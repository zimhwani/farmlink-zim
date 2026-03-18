import { useState, useEffect, useRef, useCallback } from "react";

const SUPABASE_URL = "https://buyvgrxgseubplqesvjp.supabase.co";
const SUPABASE_KEY = "sb_publishable_TJH0e7GMsengGdAUjG5HYg_hkpBrBxA";

// Auth helpers using Supabase GoTrue
const auth = {
  async sendOtp(identifier) {
    const isEmail = identifier.includes("@");
    // Pass shouldCreateUser and explicitly set no redirect URL to force OTP code mode
    const body = isEmail
      ? { email: identifier, options: { shouldCreateUser: true, emailRedirectTo: null } }
      : { phone: identifier.replace(/\s/g, ""), options: { shouldCreateUser: true } };
    const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, create_user: true }),
    });
    return res.ok ? { error: null } : { error: await res.json() };
  },
  async verifyOtp(identifier, token) {
    const isEmail = identifier.includes("@");
    const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: isEmail ? "email" : "sms",
        [isEmail ? "email" : "phone"]: identifier.replace(/\s/g, ""),
        token,
      }),
    });
    const data = await res.json();
    if (data.access_token) {
      localStorage.setItem("fl_token", data.access_token);
      localStorage.setItem("fl_user", JSON.stringify(data.user));
      return { user: data.user, error: null };
    }
    return { user: null, error: data };
  },
  getUser() {
    try { return JSON.parse(localStorage.getItem("fl_user")); } catch { return null; }
  },
  getToken() { return localStorage.getItem("fl_token"); },
  signOut() { localStorage.removeItem("fl_token"); localStorage.removeItem("fl_user"); },
};

const db = {
  async get(table, params = "") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    });
    return res.json();
  },
  async post(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async patch(table, id, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
    });
    return res.json();
  },
  async uploadImage(file) {
    const ext = file.name.split(".").pop();
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const bucket = file.type.startsWith("video/") ? "listing-media" : "produce-images";
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${filename}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": file.type },
      body: file,
    });
    if (res.ok) return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filename}`;
    return null;
  },
  async uploadMedia(files) {
    const urls = await Promise.all(Array.from(files).map(f => this.uploadImage(f)));
    return urls.filter(Boolean);
  },
};

const PROVINCES = {
  "Mashonaland Central": ["Bindura", "Guruve", "Mazowe", "Mount Darwin", "Rushinga"],
  "Mashonaland East": ["Chikomba", "Goromonzi", "Hwedza", "Marondera", "Mudzi"],
  "Mashonaland West": ["Chegutu", "Hurungwe", "Kariba", "Makonde", "Zvimba"],
  "Manicaland": ["Buhera", "Chimanimani", "Chipinge", "Makoni", "Mutare"],
  "Midlands": ["Gweru", "Kwekwe", "Mberengwa", "Shurugwi", "Zvishavane"],
  "Masvingo": ["Bikita", "Chiredzi", "Gutu", "Masvingo", "Mwenezi"],
  "Matabeleland North": ["Binga", "Bubi", "Hwange", "Lupane", "Nkayi"],
  "Matabeleland South": ["Beitbridge", "Bulilima", "Gwanda", "Insiza", "Matobo"],
  "Bulawayo": ["Bulawayo Urban"],
  "Harare": ["Harare Urban", "Chitungwiza"],
};

const CROPS = ["Maize", "Tobacco", "Soya Beans", "Cotton", "Sunflower", "Wheat", "Sorghum", "Groundnuts", "Sweet Potatoes", "Vegetables"];
const LIVESTOCK = ["Cattle", "Goats", "Sheep", "Pigs", "Poultry (Broilers)", "Poultry (Layers)", "Rabbits", "Fish (Aquaculture)"];

const PRICE_ALERTS = [
  { crop: "Maize", change: "+12%", price: "USD 298/t", trend: "up", region: "Harare GMB" },
  { crop: "Tobacco", change: "+8%", price: "USD 3.85/kg", trend: "up", region: "Auction Floors" },
  { crop: "Soya", change: "-3%", price: "USD 492/t", trend: "down", region: "Bulawayo" },
  { crop: "Cotton", change: "+5%", price: "USD 0.68/kg", trend: "up", region: "Cottco" },
];

const CHAT_STARTERS = [
  "My maize leaves are turning yellow, what's wrong?",
  "Best time to plant tobacco in Mashonaland?",
  "My cattle have ticks, local treatment options?",
  "How much fertiliser for 2 hectares of maize?",
];

const CROP_EMOJIS = {
  "Maize": "🌽", "Tobacco": "🍂", "Soya Beans": "🫘", "Cotton": "🌼", "Sunflower": "🌻",
  "Wheat": "🌾", "Sorghum": "🌾", "Groundnuts": "🥜", "Sweet Potatoes": "🍠", "Vegetables": "🥦",
  "Coffee Beans": "☕", "Tomatoes": "🍅", "Cattle": "🐄", "Goats": "🐐", "Sheep": "🐑",
  "Pigs": "🐷", "Poultry (Broilers)": "🐔", "Poultry (Layers)": "🥚", "Rabbits": "🐇", "Fish (Aquaculture)": "🐟",
};

// Zimbabwe map districts with approximate SVG path positions (lat/lng to rough x/y on Zimbabwe bounding box)
// Zimbabwe bounds: lat -15.6 to -22.4, lng 25.2 to 33.1
const maskName = (name) => {
  if (!name) return name;
  const parts = name.trim().split(" ");
  if (parts.length === 1) return name;
  return parts[0] + " " + parts.slice(1).map(p => "*".repeat(p.length)).join(" ");
};

function latLngToSVG(lat, lng, w = 340, h = 280) {
  const x = ((lng - 25.2) / (33.1 - 25.2)) * w;
  const y = ((lat - (-15.6)) / ((-22.4) - (-15.6))) * h;
  return { x, y };
}

export default function FarmLinkZim() {
  const [activeTab, setActiveTab] = useState("home");
  const [wizardStep, setWizardStep] = useState(1);
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [ward, setWard] = useState("");
  const [selectedCrops, setSelectedCrops] = useState([]);
  const [selectedLivestock, setSelectedLivestock] = useState([]);
  const [farmSize, setFarmSize] = useState("");
  const [farmerName, setFarmerName] = useState("");
  const [farmerPhone, setFarmerPhone] = useState("");
  const [cropDetails, setCropDetails] = useState({});
  const [chatMessages, setChatMessages] = useState([
    { role: "ai", text: "Mhoro! I'm FarmLink AI — your local agricultural advisor. Ask me anything about crops, livestock, weather, or markets in Zimbabwe. 🌱" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [registrationDone, setRegistrationDone] = useState(false);
  const [registeredFarmer, setRegisteredFarmer] = useState(null);
  const [filterCrop, setFilterCrop] = useState("All");
  const [listings, setListings] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [farmerCount, setFarmerCount] = useState(0);
  const [listingCount, setListingCount] = useState(0);
  const [loadingListings, setLoadingListings] = useState(true);
  const [showListingModal, setShowListingModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(null);
  const [showFarmerMap, setShowFarmerMap] = useState(false);
  const [showListingDetail, setShowListingDetail] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [authUser, setAuthUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [weather, setWeather] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);
  useEffect(() => { loadListings(); loadCounts(); loadFarmers(); fetchWeather(); checkAuth(); loadNotifications(); }, []);

  const checkAuth = () => {
    try {
      const user = auth.getUser();
      if (user) setAuthUser(user);
    } catch (e) {}
  };

  const fetchWeather = async () => {
    try {
      const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=-17.83&longitude=31.05&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&timezone=Africa%2FHarare&forecast_days=6");
      const data = await res.json();
      setWeather(data.daily);
    } catch (e) { console.error("Weather fetch failed", e); }
  };

  const getWeatherIcon = (code) => {
    if (code === 0) return "☀️";
    if (code <= 2) return "⛅";
    if (code <= 48) return "🌫️";
    if (code <= 67) return "🌧️";
    if (code <= 77) return "🌨️";
    if (code <= 82) return "🌦️";
    return "⛈️";
  };

  const loadListings = async () => {
    setLoadingListings(true);
    try {
      const data = await db.get("listings", "?active=eq.true&order=created_at.desc");
      setListings(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    setLoadingListings(false);
  };

  const loadFarmers = async () => {
    try {
      const data = await db.get("farmers", "?select=id,name,province,district,ward,latitude,longitude,farmer_crops(id,crop_name,type,hectares,head_count,crop_stage)&order=created_at.desc");
      setFarmers(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  };

  const loadCounts = async () => {
    try {
      const f = await db.get("farmers", "?select=id");
      const l = await db.get("listings", "?select=id&active=eq.true");
      setFarmerCount(Array.isArray(f) ? f.length : 0);
      setListingCount(Array.isArray(l) ? l.length : 0);
    } catch (e) {}
  };

  const toggleItem = (list, setList, item) => setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);

  const loadNotifications = async () => {
    try {
      const data = await db.get("notifications", "?order=created_at.desc&limit=20");
      setNotifications(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
  };

  const markNotificationRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await db.patch("notifications", id, { read: true });
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/notifications?read=eq.false`, {
        method: "PATCH",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
    } catch (e) { console.error(e); }
  };

  const registerFarmer = async () => {
    try {
      const coords = await db.get("district_coordinates", `?district=eq.${encodeURIComponent(district)}&limit=1`);
      const coord = Array.isArray(coords) && coords[0];
      const [farmer] = await db.post("farmers", {
        name: farmerName, phone: farmerPhone || null, province, district, ward,
        farm_size_hectares: farmSize ? parseFloat(farmSize) : null, sms_alerts: true,
        latitude: coord?.latitude || null, longitude: coord?.longitude || null,
      });
      if (farmer?.id) {
        const cropRows = [
          ...selectedCrops.map(c => ({
            farmer_id: farmer.id, crop_name: c, type: "crop",
            hectares: cropDetails[c]?.hectares ? parseFloat(cropDetails[c].hectares) : null,
            crop_stage: cropDetails[c]?.stage || null,
          })),
          ...selectedLivestock.map(l => ({
            farmer_id: farmer.id, crop_name: l, type: "livestock",
            head_count: cropDetails[l]?.head_count ? parseInt(cropDetails[l].head_count) : null,
            crop_stage: cropDetails[l]?.stage || null,
          })),
        ];
        if (cropRows.length > 0) await db.post("farmer_crops", cropRows);
        setRegisteredFarmer(farmer);
        setRegistrationDone(true);
        loadCounts(); loadFarmers();
      }
    } catch (e) { console.error("Registration error:", e); }
  };

  const sendChat = async (text) => {
    const msg = text || chatInput;
    if (!msg.trim()) return;
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: msg }]);
    setIsTyping(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          system: `You are FarmLink AI, an expert agricultural advisor specialised in Zimbabwe farming. You have deep knowledge of Zimbabwe's agro-ecological regions, local crops (maize, tobacco, cotton, soya, groundnuts), livestock management, AGRITEX recommendations, ZFU guidelines, local pests (armyworm, stalk borer, ticks, Newcastle disease), GMB pricing, Tobacco auction floors, conservation farming and the Pfumvudza/Intwasa programme. Always give practical, locally relevant advice. Keep responses concise (3-5 sentences) and actionable. Occasionally use Shona/Ndebele words naturally.`,
          messages: [{ role: "user", content: msg }]
        })
      });
      const data = await response.json();
      setIsTyping(false);
      setChatMessages(prev => [...prev, { role: "ai", text: data.content?.[0]?.text || "Sorry, please try again." }]);
    } catch {
      setIsTyping(false);
      setChatMessages(prev => [...prev, { role: "ai", text: "Network error. Offline tip: for tick control on cattle, use Triatix or Deltamethrin dip every 7 days during peak season." }]);
    }
  };

  const resetRegistration = () => {
    setRegistrationDone(false); setWizardStep(1); setFarmerName(""); setFarmerPhone("");
    setProvince(""); setDistrict(""); setWard(""); setSelectedCrops([]); setSelectedLivestock([]); setFarmSize(""); setRegisteredFarmer(null);
  };

  const TABS = [
    { id: "home", icon: "🛖", label: "Home" },
    { id: "market", icon: "🛒", label: "Marketplace" },
    { id: "diary", icon: "📓", label: "Farm Diary" },
    { id: "advisory", icon: "🤖", label: "AI Advisor" },
    { id: "insights", icon: "📊", label: "Insights" },
    { id: "prices", icon: "📈", label: "Price Feeds" },
    { id: "calendar", icon: "🗓️", label: "Planting Calendar" },
    { id: "register", icon: "📍", label: "Register Farm" },
    { id: "admin", icon: "⚙️", label: "Admin" },
  ];

  return (
    <div>
      <div className="app-shell">

        {/* ── DESKTOP SIDEBAR ── */}
        <div className="sidebar">
          {/* Logo */}
          <div style={{ padding: "0 20px 24px", borderBottom: "1px solid #1f3525" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #2d7a4f, #1a5c36)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🌿</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#c8e8d4" }}>FarmLink <span style={{ color: "#7ec99a" }}>Zim</span></div>
                <div style={{ fontSize: 8, fontFamily: "'Space Mono', monospace", color: "#4a7a5a", letterSpacing: "0.1em" }}>AGRICULTURAL MARKETPLACE</div>
              </div>
            </div>
          </div>

          {/* Nav items */}
          <nav style={{ flex: 1, paddingTop: 12 }}>
            {TABS.map(tab => (
              <button key={tab.id} className={`sidebar-nav-btn ${activeTab === tab.id ? "active" : ""}`} onClick={() => setActiveTab(tab.id)}>
                <span className="sidebar-nav-icon">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Bottom sidebar info */}
          <div style={{ padding: "16px 20px", borderTop: "1px solid #1f3525" }}>
            <div style={{ fontSize: 10, color: "#3d6b4a", marginBottom: 6, fontWeight: 600, letterSpacing: "0.08em" }}>PLATFORM STATUS</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#5cd68a" }} className="pulse" />
              <span style={{ fontSize: 11, color: "#5c8f6b" }}>Live · Farmlink connected</span>
            </div>
            <div style={{ borderTop: "1px solid #1a2e1e", paddingTop: 10 }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
                <button onClick={() => setActiveTab("legal-tos")} style={{ background: "none", border: "none", color: "#3d6b4a", fontSize: 10, cursor: "pointer", padding: 0, textDecoration: "underline" }}>Terms of Service</button>
                <button onClick={() => setActiveTab("legal-pp")} style={{ background: "none", border: "none", color: "#3d6b4a", fontSize: 10, cursor: "pointer", padding: 0, textDecoration: "underline" }}>Privacy Policy</button>
              </div>
              <div style={{ fontSize: 10, color: "#2d5236" }}>© {new Date().getFullYear()} FarmLink Zim</div>
            </div>
          </div>
        </div>

        {/* ── MAIN AREA ── */}
        <div className="main-area">

          {/* Top bar */}
          <div className="top-bar">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              {/* Mobile logo */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }} className="mobile-logo">
                <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #2d7a4f, #1a5c36)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🌿</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: "#c8e8d4" }}>FarmLink <span style={{ color: "#7ec99a" }}>Zim</span></div>
                  <div style={{ fontSize: 9, fontFamily: "'Space Mono', monospace", color: "#4a7a5a", letterSpacing: "0.1em" }}>AGRICULTURAL MARKETPLACE</div>
                </div>
              </div>
              {/* Desktop spacer */}
              <div style={{ flex: 1 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ position: "relative" }}>
                  <div onClick={() => { setShowNotifications(v => !v); if (!showNotifications) loadNotifications(); }}
                    style={{ background: "#152218", border: "1px solid #1f3525", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer", position: "relative" }}>
                    🔔
                    {notifications.filter(n => !n.read).length > 0 && (
                      <span style={{ position: "absolute", top: -4, right: -4, background: "#e07060", borderRadius: "50%", width: 16, height: 16, fontSize: 9, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>
                        {notifications.filter(n => !n.read).length}
                      </span>
                    )}
                  </div>
                  {showNotifications && (
                    <NotificationPanel
                      notifications={notifications}
                      onClose={() => setShowNotifications(false)}
                      onMarkRead={markNotificationRead}
                      onMarkAllRead={markAllRead}
                    />
                  )}
                </div>
                <button onClick={() => setShowAuthModal(true)} style={{ background: authUser ? "#1a3d24" : "#152218", border: `1px solid ${authUser ? "#2d7a4f" : "#1f3525"}`, borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontFamily: "'Space Mono', monospace", color: authUser ? "#7ec99a" : "#4a7a5a", display: "flex", alignItems: "center", gap: 5 }}>
                  {authUser ? <>👩🏾‍🌾 <span style={{ maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{authUser.name?.split(" ")[0] || "Profile"}</span></> : "👤 Login"}
                </button>
              </div>
            </div>
          </div>

          {/* Page content */}
          <div className="page-content">
            {activeTab === "home" && <HomeTab setActiveTab={setActiveTab} farmerCount={farmerCount} listingCount={listingCount} weather={weather} getWeatherIcon={getWeatherIcon} onFarmerMapClick={() => setShowFarmerMap(true)} />}
            {activeTab === "market" && <MarketTab listings={listings} loadingListings={loadingListings} filterCrop={filterCrop} setFilterCrop={setFilterCrop} setShowListingModal={setShowListingModal} setShowContactModal={setShowContactModal} setShowListingDetail={setShowListingDetail} authUser={authUser} loadListings={loadListings} />}
            {activeTab === "diary" && <FarmDiaryTab authUser={authUser} setActiveTab={setActiveTab} />}
            {activeTab === "register" && <RegisterTab wizardStep={wizardStep} setWizardStep={setWizardStep} province={province} setProvince={setProvince} district={district} setDistrict={setDistrict} ward={ward} setWard={setWard} selectedCrops={selectedCrops} setSelectedCrops={setSelectedCrops} selectedLivestock={selectedLivestock} setSelectedLivestock={setSelectedLivestock} farmSize={farmSize} setFarmSize={setFarmSize} farmerName={farmerName} setFarmerName={setFarmerName} farmerPhone={farmerPhone} setFarmerPhone={setFarmerPhone} toggleItem={toggleItem} registrationDone={registrationDone} registeredFarmer={registeredFarmer} registerFarmer={registerFarmer} resetRegistration={resetRegistration} cropDetails={cropDetails} setCropDetails={setCropDetails} />}
            {activeTab === "advisory" && <AdvisoryTab chatMessages={chatMessages} chatInput={chatInput} setChatInput={setChatInput} sendChat={sendChat} isTyping={isTyping} chatEndRef={chatEndRef} />}
            {activeTab === "prices" && <PriceFeedsTab />}
            {activeTab === "calendar" && <CalendarTab />}
            {activeTab === "insights" && <div style={{ background: "#0d1a0f", minHeight: "100vh", color: "#e8dfc8" }}><InsightsTab /></div>}
            {activeTab === "admin" && <AdminTab farmers={farmers} listings={listings} />}
            {activeTab === "legal-tos" && <LegalTab page="tos" setActiveTab={setActiveTab} />}
            {activeTab === "legal-pp" && <LegalTab page="pp" setActiveTab={setActiveTab} />}
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <div className="bottom-nav">
        {TABS.map(tab => (
          <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? "active" : ""}`} style={{ color: "#3d6b4a" }} onClick={() => setActiveTab(tab.id)}>
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.id === "advisory" ? "AI" : tab.label}</span>
          </button>
        ))}
      </div>

      {showListingModal && <ListingModal onClose={() => setShowListingModal(false)} onSave={async (listing) => { await db.post("listings", listing); setShowListingModal(false); loadListings(); loadCounts(); }} />}
      {showContactModal && <ContactModal listing={showContactModal} onClose={() => setShowContactModal(null)} onSend={async (msg) => { await db.post("messages", { listing_id: showContactModal.id, ...msg }); await db.post("notifications", { type: "message", title: "New buyer enquiry", body: `${msg.sender_name} is interested in your ${showContactModal.crop} listing (${showContactModal.quantity} at ${showContactModal.price})`, read: false }); loadNotifications(); setShowContactModal(null); }} />}
      {showFarmerMap && <FarmerMapModal farmers={farmers} onClose={() => setShowFarmerMap(false)} loadFarmers={loadFarmers} />}
      {showListingDetail && <ListingDetailModal listing={showListingDetail} onClose={() => setShowListingDetail(null)} onContact={() => { setShowContactModal(showListingDetail); setShowListingDetail(null); }} />}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} authUser={authUser} onAuth={(user) => { setAuthUser(user); setShowAuthModal(false); }} onLogout={() => { auth.signOut(); setAuthUser(null); setShowAuthModal(false); }} setActiveTab={setActiveTab} />}
    </div>
  );
}

// ─── FARMER MAP MODAL ──────────────────────────────────────────────────────────
// Convert real lat/lng to pixel coords within the simplemaps SVG viewBox (1000x861)
// simplemaps ZW SVG uses Mercator: bounds approx lng 25.2–33.1, lat -15.6 to -22.4
// Their viewBox is "0 0 1000 861" scaled to those bounds
function toMapXY(lat, lng) {
  const x = ((lng - 25.2) / (33.1 - 25.2)) * 1000;
  const y = ((lat - (-15.6)) / ((-22.4) - (-15.6))) * 861;
  return { x, y };
}

// ─── FARMER MAP MODAL (using real simplemaps SVG paths) ────────────────────────

// Convert lat/lng to the simplemaps SVG coordinate space
// viewBox="0 0 1000 918"
// We derive from the label_points in the SVG:
//   Harare: cx=724, cy=313.6  → lat=-17.829, lng=31.052
//   Bulawayo: cx=433.8, cy=595.2  → lat=-20.15, lng=28.583
// Using two known points to derive scale:
//   Δlng = 31.052-28.583 = 2.469  →  Δx = 724-433.8 = 290.2  →  scale_x = 290.2/2.469 = 117.5
//   Δlat = -17.829-(-20.15) = 2.321  →  Δy = 313.6-595.2 = -281.6  →  scale_y = -281.6/2.321 = -121.3
//   origin: x = 724 - (31.052 * 117.5) = 724 - 3648.6 = -2924.6
//           y = 313.6 - (-17.829 * -121.3) = 313.6 - 2162.5 = -1848.9
function latLngToMapXY(lat, lng) {
  const scaleX = 117.5;
  const scaleY = -121.3;
  const originX = -2924.6;
  const originY = -1848.9;
  return {
    x: originX + lng * scaleX,
    y: originY + lat * scaleY,
  };
}

const ZW_PROVINCES = {
  ZWMN: "M371.2 193.1l0.4 0.9 1.9 8.9-0.7 4.5-0.4 1.1-0.1 0.6 0 0.2 0 0.2 0.5 0.4 1.8 1 0.7 0.8 0.1 1.1-1.5 4.2-0.4 2.1 0 0.6 0.2 0.5 0.4 0.5 1 0.6 1.6 0.6 0.6 0.5 0.5 0.8 0.5 1.4 0.4 0.9 0.5 0.6 0.8 0.3 0.7 0 0.6-0.2 0.6 0 0.7 0.1 1.3 0.4 0.5 0.4 0.3 0.5-0.1 0.8-0.4 1.4 0 0.8 0.1 0.8 0.3 0.7 0.7 1 0.3 0.9 0 1.2-0.5 1.4 0 0.7 0.3 0.7 0.8 0.9 0.4 0.8 0 1 0 2 0.6 2.1 0.2 1.2 0.3 1.1 0.4 0.7 2.3 1.7 1.1 1.4 1.3 0.8 1 0.5 0.9 0.2 0.7 0.8 0.5 0.7 1.4 5.3-0.3 4.5-0.2 1.1-1 2.5-0.1 1.5-0.1 0.6-0.3 0.4-0.4 0.4-0.1 0.1-0.6 2.2-0.8 1.9-0.2 0.7 0 0.9 0.1 1 0.4 1.6 0 1 0 0.8-0.2 0.6-0.7 1-0.2 0.5-0.6 3-0.7 1.9 0 0.9 0.8 2.8 0 1-0.2 0.7-3.2 3.5-1.8 1.6-0.8 0.8-0.4 0.4-0.5 0.2-0.5-0.2-0.4-0.3-0.5-0.5-0.5-0.2-0.5-0.1-0.6 0.2-0.5 0.3-3 2.8-0.3 0.6-0.3 1.4-0.5 1.3-0.1 0.7 0 0.9 1.3 5.8 0 1.1-0.1 0.8-1.5 2.9-1 2.5 0 0.7 0 0.9 0.2 1.1-0.1 0.8-0.3 0.5-0.6 0.3-0.5 0.3-0.5 0.4-0.3 0.4-0.2 0.7-0.3 1.4-0.2 0.7-0.3 0.5-0.4 0.5-0.4 0.4-1.9 1.5-0.3 0.3-0.4 0.6 0 0.1-0.1 0.2 0 0.5 0.1 0.7 0.6 2 0.3 1.7 0.3 0.7 0.5 0.7 1.1 0.7 0.7 0.1 0.7-0.1 0.6-0.3 0.6-0.1 0.6 0.1 0.4 0.5 0.3 0.9-0.1 2.5 0.2 1.4 0.6 1.7 0.2 0.7-0.1 0.6-0.2 0.7-0.3 0.5-0.5 0.4-0.9 0.7-0.4 0.4-0.4 0.5-0.2 0.6 0.2 0.8 0.4 0.7 1.2 0.8 1 0.4 2.4 0.5 0.6 0.4 0.6 0.4 0.3 1-0.3 0.4-0.5 0.2-6.2 0.7-3.3 0.7-0.6 0.4-0.5 0.6-0.4 35.9 0.2 1.7 0.4 1.8 1.3 1.1 0.9 0.6 0.9 0.3 0.8 0.1 1.4 0.1 6.2-0.9 0.7 0 0.7 0.2 1.8 0.8 1.5 0.4 4.7 0.3 1.5 0.2 2.1 0.7 11.7 0.3 1.4 0.3 0.8 0.1 1.4-0.1 2.6-0.5 6.1 0 2.2 0.4 1.6 0.1 4.8-0.2 1-0.2 3.6-1.2 0.7-0.1 7.3 0.1 0.6-0.1 2.1-0.2 1.4-0.3 2.4-0.8 0.7-0.1 0.7 0 0.7 0.1 0.7 0.2 1.2 0.6 2.1 0.6 1.7 0.2 43.4-0.5 1.1 0.2 0.8 0.5 1.6 2.9 0.5 1.4 0.1 1.2-0.6 1.3-1 0.8-20.4 8.7-6.3 1.5-1.2 0.5-0.8 1.1 0 2.3 6.8 31 0.4 1.5 0.7 1.4 0.9 0.9 0.8 0.4 1.4 0.6 0.9 0.8 0.9 1.3 2.5 4.3 0.4 1 0 1.1-0.2 0.9-0.1 0.8-0.4 0.6-0.7 1-0.5 0.5-0.3 0.6-0.1 0.6 0 3.5 0 0.3 0.2 0.5 1 1.4 1.4 1.1 10.5 11.4 0.7 1.2 0.3 0.8 0 1.5-0.3 0.9-2.5 4.1 0.5 0.9 14.6 14.1-1 2.1-0.6 0.7-1.2 0.8-0.9 0.2-0.9-0.2-0.8-0.5-0.7-0.5-1-0.6-1.2-0.4-3.8-0.8-0.7 0-0.9 0.1-0.7 0.2-0.6 0.5-0.4 0.6 0 1.4 0.4 0.9 0.6 0.8 1.7 1.7 0.8 0.9 0.4 0.9 0.2 1-0.1 1-0.4 1.9-0.6 1.1-1 1.3-5.1 4.6-0.5 0.5-0.3 0.7 0.3 1 0.5 0.6 1.5 1.6 0.8 0.6 1 0.6 0.7 0.6 0.3 0.9 0.1 1.4-0.1 4.9-0.2 1-0.5 1.9-0.9 2.3 0 0.8-0.4 0.9-0.7 1-2.7 2-1.5 0.6-1.3 0.3-7-1.3-0.6 0-0.4 0.4 0 0.8 0.1 0.7 0.5 1.2 1.6 6.5 1.1 2.7 0 0.4 0 0.5-0.3 0.6-2 3.3-1.4 1.1-8.1 4.7-5.1 2.1-0.5 0.3-0.4 0.6-0.3 0.9 0 0.8 0.1 0.7 0.7 2.5 0 0.7-0.3 0.7-11.5 13.9-2.1 2.1-1.9 1.5-0.8 1.8-3.1 3.4-1.6 0.2-0.8-0.2-6-4.9 7.7-1.8 2-0.8 0.8-0.7 0.6-0.7 0.4-0.7 0.3-0.7 0-0.6-0.3-0.6-0.4-0.5-2.3-1.5-0.4-0.4-0.4-0.5 0-0.5 0.1-0.6 0.1-0.4 0.7-1.4 0.4-0.9 0.2-0.8-0.1-0.6-0.3-0.4-0.8-0.3-0.8-0.3-0.4-0.4-0.2-0.5-0.2-1.5-0.5-0.4-0.7 0-1.6 0.8-0.8 0.2-0.9 0-0.8-0.4-1.2-1-0.5-0.3-0.7-0.1-0.6-0.1-0.5-0.1-0.3-0.2-0.3-0.4-0.1-0.3 0-0.4 0.1-0.4 0.1-1.5 0.1-0.6 0.4-1-0.1-0.3-0.4-0.2-0.7 0-2.2 0.8-2.6 0.4-0.7 0.3-1.4 1.3-0.8 0.4-0.9 0-1.1-0.3-6.6-3.6-0.9-0.2-0.5 0-0.4 0.3-0.1 0.6 0.1 1.5 1.1 4.5 0 1.1-0.2 0.7-0.5 1.2-0.2 0.9-0.1 0.9 0.1 1.3-0.5 0.8-0.7 0.5-1.5 1-0.4 0.5 0.1 0.6 0.6 0.6 1.4 0.4 0.9 0.1 1.5 0 0.9 0 2 0.6 0.7 0 0.6-0.1 1.4-0.6 1-0.1 0.8 0.3 0.9 1.4 1.1 1.2 0.2 1.2-1.5 3.4-3 1.3-15.6 11.8-0.8 0.2-0.6-0.6-1.2-2.4-0.5-2-0.5-1.2-0.3-0.5-1.4-1.9-1.3-1.3-0.3-0.5-0.2-0.7-0.2-0.6-0.5-0.4-0.6-0.3-0.5-0.4-0.5-0.3-0.4-0.5-0.2-0.5-0.3-0.8-0.2-0.4-2.4-2-2.4-2.7-0.3-0.5-0.2-1.5-0.1-0.6-0.3-0.5-0.8-1-0.2-0.7-0.1-0.7-0.2-0.6-0.3-0.5-0.4-0.4-0.6-0.4-1.7-0.7-0.6-0.3-0.4-0.4-0.3-0.6-0.5-1.2-0.3-0.5-0.3-0.3-0.3 0-0.6 0.1-3.9 1.7-1.2 0.2-4.9 0.1-1.1 0.4-4.3 2.2-0.5 0-0.6-0.3-4.1-6.4-0.6-0.8-0.5 0.5-0.4 0.9-1.6 5-0.8 3.8-0.2 3.6-0.3 1.2-0.6 0.7-3.6-0.1-4.7-0.8-1.6-0.5-1.4-0.9-0.5-0.6-0.4-0.6-0.4-0.4-0.5-0.4-2.7-1.5-1.9-1.5-8.6-8.4-1.9-1.5-2.1-1.3-0.9-0.8-4.1-4.5-2.3-3.6-0.7-0.6-0.7-0.6-0.8-0.9-0.3-0.6-0.2-0.6-0.3-2.2-0.1-1.6-0.1-0.7-0.2-0.7-0.4-0.6-0.4-0.4-1.5-1.1-0.7-0.9-0.4-0.6-0.7-1-1-0.4-1.4-0.4-3.1-0.4-2.6-0.6-1.6-0.9-4-2.8-2.2-1.2-2.3-0.6-6.3-0.8-0.9 0.1-0.8 0.2-1 0.6-1.6 1.4-0.8 0.2-1.1 0.2-1.9-0.2-2-0.4-1.8 0-1.3 0.3-1.3-0.3-0.8-0.3-0.6-0.4-0.6-0.3-0.7-0.1-0.8 0-2.9-0.5-16.2 2-2.5-0.5-2-0.2-2.2 0.1-22.7 5.5-1.9 0.7-3.7 2.1-1.2 0.7-1.3-0.2-0.3 0-0.1 0-1.2-0.7-5.3-1.5-0.8-0.4-0.2-0.1-0.3-0.6-0.3-0.4-0.3-0.6 0-0.4-0.2-0.4-0.3-0.7-0.4-0.7-0.2-0.7-0.1-0.4 0-0.5-0.1-0.3-0.2-0.6-0.2-0.6-0.2-0.3-0.3-0.5-0.3-0.2-0.3-0.4-0.2-0.1-0.5-0.5-0.7-0.3 0.1-0.3 0-0.1-0.2 0-0.3 0.1-0.1 0-0.9 0-0.1 0.1-1.5-0.9 0-0.4 0-0.2-0.3-0.2-1-0.1-1.8-1.2-2.2-0.9-4.6-1-2.2-0.9-2.1-2-0.1-0.4-0.1-0.2 0-0.4 0-0.3-0.3-0.7-0.1-0.2-0.1-0.2-0.1-0.3 0-0.3-0.2-0.3-0.2-0.4-0.1-0.2-0.4-0.3-0.5-0.4-0.1-0.6-0.2-0.8-0.5-0.3-0.9 0.3-0.3 0-0.4 0.1-0.2 0-1.1-0.6-3.5-0.6-0.5-0.2 0.1-0.1-0.2-0.3 0.1-0.3 0.1-0.5 0.2-0.6 0.2-0.3 0.2-0.1 0.1-0.2 0.3-0.7 0.5-0.7 0.7-1 0.4-0.4 0.1-0.1 0.2-0.1 0.2-0.1 0.3-0.2-0.1-0.3-0.8-0.3-0.6-0.2-0.4-0.3-0.3-0.2-0.5-0.3-0.6-0.6-0.7-0.5-0.4-0.8-0.4-0.6-0.5-0.7-0.4 0-0.7 0.1-1.2-0.5-6.3-0.1-2.1-0.6-0.2-0.3-0.3-0.1-0.2-0.1-0.2 0-0.4-0.1-0.4 0-0.1 0-0.2 0-0.1-0.1-0.6-0.4-1.4-0.9-0.5-0.1-0.3-0.2-0.7-0.3-0.1 0.1-0.2-0.1 0-0.1-0.2-0.3-0.1-0.1-0.2-0.4-0.1-0.6-0.1-0.4-0.5-1 0.1-0.8-0.2-0.9-0.2-0.6-0.4-0.2 0-0.1 0-0.4 0-0.2-0.3-0.7-0.1-1-0.1-0.5 0-0.2-0.1-0.2 0-0.1 0-0.4-0.4-1.7-0.1-0.4-0.2-0.1-0.1-0.8 0-0.6 0-0.5-0.3-0.4-0.5-0.3-0.2-0.3-0.2-0.1-0.6-0.1 0-0.2 0-0.1-0.1-0.7-0.1-0.3-0.1-0.2-0.3-1-0.2-0.6-0.2-0.9-0.1-0.9-0.3-0.3-0.1-0.5-0.2-0.7-0.1-0.9-0.1-0.3-0.1-0.6-0.4-0.4-0.4-0.6-0.5-0.7 0-0.2-0.4-0.9-0.2-0.8-0.1-0.3 0-0.2 0-0.2-0.1-0.3-0.5-0.8-0.1-0.4-0.6-1-0.3-0.9-0.4-0.8 0-0.4 0-0.5-0.1-0.7-0.2-0.1 0-0.8-0.2-0.3-0.8-0.6-0.3-0.4-0.4-0.9-0.2-0.4-0.4-0.6-1-1.2 0-0.2 0.1-0.5 0-0.7 0-1.2-0.3-0.6-0.3-0.5-0.6-0.8-0.6-0.8-0.6-0.6-0.1-0.2-0.2-0.2 0-0.1-0.2-0.1-0.2-0.6-0.4-0.4-0.4-0.5-0.3-0.4-0.3-0.4-0.3-0.4-0.2-0.3-0.3-0.3-0.2-0.2-0.3-0.4-0.2-0.6-0.3-0.1-0.3-0.3-0.2-0.3-0.6-0.6-0.4-0.4-0.3-0.2-0.1-0.6-0.1-0.5-0.1-0.5-0.3-0.4-0.4-0.7-0.2-0.2-0.1-0.5 0-0.9-0.2-0.8 0-0.7 0-0.4 0.1-0.4 0.3-0.3 0.1-0.5-0.1-0.6 0.2-0.4 0.5-0.7 0.4-0.6 0.5-0.4 0.2-0.2 0.5-0.5 0.5-0.5 0.4-0.5 0.3-0.3 0.1-0.1 0.1-0.1-0.1-0.2 0-0.3-0.1-0.2-0.1-0.3-0.2-0.7-0.1-0.2 0-0.3-0.3-1.3 0-0.2 0-0.2-2.5 0-3.1-9.7-8.5-7.7-5.3-4.8-0.8-0.6-4.2-9.3-0.7-9-1.3-4.3-2.9-2.6-4.5-2.3-3.3-3-5.5-7.9-1.6-1.7-4-2.7-7.6-8.1-1.5-2.5-0.6-1.6-1.1-5.2-0.9-2.4-3.8-6.2-3.7-9.4-2.5-4.5-3.5-2.9-4-2.3-3.1-3.5-4.8-8.2-3.4-8.5-0.7-2.9 0-3.4 4.7-10.5 0.4 0.5 0.4 0.4 2.1 1 3.6 2.8 2.3 1.1 1.1 0.1 3.6-0.1 3.9 1.4 1.2 0.2 8.8 0 0.6 0.2 1 0.6 0.8 0.1 0.6-0.2 1.1-1.1 0.6-0.3 7.8-1.5 6.2-2.8 2.8-0.3 1.5 1 1.5 1.3 4.3 1.1 2.6 1.3 2.3 1.5 1 1.3 1.1 1.9 5.3 2.3 1.6 2.1-1.9 0.6-0.1 1.8 0.8 2 1.2 1.4 7.1 3.3 4.9 0.2 1.4-0.2 6.4-3.3 0.8 0.8 0.7-1.5 1.8-0.4 2.2 0 1.6-0.5 0.1-0.5-0.2-1.5 0.1-0.5 0.7-0.3 2-0.5 2-1.1 2.7-0.5 1-0.6 4.2-3.2 1-0.6 1.1 0.5 0.8 1 0.6 1.1 0.7 0.8 1 0.4 5.4 0.6 1.1 0.5 0.9 0.7 0.7 0.7 0.9 0.2 4.3-0.6 5.3 1 9 4.9 4.8 1.6 3.1 0.5 1.9 0.8 1.6 1.3 1.8 2 1.6 1.4 1.8 1 6.6 2.1 1.7 0.3 1.4-0.4 3.3-3.1 1.5-0.9 1.9-0.5 2.8-0.3 11-5.1 2.7 0.9 4.3-2.8 1.2-0.5 5.5-0.3 1.7-0.5 3.2-1.7 3.5-3.4 4.3-4.2 3.9-4.9-0.3-2.8-0.1-3.1 0.1-1.2 1.2-1.8 30.8-32.3 11.9-10.9 6.2-6.3 3.1-6.1 2.4-9.7 1.9-4.2 15.8-24 4.6-5.1 6-3.6 17.9-7.8z",
  ZWMS: "M438.3 606.4l6 4.9 0.8 0.2 1.6-0.2 3.1-3.4 0.8-1.8 1.9-1.5 2.1-2.1 11.5-13.9 0.3-0.7 0-0.7-0.7-2.5-0.1-0.7 0-0.8 0.3-0.9 0.4-0.6 0.5-0.3 5.1-2.1 8.1-4.7 1.4-1.1 2-3.3 0.3-0.6 0-0.5 0-0.4-1.1-2.7-1.6-6.5-0.5-1.2-0.1-0.7 0-0.8 0.4-0.4 0.6 0 7 1.3 1.3-0.3 1.5-0.6 2.7-2 0.7-1 0.4-0.9 0-0.8 0.9-2.3 0.5-1.9 0.2-1 0.1-4.9-0.1-1.4-0.3-0.9-0.7-0.6-1-0.6-0.8-0.6-1.5-1.6-0.5-0.6-0.3-1 0.3-0.7 0.5-0.5 5.1-4.6 1-1.3 0.6-1.1 0.4-1.9 0.1-1-0.2-1-0.4-0.9-0.8-0.9-1.7-1.7-0.6-0.8-0.4-0.9 0-1.4 0.4-0.6 0.6-0.5 0.7-0.2 0.9-0.1 0.7 0 3.8 0.8 1.2 0.4 1 0.6 0.7 0.5 0.8 0.5 0.9 0.2 0.9-0.2 1.2-0.8 0.6-0.7 1-2.1-14.6-14.1 2.5-4.1 0.3-0.9 0-1.5-0.3-0.8-0.7-1.2-10.5-11.4-1.4-1.1-1-1.4-0.2-0.5 0-0.3 0-3.5 0.1-0.6 0.3-0.6 0.5-0.5 0.7-1 0.4-0.6 0.1-0.8 0.2-0.9 0-1.1-0.4-1-2.5-4.3-0.9-1.3-0.9-0.8-1.4-0.6-0.8-0.4-0.9-0.9-0.7-1.4-0.4-1.5-6.8-31 0-2.3 0.8-1.1 1.2-0.5 6.3-1.5 20.4-8.7 1-0.8 0.6-1.3-0.1-1.2-0.5-1.4-1.6-2.9-0.8-0.5-1.1-0.2-43.4 0.5-1.7-0.2-2.1-0.6-1.2-0.6-0.7-0.2-0.7-0.1-0.7 0-0.7 0.1-2.4 0.8-1.4 0.3-2.1 0.2-0.6 0.1-7.3-0.1-0.7 0.1-3.6 1.2-1 0.2-4.8 0.2-1.6-0.1-2.2-0.4-6.1 0-2.6 0.5-1.4 0.1-0.8-0.1-1.4-0.3-11.7-0.3-2.1-0.7-1.5-0.2-4.7-0.3-1.5-0.4-1.8-0.8-0.7-0.2-0.7 0-6.2 0.9-1.4-0.1-0.8-0.1-0.9-0.3-0.9-0.6-1.3-1.1-0.4-1.8-0.2-1.7 0.4-35.9 0.5-0.6 0.6-0.4 3.3-0.7 6.2-0.7 0.5-0.2 0.3-0.4-0.3-1-0.6-0.4-0.6-0.4-2.4-0.5-1-0.4-1.2-0.8-0.4-0.7-0.2-0.8 0.2-0.6 0.4-0.5 0.4-0.4 0.9-0.7 0.5-0.4 0.3-0.5 0.2-0.7 0.1-0.6-0.2-0.7-0.6-1.7-0.2-1.4 0.1-2.5-0.3-0.9-0.4-0.5-0.6-0.1-0.6 0.1-0.6 0.3-0.7 0.1-0.7-0.1-1.1-0.7-0.5-0.7-0.3-0.7-0.3-1.7-0.6-2-0.1-0.7 0-0.5 0.1-0.2 0-0.1 0.4-0.6 0.3-0.3 1.9-1.5 0.4-0.4 0.4-0.5 0.3-0.5 0.2-0.7 0.3-1.4 0.2-0.7 0.3-0.4 0.5-0.4 0.5-0.3 0.6-0.3 0.3-0.5 0.1-0.8-0.2-1.1 0-0.9 0-0.7 1-2.5 1.5-2.9 0.1-0.8 0-1.1-1.3-5.8 0-0.9 0.1-0.7 0.5-1.3 0.3-1.4 0.3-0.6 3-2.8 0.5-0.3 0.6-0.2 0.5 0.1 0.5 0.2 0.5 0.5 0.4 0.3 0.5 0.2 0.5-0.2 0.4-0.4 0.8-0.8 1.8-1.6 3.2-3.5 0.2-0.7 0-1-0.8-2.8 0-0.9 0.7-1.9 0.6-3 0.2-0.5 0.7-1 0.2-0.6 0-0.8 0-1-0.4-1.6-0.1-1 0-0.9 0.2-0.7 0.8-1.9 0.6-2.2 0.1-0.1 0.4-0.4 0.3-0.4 0.1-0.6 0.1-1.5 1-2.5 0.2-1.1 0.3-4.5-3.8-0.7-1.6 0.3-1.4 0.8-11.7 2.7-1.9 0.3-1.8-0.2-2.6-0.6-0.8 0.1-0.6 0.3-0.7 0.4-0.5-0.1-0.6-0.4-0.6-0.5-1-0.7-0.6 0-0.5 0.3-0.8 1.2-0.7 0.7-2.1 1.3-0.6 0.5-4.5 5.8-1.1 2.4-1.3 2.2-4.6 5.5-1.1 0.9-0.8 0.4-0.9 0.1-2.4-0.4-1 0.1-0.7 0.3-0.4 0.5-1 1.6-0.7 0.8-1 0.8-3.3 2.1-0.9 0.4-5.5 1.7-1.3 0.1-0.8 0-3.2-0.5-1 0-0.7 0.2-0.5 0.3-3.6 2.8-0.6 0.2-0.6-0.2-0.6-0.6-0.6-0.7-0.5-1.1-0.5-1.9-0.2-0.5-1-1.5-0.3-0.5-0.7-1.8-0.7-1-0.7-0.9-0.4-0.4-0.6-0.4-8-2.7-3.3-2.7-0.6-0.3-1.9-0.3-0.8-0.2-0.6-0.4-0.5-0.3-0.4-0.5-0.5-0.3-0.5-0.4-7.3-2.6-0.7-0.1-1.3-0.1-1 0.2-1.3 0.4-0.8 0.1-0.9-0.1-0.7-0.3-0.8-0.5-1.1-0.9-0.4-0.4-0.4-0.4-0.8-1.7-0.4-1.2-0.5-2.6-0.2-0.6-0.2-0.6-0.3-0.5-7.8-9-0.8-0.5-1-0.5-2.1-0.6-0.9-0.6-0.2-0.6 0.8-2.1 0.2-0.4 0.4-0.5 0.5-0.4 2-1.2 0.9-0.8 0.7-1 0.4-0.5 0.5-1.3 0.6-1.1 0.9-0.7 0.5-0.4 0.5-0.4 0.4-0.4 0.4-0.5 0.2-0.6-0.1-0.8-0.3-0.7-1.4-1.4-0.4-0.6-0.2-0.6-0.2-2.8 0.4-3.1-0.1-3-0.1-0.7-0.3-0.7-0.2-0.6-0.3-0.5-0.4-0.5-1.9 1.4-0.5 0.5 0 0.6 0.1 0.8 1.2 1.1 0.5 0.8 0.2 0.8-0.2 0.6-0.6 1.2-0.7 0.9-1.4 1.1-0.5 0.4-0.3 0.6-0.3 0.6-0.5 3.1-0.2 0.7-0.3 0.6-1.6 1.9-0.3 0.6-0.7 1.9-1.3 2.2-3.1 7.6-0.8 1-0.2 0.6-0.2 0.6-0.2 1.4-0.2 0.4-0.2 0.3-0.1 0.2 0 0.1-0.1 0.3 0 0.5 0.4 1.2 0.2 0.6 0.3 1.3 0 0.7-0.1 1.4 0.1 0.7 0.2 0.6 0.2 0.5 0.3 0.6 0.2 1.3 0.4 0.7 0.6 0.7 1.6 1.7 0.5 0.6 0 0.7 0.1 0.7 0.1 0.7 0.2 0.6 0.3 0.5 3.1 2.9 0.3 0.5 0.3 0.5 0.5 1.4 0.6 0.7 2.9 3.3 0.9 0.6 2.5 1.3 0.8 0.5 0.6 0.6 0.9 1.6 1.1 1.3 0.9 0.5 1.9 0.4 1.2 0.5 16 10.4 4.3 2 0.7 0.6 0.3 0.6 0.1 0.8-0.1 0.7-0.2 0.8-1.2 3.2-0.2 0.7 0 0.7 0 1.3-0.1 0.5-0.1 0.4-0.3 0.4-0.9 0.7-0.4 0.5-0.2 0.6 0 0.7 0.5 5.7-0.3 2.4-0.1 0.7 0.1 0.7 0.2 0.9 0.4 1 0.9 1.5 0.8 0.7 0.8 0.3 1.1 0.3 1.5 0.5 4.5 2.8 1.1 0.5 0.7-0.1 1.1-0.5 0.6 0 2.9 0.5 0.7 0.1 0.9 0.2 1 0.4 1.5 0.9 0.8 0.7 0.9 1 0.6 0.4 0.7 0.1 0.6-0.3 0.7-0.1 0.8 0.1 2.5 1.1 1.1 0.3 0.5 0.2 0.4 0.4 0.3 0.7 0.6 0.9 0.7 0.5 0.6 0.3 1.8 0.3 3.8 1.8 0.7 0.2 4.4 0.9 0.6 0 0.5-0.3 0.9-0.8 0.5-0.4 1.9-0.5 0.8-0.1 1 0.2 3.9 1.9 2.2 0.1 0.7 0.2 2.8 1.5 0.7 0.3 1.4 0.3 1.6 0.1 3-0.1 0.7 0.1 4 1 1.6 0.6 1.5 0.9 0.9 0.8 2.5 2.7 0.8 0.6 0.9 0.4 1.7 0.5 2.7 1.3 2.7 0.5 1.5 0.6 0.9 0.4 1 0.8 4.1 4 2 0.9 1.8 1.8 2.9 2.1 5.1 2.2 2.2 0.5 1.8 0.8 2.4 2.2 0.8 0.4 0.7 0.1 1.2 0.2 1.8 0.4 3.1 0 2.5 0.3 0.8 0.4 1 0.6 0.7 0.3 0.8 0.2z",
  ZWMW: "M397.3 259.2l-1.4-5.3-0.5-0.7-0.7-0.8-0.9-0.2-1-0.5-1.3-0.8-1.1-1.4-2.3-1.7-0.4-0.7-0.3-1.1-0.2-1.2-0.6-2.1 0-2 0-1-0.4-0.8-0.8-0.9-0.3-0.7 0-0.7 0.5-1.4 0-1.2-0.3-0.9-0.7-1-0.3-0.7-0.1-0.8 0-0.8 0.4-1.4 0.1-0.8-0.3-0.5-0.5-0.4-1.3-0.4-0.7-0.1-0.6 0-0.6 0.2-0.7 0-0.8-0.3-0.5-0.6-0.4-0.9-0.5-1.4-0.5-0.8-0.6-0.5-1.6-0.6-1-0.6-0.4-0.5-0.2-0.5 0-0.6 0.4-2.1 1.5-4.2-0.1-1.1-0.7-0.8-1.8-1-0.5-0.4 0-0.2 0-0.2 0.1-0.6 0.4-1.1 0.7-4.5-1.9-8.9-0.4-0.9 10.6-4.6 11.5-9.6 7.8-5.1 42.2-16.7 5.5-1 3.3 0 1.6-0.3 1-0.9 2.3-2.2 1-2.1 4.6-3.5 1.5-1.9 0.8-4.4 0.5-1 2.8-4.6 0-2.8-2-5-0.4-2.1 0.4-2.6 2.8-6.5-2-3.5 0.6-4.8 1.5-5 0.7-4.1-0.3-0.6-0.6-0.7-0.5-0.9-0.2-1.1 0.3-1.3 1.6-2.5 0.4-0.8 2.5-3.2 3.9-3.9 1.7-0.7 0.5-0.3 2.5-0.4 5.3-0.1 2.8-0.6 1.5-1.4 2.4-4.7 1.2-1.3 1.8-1.7 2.3-1.4 2.4-0.6 1-0.6 4.1-4.4 25.7-11.9 1.7-0.4 10.1-0.9 2-1.3 4.3-3.7 2.8-0.8 2.5 0.4 2.2 0.6 2.4 0.4 2.8-0.4 6.7-2.3 5-0.8 4.8-2.2 2.7-0.6 5.1 0.5 10 2.7 5 0.6 4.6-0.7 4.6-1.3 4.7-0.7 4.6 1 3 2 1.4 0.5 1.8-0.4 0.9-0.6 1.8-1.5 1-0.4 2.9 0.4 1.9 0.8-0.3 1.4 0 4.8 0.5 1.7 1.4 1.7 0.6 1.2 0.9 2.6-0.4 1.7-0.9 1.6-30.3 26.3-0.5 0.5-0.2 0.3 0 0.5 0 0.6 0.2 0.7 0.3 0.5 0.3 0.5 0.9 0.8 0.5 0.3 2.4 1 0.4 0.6 0.2 1-0.5 3.2-0.1 1 0.3 1.3 0.2 0.6 0.3 0.5 0.4 0.5 0.7 0.7 0.2 0.4 0.1 0.4-0.1 0.6 0 0.8 0.2 0.6 0.7 1 0.4 0.3 0.5 0.4 0.6 0.1 0.6 0 0.6-0.1 0.7 0 0.5 0.4 0.3 0.7 0 1.2-0.2 0.7-0.4 0.5-3 2-0.5 0.6-1.5 2.3-0.4 1.1-0.2 0.9 0.1 0.8 0.6 3.9-0.1 1.7-0.2 0.9-0.3 0.8-0.4 0.4-1.4 1-0.6 0.6-0.7 1.1-2 4.6-0.2 1.3 0.3 0.7 0.5 0.3 0.6 0.2 1.3 0.4 0.7 0.1 0.6-0.1 0.5-0.3 0.3-0.5 0.5-1.3 0.2-0.6 0.4-0.4 0.5-0.3 1.2-0.5 0.6-0.1 0.7 0 2.6 0.6 0.6 0.1 0.5-0.3 0.4-0.4 0.7-1 0.5-0.3 0.5-0.3 2.6-0.6 0.6-0.3 0.4-0.3 0.4-0.4 0.4-0.5 0.3-0.6 0.1-0.6 0-0.8-0.6-2.4 0-0.7 0-0.7 0.3-0.6 0.3-0.5 0.5-0.3 1.2-0.5 4.2-0.5 0.7 0 1.6 0.2 0.6 0.2 0.6 0.6 0.5 1 1 3.2 0.4 0.8 2.1 2.3 0.3 0.3 0.5 0.2 0.6 0.1 6.6-0.3 0.8 0.2 0.8 0.4 1 1.6 0.5 1.6 0.8 2.6 0.2 1.4 0 1.1-0.3 0.6-1.5 2.7-0.4 1-0.1 0.5-0.3 3.1-0.8 3.8-0.5 1.2-0.7 1-0.3 0.6-0.9 2.8-0.8 5.2 0 1 0.2 0.8 1.2 1.8 0.9 1.8 0.4 0.5 0.5 0.4 1.9 0.7 0.5 0.4 1 0.7 0.5 0.2 1.4 0.3 0.6 0.2 3.8 2.3 0.9 0.4 0.3 0.2 0.3 0.3 1.8 4.1 0 0.8-0.2 0.7-0.3 0.6-0.2 0.7 0.5 0.4 0.5 0.3 0.6 0.2 0.6 0.3 0.6 0.6 0.6 0.8 0.8 1.5 0.3 1.1 0.1 0.9-0.2 0.7-0.6 1.2-1.8 2.3-0.3 0.6-0.2 0.6-0.2 0.7-0.1 0.8 0.7 10.7 0.3 1 0.3 0.4 0.4 0.5 1.8 1.6 0.4 0.4 0.4 0.7 0 0.5-0.3 0.4-0.5 0.4-0.5 0.2-0.4 0.3-0.1 0.4 0.1 3.2 0.5 2.5 0.3 0.5 0.5 0.4 0.7 0.1 0.7 0 2.9-0.3 0.7 0.1 0.6 0.2 0.4 0.3 0.6 0.3 0.6 0 0.5-0.2 1.4-1 1.6-1 0.6-0.2 0.6-0.1 0.7 0.5 0.3 0.8 0.2 1.2 0.4 0.4 0.5 0 0.6-0.3 0.9-0.7 0.6-0.3 0.6-0.1 0.6 0 0.7 0.1 1.4 0.5 0.6 0.3 0.6 0.6 0.1 0.7 0.1 0.8-1.3 10.1-0.4 1.1-0.3 0.6-1.5 2-1.5 1.8-1.7 1.6-0.5 0.4-0.4 0.5-0.4 0.6 0.1 0.6 0.5 0.5 0.5 0.4 0.5 0.6 0 0.6-0.2 0.6-4.3 8.5-1.7 2.5-0.2 0.7-0.3 0.8 1.6 6.9 0.2 2 0 1.7-1.4 10.1 0 2.9 0.7 0.5 0.4 0.2 16.3 0 0.7 0.1 0.2 0.5-0.4 2.1-0.9 2.4-0.2 0.9 0 1.1 0.4 0.8 1.1 0.7 6.4 2.6 5.5 3 1.6 1.1 0.7 0.4 0.7 0 0.8-0.6 0.6-0.8 0.7-0.7 0.7-0.4 2.2 0.8 3.2 5.4-1.4 3.8-3.2 3.8-1.4 1-1.2 0.6-1.1 0.2-0.5 0.5-0.3 0.9-0.3 1.4 0 0.9 0.3 0.7 0.5 0.6 0.3 0.7 0 1.4-0.8 1.7-0.1 1 0.2 0.7 0.7 0.5 2.4 1.4 0.6 0.7 0.5 0.9 0.4 1.2-0.2 0.6-0.5 0.5-3.7 1.4-3.2 0.6-0.6-0.4-1.6-0.9-3.1-1.2-0.9-0.5-0.4-0.1-0.4 0.2-0.5 1-0.2 1.6 0 1 0.2 0.8 0.4 1.2 0.2 0.6 0 0.7-0.3 0.6-0.6 0.6-0.6 0.3-1.9 0.8-0.1 0.1-0.3 0.5-0.4 0.7-0.2 1.6 0.1 0.9 0.1 0.8 1.8 4-0.1 0.7-0.3 0.6-1.6 1.2-0.6 0.7-0.5 1-1.1 3.9 0 0.7 0.1 0.6 0.2 0.6-0.2 1.1-0.6 1.5-2 3.2-1.1 1.3-0.9 0.9-0.6 0.2-1.1 0.6-0.4 0.4-0.4 0.7-0.1 1.1 0.2 4 0.1 0.7 0.3 0.6 0.3 0.5 0.7 0.9 4.9 4.4 3.2 3.6 0.6 1 0.5 1.2 0.2 0.5-0.1 0.7-0.5 0.8-1.2 0.9-0.7 0.6-0.6 0.8-0.3 1.3-0.2 1-0.9 16.9-0.2 1.5-0.5 1-0.8 1-5 4.9-5.3 9.2-0.3 0.4-0.2 0.2-0.5-0.7-0.3-0.3-0.4-0.2-2.6-0.7-0.6-0.1-0.6 0.2-0.2 0.8 0.1 0.7 0.5 1.9 0.1 0.5-0.2 0.4-0.5 0.4-1.2 0.2-0.9-0.1-0.7-0.3-0.9-0.9-0.5-0.3-2.5-0.8-0.6-0.1-0.5 0.2-0.1 0.6 0.1 0.7 0.3 1.1 0.1 0.6-0.4 0.5-0.9 0.6-2.4 0.8-0.9 0.1-0.6-0.1-1.8-4.4-0.3-0.3-0.3-0.5-0.3-0.5-1.2-3.6-0.3-0.6-0.3-0.4-0.5-0.4-0.7 0.2-0.9 1.2-5 10.3-0.3 1-0.9 5.7-0.9 1.9-2 2-4.1-4-1-0.8-0.9-0.4-1.5-0.6-2.7-0.5-2.7-1.3-1.7-0.5-0.9-0.4-0.8-0.6-2.5-2.7-0.9-0.8-1.5-0.9-1.6-0.6-4-1-0.7-0.1-3 0.1-1.6-0.1-1.4-0.3-0.7-0.3-2.8-1.5-0.7-0.2-2.2-0.1-3.9-1.9-1-0.2-0.8 0.1-1.9 0.5-0.5 0.4-0.9 0.8-0.5 0.3-0.6 0-4.4-0.9-0.7-0.2-3.8-1.8-1.8-0.3-0.6-0.3-0.7-0.5-0.6-0.9-0.3-0.7-0.4-0.4-0.5-0.2-1.1-0.3-2.5-1.1-0.8-0.1-0.7 0.1-0.6 0.3-0.7-0.1-0.6-0.4-0.9-1-0.8-0.7-1.5-0.9-1-0.4-0.9-0.2-0.7-0.1-2.9-0.5-0.6 0-1.1 0.5-0.7 0.1-1.1-0.5-4.5-2.8-1.5-0.5-1.1-0.3-0.8-0.3-0.8-0.7-0.9-1.5-0.4-1-0.2-0.9-0.1-0.7 0.1-0.7 0.3-2.4-0.5-5.7 0-0.7 0.2-0.6 0.4-0.5 0.9-0.7 0.3-0.4 0.1-0.4 0.1-0.5 0-1.3 0-0.7 0.2-0.7 1.2-3.2 0.2-0.8 0.1-0.7-0.1-0.8-0.3-0.6-0.7-0.6-4.3-2-16-10.4-1.2-0.5-1.9-0.4-0.9-0.5-1.1-1.3-0.9-1.6-0.6-0.6-0.8-0.5-2.5-1.3-0.9-0.6-2.9-3.3-0.6-0.7-0.5-1.4-0.3-0.5-0.3-0.5-3.1-2.9-0.3-0.5-0.2-0.6-0.1-0.7-0.1-0.7 0-0.7-0.5-0.6-1.6-1.7-0.6-0.7-0.4-0.7-0.2-1.3-0.3-0.6-0.2-0.5-0.2-0.6-0.1-0.7 0.1-1.4 0-0.7-0.3-1.3-0.2-0.6-0.4-1.2 0-0.5 0.1-0.3 0-0.1 0.1-0.2 0.2-0.3 0.2-0.4 0.2-1.4 0.2-0.6 0.2-0.6 0.8-1 3.1-7.6 1.3-2.2 0.7-1.9 0.3-0.6 1.6-1.9 0.3-0.6 0.2-0.7 0.5-3.1 0.3-0.6 0.3-0.6 0.5-0.4 1.4-1.1 0.7-0.9 0.6-1.2 0.2-0.6-0.2-0.8-0.5-0.8-1.2-1.1-0.1-0.8 0-0.6 0.5-0.5 1.9-1.4 0.4-0.5 0.3-0.5 0.2-0.6 0.3-0.7 0.1-0.7 0.1-3 0.4-3.1-0.2-2.8-0.2-0.6-0.4-0.6-1.4-1.4-0.3-0.7-0.1-0.8 0.2-0.6 0.4-0.5 0.4-0.4 0.5-0.4 0.5-0.4 0.9-0.7 0.6-1.1 0.5-1.3 0.4-0.5 0.7-1 0.9-0.8 2-1.2 0.5-0.4 0.4-0.5 0.2-0.4 0.8-2.1-0.2-0.6-0.9-0.6-2.1-0.6-1-0.5-0.8-0.5-7.8-9-0.3-0.5-0.2-0.6-0.2-0.6-0.5-2.6-0.4-1.2-0.8-1.7-0.4-0.4-0.4-0.4-1.1-0.9-0.8-0.5-0.7-0.3-0.9-0.1-0.8 0.1-1.3 0.4-1 0.2-1.3-0.1-0.7-0.1-7.3-2.6-0.5-0.4-0.5-0.3-0.4-0.5-0.5-0.3-0.6-0.4-0.8-0.2-1.9-0.3-0.6-0.3-3.3-2.7-8-2.7-0.6-0.4-0.4-0.4-0.7-0.9-0.7-1-0.7-1.8-0.3-0.5-1-1.5-0.2-0.5-0.5-1.9-0.5-1.1-0.6-0.7-0.6-0.6-0.6-0.2-0.6 0.2-3.6 2.8-0.5 0.3-0.7 0.2-1 0-3.2-0.5-0.8 0-1.3 0.1-5.5 1.7-0.9 0.4-3.3 2.1-1 0.8-0.7 0.8-1 1.6-0.4 0.5-0.7 0.3-1 0.1-2.4-0.4-0.9 0.1-0.8 0.4-1.1 0.9-4.6 5.5-1.3 2.2-1.1 2.4-4.5 5.8-0.6 0.5-2.1 1.3-0.7 0.7-0.8 1.2-0.5 0.3-0.6 0-1-0.7-0.6-0.5-0.6-0.4-0.5-0.1-0.7 0.4-0.6 0.3-0.8 0.1-2.6-0.6-1.8-0.2-1.9 0.3-11.7 2.7-1.4 0.8-1.6 0.3-3.8-0.7z",
  ZWMC: "M635.4 44.6l3.7 1.6 3.3-0.1 4.6-1.8 0.2 9.7 0.2 11.5 0.2 14.5 0.2 8.4 13-0.1 8.3-0.1 19-0.1 12.5-0.1 5.2 1.1 4.7 3.3 1.8 2 1.7 1.3 2 0.3 2.6-1.1 1.3-1.2 2.2-2.5 1.7-0.8 1 0.2 0.9 0.7 0.9 0.1 0.9-1.7 2.9-1.8 5.2 0.4 11.8 2.8 2.2 0.8 1.9 1.4 1.6 2.1 2.2 4.1 1.5 1.6 2.2 1.3 1.2 0.8 0.5 1.1 0.4 1.1 0.7 0.8 0.4 0.1 0.9-0.2 0.5-0.1 0.6 0.4-0.1 0.5-0.1 0.6 0.2 0.4 2.3 0.3 2.5 0 2.3 0.3 1.7 1.3 4.5 2.2 19.4 1.3 2.9 1.3 3.2 2.6 7 7.8 2.2 1.9 4.9 2.6 1.4 1.1 1 2.2 0.6 4.6 1 1.8 1.8 0.9 12.1 2 23-0.6 9.1 1.4 12 4.8 18.4 7.5 13.9 5.6 1.4 1.3 0.5 1.7 0.1 2.8 1.2 4.8 3 2.4 0.7 0.2-0.4 0.3-3.1 3-2 0.9-2.1 0.3-6.7-0.6-1-0.4-2-1-1-0.4-15.7-1.9-2.9 0.3-3 1.1-5.6 3.3-3 1.1-1.6 0.2-4.8-0.2-1.2 0.3-1 0.5-2 1.4-2.2 1.2-2.6 1-2.8 0.6-2.5 0.2-1-0.3-1.9-0.8-1.1-0.2-1.7 0.3-1.9 0.8-3.3 2-1.2 1.3-1 1.8-0.8 1.9-1.3 5.8-0.7 1.2-1 1-3.8 1.9-1.7 1.4-1.5 1.9-1.1 2.1-0.7 2.2-0.7 4-0.6 1.2-2.6 4.4-1.6 1.9-1.8 1.7-2.3 1.4-0.6 0.5-0.7 0.8-1 1.9-0.6 0.8-1.3 1.2-3 1.8-1.3 1-0.9 1.8-0.3 2.2 0.2 2.2 0.4 2 0.2 3.3-1.1 2.8-1.9 2.5-9.9 9.9-1.9 3-0.3 1.1-2.1 2-10.6 5.7-0.5 0.7-1.3 2.1-1.1 2.4-0.7 1.1-0.9 0.9-0.7-0.2-0.7-0.3-0.7 0-1.2 0.9-6.2 5.9-1.2 1-1.3 0.6-4-1.7-1.3 0.5-2.6 1.4-1.1 0.2-0.8-1-0.6-1.1-0.3-1.3-0.2-1.3 0.2-1.3 3.9-10.3 0.2-0.8 0-0.7-1-0.2-18.3-1.7-1.5 0.8-1.6 1.6-1.8 3.9-2.4 2.8-0.2 0.7 0.7 1.6 0.8 0.4 0.8 0.1 0.2 1.1 0.1 0.9-2.3 10.2-0.4 5.3-0.9 1.9-0.7 0.8-0.8 0.4-0.8 0.1-2.1 0-1.1 0.4-1.4 0.2-1.1 0-0.6-0.2-0.6-0.4-1.9-1.7-3.2-5.4-2.2-0.8-0.7 0.4-0.7 0.7-0.6 0.8-0.8 0.6-0.7 0-0.7-0.4-1.6-1.1-5.5-3-6.4-2.6-1.1-0.7-0.4-0.8 0-1.1 0.2-0.9 0.9-2.4 0.4-2.1-0.2-0.5-0.7-0.1-16.3 0-0.4-0.2-0.7-0.5 0-2.9 1.4-10.1 0-1.7-0.2-2-1.6-6.9 0.3-0.8 0.2-0.7 1.7-2.5 4.3-8.5 0.2-0.6 0-0.6-0.5-0.6-0.5-0.4-0.5-0.5-0.1-0.6 0.4-0.6 0.4-0.5 0.5-0.4 1.7-1.6 1.5-1.8 1.5-2 0.3-0.6 0.4-1.1 1.3-10.1-0.1-0.8-0.1-0.7-0.6-0.6-0.6-0.3-1.4-0.5-0.7-0.1-0.6 0-0.6 0.1-0.6 0.3-0.9 0.7-0.6 0.3-0.5 0-0.4-0.4-0.2-1.2-0.3-0.8-0.7-0.5-0.6 0.1-0.6 0.2-1.6 1-1.4 1-0.5 0.2-0.6 0-0.6-0.3-0.4-0.3-0.6-0.2-0.7-0.1-2.9 0.3-0.7 0-0.7-0.1-0.5-0.4-0.3-0.5-0.5-2.5-0.1-3.2 0.1-0.4 0.4-0.3 0.5-0.2 0.5-0.4 0.3-0.4 0-0.5-0.4-0.7-0.4-0.4-1.8-1.6-0.4-0.5-0.3-0.4-0.3-1-0.7-10.7 0.1-0.8 0.2-0.7 0.2-0.6 0.3-0.6 1.8-2.3 0.6-1.2 0.2-0.7-0.1-0.9-0.3-1.1-0.8-1.5-0.6-0.8-0.6-0.6-0.6-0.3-0.6-0.2-0.5-0.3-0.5-0.4 0.2-0.7 0.3-0.6 0.2-0.7 0-0.8-1.8-4.1-0.3-0.3-0.3-0.2-0.9-0.4-3.8-2.3-0.6-0.2-1.4-0.3-0.5-0.2-1-0.7-0.5-0.4-1.9-0.7-0.5-0.4-0.4-0.5-0.9-1.8-1.2-1.8-0.2-0.8 0-1 0.8-5.2 0.9-2.8 0.3-0.6 0.7-1 0.5-1.2 0.8-3.8 0.3-3.1 0.1-0.5 0.4-1 1.5-2.7 0.3-0.6 0-1.1-0.2-1.4-0.8-2.6-0.5-1.6-1-1.6-0.8-0.4-0.8-0.2-6.6 0.3-0.6-0.1-0.5-0.2-0.3-0.3-2.1-2.3-0.4-0.8-1-3.2-0.5-1-0.6-0.6-0.6-0.2-1.6-0.2-0.7 0-4.2 0.5-1.2 0.5-0.5 0.3-0.3 0.5-0.3 0.6 0 0.7 0 0.7 0.6 2.4 0 0.8-0.1 0.6-0.3 0.6-0.4 0.5-0.4 0.4-0.4 0.3-0.6 0.3-2.6 0.6-0.5 0.3-0.5 0.3-0.7 1-0.4 0.4-0.5 0.3-0.6-0.1-2.6-0.6-0.7 0-0.6 0.1-1.2 0.5-0.5 0.3-0.4 0.4-0.2 0.6-0.5 1.3-0.3 0.5-0.5 0.3-0.6 0.1-0.7-0.1-1.3-0.4-0.6-0.2-0.5-0.3-0.3-0.7 0.2-1.3 2-4.6 0.7-1.1 0.6-0.6 1.4-1 0.4-0.4 0.3-0.8 0.2-0.9 0.1-1.7-0.6-3.9-0.1-0.8 0.2-0.9 0.4-1.1 1.5-2.3 0.5-0.6 3-2 0.4-0.5 0.2-0.7 0-1.2-0.3-0.7-0.5-0.4-0.7 0-0.6 0.1-0.6 0-0.6-0.1-0.5-0.4-0.4-0.3-0.7-1-0.2-0.6 0-0.8 0.1-0.6-0.1-0.4-0.2-0.4-0.7-0.7-0.4-0.5-0.3-0.5-0.2-0.6-0.3-1.3 0.1-1 0.5-3.2-0.2-1-0.4-0.6-2.4-1-0.5-0.3-0.9-0.8-0.3-0.5-0.3-0.5-0.2-0.7 0-0.6 0-0.5 0.2-0.3 0.5-0.5 30.3-26.3 0.9-1.6 0.4-1.7-0.9-2.6-0.6-1.2-1.4-1.7-0.5-1.7 0-4.8 0.3-1.4z",
  ZWME: "M740.3 484.4l-18.3 0.4-5-0.7-0.4-0.6-0.1-0.7-0.2-1.4 0.1-1.6 0.4-1.4 0.2-0.5 0.2-0.3 0.1-0.4-0.1-0.3 0-0.1 0-0.1 0-0.1 0.4-0.6 0.3-0.9 0.1-1-0.1-0.5-0.5-0.2-0.3-0.1-4.1-0.4-1.2 0.2-0.8 0.6-1.2 1.9-0.7 0.9-1.1 0.5-1.6 0.3-0.7 0.2-0.3 0.4 0.2 1 0.5 1.1-0.2 2.6-5.1 4.7-2.9-1.6-2.9-0.8-0.5-0.1-1.5-1.4-1.7-2.2-2.3-2-1.7-1.9-2.4-1.9-0.4-0.5-0.2-0.6 0.2-0.4 0-0.3 0-0.3-0.1-0.3-0.1-0.3-0.1-0.4-0.1-0.2 0-0.5 0.1-0.4 0.6-1.8 0.4-0.3 0.5-0.1 0.5-0.2 0.1-0.4-0.1-0.8-0.2-0.8-0.4-1-0.6-1-2.7-3.8-2.4-4.2-0.4-1.1 0-0.8 0.1-0.5 1.2-1.9 0.2-0.7-0.8-0.2-0.7-0.3-1-0.6-0.8-0.4-2.5-0.3-3.1 0-1.8-0.4-1.2-0.2-0.7-0.1-0.8-0.4-2.4-2.2-1.8-0.8-2.2-0.5-5.1-2.2-2.9-2.1-1.8-1.8-2-0.9-6.2-1.6 2-2 0.9-1.9 0.9-5.7 0.3-1 5-10.3 0.9-1.2 0.7-0.2 0.5 0.4 0.3 0.4 0.3 0.6 1.2 3.6 0.3 0.5 0.3 0.5 0.3 0.3 1.8 4.4 0.6 0.1 0.9-0.1 2.4-0.8 0.9-0.6 0.4-0.5-0.1-0.6-0.3-1.1-0.1-0.7 0.1-0.6 0.5-0.2 0.6 0.1 2.5 0.8 0.5 0.3 0.9 0.9 0.7 0.3 0.9 0.1 1.2-0.2 0.5-0.4 0.2-0.4-0.1-0.5-0.5-1.9-0.1-0.7 0.2-0.8 0.6-0.2 0.6 0.1 2.6 0.7 0.4 0.2 0.3 0.3 0.5 0.7 0.2-0.2 0.3-0.4 5.3-9.2 5-4.9 0.8-1 0.5-1 0.2-1.5 0.9-16.9 0.2-1 0.3-1.3 0.6-0.8 0.7-0.6 1.2-0.9 0.5-0.8 0.1-0.7-0.2-0.5-0.5-1.2-0.6-1-3.2-3.6-4.9-4.4-0.7-0.9-0.3-0.5-0.3-0.6-0.1-0.7-0.2-4 0.1-1.1 0.4-0.7 0.4-0.4 1.1-0.6 0.6-0.2 0.9-0.9 1.1-1.3 2-3.2 0.6-1.5 0.2-1.1-0.2-0.6-0.1-0.6 0-0.7 1.1-3.9 0.5-1 0.6-0.7 1.6-1.2 0.3-0.6 0.1-0.7-1.8-4-0.1-0.8-0.1-0.9 0.2-1.6 0.4-0.7 0.3-0.5 0.1-0.1 1.9-0.8 0.6-0.3 0.6-0.6 0.3-0.6 0-0.7-0.2-0.6-0.4-1.2-0.2-0.8 0-1 0.2-1.6 0.5-1 0.4-0.2 0.4 0.1 0.9 0.5 3.1 1.2 1.6 0.9 0.6 0.4 3.2 0.6 3.7-1.4 0.5-0.5 0.2-0.6-0.4-1.2-0.5-0.9-0.6-0.7-2.4-1.4-0.7-0.5-0.2-0.7 0.1-1 0.8-1.7 0-1.4-0.3-0.7-0.5-0.6-0.3-0.7 0-0.9 0.3-1.4 0.3-0.9 0.5-0.5 1.1-0.2 1.2-0.6 1.4-1 3.2-3.8 1.4-3.8 3.1 2.9 4.4 1.9 1.5 0.3 2.3 1 3.1 2.9 0.6 0.4 3.1 1.2 1.6 0.9 0.6 0.4z",
  ZWMA: "M880.8 737.3l-11.1-7.2-1.8-2.4 0.1-1.9-4.1-10.1-0.9-2.9-0.6-0.6-8.1-4.1 1.3-1.9-0.3-1.3-2.6-2-0.7-1.1-0.3-1.2-1.1-5.8-0.5-1.1-1-1.5 0-1 1.6-2.9 0.4-1.2 0.6-2.7 4.2-7.9 2.1-6.4 0.3-2.5 0.4-2.2 1.1-1.9 2.4-3.1 1.3-7.4 1.6-2.4 1-6 0.6-17.5 5.7-34.8 0.2-12.3-0.8-1.1-0.3-1.2-2.1-1.4-6.1-3-7.7-6-1.5-0.6-1.1-0.3-0.9-0.1-2.3 0.1-2.7 0.4-0.7-0.2-0.7-0.6-1-1.1-0.7-0.6-0.9-0.6-1.3-0.4-1-0.1-1.3-0.3-1.4-0.8-2.5-1.8-1.8-1.7-0.9-1.1-0.9-1.9-0.6-0.6-0.7-0.5-3.1-1.4-0.6-0.5-0.7-0.6-0.8-1.1-0.5-0.8-0.2-0.8-1.2-3.8-0.6-0.8-0.9-1-3.6-3.3-2.7-3.2-0.3-0.6-0.3-0.5-0.8-2.5-0.3-0.6-0.8-0.8-1.4-0.9-5.3-3-0.8-0.6-1-1.1-0.5-0.8-0.3-0.8-0.1-0.7-0.2-0.6-0.2-0.6-0.4-0.5-3.6-3.5-0.6-1.2-0.3-0.9 0-1.4 0-0.4-0.5-0.4-0.8-0.3-2.8-0.5-1.2-0.3-1.6-0.7-1-0.6-0.9-0.7-0.6-0.4-0.9-0.1-1.2 0.5-0.6 0.2-0.7-0.2-0.7-0.4-0.8-0.9-0.4-0.7-0.6-0.9-1-0.8-3.1-2.1-1.1-0.6-2.2-0.5-0.7-0.3-0.6-0.4-1.2-1.2-0.5-0.3-0.7-0.2-1.2-0.1-0.9 0.1-0.6 0.3-0.5 0.3-0.6 0.2-0.7 0-1.3-0.7-1.5-1-4.2-3.6-18.9-11.6-1.5-1.9 11.3-1.3 1.4-0.7 0-6 1.2-3 0.1-4.9 0.4-0.7 0.1-0.5 0.6-0.7 1.1-0.6 3.1-0.3 1.5 0.1 1.1 0.3 1.1 0.6 1.3 0.5 0.6 0.1 0.8-0.2 0.7-0.5 0.8-1 0.5-0.3 0.7-0.1 1 0.4 0.6 0.4 2.2 2.1 0.3 0.6 0.2 0.6 0 0.7 0.1 0.7 0.2 0.6 0.7 0.3 0.9 0.1 1.3 0 0.8 0.3 0.6 0.3 0.5 0.3 0.5 0.4 0.7 0.1 0.8-0.3 2.2-2.2 0.7-0.9 1-1.6 1.6-3.6 0.9-2.6 0.8-1.7 0.1-0.6-0.1-0.6-0.3-0.5-0.8-0.9-0.2-0.5 0.5-0.4 1.1-0.1 2.5 0.7 3.9 1.8 2.1 0.2 5.8-1 2-0.1 1.9 0.6 1.6 1.1 4.4 4.6 1.8 1.3 4.3 1.1 4.6 2.3 2.4 0.5 1.1-0.1 2-0.7 0.9 0 1.1 0.3 0.9 0.3 0.7 0.6 0.8-2.2-0.6-3 0.1-1.6 0.3-2.4-0.1-2.3 0.4-5.2-0.1-0.5-0.1-0.6-0.5-1.2-0.6-1-1.1-1.5-0.3-0.5-0.2-0.6-0.1-0.7-0.2-0.6-0.4-0.5-1.1-0.6-0.5-0.4-0.4-0.4-0.3-0.5-0.2-0.7-2.1-10.6-2.5-6.5-0.4-0.5-0.4-0.4-0.6-0.3-0.6-0.2-0.8-0.2-2.1-0.1-0.7-0.2-0.5-0.2-0.5-0.4-0.4-0.5-0.3-0.5-0.4-1.4-0.6-2.4-0.2-0.8-0.4-0.5-1-1.4-1-1.5-1.3-1.3-0.4-0.5-0.3-0.5-1.1-2.2-1.1-1.4-0.2-0.6-0.2-1.4-0.4-0.5-0.2-0.7 0-0.8 0.7-1.7 0.4-1.2-0.1-1-1-2.1-0.3-2-1.4-2.1-0.4-0.9 0.7-0.8 0.3-0.3 0.5-0.3 0.6-0.6 0.3-1 0.3-1.2 0-1.2 0.3-1.2 0.3-1 1-0.5 1.1-0.5 5.1-1.2 1.2-0.4 0.8-0.6 0.1-1.3-0.3-2.3 0.4-1.3 1.7-3.5-0.1-1.2-0.2-0.5-0.4-1.2-0.3-2.1 0.2-4 0.2-0.7 0.2-0.7 4.3-5.8 0.9-1.7 0.4-1.2-0.2-2.2 0-0.7 0.1-0.8 27.3-27.8 0.4-0.7 0.1-0.6-0.3-2 0.1-1.5 0.8-4.6 0.2-0.7 0.4-0.6 0.5-0.5 0.8-0.5 3.1-1.2 2.5-1.4 2.4-0.9 0.6-0.5 0.7-0.6 0.8-1.3 1.2-2.1 0.6-1 0.5-0.6 1-0.8 2.6-1.5 1.2-0.9 4.7-4.7 1.9-1.3 2.1-1 1.2-0.4 1.1-0.1 0.7 0 0.7 0.2 1.3 0.4 0.8-0.2 1-0.6 1.8-1.9 1.5-2.1 0.6-0.6 4.1-1.8 2.1-0.3 0.6-0.2 1.1-0.5 1.2-0.4 0.7-0.1 1-0.5 1.3-0.9 4.8-5.2 0.4-0.7 0.2-0.7 0.1-0.8 0.2-2.2 0.2-0.6 0.4-0.6 0.8-0.6 3.6-1.4 1.2-0.3 1.8-0.8 0.6-0.5 0.8-0.7 0.6-1.1 0.2-0.8 0-1.5 0.2-0.6 3.4-6.9 0.4-0.6 0.5-0.7 7.8-5.7 2.7-2.5 1.2-0.8 8.6-3.5 2.5-0.7 0.7 0-0.7 0 0 1.2 0.5 2.7 1.2 2.4 1 0.8 2.6 1.5 0.8 1.1 0.1 1.9-0.7 1.9-0.6 0.8-1.6 2.6-4.6 8.9-0.7 1-1 0.6-0.8 0.9 0 1.3 1.2 4.1 0.6 1 2 1.6 4.3 2 1.6 2.2 0.5 2.5-0.4 2.3-2 4.6-0.4 4.6 0.3 5.4-0.4 4.4-3 2-1.9 0.9-1.3 2.1-0.7 2.5-0.4 2.4 0.2 2.4 1.4 3.4 0.2 2.2-0.4 1.6-1 0.8-0.9 0.6-0.6 1 0.2 1.1 1.4 1.7-0.1 1.1-0.6 2.4 0.3 2.7 4.1 12.6 0.3 4.1 0 0.9-1.1 2.6-0.9 1.6-0.7 1-0.2 1 0.5 1.8 1.8 2.6 5.4 4.4 2.1 2.4 0.9 2.3-0.5 1.4-3.4 2.5-2.4 3.6 0.1 1.2 1.5 1.8 0.4 1.2-0.7 2.5-2.1 1.6-2.6 1.2-2.2 1.4-2.1 1.1-2.2 0.6-2 0.9-1.4 1.6-0.3 2.1 0.4 2.5 1.5 4.4 3.4 7 0.9 3.3-0.2 4.1-0.8 3.3-1.3 2.6-2 1.6-3 0.3-4.8-0.4-3.5 0.6-11.2 5.2-0.2 1.1 0.8 6.7 0.8 1.8 1.4 0.9-1.2 1-1.5 0.8-1.1 1.1-0.2 1.5 0.9 2.7 0.2 1.4-0.2 1.5 0.3 1.7 0.9 0.9 1.3 0.5 1.6 0.1 7.2-1.1 2 0.2 1.3 0.5 0.7 0.6 0.3 0.8 0.3 1.5 0.5 1.5 1 0.9 1.1 0.9 0.9 1.2 0.8 4.2-3.4 15.3-0.1 3-0.4 2.2-1 2.1-1.7 2.7-4.3 4.9-0.3 1.2 0.3 3.7-0.8 5 0.2 2.5 1.2 1.5 2.2 0.1 2.1-0.3 1.7 0.6 0.8 2.7 0 2.2-0.8 8.9 0 1.2 0.3 1.2 0.2 1.6-0.5 1.2-0.7 1-0.4 1.3 0.4 2.7 1.3 1.4 2.1 0.5 2.7 0.1 2.6-0.7 3.5-3.6 2.2-0.7 2 1.1 0.2 2.5-1 4.8 1 2.2 1.9 2 2.5 1.6 2.6 1 1.2 1.4-0.4 2.4-0.8 2.9-0.1 5.1-2.3 7.2-0.4 9.2 0.7 2.9 0.3 0.9-6.2-0.2-1.6 1.4-0.7 3.8-0.9 1.8-1.8 0.5-1.9 0.4-1.1 1.1-0.8 6-0.6 2-1.6 2.9-0.2 1.2 0.1 0.9 0.8 1.6 0.1 1-0.9 3.8-0.6 1.8-0.9 1.6-5.2 6.4-7.5 9.4-3.7 7.1-3.8 7.5-2.9 3.2-5 0.8-5.5-0.6-5 0.6-3.7 4.8-1.2 5.3-0.2 5.1 1.7 13.3 1.6 13-0.8 4.7-2.7 5.5-5.9 7.5-8.9 11.6 0.6 1.1 1.7 1.1 1 1.4 0.6 0.1 0.5 0 0.3 0.2 0 0.9-0.4 0.8-0.5 0.6-0.1 0.5 8.4 14.6 0.2 0.5 0.1 0.6-4.5-2.9z",
  ZWMI: "M510.8 513.8l-14.6-14.1-0.5-0.9 2.5-4.1 0.3-0.9 0-1.5-0.3-0.8-0.7-1.2-10.5-11.4-1.4-1.1-1-1.4-0.2-0.5 0-0.3 0-3.5 0.1-0.6 0.3-0.6 0.5-0.5 0.7-1 0.4-0.6 0.1-0.8 0.2-0.9 0-1.1-0.4-1-2.5-4.3-0.9-1.3-0.9-0.8-1.4-0.6-0.8-0.4-0.9-0.9-0.7-1.4-0.4-1.5-6.8-31 0-2.3 0.8-1.1 1.2-0.5 6.3-1.5 20.4-8.7 1-0.8 0.6-1.3-0.1-1.2-0.5-1.4-1.6-2.9-0.8-0.5-1.1-0.2-43.4 0.5-1.7-0.2-2.1-0.6-1.2-0.6-0.7-0.2-0.7-0.1-0.7 0-0.7 0.1-2.4 0.8-1.4 0.3-2.1 0.2-0.6 0.1-7.3-0.1-0.7 0.1-3.6 1.2-1 0.2-4.8 0.2-1.6-0.1-2.2-0.4-6.1 0-2.6 0.5-1.4 0.1-0.8-0.1-1.4-0.3-11.7-0.3-2.1-0.7-1.5-0.2-4.7-0.3-1.5-0.4-1.8-0.8-0.7-0.2-0.7 0-6.2 0.9-1.4-0.1-0.8-0.1-0.9-0.3-0.9-0.6-1.3-1.1-0.4-1.8-0.2-1.7 0.4-35.9 0.5-0.6 0.6-0.4 3.3-0.7 6.2-0.7 0.5-0.2 0.3-0.4-0.3-1-0.6-0.4-0.6-0.4-2.4-0.5-1-0.4-1.2-0.8-0.4-0.7-0.2-0.8 0.2-0.6 0.4-0.5 0.4-0.4 0.9-0.7 0.5-0.4 0.3-0.5 0.2-0.7 0.1-0.6-0.2-0.7-0.6-1.7-0.2-1.4 0.1-2.5-0.3-0.9-0.4-0.5-0.6-0.1-0.6 0.1-0.6 0.3-0.7 0.1-0.7-0.1-1.1-0.7-0.5-0.7-0.3-0.7-0.3-1.7-0.6-2-0.1-0.7 0-0.5 0.1-0.2 0-0.1 0.4-0.6 0.3-0.3 1.9-1.5 0.4-0.4 0.4-0.5 0.3-0.5 0.2-0.7 0.3-1.4 0.2-0.7 0.3-0.4 0.5-0.4 0.5-0.3 0.6-0.3 0.3-0.5 0.1-0.8-0.2-1.1 0-0.9 0-0.7 1-2.5 1.5-2.9 0.1-0.8 0-1.1-1.3-5.8 0-0.9 0.1-0.7 0.5-1.3 0.3-1.4 0.3-0.6 3-2.8 0.5-0.3 0.6-0.2 0.5 0.1 0.5 0.2 0.5 0.5 0.4 0.3 0.5 0.2 0.5-0.2 0.4-0.4 0.8-0.8 1.8-1.6 3.2-3.5 0.2-0.7 0-1-0.8-2.8 0-0.9 0.7-1.9 0.6-3 0.2-0.5 0.7-1 0.2-0.6 0-0.8 0-1-0.4-1.6-0.1-1 0-0.9 0.2-0.7 0.8-1.9 0.6-2.2 0.1-0.1 0.4-0.4 0.3-0.4 0.1-0.6 0.1-1.5 1-2.5 0.2-1.1 0.3-4.5 3.8 0.7 1.6-0.3 1.4-0.8 11.7-2.7 1.9-0.3 1.8 0.2 2.6 0.6 0.8-0.1 0.6-0.3 0.7-0.4 0.5 0.1 0.6 0.4 0.6 0.5 1 0.7 0.6 0 0.5-0.3 0.8-1.2 0.7-0.7 2.1-1.3 0.6-0.5 4.5-5.8 1.1-2.4 1.3-2.2 4.6-5.5 1.1-0.9 0.8-0.4 0.9-0.1 2.4 0.4 1-0.1 0.7-0.3 0.4-0.5 1-1.6 0.7-0.8 1-0.8 3.3-2.1 0.9-0.4 5.5-1.7 1.3-0.1 0.8 0 3.2 0.5 1 0 0.7-0.2 0.5-0.3 3.6-2.8 0.6-0.2 0.6 0.2 0.6 0.6 0.6 0.7 0.5 1.1 0.5 1.9 0.2 0.5 1 1.5 0.3 0.5 0.7 1.8 0.7 1 0.7 0.9 0.4 0.4 0.6 0.4 8 2.7 3.3 2.7 0.6 0.3 1.9 0.3 0.8 0.2 0.6 0.4 0.5 0.3 0.4 0.5 0.5 0.3 0.5 0.4 7.3 2.6 0.7 0.1 1.3 0.1 1-0.2 1.3-0.4 0.8-0.1 0.9 0.1 0.7 0.3 0.8 0.5 1.1 0.9 0.4 0.4 0.4 0.4 0.8 1.7 0.4 1.2 0.5 2.6 0.2 0.6 0.2 0.6 0.3 0.5 7.8 9 0.8 0.5 1 0.5 2.1 0.6 0.9 0.6 0.2 0.6-0.8 2.1-0.2 0.4-0.4 0.5-0.5 0.4-2 1.2-0.9 0.8-0.7 1-0.4 0.5-0.5 1.3-0.6 1.1-0.9 0.7-0.5 0.4-0.5 0.4-0.4 0.4-0.4 0.5-0.2 0.6 0.1 0.8 0.3 0.7 1.4 1.4 0.4 0.6 0.2 0.6 0.2 2.8-0.4 3.1-0.1 3-0.1 0.7-0.3 0.7-0.2 0.6-0.3 0.5-0.4 0.5-1.9 1.4-0.5 0.5 0 0.6 0.1 0.8 1.2 1.1 0.5 0.8 0.2 0.8-0.2 0.6-0.6 1.2-0.7 0.9-1.4 1.1-0.5 0.4-0.3 0.6-0.3 0.6-0.5 3.1-0.2 0.7-0.3 0.6-1.6 1.9-0.3 0.6-0.7 1.9-1.3 2.2-3.1 7.6-0.8 1-0.2 0.6-0.2 0.6-0.2 1.4-0.2 0.4-0.2 0.3-0.1 0.2 0 0.1-0.1 0.3 0 0.5 0.4 1.2 0.2 0.6 0.3 1.3 0 0.7-0.1 1.4 0.1 0.7 0.2 0.6 0.2 0.5 0.3 0.6 0.2 1.3 0.4 0.7 0.6 0.7 1.6 1.7 0.5 0.6 0 0.7 0.1 0.7 0.1 0.7 0.2 0.6 0.3 0.5 3.1 2.9 0.3 0.5 0.3 0.5 0.5 1.4 0.6 0.7 2.9 3.3 0.9 0.6 2.5 1.3 0.8 0.5 0.6 0.6 0.9 1.6 1.1 1.3 0.9 0.5 1.9 0.4 1.2 0.5 16 10.4 4.3 2 0.7 0.6 0.3 0.6 0.1 0.8-0.1 0.7-0.2 0.8-1.2 3.2-0.2 0.7 0 0.7 0 1.3-0.1 0.5-0.1 0.4-0.3 0.4-0.9 0.7-0.4 0.5-0.2 0.6 0 0.7 0.5 5.7-0.3 2.4-0.1 0.7 0.1 0.7 0.2 0.9 0.4 1 0.9 1.5 0.8 0.7 0.8 0.3 1.1 0.3 1.5 0.5 4.5 2.8 1.1 0.5 0.7-0.1 1.1-0.5 0.6 0 2.9 0.5 0.7 0.1 0.9 0.2 1 0.4 1.5 0.9 0.8 0.7 0.9 1 0.6 0.4 0.7 0.1 0.6-0.3 0.7-0.1 0.8 0.1 2.5 1.1 1.1 0.3 0.5 0.2 0.4 0.4 0.3 0.7 0.6 0.9 0.7 0.5 0.6 0.3 1.8 0.3 3.8 1.8 0.7 0.2 4.4 0.9 0.6 0 0.5-0.3 0.9-0.8 0.5-0.4 1.9-0.5 0.8-0.1 1 0.2 3.9 1.9 2.2 0.1 0.7 0.2 2.8 1.5 0.7 0.3 1.4 0.3 1.6 0.1 3-0.1 0.7 0.1 4 1 1.6 0.6 1.5 0.9 0.9 0.8 2.5 2.7 0.8 0.6 0.9 0.4 1.7 0.5 2.7 1.3 2.7 0.5 1.5 0.6 0.9 0.4 1 0.8 4.1 4 6.2 1.6 2 0.9 1.8 1.8 2.9 2.1 5.1 2.2 2.2 0.5 1.8 0.8 2.4 2.2 0.8 0.4 0.7 0.1 1.2 0.2 1.8 0.4 3.1 0 2.5 0.3 0.8 0.4 1 0.6 0.7 0.3 0.8 0.2-0.2 0.7-1.2 1.9-0.1 0.5 0 0.8 0.4 1.1 2.4 4.2 2.7 3.8 0.6 1 0.4 1 0.2 0.8 0.1 0.8-0.1 0.4-0.5 0.2-0.5 0.1-0.4 0.3-0.6 1.8-0.1 0.4 0 0.5 0.1 0.2 0.1 0.4 0.1 0.3 0.1 0.3 0 0.3 0 0.3-0.2 0.4 0.2 0.6 0.4 0.5 2.4 1.9 1.7 1.9 2.3 2 1.7 2.2 1.5 1.4 0.5 0.1 2.9 0.8 2.9 1.6-16.2 13.4-0.9 0.9-0.3 0.6 0.5 0.5 0.7 0.3 3.6 0.8 0.9 0.4 0.7 0.8 0.1 0.9-0.6 1-1.5 0.9-1.3 0.5-0.7 0.6-0.2 1-0.2 10.2-1.3 6.5 0.4 2 0.5 1.7 0.1 1.3-0.1 1.3-2 9.9-0.1 1 0.1 3-0.1 0.8-1.3 3.9-0.3 2.3 0 1.5 0.2 1.4 0.1 0.6 0.2 0.3 0.4 0.3 0.3 0.4 0.2 0.4-0.2 0.6-0.9 0.5-0.8 0.3-3.4 0.9-1.5 0.1-1.5-0.2-3.4-0.9-3.2-1.7-0.9-0.4-1.1 0-9.9 0.3-1.1 0.6-1.3 2.5-0.1 0.6 0.1 0.4 0.2 0.3 0.1 0.5 0.1 0.2 0.1 0.1 0.2 0.2 0.1 0.2 0 0.4 0.1 0.6 0.1 0.5 0.2 0.3 0.1 0.2 0.2 0.3 0 0.3-0.1 0.4-0.3 0.5-0.6 0.8-2.8 2.1-0.3 0.6-0.2 1.1 0 0.6 0.1 0.4 0.1 0.2 0.1 0.3-0.1 0.4-0.3 0.7-0.1 0.4 0 0.3 0.2 0.1 0.4 0 0.8 0.1-0.6 0.6-0.6 0.2-0.8 0.1-18.1 0.8-0.7 0.1-0.7 0.2-8.7 4.2-0.9 0.7-0.4 0.6 0.7 0.9 0.3 0.9 0.1 1.7-0.8 4.4-1.4 2.6-0.6 5.1 0 3.6 0.4 0.2 0.7-0.3 2.1-1.3 1.9 0.2 1.9 0.5 1.5 1 0.7 0.9 0.5 1.6 0.4 2 0.2 2.4-0.1 2.5-1 3.1 0 1.3 0.3 0.7 0.6 0.2 0.4 0.5 1.6 2.7 0.4 0.5 0.9 0.7 0.5 0.4 0.6 0.2 1.3 0.4 2.3 0.2 0.6 0.1 0.4 0.3 0.3 0.5 0 0.7-0.1 0.6 0 0.8 0.2 0.6 0.3 0.6 0.8 1 0.4 0.4 0.5 0.3 0.7 0.2 1.4 0.3 0.6 0.2 0.4 0.4 0.3 0.5 0.3 0.6 0.2 0.7 0.3 0.5 0.4 0.5 0.5 0.4 2.6 1.7 0.4 0.4 0.3 0.6 0.2 0.6 0.2 1.5 0.1 0.7 0.3 0.6 0 0.1 4.8 5.4 0.2 0.7-0.1 0.9-0.6 1.4-0.1 1.1 0 0.9 0.5 1.3 0.2 0.6 0 0.8-0.2 2.2 0.1 0.8 0.1 0.7 0.3 0.6 0.3 0.6 0.4 0.4 0.4 0.5 1 0.7 0.3 0.5 0.3 0.6 0.3 1.5 0.1 0.7 0.3 0.6-0.1 0.7-0.2 0.6-1.5 2.7-0.3 0.8-0.2 0.7 0 0.8 0.6 2.5 0 0.7-0.1 0.8-1.3 2.4-0.6 3-0.3 0.7-0.4 0.8-1.3 1.5-0.4 0.7-0.2 0.7 0.6 9-0.3 2-0.8 1.4-11.6 10.7-1 0.1-0.8-0.1-0.8-0.3-0.8-0.2-2.2-1.3-0.6 0-0.4 0.1-1.1 0.8-0.6 0.3-0.5 0.2-0.3 0.2-0.4 0.3-0.7 0.3-0.8 0-3.1-0.5-2.2 0-2.9-0.4-1.1-0.3-0.6-0.3-0.5-0.3-0.7-0.6-0.7-0.9-0.4-0.4-0.7-0.4-2.7-0.8-1.4-0.8-1.1-1.1-1.8-2.4-0.5-0.4-0.7-0.4-1.8-0.8-0.6-0.3-0.7-0.5-0.8-0.8-0.9-0.7-0.8-0.5-0.8-0.6-0.6-0.7-0.8-0.5-0.8-0.2-1.4-0.1-1.3 0.2-1.1 0.4-1.5 0.8-13.7 11.6-2.4 1.2-1.3 0.2-1 0-5.8-0.8z",
  ZWHA: "M703.1 325l3.2-0.6 3.7-1.4 0.5-0.5 0.2-0.6-0.4-1.2-0.5-0.9-0.6-0.7-2.4-1.4-0.7-0.5-0.2-0.7 0.1-1 0.8-1.7 0-1.4-0.3-0.7-0.5-0.6-0.3-0.7 0-0.9 0.3-1.4 0.3-0.9 0.5-0.5 1.1-0.2 1.2-0.6 1.4-1 3.2-3.8 1.4-3.8 1.9 1.7 0.6 0.4 0.6 0.2 1.1 0 1.4-0.2 1.1-0.4 2.1 0 0.8-0.1 0.8-0.4 0.7-0.8 0.9-1.9 0.4-5.3 2.2 0.1 0.5 0.3 0.4 0.4 0.2 1 0.3 0.9 0.5 0.7 0.8 0.4 2.1 0.4 3.9-0.1 1.1 0.3 0.5 0.6 0.4 1.3 0.1 1.3-0.1 1.4-0.5 2 0 0.9 0.3 0.8 0.4 0.8 0.4 0.7 0.1 0.7-0.1 1.4 0.1 0.8 0.3 1.2 0.3 1 1.1 2.4 0.1 0.5 0.1 0.5-0.3 0.6-0.5 0.8-1.1 1.1-0.5 0.9-0.2 0.8-0.1 1.3-0.6 0.7-1 0.6-4.3 1.9-0.1 0.4 0 0.4 0.3 1.3 0.1 0.7 0.1 1.4 0 0.6-0.5 2-1.1 1.4-1.7 0.7-0.3 0.9-0.1 0.6 0.4 0.5 1 0.9 0.2 0.2-0.4 0.5-2 1.5-0.6 0.3-1.6 0.2-0.7 0.2-0.6 0.3-1 0.6-0.4 0.2-0.4 0.1-0.5 0.1-0.7-0.2-1-0.5-2.7-2.3-5.7-3.8-4.4-1.9-1.5-0.3-2.3-1-3.1-2.9z",
  ZWBU: "M426.6 605.5l1.5-3.4-0.2-1.2-1.1-1.2-0.9-1.4-0.8-0.3-1 0.1-1.4 0.6-0.6 0.1-0.7 0-2-0.6-0.9 0-1.5 0-0.9-0.1-1.4-0.4-0.6-0.6-0.1-0.6 0.4-0.5 1.5-1 0.7-0.5 0.5-0.8-0.1-1.3 0.1-0.9 0.2-0.9 0.5-1.2 0.2-0.7 0-1.1-1.1-4.5-0.1-1.5 0.1-0.6 0.4-0.3 0.5 0 0.9 0.2 6.6 3.6 1.1 0.3 0.9 0 0.8-0.4 1.4-1.3 0.7-0.3 2.6-0.4 2.2-0.8 0.7 0 0.4 0.2 0.1 0.3-0.4 1-0.1 0.6-0.1 1.5-0.1 0.4 0 0.4 0.1 0.3 0.3 0.4 0.3 0.2 0.5 0.1 0.6 0.1 0.7 0.1 0.5 0.3 1.2 1 0.8 0.4 0.9 0 0.8-0.2 1.6-0.8 0.7 0 0.5 0.4 0.2 1.5 0.2 0.5 0.4 0.4 0.8 0.3 0.8 0.3 0.3 0.4 0.1 0.6-0.2 0.8-0.4 0.9-0.7 1.4-0.1 0.4-0.1 0.6 0 0.5 0.4 0.5 0.4 0.4 2.3 1.5 0.4 0.5 0.3 0.6 0 0.6-0.3 0.7-0.4 0.7-0.6 0.7-0.8 0.7-2 0.8-7.7 1.8-1.5-0.8-1.4-0.3-0.8-0.4-0.6-0.2-0.4 0.1-3.8 3.1-0.6 0-0.5 0-2.1-2.4z",
  ZWMV: "M728.4 868.1l0-0.1-1.6-3.1-0.5-0.6-0.7-0.1-0.6 0.1-0.8-0.1-0.8-0.3-0.6-0.5-0.3-0.9-0.2-1.6-0.3-0.7-1.4-2-0.2-0.9-0.1-1.5-0.3-0.9-0.9-1.5-0.2-1-0.1-0.9-0.1-0.7-0.5-0.5-0.9-0.4-0.8-0.1-1.4 0.1-0.6-0.1-0.5-0.3 0.2-1.4-0.2-0.7-0.6-0.5-1.2-0.4-1.7-0.3-0.6-0.4-0.5-0.7-0.5-1.1-0.3-1.8-0.2-0.6-0.3-0.6-1-1.2-0.4-0.7-0.2-0.6 0-1.5-0.3-0.6-0.5-0.4-1.1 0-1.5 0.2-0.7-0.2-0.4-0.4-0.7-1.8-0.5-0.8-1.3-1-0.7-0.7-0.7-1.1-0.8-0.8-1.6-1.1-1.1-0.4-0.9-0.3-0.7 0-0.6-0.1-0.4-0.3 0.2-0.6 0.2-0.3 0.1-0.2 0.1-0.1 0.1-0.2 0.2-0.3-0.1-1.2 0.1-0.7 0.2-0.6 0-0.6-0.3-0.6-1.2-0.5-0.9-0.6-0.8-0.7-0.8-1.4-0.1-0.9 0.2-1.3-0.2-0.6-5.3-6.7-0.3-0.8-0.6-0.7-0.6-0.7-3-1.7-0.4-0.6-0.4-0.9-0.8-2.6-0.1-0.7 0.1-0.8-0.2-0.7-0.4-0.6-1.6-0.8-0.4-0.4 0-0.8 0.2-0.7-0.1-0.6-0.4-0.4-0.8-0.2-1.2 0.6-0.6 0.1-0.6 0-2.8-1.1-1.3-0.8-0.7-0.2-0.6 0-0.6 0-0.6-0.2-0.9-1.7-0.7-0.9-2.3-2.6-1-1.4-0.1-0.5 0.2-0.5 0.6-0.9 0.1-0.5-0.4-0.5-0.9-0.4-2.3-0.1-3.6-1.4-0.9-0.8-2.5-1.2-2.9-2-2.7-1.4-0.7 0.1-0.6 0.2-0.6 0.3-0.6 0.1-0.6-0.1-1.3-0.4-9.4-1.2-0.8-0.2-0.5-0.4-0.3-0.5 0.2-1.6 0-0.8-0.2-0.6-0.4-0.5-0.5-0.4-1.1-0.2-0.8-0.4-2.4-1.4-1-0.2-0.5-0.3-0.5-0.5-0.5-1.8-0.4-0.7-1-0.4-1.6-0.1-0.7-0.1-1.5-0.4-0.5-0.1-0.5 0.1-0.1 0-0.3 0.1-0.5-0.1-0.5-0.4-0.5-1.1-0.5-0.7-0.8-0.5-0.8-0.3-0.6-0.6-0.7-0.8-0.9-1.6-2.2-2-1.2-0.8-0.5-0.5-2-3.5-1.2-1.2-0.6-0.4-1.3-0.8-0.5-0.4-0.5-0.4-0.9-0.8-1.3-0.6-0.5-0.3-0.6-0.8-0.5-1.1-1.8-4.2-0.2-0.3-0.4-0.3-0.6-0.3-0.6-0.3-0.3-0.4-0.2-0.9 0-0.6-0.2-0.7-0.4-0.4-0.9-0.4-0.6-0.2-0.5 0-0.3-0.4-0.2-0.8-0.2-3.4-0.2-1-0.5-0.6-1.1-0.7-0.7-0.2-1-0.2-0.5-0.6-0.7-1.1-1.2-2.6-0.2-1.2 0-0.6 0.3-0.3-0.2-0.3-0.4-0.4-2.8-1.7-0.9-0.3-0.6-0.5-5.2-6.1-0.9-1.9-1.7-5.9 1.9 0-3.6 0.5-8.1 1.9-4.8-0.1-4.3-1.1-3.1-0.2-0.6-0.1-2.3-0.7-1.2-0.6-0.3-0.4-0.1-0.6 1.5-1.3 16.5-11.4 0.5-0.7 0.3-1.1 6.2-29-0.1-0.8-0.7 0-4.9 1.6-1.1 0.1-0.6-0.3-0.5-1.4-0.4-1.1-0.8-1-1-1.1-0.4-0.5-0.1-0.7 0.2-1.1 0.3-0.7 0.3-0.5 0.7-0.3 0.8-0.6 0.8-0.8-0.1-1.5 1.1-2.7 0.3-1.3 0-6.5 0.7-0.2 0.9 0.3 3.9 2.8 1.1 0.4 1-0.5 0.8-0.8 2-2.5 0.8-1.8 0.9-2.4 0.4-1.2 0-1-0.2-4 0-1.1 0.2-0.7 6.9-16.9 0.2-0.8 0.6-5.9 0.2-0.7 7.7-16.4 0.3-1.3 0-1.2-3.6-6.1-0.4-0.2-0.5 0.1-1.7 1.1-0.4 0.1-0.4-0.3-0.8-3.1-0.8-1.3-1.7-0.1-8.1 2-1-0.3-0.5-1.5-0.8-3.7-0.4-1.4-0.7-0.1-0.6 0.1-1.2 0.6-0.6 0.2-5.2 1.1-0.7 0-0.7-0.4-5.3-4-7.6-3.9-1-0.2-1.7-0.1-2 0.9-2 0.6-1.3-0.3-1.2-2.5-0.4-1.3-0.2-1.2 0-1.5 1.3-6-0.2-1-0.3-1.2-1-2.1-0.7-1.3-3.1-3.2-1-1.5-0.9-2.8-0.1-1-0.4-0.7-0.6-0.9-2.6-2.4-0.5-0.6-0.5-0.8-2.7-5.3-1.2-3.3-1.6-2-5.9-5.5 1-2.1 0.6-0.7 1.2-0.8 0.9-0.2 0.9 0.2 0.8 0.5 0.7 0.5 1 0.6 1.2 0.4 3.8 0.8 0.7 0 0.9-0.1 0.7-0.2 0.6-0.5 0.4-0.6 0-1.4-0.4-0.9-0.6-0.8-1.7-1.7-0.8-0.9-0.4-0.9-0.2-1 0.1-1 0.4-1.9 0.6-1.1 1-1.3 5.1-4.6 0.5-0.5 0.3-0.7-0.3-1-0.5-0.6-1.5-1.6-0.8-0.6-1-0.6-0.7-0.6-0.3-0.9-0.1-1.4 0.1-4.9 0.2-1 0.5-1.9 0.9-2.3 0-0.8 0.4-0.9 0.7-1 2.7-2 1.5-0.6 1.3-0.3 7 1.3 0.6 0 0.4-0.4 0-0.8-0.1-0.7-0.5-1.2-1.6-6.5-1.1-2.7 0-0.4 0-0.5 0.3-0.6 2-3.3 1.4-1.1 8.1-4.7 5.1-2.1 0.5-0.3 0.4-0.6 0.3-0.9 0-0.8-0.1-0.7-0.7-2.5 0-0.7 0.3-0.7 11.5-13.9 2.1-2.1 1.9-1.5 0.8-1.8 3.1-3.4 1.6-0.2 0.8 0.2 6 4.9 5.8 0.8 1 0 1.3-0.2 2.4-1.2 13.7-11.6 1.5-0.8 1.1-0.4 1.3-0.2 1.4 0.1 0.8 0.2 0.8 0.5 0.6 0.7 0.8 0.6 0.8 0.5 0.9 0.7 0.8 0.8 0.7 0.5 0.6 0.3 1.8 0.8 0.7 0.4 0.5 0.4 1.8 2.4 1.1 1.1 1.4 0.8 2.7 0.8 0.7 0.4 0.4 0.4 0.7 0.9 0.7 0.6 0.5 0.3 0.6 0.3 1.1 0.3 2.9 0.4 2.2 0 3.1 0.5 0.8 0 0.7-0.3 0.4-0.3 0.3-0.2 0.5-0.2 0.6-0.3 1.1-0.8 0.4-0.1 0.6 0 2.2 1.3 0.8 0.2 0.8 0.3 0.8 0.1 1-0.1 11.6-10.7 0.8-1.4 0.3-2-0.6-9 0.2-0.7 0.4-0.7 1.3-1.5 0.4-0.8 0.3-0.7 0.6-3 1.3-2.4 0.1-0.8 0-0.7-0.6-2.5 0-0.8 0.2-0.7 0.3-0.8 1.5-2.7 0.2-0.6 0.1-0.7-0.3-0.6-0.1-0.7-0.3-1.5-0.3-0.6-0.3-0.5-1-0.7-0.4-0.5-0.4-0.4-0.3-0.6-0.3-0.6-0.1-0.7-0.1-0.8 0.2-2.2 0-0.8-0.2-0.6-0.5-1.3 0-0.9 0.1-1.1 0.6-1.4 0.1-0.9-0.2-0.7-4.8-5.4 0-0.1-0.3-0.6-0.1-0.7-0.2-1.5-0.2-0.6-0.3-0.6-0.4-0.4-2.6-1.7-0.5-0.4-0.4-0.5-0.3-0.5-0.2-0.7-0.3-0.6-0.3-0.5-0.4-0.4-0.6-0.2-1.4-0.3-0.7-0.2-0.5-0.3-0.4-0.4-0.8-1-0.3-0.6-0.2-0.6 0-0.8 0.1-0.6 0-0.7-0.3-0.5-0.4-0.3-0.6-0.1-2.3-0.2-1.3-0.4-0.6-0.2-0.5-0.4-0.9-0.7-0.4-0.5-1.6-2.7-0.4-0.5-0.6-0.2-0.3-0.7 0-1.3 1-3.1 0.1-2.5-0.2-2.4-0.4-2-0.5-1.6-0.7-0.9-1.5-1-1.9-0.5-1.9-0.2-2.1 1.3-0.7 0.3-0.4-0.2 0-3.6 0.6-5.1 1.4-2.6 0.8-4.4-0.1-1.7-0.3-0.9-0.7-0.9 0.4-0.6 0.9-0.7 8.7-4.2 0.7-0.2 0.7-0.1 18.1-0.8 0.8-0.1 0.6-0.2 0.6-0.6-0.8-0.1-0.4 0-0.2-0.1 0-0.3 0.1-0.4 0.3-0.7 0.1-0.4-0.1-0.3-0.1-0.2-0.1-0.4 0-0.6 0.2-1.1 0.3-0.6 2.8-2.1 0.6-0.8 0.3-0.5 0.1-0.4 0-0.3-0.2-0.3-0.1-0.2-0.2-0.3-0.1-0.5-0.1-0.6 0-0.4-0.1-0.2-0.2-0.2-0.1-0.1-0.1-0.2-0.1-0.5-0.2-0.3-0.1-0.4 0.1-0.6 1.3-2.5 1.1-0.6 9.9-0.3 1.1 0 0.9 0.4 3.2 1.7 3.4 0.9 1.5 0.2 1.5-0.1 3.4-0.9 0.8-0.3 0.9-0.5 0.2-0.6-0.2-0.4-0.3-0.4-0.4-0.3-0.2-0.3-0.1-0.6-0.2-1.4 0-1.5 0.3-2.3 1.3-3.9 0.1-0.8-0.1-3 0.1-1 2-9.9 0.1-1.3-0.1-1.3-0.5-1.7-0.4-2 1.3-6.5 0.2-10.2 0.2-1 0.7-0.6 1.3-0.5 1.5-0.9 0.6-1-0.1-0.9-0.7-0.8-0.9-0.4-3.6-0.8-0.7-0.3-0.5-0.5 0.3-0.6 0.9-0.9 16.2-13.4 5.1-4.7 5.9 5.5 1.6 2 1.2 3.3 2.7 5.3 0.5 0.8 0.5 0.6 2.6 2.4 0.6 0.9 0.4 0.7 0.1 1 0.9 2.8 1 1.5 3.1 3.2 0.7 1.3 1 2.1 0.3 1.2 0.2 1-1.3 6 0 1.5 0.2 1.2 0.4 1.3 1.2 2.5 1.3 0.3 2-0.6 2-0.9 1.7 0.1 1 0.2 7.6 3.9 5.3 4 0.7 0.4 0.7 0 5.2-1.1 0.6-0.2 1.2-0.6 0.6-0.1 0.7 0.1 0.4 1.4 0.8 3.7 0.5 1.5 1 0.3 8.1-2 1.7 0.1 0.8 1.3 0.8 3.1 0.4 0.3 0.4-0.1 1.7-1.1 0.5-0.1 0.4 0.2 3.6 6.1 0 1.2-0.3 1.3-7.7 16.4-0.2 0.7-0.6 5.9-0.2 0.8-6.9 16.9-0.2 0.7 0 1.1 0.2 4 0 1-0.4 1.2-0.9 2.4-0.8 1.8-2 2.5-0.8 0.8-1 0.5-1.1-0.4-3.9-2.8-0.9-0.3-0.7 0.2 0 6.5-0.3 1.3-1.1 2.7 0.1 1.5-0.8 0.8-0.8 0.6-0.7 0.3-0.3 0.5-0.3 0.7-0.2 1.1 0.1 0.7 0.4 0.5 1 1.1 0.8 1 0.4 1.1 0.5 1.4 0.6 0.3 1.1-0.1 4.9-1.6 0.7 0 0.1 0.8-6.2 29-0.3 1.1-0.5 0.7-16.5 11.4-1.5 1.3 0.1 0.6 0.3 0.4 1.2 0.6 2.3 0.7 0.6 0.1 3.1 0.2 4.3 1.1 4.8 0.1 8.1-1.9 3.6-0.5 1.9 0 1.7 5.9 0.9 1.9 5.2 6.1 0.6 0.5 0.9 0.3 2.8 1.7 0.4 0.4 0.2 0.3-0.3 0.3 0 0.6 0.2 1.2 1.2 2.6 0.7 1.1 0.5 0.6 1 0.2 0.7 0.2 1.1 0.7 0.5 0.6 0.2 1 0.2 3.4 0.2 0.8 0.3 0.4 0.5 0 0.6 0.2 0.9 0.4 0.4 0.4 0.2 0.7 0 0.6 0.2 0.9 0.3 0.4 0.6 0.3 0.6 0.3 0.4 0.3 0.2 0.3 1.8 4.2 0.5 1.1 0.6 0.8 0.5 0.3 1.3 0.6 0.9 0.8 0.5 0.4 0.5 0.4 1.3 0.8 0.6 0.4 1.2 1.2 2 3.5 0.5 0.5 1.2 0.8 2.2 2 0.9 1.6 0.7 0.8 0.6 0.6 0.8 0.3 0.8 0.5 0.5 0.7 0.5 1.1 0.5 0.4 0.5 0.1 0.3-0.1 0.1 0 0.5-0.1 0.5 0.1 1.5 0.4 0.7 0.1 1.6 0.1 1 0.4 0.4 0.7 0.5 1.8 0.5 0.5 0.5 0.3 1 0.2 2.4 1.4 0.8 0.4 1.1 0.2 0.5 0.4 0.4 0.5 0.2 0.6 0 0.8-0.2 1.6 0.3 0.5 0.5 0.4 0.8 0.2 9.4 1.2 1.3 0.4 0.6 0.1 0.6-0.1 0.6-0.3 0.6-0.2 0.7-0.1 2.7 1.4 2.9 2 2.5 1.2 0.9 0.8 3.6 1.4 2.3 0.1 0.9 0.4 0.4 0.5-0.1 0.5-0.6 0.9-0.2 0.5 0.1 0.5 1 1.4 2.3 2.6 0.7 0.9 0.9 1.7 0.6 0.2 0.6 0 0.6 0 0.7 0.2 1.3 0.8 2.8 1.1 0.6 0 0.6-0.1 1.2-0.6 0.8 0.2 0.4 0.4 0.1 0.6-0.2 0.7 0 0.8 0.4 0.4 1.6 0.8 0.4 0.6 0.2 0.7-0.1 0.8 0.1 0.7 0.8 2.6 0.4 0.9 0.4 0.6 3 1.7 0.6 0.7 0.6 0.7 0.3 0.8 5.3 6.7 0.2 0.6-0.2 1.3 0.1 0.9 0.8 1.4 0.8 0.7 0.9 0.6 1.2 0.5 0.3 0.6 0 0.6-0.2 0.6-0.1 0.7 0.1 1.2-0.2 0.3-0.1 0.2-0.1 0.1-0.1 0.2-0.2 0.3-0.2 0.6 0.4 0.3 0.6 0.1 0.7 0 0.9 0.3 1.1 0.4 1.6 1.1 0.8 0.8 0.7 1.1 0.7 0.7 1.3 1 0.5 0.8 0.7 1.8 0.4 0.4 0.7 0.2 1.5-0.2 1.1 0 0.5 0.4 0.3 0.6 0 1.5 0.2 0.6 0.4 0.7 1 1.2 0.3 0.6 0.2 0.6 0.3 1.8 0.5 1.1 0.5 0.7 0.6 0.4 1.7 0.3 1.2 0.4 0.6 0.5 0.2 0.7-0.2 1.4 0.5 0.3 0.6 0.1 1.4-0.1 0.8 0.1 0.9 0.4 0.5 0.5 0.1 0.7 0.1 0.9 0.2 1 0.9 1.5 0.3 0.9 0.1 1.5 0.2 0.9 1.4 2 0.3 0.7 0.2 1.6 0.3 0.9 0.6 0.5 0.8 0.3 0.8 0.1 0.6-0.1 0.7 0.1 0.5 0.6 1.6 3.1z",
};

// ─── MOBILE NAV ────────────────────────────────────────────────────────────────
function MobileNav({ TABS, activeTab, setActiveTab }) {
  const [showMore, setShowMore] = useState(false);
  const PRIMARY = TABS.slice(0, 5);
  const MORE = TABS.slice(5);
  const moreActive = MORE.some(t => t.id === activeTab);

  return (
    <>
      {/* More drawer backdrop */}
      {showMore && (
        <div onClick={() => setShowMore(false)}
          style={{ position: "fixed", inset: 0, zIndex: 198, background: "rgba(0,0,0,0.5)" }} />
      )}

      {/* More drawer */}
      {showMore && (
        <div style={{ position: "fixed", bottom: 65, left: 0, right: 0, background: "#0a1a0c", border: "1px solid #1f3525", borderRadius: "16px 16px 0 0", padding: "16px 12px 8px", zIndex: 99, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          <div style={{ width: "100%", fontSize: 9, fontFamily: "'Space Mono', monospace", color: "#3d6b4a", letterSpacing: "0.12em", textAlign: "center", marginBottom: 4 }}>MORE</div>
          {MORE.map(tab => (
            <button key={tab.id}
              onClick={() => { setActiveTab(tab.id); setShowMore(false); }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: activeTab === tab.id ? "#152218" : "transparent", border: activeTab === tab.id ? "1px solid #2d7a4f" : "1px solid #1f3525", borderRadius: 12, padding: "10px 16px", cursor: "pointer", minWidth: 80 }}>
              <span style={{ fontSize: 22 }}>{tab.icon}</span>
              <span style={{ fontSize: 9, fontFamily: "'Space Mono', monospace", color: activeTab === tab.id ? "#7ec99a" : "#5c8f6b", letterSpacing: "0.06em", textTransform: "uppercase" }}>{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Bottom bar */}
      <div className="bottom-nav">
        {PRIMARY.map(tab => (
          <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            style={{ color: "#3d6b4a" }} onClick={() => { setActiveTab(tab.id); setShowMore(false); }}>
            <span className="tab-icon">{tab.icon}</span>
          </button>
        ))}
        {/* More button */}
        <button className={`tab-btn ${moreActive || showMore ? "active" : ""}`}
          style={{ color: "#3d6b4a" }} onClick={() => setShowMore(v => !v)}>
          <span className="tab-icon">{showMore ? "✕" : "••••"}</span>
        </button>
      </div>
    </>
  );
}

// ─── NOTIFICATION PANEL ───────────────────────────────────────────────────────
const NOTIF_ICONS = { message: "✉️", price: "📈", pest: "🚨", weather: "🌧️", system: "🌿" };
const NOTIF_COLORS = { message: "#7ec99a", price: "#d4a017", pest: "#e07060", weather: "#5a9fd4", system: "#7ec99a" };

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function NotificationPanel({ notifications, onClose, onMarkRead, onMarkAllRead }) {
  const unreadCount = notifications.filter(n => !n.read).length;
  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300 }} />
      {/* Panel */}
      <div style={{ position: "fixed", right: 0, left: 0, top: 70, margin: "0 16px", width: "auto", maxWidth: 400, background: "#0d1a0f", border: "1px solid #2d5a36", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.6)", zIndex: 500, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #1f3525" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#c8e8d4" }}>Notifications</div>
            {unreadCount > 0 && <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#5c8f6b", marginTop: 2 }}>{unreadCount} UNREAD</div>}
          </div>
          {unreadCount > 0 && (
            <button onClick={onMarkAllRead} style={{ background: "none", border: "1px solid #2d5a36", borderRadius: 6, padding: "4px 10px", color: "#5c8f6b", fontSize: 10, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>
              Mark all read
            </button>
          )}
        </div>
        {/* List */}
        <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {notifications.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "#3d6b4a", fontSize: 12 }}>No notifications yet</div>
          ) : notifications.map(n => (
            <div key={n.id} onClick={() => onMarkRead(n.id)}
              style={{ display: "flex", gap: 12, padding: "12px 16px", borderBottom: "1px solid #1a2e1e", background: n.read ? "transparent" : "rgba(45,122,79,0.08)", cursor: "pointer", transition: "background 0.2s" }}
              onMouseOver={e => e.currentTarget.style.background = "rgba(45,122,79,0.12)"}
              onMouseOut={e => e.currentTarget.style.background = n.read ? "transparent" : "rgba(45,122,79,0.08)"}>
              {/* Icon */}
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${NOTIF_COLORS[n.type]}20`, border: `1px solid ${NOTIF_COLORS[n.type]}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                {NOTIF_ICONS[n.type] || "🔔"}
              </div>
              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: n.read ? "#8aaa94" : "#c8e8d4", lineHeight: 1.3 }}>{n.title}</div>
                  {!n.read && <div style={{ width: 7, height: 7, borderRadius: "50%", background: NOTIF_COLORS[n.type], flexShrink: 0, marginTop: 4 }} />}
                </div>
                <div style={{ fontSize: 11, color: "#5c8f6b", marginTop: 3, lineHeight: 1.4 }}>{n.body}</div>
                <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#3d6b4a", marginTop: 4 }}>{timeAgo(n.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── CROP HECTARE ROW (inline editable) ───────────────────────────────────────
function CropHectareRow({ crop, onUpdate }) {
  const isLivestock = crop.type === "livestock";
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(isLivestock ? (crop.head_count ?? "") : (crop.hectares ?? ""));
  const [stage, setStage] = useState(crop.crop_stage || "");
  const [saving, setSaving] = useState(false);

  const currentVal = isLivestock ? crop.head_count : crop.hectares;
  const unit = isLivestock ? "head" : "ha";
  const placeholder = isLivestock ? "e.g. 24" : "e.g. 5.5";

  const CROP_STAGES = ["land_prep","seeding","germination","vegetative","flowering","grain_fill","harvesting","post_harvest","fallow"];
  const CROP_STAGE_LABELS = { land_prep:"🚜 Land Prep", seeding:"🌱 Seeding", germination:"🌿 Germination", vegetative:"🌾 Vegetative", flowering:"🌸 Flowering", grain_fill:"🫘 Grain Fill", harvesting:"🌾 Harvesting", post_harvest:"📦 Post Harvest", fallow:"🟫 Fallow" };
  const LIVE_STAGES = ["breeding","pregnant","lactating","growing","fattening","selling"];
  const LIVE_STAGE_LABELS = { breeding:"❤️ Breeding", pregnant:"🐣 Pregnant", lactating:"🍼 Lactating", growing:"📈 Growing", fattening:"🥩 Fattening", selling:"💰 Ready to Sell" };

  const stages = isLivestock ? LIVE_STAGES : CROP_STAGES;
  const stageLabels = isLivestock ? LIVE_STAGE_LABELS : CROP_STAGE_LABELS;

  const handleSave = async () => {
    setSaving(true);
    const parsed = value !== "" ? (isLivestock ? parseInt(value) : parseFloat(value)) : null;
    const updateData = isLivestock
      ? { head_count: parsed, crop_stage: stage || null }
      : { hectares: parsed, crop_stage: stage || null };
    await onUpdate(crop.id, updateData);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div style={{ marginBottom: 8, background: "#0f2218", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editing ? 8 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: isLivestock ? "rgba(90,143,163,0.2)" : "rgba(45,122,79,0.2)", color: isLivestock ? "#5a9fd4" : "#7ec99a", flexShrink: 0 }}>
            {isLivestock ? "🐄" : "🌾"} {crop.crop_name}
          </span>
          {!editing && (
            <span style={{ fontSize: 10, color: currentVal ? "#c8b43c" : "#3d6b4a" }}>
              {currentVal != null ? `${currentVal} ${unit}` : `— ${unit}`}
            </span>
          )}
          {!editing && stage && (
            <span style={{ fontSize: 10, color: "#5c8f6b" }}>{stageLabels[stage]}</span>
          )}
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)} style={{ background: "none", border: "1px solid #2d5a36", borderRadius: 5, padding: "1px 8px", color: "#4a7a5a", fontSize: 9, cursor: "pointer" }}>edit</button>
        ) : (
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={handleSave} disabled={saving} style={{ background: "#2d7a4f", border: "none", borderRadius: 6, padding: "2px 10px", color: "#e8dfc8", fontSize: 10, cursor: "pointer" }}>{saving ? "..." : "✓"}</button>
            <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", color: "#4a7a5a", fontSize: 12, cursor: "pointer" }}>✕</button>
          </div>
        )}
      </div>

      {editing && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <div>
            <label style={{ fontSize: 9, color: "#4a7a5a", display: "block", marginBottom: 3 }}>{isLivestock ? "HEAD COUNT" : "HECTARES"}</label>
            <input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder}
              style={{ width: "100%", background: "#1a2e1e", border: "1px solid #4aad72", borderRadius: 6, padding: "4px 8px", color: "#e8dfc8", fontSize: 11, outline: "none" }}
              autoFocus onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: "#4a7a5a", display: "block", marginBottom: 3 }}>CURRENT STAGE</label>
            <select value={stage} onChange={e => setStage(e.target.value)}
              style={{ width: "100%", background: "#1a2e1e", border: "1px solid #2d5a36", borderRadius: 6, padding: "4px 6px", color: "#e8dfc8", fontSize: 11, outline: "none" }}>
              <option value="">Select stage</option>
              {stages.map(s => <option key={s} value={s}>{stageLabels[s]}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

function FarmerMapModal({ farmers, onClose, loadFarmers }) {
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const farmersWithCoords = farmers.filter(f => f.latitude && f.longitude);
  const districtCounts = {};
  farmers.forEach(f => { if (f.district) districtCounts[f.district] = (districtCounts[f.district] || 0) + 1; });
  const districtDots = [];
  const seen = new Set();
  farmersWithCoords.forEach(f => {
    if (!seen.has(f.district)) {
      seen.add(f.district);
      const pos = latLngToMapXY(f.latitude, f.longitude);
      districtDots.push({ district: f.district, province: f.province, count: districtCounts[f.district] || 1, ...pos, farmers: farmersWithCoords.filter(x => x.district === f.district) });
    }
  });

  // Province fill colors — highlight if has farmers
  const activeProv = new Set(farmers.map(f => {
    const map = { "Matabeleland North": "ZWMN", "Matabeleland South": "ZWMS", "Masvingo": "ZWMV", "Mashonaland West": "ZWMW", "Mashonaland Central": "ZWMC", "Mashonaland East": "ZWME", "Manicaland": "ZWMA", "Midlands": "ZWMI", "Harare": "ZWHA", "Bulawayo": "ZWBU" };
    return map[f.province];
  }).filter(Boolean));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ borderRadius: "20px 20px 0 0", maxHeight: "92vh" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#c8e8d4" }}>Farmer Distribution Map</div>
            <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: "#4a7a5a" }}>{farmers.length} REGISTERED FARMERS · ZIMBABWE</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#4a7a5a", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ background: "#080f09", borderRadius: 12, border: "1px solid #1f3525", overflow: "hidden", marginBottom: 14 }}>
          <svg viewBox="0 0 1000 918" style={{ width: "100%", height: "auto", display: "block" }}
            xmlns="http://www.w3.org/2000/svg">
            <style>{`
              .zw-prov { fill: #0f2218; stroke: #3a7a50; stroke-width: 0.8; transition: fill 0.2s; cursor: pointer; }
              .zw-prov:hover { fill: #1a3528; }
              .zw-active { fill: #122a1c; }
              .prov-label { font-family: monospace; font-size: 20px; fill: #3a6b48; text-anchor: middle; pointer-events: none; }
              .city-dot { fill: #5c8f6b; }
              .city-label { font-family: monospace; font-size: 14px; fill: #5c8f6b; }
            `}</style>

            {/* All 10 province paths from simplemaps */}
            <path className={`zw-prov${activeProv.has("ZWMN") ? " zw-active" : ""}`} d={ZW_PROVINCES.ZWMN} id="ZWMN"/>
            <path className={`zw-prov${activeProv.has("ZWMS") ? " zw-active" : ""}`} d={ZW_PROVINCES.ZWMS} id="ZWMS"/>
            <path className={`zw-prov${activeProv.has("ZWMV") ? " zw-active" : ""}`} d={ZW_PROVINCES.ZWMV} id="ZWMV"/>
            <path className={`zw-prov${activeProv.has("ZWMW") ? " zw-active" : ""}`} d={ZW_PROVINCES.ZWMW} id="ZWMW"/>
            <path className={`zw-prov${activeProv.has("ZWMC") ? " zw-active" : ""}`} d={ZW_PROVINCES.ZWMC} id="ZWMC"/>
            <path className={`zw-prov${activeProv.has("ZWME") ? " zw-active" : ""}`} d={ZW_PROVINCES.ZWME} id="ZWME"/>
            <path className={`zw-prov${activeProv.has("ZWMA") ? " zw-active" : ""}`} d={ZW_PROVINCES.ZWMA} id="ZWMA"/>
            <path className={`zw-prov${activeProv.has("ZWMI") ? " zw-active" : ""}`} d={ZW_PROVINCES.ZWMI} id="ZWMI"/>
            <path className={`zw-prov${activeProv.has("ZWHA") ? " zw-active" : ""}`} d={ZW_PROVINCES.ZWHA} id="ZWHA"/>
            <path className={`zw-prov${activeProv.has("ZWBU") ? " zw-active" : ""}`} d={ZW_PROVINCES.ZWBU} id="ZWBU"/>

            {/* Province labels (from simplemaps label_points centroids) */}
            <text className="prov-label" x="275.7" y="437.2">Mat North</text>
            <text className="prov-label" x="461.3" y="692.9">Mat South</text>
            <text className="prov-label" x="754.7" y="667.4">Masvingo</text>
            <text className="prov-label" x="584" y="212.1">Mash West</text>
            <text className="prov-label" x="749.9" y="180.6">Mash Central</text>
            <text className="prov-label" x="745.6" y="404.2">Mash East</text>
            <text className="prov-label" x="869.4" y="397">Manicaland</text>
            <text className="prov-label" x="582.2" y="495.6">Midlands</text>
            <text className="prov-label" x="724" y="330">Harare</text>
            <text className="prov-label" x="433.8" y="612">Bulawayo</text>

            {/* City dots */}
            <circle cx="724" cy="313.6" r="5" className="city-dot"/>
            <circle cx="433.8" cy="595.2" r="5" className="city-dot"/>

            {/* Farmer dots — plotted using calibrated lat/lng → SVG coords */}
            {districtDots.map((d, i) => {
              const r = Math.min(10 + d.count * 4, 28);
              const isSelected = selectedDistrict?.district === d.district;
              return (
                <g key={i} onClick={() => setSelectedDistrict(isSelected ? null : d)} style={{ cursor: "pointer" }}>
                  <circle cx={d.x} cy={d.y} r={r + 10} fill="#7ec99a" opacity="0.12"/>
                  <circle cx={d.x} cy={d.y} r={r} fill={isSelected ? "#5cd68a" : "#2d7a4f"} stroke={isSelected ? "#c8e8d4" : "#7ec99a"} strokeWidth="2"/>
                  <text x={d.x} y={d.y + 1} textAnchor="middle" dominantBaseline="middle" fill="#e8dfc8" fontSize="12" fontWeight="bold" fontFamily="monospace" style={{ pointerEvents: "none" }}>{d.count}</text>
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(8,15,9,0.92)", borderRadius: 8, padding: "6px 10px", border: "1px solid #1f3525" }}>
            <div style={{ fontSize: 9, fontFamily: "'Space Mono', monospace", color: "#4a7a5a", marginBottom: 4 }}>FARMERS</div>
            {[{ r: 8, label: "1–2" }, { r: 11, label: "3–5" }, { r: 14, label: "6+" }].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                <svg width={l.r * 2 + 4} height={l.r * 2 + 4}><circle cx={l.r + 2} cy={l.r + 2} r={l.r} fill="#2d7a4f" stroke="#7ec99a" strokeWidth="1.5" /></svg>
                <span style={{ fontSize: 9, color: "#8aaa94", fontFamily: "'Space Mono', monospace" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {selectedDistrict ? (
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#c8e8d4" }}>{selectedDistrict.district}</div>
                <div style={{ fontSize: 11, color: "#5c8f6b" }}>{selectedDistrict.province}</div>
              </div>
              <div style={{ background: "rgba(45,122,79,0.2)", color: "#7ec99a", fontFamily: "'Space Mono', monospace", fontSize: 12, padding: "4px 10px", borderRadius: 20 }}>
                {selectedDistrict.count} farmer{selectedDistrict.count > 1 ? "s" : ""}
              </div>
            </div>
            {selectedDistrict.farmers.map((f, i) => (
              <div key={i} style={{ padding: "10px 0", borderTop: i > 0 ? "1px solid #1a2e1e" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 20 }}>👩🏾‍🌾</div>
                  <div>
                    <div style={{ fontSize: 13, color: "#c8e8d4", fontWeight: 600 }}>{maskName(f.name)}</div>
                    <div style={{ fontSize: 10, color: "#4a7a5a", fontFamily: "'Space Mono', monospace" }}>{f.ward}</div>
                  </div>
                </div>
                {f.farmer_crops && f.farmer_crops.length > 0 && (
                  <div style={{ paddingLeft: 28 }}>
                    {f.farmer_crops.map((c, j) => (
                      <CropHectareRow key={j} crop={c} onUpdate={(id, data) => {
                        db.patch("farmer_crops", id, data).then(() => loadFarmers());
                      }} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "10px 0", color: "#4a7a5a", fontSize: 11, fontFamily: "'Space Mono', monospace" }}>
            TAP A GREEN DOT TO SEE FARMERS IN THAT DISTRICT
          </div>
        )}

        <div className="section-title" style={{ marginTop: 12 }}>Farmers by Province</div>
        {Object.entries(farmers.reduce((acc, f) => { acc[f.province] = (acc[f.province] || 0) + 1; return acc; }, {}))
          .sort((a, b) => b[1] - a[1]).map(([prov, count]) => (
            <div key={prov} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1, fontSize: 13, color: "#c8e8d4" }}>{prov}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ height: 6, borderRadius: 3, background: "linear-gradient(90deg, #2d7a4f, #5cd68a)", width: Math.max(20, (count / farmers.length) * 140) }} />
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#7ec99a", minWidth: 16 }}>{count}</div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
// ─── HOME TAB ──────────────────────────────────────────────────────────────────
function HomeTab({ setActiveTab, farmerCount, listingCount, weather, getWeatherIcon, onFarmerMapClick }) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const [prices, setPrices] = useState(PRICE_ALERTS);
  const [pricesLoading, setPricesLoading] = useState(true);

  useEffect(() => {
    db.get("price_feed", "?order=created_at.desc&limit=4").then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setPrices(data.map(p => ({
          crop: p.crop,
          change: `${p.change_pct > 0 ? "+" : ""}${p.change_pct}%`,
          price: `USD ${p.price_usd}/${p.unit}`,
          trend: p.trend === "up" ? "up" : "down",
          region: p.source,
        })));
      }
      setPricesLoading(false);
    }).catch(() => setPricesLoading(false));
  }, []);
  return (
    <div className="fade-in two-col">
      {/* LEFT COLUMN */}
      <div style={{ padding: "20px 16px" }}>
        {/* Hero */}
        <div style={{ background: "linear-gradient(135deg, #1a3d24 0%, #0f2a18 100%)", borderRadius: 16, padding: "24px 20px", marginBottom: 16, position: "relative", overflow: "hidden", border: "1px solid #2d5a36" }}>
          <div className="hero-grain" />
          <div style={{ position: "absolute", right: -20, top: -20, fontSize: 100, opacity: 0.07 }}>🌿</div>
          <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: "#5cd68a", letterSpacing: "0.15em", marginBottom: 8 }}>ZIMBABWE'S FARMING PLATFORM</div>
          <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: "#d8f0e0", marginBottom: 8 }}>Connect. Grow.<br /><span style={{ color: "#7ec99a" }}>Prosper.</span></div>
          <div style={{ fontSize: 14, color: "#8aaa94", lineHeight: 1.5, marginBottom: 20 }}>Linking farmers to markets, advisors, and buyers across Zimbabwe.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" style={{ width: "auto", padding: "10px 18px", fontSize: 11 }} onClick={() => setActiveTab("register")}>Register Farm</button>
            <button className="btn-secondary" style={{ padding: "10px 18px", fontSize: 11 }} onClick={() => setActiveTab("market")}>Browse Market</button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gap: 8, marginBottom: 16 }} className="stats-row">
          <div onClick={onFarmerMapClick} style={{ background: "#152218", border: "1px solid #2d7a4f", borderRadius: 10, padding: "12px 8px", textAlign: "center", cursor: "pointer" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>👩🏾‍🌾</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, color: "#7ec99a", fontWeight: 700 }}>{farmerCount}</div>
            <div style={{ fontSize: 9, color: "#4a7a5a", marginTop: 2, fontFamily: "'Space Mono', monospace" }}>Farmers</div>
            <div style={{ fontSize: 8, color: "#2d7a4f", marginTop: 2, fontFamily: "'Space Mono', monospace" }}>TAP MAP ↗</div>
          </div>
          {[{ label: "Listings", value: listingCount, icon: "🛒", tab: "market" }, { label: "Districts", value: "60+", icon: "📍", tab: "register" }].map(s => (
            <div key={s.label} onClick={() => setActiveTab(s.tab)} style={{ background: "#152218", border: "1px solid #1f3525", borderRadius: 10, padding: "12px 8px", textAlign: "center", cursor: "pointer" }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, color: "#7ec99a", fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#4a7a5a", marginTop: 2, fontFamily: "'Space Mono', monospace" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="section-title">Quick Actions</div>
        <div style={{ display: "grid", gap: 8 }} className="quick-grid">
          {[{ label: "AI Farm Advisor", icon: "🤖", desc: "Get instant advice", tab: "advisory" }, { label: "Sell Produce", icon: "📦", desc: "List your harvest", tab: "market" }, { label: "Crop Mapping", icon: "🗺️", desc: "Register your farm", tab: "register" }, { label: "Market Insights", icon: "📈", desc: "Yield & price data", tab: "insights" }].map((a, i) => (
            <button key={i} onClick={() => setActiveTab(a.tab)} style={{ background: "#152218", border: "1px solid #1f3525", borderRadius: 12, padding: "14px 12px", textAlign: "left", cursor: "pointer", transition: "border-color 0.2s" }} onMouseOver={e => e.currentTarget.style.borderColor = "#3a7a50"} onMouseOut={e => e.currentTarget.style.borderColor = "#1f3525"}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{a.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#c8e8d4", marginBottom: 2 }}>{a.label}</div>
              <div style={{ fontSize: 11, color: "#4a7a5a" }}>{a.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div style={{ padding: "20px 16px" }}>
        {/* Weather */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="section-title" style={{ margin: 0 }}>Weather — Harare</div>
            <div style={{ fontSize: 9, fontFamily: "'Space Mono', monospace", color: "#5cd68a" }}>● LIVE</div>
          </div>
          <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 4 }} className="weather-strip">
            {weather ? weather.time.map((t, i) => {
              const date = new Date(t);
              const label = i === 0 ? "Today" : days[date.getDay()];
              return (
                <div key={i} className="weather-day" style={i === 0 ? { borderColor: "#2d7a4f", background: "#1a2e1e" } : {}}>
                  <div style={{ fontSize: 9, fontFamily: "'Space Mono', monospace", color: "#4a7a5a", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{getWeatherIcon(weather.weathercode[i])}</div>
                  <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: "#e8dfc8" }}>{Math.round(weather.temperature_2m_max[i])}°</div>
                  <div style={{ fontSize: 9, fontFamily: "'Space Mono', monospace", color: "#4a7a5a" }}>{Math.round(weather.temperature_2m_min[i])}°</div>
                  <div style={{ fontSize: 9, color: "#5a9fd4", marginTop: 4 }}>{weather.precipitation_probability_max[i]}%</div>
                </div>
              );
            }) : [1,2,3,4,5,6].map(i => <div key={i} className="skeleton weather-day" style={{ height: 80 }} />)}
          </div>
          {weather && weather.precipitation_probability_max[0] > 60 && (
            <div style={{ marginTop: 10, background: "#1a2e1e", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#8aaa94", borderLeft: "3px solid #2d7a4f" }}>
              ⚠️ High rain probability today. Consider delaying fertiliser application.
            </div>
          )}
        </div>

        {/* Price Alerts */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div className="section-title" style={{ margin: 0 }}>📈 Live Market Prices</div>
          <button onClick={() => setActiveTab("prices")} style={{ background: "none", border: "none", color: "#4a7a5a", fontSize: 11, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>See all →</button>
        </div>
        <div style={{ display: "grid", gap: 8, marginBottom: 16 }} className="price-grid">
          {pricesLoading ? [1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 70, borderRadius: 10 }} />) :
          prices.map((p, i) => (
            <div key={i} style={{ background: "#152218", border: `1px solid ${p.trend === "up" ? "#1f3a25" : "#3a1f1f"}`, borderRadius: 10, padding: "12px", cursor: "pointer" }} onClick={() => setActiveTab("prices")}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#c8e8d4" }}>{p.crop}</div>
                <div style={{ fontSize: 11, color: p.trend === "up" ? "#5cd68a" : "#e07060", fontWeight: 600 }}>{p.trend === "up" ? "▲" : "▼"} {p.change}</div>
              </div>
              <div style={{ fontSize: 12, color: "#7ec99a", margin: "6px 0 4px", fontWeight: 600 }}>{p.price}</div>
              <div style={{ fontSize: 10, color: "#4a7a5a" }}>{p.region}</div>
            </div>
          ))}
        </div>

        {/* Sponsored */}
        <SponsorCard />

        {/* Pest Alerts */}
        <div className="section-title">🚨 Pest & Disease Alerts</div>
        {[{ name: "Fall Armyworm", risk: "High", regions: "Mash West, Mash Central", action: "Apply chlorpyrifos immediately" }, { name: "Stalk Borer", risk: "Medium", regions: "Midlands, Masvingo", action: "Monitor trap counts weekly" }, { name: "Tick Season", risk: "High", regions: "Matabeleland", action: "Dip cattle weekly with Triatix" }].map((p, i) => (
          <div key={i} style={{ background: "#152218", border: `1px solid ${p.risk === "High" ? "#5a2020" : "#3a4a20"}`, borderRadius: 10, padding: "12px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#c8e8d4" }}>{p.name}</div>
              <span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", background: p.risk === "High" ? "rgba(224,112,96,0.2)" : "rgba(200,180,60,0.2)", color: p.risk === "High" ? "#e07060" : "#c8b43c", padding: "2px 8px", borderRadius: 8 }}>{p.risk}</span>
            </div>
            <div style={{ fontSize: 11, color: "#5c8f6b", marginBottom: 2 }}>📍 {p.regions}</div>
            <div style={{ fontSize: 11, color: "#8aaa94" }}>💊 {p.action}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MARKET TAB ────────────────────────────────────────────────────────────────
function MarketTab({ listings, loadingListings, filterCrop, setFilterCrop, setShowListingModal, setShowContactModal, setShowListingDetail, authUser, loadListings }) {
  const filters = ["All", "Grain", "Livestock", "Horticulture", "Cash Crops"];
  const filterMap = { "Grain": ["Maize", "Wheat", "Sorghum"], "Livestock": ["Cattle", "Goats", "Sheep", "Pigs", "Poultry"], "Horticulture": ["Tomatoes", "Vegetables", "Sweet Potatoes"], "Cash Crops": ["Tobacco", "Cotton", "Coffee", "Soya", "Sunflower", "Groundnuts"] };
  const [search, setSearch] = useState("");
  const [editingListing, setEditingListing] = useState(null);
  const [featuringListing, setFeaturingListing] = useState(null);
  const [myTab, setMyTab] = useState("all");

  const myListings = authUser ? listings.filter(l =>
    l.auth_user_id === authUser.id ||
    l.farmer_name?.toLowerCase() === authUser.email?.split("@")[0]?.toLowerCase()
  ) : [];

  const filtered = (myTab === "mine" ? myListings : listings)
    .filter(l => filterCrop === "All" || (filterMap[filterCrop] || []).some(f => l.crop?.toLowerCase().includes(f.toLowerCase())))
    .filter(l => !search || l.crop?.toLowerCase().includes(search.toLowerCase()) || l.location?.toLowerCase().includes(search.toLowerCase()) || l.farmer_name?.toLowerCase().includes(search.toLowerCase()))
    // Featured listings appear first
    .sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));

  const handleFeatureListing = async (weeks, ref, method) => {
    if (!featuringListing) return;
    const expires = new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.patch("listings", featuringListing.id, { is_featured: true, featured_until: expires });
    await db.post("featured_listings", { listing_id: featuringListing.id, farmer_name: featuringListing.farmer_name, weeks, amount_usd: weeks * 2, status: "active", expires_at: expires, payment_reference: ref, payment_method: method });
    setFeaturingListing(null);
    loadListings();
  };

  const deleteListing = async (id) => {
    if (!window.confirm("Remove this listing?")) return;
    await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    loadListings();
  };

  return (
    <div className="fade-in single-col">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#c8e8d4" }}>Marketplace</div>
          <div style={{ fontSize: 12, color: "#4a7a5a" }}>{listings.length} active listings</div>
        </div>
        <button onClick={() => setShowListingModal(true)} style={{ background: "#152218", border: "1px solid #2d7a4f", borderRadius: 8, padding: "8px 14px", color: "#7ec99a", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>+ List Produce</button>
      </div>

      {/* My Listings / All toggle */}
      {authUser && myListings.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[["all", "All Listings"], ["mine", `My Listings (${myListings.length})`]].map(([v, label]) => (
            <button key={v} onClick={() => setMyTab(v)} style={{ background: myTab === v ? "#2d7a4f" : "#152218", border: `1px solid ${myTab === v ? "#3a9962" : "#1f3525"}`, borderRadius: 8, padding: "7px 14px", color: myTab === v ? "#e8f5ed" : "#5c8f6b", fontSize: 12, cursor: "pointer" }}>{label}</button>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#3d6b4a", fontSize: 14 }}>🔍</span>
        <input className="input-field" placeholder="Search crops, location, farmer..." style={{ paddingLeft: 36 }} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
        {filters.map(f => <span key={f} className={`chip ${filterCrop === f ? "active" : ""}`} onClick={() => setFilterCrop(f)} style={{ fontFamily: "'Space Mono', monospace", fontSize: 10 }}>{f}</span>)}
      </div>

      {/* Listings grid */}
      <div className="listing-grid">
        {loadingListings ? [1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12, marginBottom: 10 }} />) :
          filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#4a7a5a", gridColumn: "1/-1" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🌾</div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11 }}>No listings found</div>
            </div>
          ) : filtered.map(l => (
            <div key={l.id} className="listing-card" onClick={() => setShowListingDetail(l)} style={{ cursor: "pointer" }}>
              {/* Media thumbnail */}
              {(l.image_url || (l.media_urls && l.media_urls.length > 0)) ? (
                <img
                  src={l.media_urls?.[0] || l.image_url}
                  alt={l.crop}
                  style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 8, marginBottom: 10 }}
                />
              ) : (
                <div style={{ width: "100%", height: 100, background: "#1a2e1e", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 10 }}>
                  {CROP_EMOJIS[l.crop] || l.img || "🌾"}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#c8e8d4" }}>{l.crop}</div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {l.is_featured && <span style={{ fontSize: 9, background: "rgba(212,160,23,0.2)", color: "#d4a017", border: "1px solid #d4a01740", padding: "2px 7px", borderRadius: 10, fontWeight: 700 }}>⭐ FEATURED</span>}
                  <span style={{ background: badgeColorBg(l.badge), color: badgeColorText(l.badge), fontSize: 9, padding: "2px 7px", borderRadius: 10 }}>{l.badge}</span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#5c8f6b", marginBottom: 6 }}>📍 {l.location}</div>
              {l.description && <div style={{ fontSize: 12, color: "#8aaa94", marginBottom: 8, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{l.description}</div>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: 12, color: "#7ec99a" }}>{l.price}</span>
                  <span style={{ fontSize: 11, color: "#4a7a5a", marginLeft: 6 }}>{l.quantity}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {/* Edit/Delete for own listings */}
                  {authUser && (l.auth_user_id === authUser.id) && (<>
                    {!l.is_featured && (
                      <button onClick={e => { e.stopPropagation(); setFeaturingListing(l); }}
                        style={{ background: "rgba(212,160,23,0.15)", border: "1px solid #d4a017", borderRadius: 6, padding: "4px 8px", color: "#d4a017", fontSize: 11, cursor: "pointer" }}>⭐ Feature</button>
                    )}
                    {l.is_featured && (
                      <span style={{ background: "rgba(212,160,23,0.2)", border: "1px solid #d4a017", borderRadius: 6, padding: "4px 8px", color: "#d4a017", fontSize: 10 }}>⭐ Featured</span>
                    )}
                    <button onClick={e => { e.stopPropagation(); setEditingListing(l); }}
                      style={{ background: "#1a2e1e", border: "1px solid #2d5a36", borderRadius: 6, padding: "4px 8px", color: "#7ec99a", fontSize: 11, cursor: "pointer" }}>✏️</button>
                    <button onClick={e => { e.stopPropagation(); deleteListing(l.id); }}
                      style={{ background: "#2a1a1a", border: "1px solid #5a2020", borderRadius: 6, padding: "4px 8px", color: "#e07060", fontSize: 11, cursor: "pointer" }}>🗑</button>
                  </>)}
                  {l.phone && (
                    <a href={`https://wa.me/${l.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ background: "#1a5c2a", border: "1px solid #25a244", borderRadius: 6, padding: "4px 8px", color: "#4cd964", fontSize: 11, textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
                      <span style={{ fontSize: 13 }}>💬</span> WA
                    </a>
                  )}
                  <button className="btn-secondary" style={{ padding: "4px 10px", fontSize: 10 }}
                    onClick={e => { e.stopPropagation(); setShowContactModal(l); }}>
                    Contact
                  </button>
                </div>
              </div>
            </div>
          ))
        }
      </div>
      {/* Edit listing modal */}
      {editingListing && <EditListingModal listing={editingListing} onClose={() => setEditingListing(null)} onSave={async (updates) => { await db.patch("listings", editingListing.id, updates); setEditingListing(null); loadListings(); }} />}
      {featuringListing && <FeatureListingModal listing={featuringListing} onClose={() => setFeaturingListing(null)} onSave={handleFeatureListing} />}
    </div>
  );
}

function badgeColorBg(b) { if (b === "Premium") return "rgba(212,160,23,0.2)"; if (b === "Verified") return "rgba(45,122,79,0.25)"; return "rgba(90,143,163,0.2)"; }
function badgeColorText(b) { if (b === "Premium") return "#d4a017"; if (b === "Verified") return "#5cd68a"; return "#5a9fd4"; }

// ─── LISTING DETAIL MODAL ──────────────────────────────────────────────────────
function ListingDetailModal({ listing, onClose, onContact }) {
  const l = listing;
  const [mediaIdx, setMediaIdx] = useState(0);
  const allMedia = [
    ...(l.media_urls || []),
    ...(l.image_url ? [l.image_url] : []),
  ].filter(Boolean);

  const waNumber = l.phone ? l.phone.replace(/\D/g, '') : null;
  const waMsg = encodeURIComponent(`Hi ${maskName(l.farmer_name)}, I saw your listing on FarmLink Zim for ${l.crop} (${l.quantity} at ${l.price}). I'm interested, please contact me.`);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ borderRadius: "20px 20px 0 0", maxHeight: "92vh", padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>

        {/* Media gallery */}
        <div style={{ position: "relative", background: "#080f09", flexShrink: 0 }}>
          {allMedia.length > 0 ? (
            <>
              {allMedia[mediaIdx]?.match(/\.(mp4|mov|webm)$/i) || l.video_url === allMedia[mediaIdx] ? (
                <video src={allMedia[mediaIdx]} controls style={{ width: "100%", maxHeight: 280, objectFit: "cover" }} />
              ) : (
                <img src={allMedia[mediaIdx]} alt={l.crop} style={{ width: "100%", height: 240, objectFit: "cover" }} />
              )}
              {/* Navigation dots */}
              {allMedia.length > 1 && (
                <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
                  {allMedia.map((_, dotIdx) => (
                    <div key={dotIdx} onClick={() => setMediaIdx(dotIdx)} style={{ width: dotIdx === mediaIdx ? 20 : 6, height: 6, borderRadius: 3, background: dotIdx === mediaIdx ? "#7ec99a" : "rgba(255,255,255,0.4)", cursor: "pointer", transition: "all 0.2s" }} />
                  ))}
                </div>
              )}
              {/* Arrows */}
              {allMedia.length > 1 && <>
                <button onClick={() => setMediaIdx(prev => (prev - 1 + allMedia.length) % allMedia.length)}
                  style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", width: 32, height: 32, color: "#fff", cursor: "pointer", fontSize: 16 }}>‹</button>
                <button onClick={() => setMediaIdx(prev => (prev + 1) % allMedia.length)}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", width: 32, height: 32, color: "#fff", cursor: "pointer", fontSize: 16 }}>›</button>
              </>}
              {/* Media count badge */}
              {allMedia.length > 1 && (
                <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.6)", borderRadius: 10, padding: "2px 8px", fontSize: 10, color: "#fff", fontFamily: "'Space Mono', monospace" }}>
                  {mediaIdx + 1}/{allMedia.length}
                </div>
              )}
            </>
          ) : (
            <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>
              {CROP_EMOJIS[l.crop] || "🌾"}
            </div>
          )}
          {/* Thumbnail strip */}
          {allMedia.length > 1 && (
            <div style={{ display: "flex", gap: 6, padding: "8px 12px", overflowX: "auto" }}>
              {allMedia.map((m, thumbIdx) => (
                <div key={thumbIdx} onClick={() => setMediaIdx(thumbIdx)} style={{ width: 52, height: 40, borderRadius: 6, overflow: "hidden", flexShrink: 0, border: thumbIdx === mediaIdx ? "2px solid #7ec99a" : "2px solid transparent", cursor: "pointer" }}>
                  <img src={m} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.target.style.display = "none"} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: "auto", padding: "16px 20px", flex: 1 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#c8e8d4" }}>{l.crop}</div>
              <div style={{ fontSize: 12, color: "#5c8f6b", marginTop: 2 }}>👩🏾‍🌾 {maskName(l.farmer_name)} · 📍 {l.location}</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#4a7a5a", fontSize: 22, cursor: "pointer", flexShrink: 0 }}>✕</button>
          </div>

          {/* Price + quantity */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{ background: "rgba(45,122,79,0.2)", borderRadius: 10, padding: "10px 16px", flex: 1 }}>
              <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#5c8f6b", marginBottom: 4 }}>PRICE</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#7ec99a", fontFamily: "'Space Mono', monospace" }}>{l.price}</div>
            </div>
            <div style={{ background: "#152218", borderRadius: 10, padding: "10px 16px", flex: 1 }}>
              <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#5c8f6b", marginBottom: 4 }}>AVAILABLE</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#c8e8d4" }}>{l.quantity}</div>
            </div>
            <span style={{ background: badgeColorBg(l.badge), color: badgeColorText(l.badge), fontSize: 10, fontFamily: "'Space Mono', monospace", padding: "6px 10px", borderRadius: 10, alignSelf: "center" }}>{l.badge}</span>
          </div>

          {/* Description */}
          {l.description && (
            <div style={{ marginBottom: 16 }}>
              <div className="section-title">About this listing</div>
              <div style={{ fontSize: 14, color: "#c8e8d4", lineHeight: 1.7 }}>{l.description}</div>
            </div>
          )}

          {/* Contact actions */}
          <div className="section-title">Contact Seller</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* WhatsApp */}
            {waNumber && (
              <a href={`https://wa.me/${waNumber}?text=${waMsg}`} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "linear-gradient(135deg, #1a5c2a, #128c3c)", border: "1px solid #25a244", borderRadius: 10, padding: "14px", textDecoration: "none", color: "#4cd964", fontFamily: "'Space Mono', monospace", fontSize: 13 }}>
                <span style={{ fontSize: 22 }}>💬</span>
                <div>
                  <div style={{ fontWeight: 700 }}>Chat on WhatsApp</div>
                  <div style={{ fontSize: 10, color: "rgba(76,217,100,0.7)" }}>{l.phone}</div>
                </div>
              </a>
            )}
            {/* In-app message */}
            <button onClick={onContact} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "linear-gradient(135deg, #2d7a4f, #1f5a39)", border: "none", borderRadius: 10, padding: "14px", color: "#e8dfc8", fontFamily: "'Space Mono', monospace", fontSize: 13, cursor: "pointer" }}>
              <span style={{ fontSize: 18 }}>✉️</span> Send In-App Message
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LIST PRODUCE MODAL ────────────────────────────────────────────────────────
function ListingModal({ onClose, onSave }) {
  const [fields, setFields] = useState({ crop: "", quantity: "", price: "", farmerName: "", location: "", phone: "", description: "" });
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaPreviews, setMediaPreviews] = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setFields(f => ({ ...f, [k]: v }));
  const required = ["crop", "quantity", "price", "farmerName", "location"];
  const valid = required.every(k => fields[k].trim());

  const handleMedia = (e) => {
    const files = Array.from(e.target.files);
    setMediaFiles(prev => [...prev, ...files]);
    const previews = files.map(f => ({ url: URL.createObjectURL(f), type: f.type }));
    setMediaPreviews(prev => [...prev, ...previews]);
  };

  const removeMedia = (i) => {
    setMediaFiles(prev => prev.filter((_, idx) => idx !== i));
    setMediaPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    const mediaUrls = mediaFiles.length > 0 ? await db.uploadMedia(mediaFiles) : [];
    const videoUrl = mediaUrls.find(u => u.match(/\.(mp4|mov|webm)$/i)) || null;
    const imageUrls = mediaUrls.filter(u => !u.match(/\.(mp4|mov|webm)$/i));
    await onSave({
      crop: fields.crop, quantity: fields.quantity, price: fields.price,
      farmer_name: fields.farmerName, location: fields.location,
      phone: fields.phone || null,
      description: fields.description || null,
      badge: "New", img: CROP_EMOJIS[fields.crop] || "🌾", active: true,
      image_url: imageUrls[0] || null,
      media_urls: imageUrls,
      video_url: videoUrl,
    });
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#c8e8d4" }}>List Your Produce</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#4a7a5a", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {/* Media upload */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#5c8f6b", display: "block", marginBottom: 8 }}>PHOTOS & VIDEOS</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {mediaPreviews.map((p, i) => (
              <div key={i} style={{ position: "relative", width: 72, height: 72, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                {p.type.startsWith("video/")
                  ? <div style={{ width: "100%", height: "100%", background: "#1a2e1e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🎥</div>
                  : <img src={p.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                }
                <button onClick={() => removeMedia(i)} style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.7)", border: "none", borderRadius: "50%", width: 18, height: 18, color: "#fff", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
            ))}
            <label style={{ width: 72, height: 72, background: "#1a2e1e", border: "2px dashed #2d5a36", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <input type="file" accept="image/*,video/*" multiple onChange={handleMedia} style={{ display: "none" }} />
              <div style={{ fontSize: 22 }}>📷</div>
              <div style={{ fontSize: 9, color: "#4a7a5a", fontFamily: "'Space Mono', monospace", marginTop: 2 }}>ADD</div>
            </label>
          </div>
          <div style={{ fontSize: 10, color: "#3d6b4a", fontFamily: "'Space Mono', monospace" }}>Add up to 6 photos or 1 video</div>
        </div>

        {/* Fields */}
        {[
          ["YOUR NAME", "farmerName", "e.g. Tendai Moyo", "text"],
          ["YOUR WHATSAPP NUMBER", "phone", "+263 77X XXX XXX", "tel"],
          ["LOCATION", "location", "e.g. Mazowe, Mashonaland Central", "text"],
          ["CROP / LIVESTOCK", "crop", "e.g. Maize, Cattle, Tomatoes", "text"],
          ["QUANTITY", "quantity", "e.g. 10 tonnes, 5 head", "text"],
          ["PRICE", "price", "e.g. USD 280/tonne", "text"],
        ].map(([label, key, ph, type]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#5c8f6b", display: "block", marginBottom: 5 }}>{label}</label>
            <input className="input-field" type={type} value={fields[key]} onChange={e => set(key, e.target.value)} placeholder={ph} />
          </div>
        ))}

        {/* Description */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#5c8f6b", display: "block", marginBottom: 5 }}>DESCRIPTION — OPTIONAL</label>
          <textarea className="input-field" value={fields.description} onChange={e => set("description", e.target.value)}
            placeholder="Describe your produce — variety, quality, storage, delivery options..." rows={3} style={{ resize: "none" }} />
        </div>

        <button className="btn-primary" onClick={handleSave} style={{ opacity: valid ? 1 : 0.4 }}>
          {saving ? "Uploading & Saving..." : "Post Listing ✓"}
        </button>
      </div>
    </div>
  );
}

// ─── CONTACT MODAL ─────────────────────────────────────────────────────────────
function ContactModal({ listing, onClose, onSend }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [sent, setSent] = useState(false);
  const [message, setMessage] = useState(`Hi ${listing.farmer_name}, I'm interested in your ${listing.crop} (${listing.quantity} at ${listing.price}).`);
  const handleSend = async () => { if (!name || !message) return; await onSend({ sender_name: name, sender_phone: phone, message }); setSent(true); setTimeout(onClose, 2000); };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#c8e8d4" }}>Contact Seller</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#4a7a5a", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        {sent ? <div style={{ textAlign: "center", padding: "24px 0" }}><div style={{ fontSize: 40, marginBottom: 12 }}>✅</div><div style={{ fontSize: 16, color: "#7ec99a", fontWeight: 600 }}>Message Sent!</div></div> : (
          <>
            <div style={{ background: "#1a2e1e", borderRadius: 10, padding: "10px 12px", marginBottom: 16, fontSize: 13, color: "#8aaa94" }}>
              <strong style={{ color: "#c8e8d4" }}>{listing.crop}</strong> · {listing.quantity} · {listing.price}
            </div>
            {[["YOUR NAME", name, setName, "Full name", "text"], ["PHONE", phone, setPhone, "+263 77X XXX XXX", "tel"]].map(([l, v, s, p, t]) => (
              <div key={l} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#5c8f6b", display: "block", marginBottom: 5 }}>{l}</label>
                <input className="input-field" type={t} value={v} onChange={e => s(e.target.value)} placeholder={p} />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#5c8f6b", display: "block", marginBottom: 5 }}>MESSAGE</label>
              <textarea className="input-field" value={message} onChange={e => setMessage(e.target.value)} rows={3} style={{ resize: "none" }} />
            </div>
            <button className="btn-primary" onClick={handleSend} style={{ opacity: (!name || !message) ? 0.4 : 1 }}>Send Message</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── REGISTER TAB ──────────────────────────────────────────────────────────────
function RegisterTab({ wizardStep, setWizardStep, province, setProvince, district, setDistrict, ward, setWard, selectedCrops, setSelectedCrops, selectedLivestock, setSelectedLivestock, farmSize, setFarmSize, farmerName, setFarmerName, farmerPhone, setFarmerPhone, toggleItem, registrationDone, registeredFarmer, registerFarmer, resetRegistration, cropDetails, setCropDetails }) {

  const updateCropDetail = (name, field, value) => {
    setCropDetails(prev => ({ ...prev, [name]: { ...(prev[name] || {}), [field]: value } }));
  };

  const CROP_STAGES = [
    { id: "land_prep", label: "Land Preparation", icon: "🚜" },
    { id: "seeding", label: "Seeding / Planting", icon: "🌱" },
    { id: "germination", label: "Germination", icon: "🌿" },
    { id: "vegetative", label: "Vegetative Growth", icon: "🌾" },
    { id: "flowering", label: "Flowering / Tasselling", icon: "🌸" },
    { id: "grain_fill", label: "Grain Fill / Podding", icon: "🫘" },
    { id: "harvesting", label: "Harvesting", icon: "🌾" },
    { id: "post_harvest", label: "Post Harvest", icon: "📦" },
    { id: "fallow", label: "Fallow / Resting", icon: "🟫" },
  ];

  const LIVESTOCK_STAGES = [
    { id: "breeding", label: "Breeding Season", icon: "❤️" },
    { id: "pregnant", label: "Pregnant", icon: "🐣" },
    { id: "lactating", label: "Lactating / Nursing", icon: "🍼" },
    { id: "growing", label: "Growing", icon: "📈" },
    { id: "fattening", label: "Fattening", icon: "🥩" },
    { id: "selling", label: "Ready to Sell", icon: "💰" },
  ];
  const wards = Array.from({ length: 10 }, (_, i) => `Ward ${i + 1}`);
  const [saving, setSaving] = useState(false);
  const handleRegister = async () => { setSaving(true); await registerFarmer(); setSaving(false); };

  if (registrationDone && registeredFarmer) {
    return (
      <div className="fade-in" style={{ padding: "40px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>👩🏾‍🌾</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#7ec99a", marginBottom: 8 }}>Farm Registered!</div>
        <div style={{ fontSize: 15, color: "#8aaa94", lineHeight: 1.6, marginBottom: 4 }}>Welcome, <strong style={{ color: "#c8e8d4" }}>{registeredFarmer.name}</strong></div>
        <div style={{ fontSize: 13, color: "#4a7a5a", marginBottom: 24 }}>{registeredFarmer.province} · {registeredFarmer.district} · {registeredFarmer.ward}</div>
        <div className="card" style={{ textAlign: "left", marginBottom: 16 }}>
          <div className="section-title">Your Farm Profile</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {selectedCrops.map(c => <span key={c} className="chip active" style={{ fontSize: 11 }}>🌾 {c}</span>)}
            {selectedLivestock.map(l => <span key={l} className="chip active" style={{ fontSize: 11 }}>🐄 {l}</span>)}
          </div>
          {registeredFarmer.farm_size_hectares && <div style={{ fontSize: 13, color: "#8aaa94" }}>Farm size: <strong style={{ color: "#c8e8d4" }}>{registeredFarmer.farm_size_hectares} ha</strong></div>}
        </div>
        <button className="btn-primary" onClick={resetRegistration}>Register Another Farm</button>
      </div>
    );
  }

  return (
    <div className="fade-in single-col">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#c8e8d4", marginBottom: 4 }}>Farmer Registration</div>
        <div style={{ fontSize: 12, color: "#4a7a5a" }}>Join farmers on FarmLink Zim 👩🏾‍🌾</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24 }}>
        {[1,2,3].map(s => <div key={s} className={`step-dot ${wizardStep === s ? "active" : wizardStep > s ? "done" : "pending"}`} />)}
        <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#4a7a5a", marginLeft: 6 }}>STEP {wizardStep} OF 3 — {["LOCATION", "CROPS & LIVESTOCK", "FARM DETAILS"][wizardStep - 1]}</div>
      </div>
      {wizardStep === 1 && (
        <div className="fade-in">
          <div className="card" style={{ marginBottom: 12 }}>
            {[["FULL NAME", farmerName, setFarmerName, "e.g. Tendai Moyo", "text"], ["PHONE NUMBER", farmerPhone, setFarmerPhone, "+263 77X XXX XXX", "tel"]].map(([label, val, setter, ph, type]) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: "#5c8f6b", display: "block", marginBottom: 6 }}>{label}</label>
                <input className="input-field" type={type} placeholder={ph} value={val} onChange={e => setter(e.target.value)} />
              </div>
            ))}
            {[["PROVINCE", province, (v) => { setProvince(v); setDistrict(""); }, Object.keys(PROVINCES)], ...(province ? [["DISTRICT", district, setDistrict, PROVINCES[province]]] : []), ...(district ? [["WARD", ward, setWard, wards]] : [])].map(([label, val, setter, options]) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: "#5c8f6b", display: "block", marginBottom: 6 }}>{label}</label>
                <div style={{ position: "relative" }}>
                  <select className="select-field" value={val} onChange={e => setter(e.target.value)}>
                    <option value="">Select {label.toLowerCase()}...</option>
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#4a7a5a" }}>▾</span>
                </div>
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={() => { if (farmerName && province && district && ward) setWizardStep(2); }} style={{ opacity: (farmerName && province && district && ward) ? 1 : 0.4 }}>Continue →</button>
        </div>
      )}
      {wizardStep === 2 && (
        <div className="fade-in">
          {/* Crop selection */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="section-title">Crops Being Grown</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {CROPS.map(c => <span key={c} className={`chip ${selectedCrops.includes(c) ? "active" : ""}`} style={{ fontSize: 11 }} onClick={() => toggleItem(selectedCrops, setSelectedCrops, c)}>{selectedCrops.includes(c) ? "✓ " : ""}{c}</span>)}
            </div>

            {/* Per-crop hectares and stage */}
            {selectedCrops.length > 0 && (
              <div style={{ borderTop: "1px solid #1a2e1e", paddingTop: 12 }}>
                <div style={{ fontSize: 10, color: "#5c8f6b", fontWeight: 600, marginBottom: 10 }}>CROP DETAILS</div>
                {selectedCrops.map(crop => (
                  <div key={crop} style={{ background: "#1a2e1e", borderRadius: 10, padding: "12px", marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#c8e8d4", marginBottom: 10 }}>🌾 {crop}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <div>
                        <label style={{ fontSize: 10, color: "#4a7a5a", display: "block", marginBottom: 4 }}>HECTARES</label>
                        <input type="number" className="input-field" style={{ padding: "8px 10px" }}
                          placeholder="e.g. 2.5"
                          value={cropDetails[crop]?.hectares || ""}
                          onChange={e => updateCropDetail(crop, "hectares", e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: "#4a7a5a", display: "block", marginBottom: 4 }}>CURRENT STAGE</label>
                        <select className="select-field" style={{ padding: "8px 10px" }}
                          value={cropDetails[crop]?.stage || ""}
                          onChange={e => updateCropDetail(crop, "stage", e.target.value)}>
                          <option value="">Select stage</option>
                          {CROP_STAGES.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Livestock selection */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">Livestock Raised</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {LIVESTOCK.map(l => <span key={l} className={`chip ${selectedLivestock.includes(l) ? "active" : ""}`} style={{ fontSize: 11 }} onClick={() => toggleItem(selectedLivestock, setSelectedLivestock, l)}>{selectedLivestock.includes(l) ? "✓ " : ""}{l}</span>)}
            </div>

            {/* Per-livestock head count and stage */}
            {selectedLivestock.length > 0 && (
              <div style={{ borderTop: "1px solid #1a2e1e", paddingTop: 12 }}>
                <div style={{ fontSize: 10, color: "#5c8f6b", fontWeight: 600, marginBottom: 10 }}>LIVESTOCK DETAILS</div>
                {selectedLivestock.map(animal => (
                  <div key={animal} style={{ background: "#1a2e1e", borderRadius: 10, padding: "12px", marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#c8e8d4", marginBottom: 10 }}>🐄 {animal}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 10, color: "#4a7a5a", display: "block", marginBottom: 4 }}>HEAD COUNT</label>
                        <input type="number" className="input-field" style={{ padding: "8px 10px" }}
                          placeholder="e.g. 12"
                          value={cropDetails[animal]?.head_count || ""}
                          onChange={e => updateCropDetail(animal, "head_count", e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: "#4a7a5a", display: "block", marginBottom: 4 }}>CURRENT STAGE</label>
                        <select className="select-field" style={{ padding: "8px 10px" }}
                          value={cropDetails[animal]?.stage || ""}
                          onChange={e => updateCropDetail(animal, "stage", e.target.value)}>
                          <option value="">Select stage</option>
                          {LIVESTOCK_STAGES.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-secondary" style={{ width: "auto", padding: "12px 20px" }} onClick={() => setWizardStep(1)}>← Back</button>
            <button className="btn-primary" onClick={() => { if (selectedCrops.length > 0 || selectedLivestock.length > 0) setWizardStep(3); }} style={{ opacity: (selectedCrops.length > 0 || selectedLivestock.length > 0) ? 1 : 0.4 }}>Continue →</button>
          </div>
        </div>
      )}
      {wizardStep === 3 && (
        <div className="fade-in">
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: "#5c8f6b", display: "block", marginBottom: 6 }}>FARM SIZE (HECTARES) — OPTIONAL</label>
              <input className="input-field" type="number" placeholder="e.g. 5.5" value={farmSize} onChange={e => setFarmSize(e.target.value)} />
            </div>
            <div><label style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: "#5c8f6b", display: "block", marginBottom: 6 }}>SMS PRICE ALERTS</label>
              <span className="chip active" style={{ fontSize: 11 }}>✓ Enable SMS alerts</span></div>
          </div>
          <div className="card card-premium" style={{ marginBottom: 16 }}>
            <div className="section-title">Registration Summary</div>
            <div style={{ fontSize: 14, color: "#c8e8d4", marginBottom: 4 }}>{farmerName}</div>
            {farmerPhone && <div style={{ fontSize: 12, color: "#5c8f6b", marginBottom: 4 }}>📱 {farmerPhone}</div>}
            <div style={{ fontSize: 12, color: "#5c8f6b", marginBottom: 10 }}>📍 {province} › {district} › {ward}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {selectedCrops.map(c => (
                <div key={c} style={{ background: "rgba(45,122,79,0.15)", border: "1px solid rgba(45,122,79,0.3)", borderRadius: 8, padding: "6px 10px", marginBottom: 4 }}>
                  <div style={{ fontSize: 12, color: "#7ec99a", fontWeight: 600 }}>🌾 {c}</div>
                  <div style={{ fontSize: 10, color: "#4a7a5a", marginTop: 2 }}>
                    {cropDetails[c]?.hectares ? `${cropDetails[c].hectares} ha` : "— ha"} · {cropDetails[c]?.stage ? CROP_STAGES.find(s => s.id === cropDetails[c].stage)?.label : "Stage not set"}
                  </div>
                </div>
              ))}
              {selectedLivestock.map(l => (
                <div key={l} style={{ background: "rgba(90,143,163,0.15)", border: "1px solid rgba(90,143,163,0.3)", borderRadius: 8, padding: "6px 10px", marginBottom: 4 }}>
                  <div style={{ fontSize: 12, color: "#5a9fd4", fontWeight: 600 }}>🐄 {l}</div>
                  <div style={{ fontSize: 10, color: "#4a7a5a", marginTop: 2 }}>
                    {cropDetails[l]?.head_count ? `${cropDetails[l].head_count} head` : "— head"} · {cropDetails[l]?.stage ? LIVESTOCK_STAGES.find(s => s.id === cropDetails[l].stage)?.label : "Stage not set"}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-secondary" style={{ width: "auto", padding: "12px 20px" }} onClick={() => setWizardStep(2)}>← Back</button>
            <button className="btn-primary" onClick={handleRegister} style={{ opacity: saving ? 0.6 : 1 }}>{saving ? "Registering..." : "Register Farm ✓"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADVISORY TAB ──────────────────────────────────────────────────────────────
function AdvisoryTab({ chatMessages, chatInput, setChatInput, sendChat, isTyping, chatEndRef }) {
  return (
    <div className="fade-in single-col">
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #1f3525" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, background: "linear-gradient(135deg, #2d7a4f, #1a5c36)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🤖</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#c8e8d4" }}>FarmLink AI Advisor</div>
            <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#4a7a5a" }}>
              <span className="pulse" style={{ display: "inline-block", width: 6, height: 6, background: "#5cd68a", borderRadius: "50%", marginRight: 5 }} />TRAINED ON AGRITEX & ZFU DATA
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #1a2e1e" }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
          {CHAT_STARTERS.map((s, i) => <span key={i} className="chip" style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", flexShrink: 0 }} onClick={() => sendChat(s)}>{s}</span>)}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {chatMessages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div className={m.role === "ai" ? "chat-bubble-ai" : "chat-bubble-user"} style={{ color: "#e8dfc8" }}>{m.text}</div>
          </div>
        ))}
        {isTyping && (
          <div style={{ display: "flex", gap: 5, padding: "10px 14px", background: "#152218", border: "1px solid #1f3525", borderRadius: "16px 16px 16px 4px", width: "fit-content" }}>
            {[0,1,2].map(i => <div key={i} className="pulse" style={{ width: 6, height: 6, background: "#5c8f6b", borderRadius: "50%", animationDelay: `${i * 0.2}s` }} />)}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div style={{ padding: "12px 16px 16px", borderTop: "1px solid #1f3525" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input-field" placeholder="Ask about crops, livestock, weather..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} style={{ flex: 1 }} />
          <button onClick={() => sendChat()} style={{ background: "linear-gradient(135deg, #2d7a4f, #1f5a39)", border: "none", borderRadius: 8, width: 44, height: 44, cursor: "pointer", fontSize: 18, flexShrink: 0 }}>➤</button>
        </div>
        <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#3d6b4a", marginTop: 6, textAlign: "center" }}>Powered by Farmlink AI</div>
      </div>
    </div>
  );
}

// ─── PLANTING CALENDAR TAB ─────────────────────────────────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const ZONE_LABELS = { all: "All Zimbabwe", mashonaland: "Mashonaland", matabeleland: "Matabeleland", manicaland: "Manicaland", midlands: "Midlands", masvingo: "Masvingo" };
const CAT_COLORS = { grain: { bg: "rgba(45,122,79,0.25)", border: "#2d7a4f", text: "#7ec99a", dot: "#5cd68a" }, cash_crop: { bg: "rgba(200,160,30,0.2)", border: "#c8a01e", text: "#d4a017", dot: "#e8c040" }, horticulture: { bg: "rgba(90,143,200,0.2)", border: "#5a8fc8", text: "#7ab0e0", dot: "#8ac8f0" }, livestock: { bg: "rgba(180,90,200,0.2)", border: "#b45ac8", text: "#cc80e0", dot: "#d890f0" } };
const CAT_ICONS = { grain: "🌾", cash_crop: "💰", horticulture: "🥦", livestock: "🐄" };

function monthsInRange(start, end) {
  const months = [];
  if (start <= end) { for (let m = start; m <= end; m++) months.push(m); }
  else { for (let m = start; m <= 12; m++) months.push(m); for (let m = 1; m <= end; m++) months.push(m); }
  return months;
}
function CalendarTab() {
  const [calData, setCalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState("all");
  const [selectedCat, setSelectedCat] = useState("all");
  const [selectedCrop, setSelectedCrop] = useState(null);
  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    db.get("planting_calendar", "?order=category,crop_name").then(data => {
      setCalData(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  const filtered = calData.filter(c =>
    (selectedZone === "all" || c.province_zone === "all" || c.province_zone === selectedZone) &&
    (selectedCat === "all" || c.category === selectedCat)
  );

  const grouped = {};
  filtered.forEach(c => {
    if (!grouped[c.crop_name]) grouped[c.crop_name] = { ...c, zones: [c.province_zone] };
    else grouped[c.crop_name].zones.push(c.province_zone);
  });
  const crops = Object.values(grouped);

  // Get all activity months for a crop (handles both crop and livestock)
  const getActivityMonths = (c) => {
    const isLivestock = c.category === "livestock";
    if (isLivestock) {
      return {
        breeding: c.breeding_month_start ? monthsInRange(c.breeding_month_start, c.breeding_month_end) : [],
        birthing: c.birthing_month_start ? monthsInRange(c.birthing_month_start, c.birthing_month_end) : [],
        dipping: c.dipping_month_start ? monthsInRange(c.dipping_month_start, c.dipping_month_end) : [],
        slaughter: c.slaughter_month_start ? monthsInRange(c.slaughter_month_start, c.slaughter_month_end) : [],
      };
    }
    return {
      plant: c.plant_month_start ? monthsInRange(c.plant_month_start, c.plant_month_end) : [],
      fertilise: c.fertilise_month_start ? monthsInRange(c.fertilise_month_start, c.fertilise_month_end) : [],
      harvest: c.harvest_month_start ? monthsInRange(c.harvest_month_start, c.harvest_month_end) : [],
    };
  };

  // What's active this month
  const activeNow = calData.filter(c => {
    const acts = getActivityMonths(c);
    return Object.values(acts).some(months => months.includes(currentMonth));
  });

  // Cell colour and emoji for each month
  const getCellStyle = (c, m) => {
    const acts = getActivityMonths(c);
    if (c.category === "livestock") {
      if (acts.birthing?.includes(m)) return { bg: "rgba(212,160,23,0.5)", emoji: "🐣" };
      if (acts.breeding?.includes(m)) return { bg: "rgba(204,128,224,0.45)", emoji: "❤️" };
      if (acts.dipping?.includes(m)) return { bg: "rgba(90,143,212,0.4)", emoji: "🪣" };
      if (acts.slaughter?.includes(m)) return { bg: "rgba(224,112,96,0.3)", emoji: "🥩" };
    } else {
      if (acts.harvest?.includes(m)) return { bg: "rgba(212,160,23,0.5)", emoji: "🌾" };
      if (acts.plant?.includes(m)) return { bg: `${CAT_COLORS[c.category]?.border || "#2d7a4f"}60`, emoji: "🌱" };
      if (acts.fertilise?.includes(m)) return { bg: "rgba(90,143,200,0.3)", emoji: "🧪" };
    }
    return { bg: "transparent", emoji: null };
  };

  return (
    <div className="fade-in single-col">
      <div style={{ fontSize: 20, fontWeight: 700, color: "#c8e8d4", marginBottom: 4 }}>Planting Calendar</div>
      <div style={{ fontSize: 12, color: "#4a7a5a", marginBottom: 20 }}>AGRITEX seasonal guide · Zimbabwe 2025/26</div>

      {/* This month banner */}
      <div style={{ background: "linear-gradient(135deg, #1a3d24, #0f2218)", border: "1px solid #2d7a4f", borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: "#5cd68a", marginBottom: 8, letterSpacing: "0.1em" }}>
          🗓️ {MONTHS[currentMonth - 1].toUpperCase()} — WHAT TO DO NOW
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[...new Set(activeNow.map(c => c.crop_name))].map(name => {
            const c = activeNow.find(x => x.crop_name === name);
            const acts = getActivityMonths(c);
            const col = CAT_COLORS[c.category] || CAT_COLORS.grain;
            const isLivestock = c.category === "livestock";
            const tags = isLivestock ? [
              acts.breeding?.includes(currentMonth) && "❤️ BREEDING",
              acts.birthing?.includes(currentMonth) && "🐣 BIRTHING",
              acts.dipping?.includes(currentMonth) && "🪣 DIPPING",
              acts.slaughter?.includes(currentMonth) && "🥩 SLAUGHTER",
            ].filter(Boolean) : [
              acts.plant?.includes(currentMonth) && "🌱 PLANT",
              acts.fertilise?.includes(currentMonth) && "🧪 FERTILISE",
              acts.harvest?.includes(currentMonth) && "🌾 HARVEST",
            ].filter(Boolean);
            return (
              <div key={name} onClick={() => setSelectedCrop(c)} style={{ background: col.bg, border: `1px solid ${col.border}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>
                <div style={{ fontSize: 12, color: col.text, fontWeight: 600 }}>{CAT_ICONS[c.category]} {name}</div>
                <div style={{ fontSize: 9, color: col.dot, marginTop: 2 }}>{tags.join(" · ")}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <select className="select-field" style={{ flex: 1, minWidth: 140 }} value={selectedZone} onChange={e => setSelectedZone(e.target.value)}>
          {Object.entries(ZONE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="select-field" style={{ flex: 1, minWidth: 140 }} value={selectedCat} onChange={e => setSelectedCat(e.target.value)}>
          <option value="all">All Categories</option>
          <option value="grain">🌾 Grains</option>
          <option value="cash_crop">💰 Cash Crops</option>
          <option value="horticulture">🥦 Horticulture</option>
          <option value="livestock">🐄 Livestock</option>
        </select>
      </div>

      {/* Gantt grid */}
      {loading ? <div className="skeleton" style={{ height: 300, borderRadius: 12 }} /> : (
        <div className="card" style={{ overflowX: "auto", padding: "16px 12px" }}>
          {/* Month headers */}
          <div style={{ display: "grid", gridTemplateColumns: "120px repeat(12, 1fr)", gap: 2, marginBottom: 8 }}>
            <div />
            {MONTHS.map((m, i) => (
              <div key={m} style={{ textAlign: "center", fontSize: 9, color: i + 1 === currentMonth ? "#7ec99a" : "#3d6b4a", fontWeight: i + 1 === currentMonth ? 700 : 400, background: i + 1 === currentMonth ? "rgba(45,122,79,0.15)" : "transparent", borderRadius: 4, padding: "3px 0" }}>{m}</div>
            ))}
          </div>

          {/* Rows */}
          {crops.map((c, idx) => {
            const col = CAT_COLORS[c.category] || CAT_COLORS.grain;
            return (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "120px repeat(12, 1fr)", gap: 2, marginBottom: 3, cursor: "pointer" }} onClick={() => setSelectedCrop(c)}>
                <div style={{ fontSize: 11, color: col.text, display: "flex", alignItems: "center", gap: 4, paddingRight: 8, overflow: "hidden" }}>
                  <span>{CAT_ICONS[c.category]}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.crop_name}</span>
                </div>
                {MONTHS.map((_, mi) => {
                  const m = mi + 1;
                  const { bg, emoji } = getCellStyle(c, m);
                  const isCurrent = m === currentMonth;
                  return (
                    <div key={m} style={{ height: 22, borderRadius: 3, background: bg, border: isCurrent ? "1px solid #7ec99a" : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>
                      {emoji}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Legend */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #1a2e1e" }}>
            <div style={{ fontSize: 10, color: "#3d6b4a", marginBottom: 8, fontWeight: 600 }}>CROPS</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              {[["🌱", "rgba(45,122,79,0.4)", "Plant"], ["🧪", "rgba(90,143,200,0.3)", "Fertilise"], ["🌾", "rgba(212,160,23,0.5)", "Harvest"]].map(([icon, bg, label]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 20, height: 14, borderRadius: 3, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>{icon}</div>
                  <span style={{ fontSize: 10, color: "#5c8f6b" }}>{label}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "#3d6b4a", marginBottom: 8, fontWeight: 600 }}>LIVESTOCK</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[["❤️", "rgba(204,128,224,0.45)", "Breeding"], ["🐣", "rgba(212,160,23,0.5)", "Birthing/Calving"], ["🪣", "rgba(90,143,212,0.4)", "Dipping/Deworming"], ["🥩", "rgba(224,112,96,0.3)", "Slaughter/Sell"]].map(([icon, bg, label]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 20, height: 14, borderRadius: 3, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>{icon}</div>
                  <span style={{ fontSize: 10, color: "#5c8f6b" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Crop/Livestock detail modal */}
      {selectedCrop && (
        <div className="modal-overlay" onClick={() => setSelectedCrop(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#c8e8d4" }}>{CAT_ICONS[selectedCrop.category]} {selectedCrop.crop_name}</div>
                <div style={{ fontSize: 10, color: "#4a7a5a", marginTop: 2 }}>{selectedCrop.category?.replace("_", " ").toUpperCase()} · ZONE {selectedCrop.agro_zone}</div>
              </div>
              <button onClick={() => setSelectedCrop(null)} style={{ background: "none", border: "none", color: "#4a7a5a", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>

            {selectedCrop.category === "livestock" ? (
              // Livestock-specific timeline
              [
                { label: "❤️ BREEDING SEASON", months: selectedCrop.breeding_month_start ? monthsInRange(selectedCrop.breeding_month_start, selectedCrop.breeding_month_end) : [], color: "#cc80e0" },
                { label: "🐣 BIRTHING / CALVING", months: selectedCrop.birthing_month_start ? monthsInRange(selectedCrop.birthing_month_start, selectedCrop.birthing_month_end) : [], color: "#d4a017" },
                { label: "🪣 DIPPING / DEWORMING", months: selectedCrop.dipping_month_start ? monthsInRange(selectedCrop.dipping_month_start, selectedCrop.dipping_month_end) : [], color: "#5a9fd4" },
                { label: "🥩 SLAUGHTER / SELLING", months: selectedCrop.slaughter_month_start ? monthsInRange(selectedCrop.slaughter_month_start, selectedCrop.slaughter_month_end) : [], color: "#e07060" },
              ].map(({ label, months, color }) => months.length > 0 && (
                <div key={label} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: "#4a7a5a", marginBottom: 6, fontWeight: 600 }}>{label}</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {months.map(m => (
                      <span key={m} style={{ background: m === currentMonth ? color : "rgba(255,255,255,0.08)", color: m === currentMonth ? "#0d1a0f" : color, border: `1px solid ${color}40`, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: m === currentMonth ? 700 : 400 }}>
                        {MONTHS[m - 1]}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              // Crop timeline
              [
                { label: "🌱 PLANT", months: selectedCrop.plant_month_start ? monthsInRange(selectedCrop.plant_month_start, selectedCrop.plant_month_end) : [], color: "#7ec99a" },
                { label: "🧪 FERTILISE", months: selectedCrop.fertilise_month_start ? monthsInRange(selectedCrop.fertilise_month_start, selectedCrop.fertilise_month_end) : [], color: "#7ab0e0" },
                { label: "🌾 HARVEST", months: selectedCrop.harvest_month_start ? monthsInRange(selectedCrop.harvest_month_start, selectedCrop.harvest_month_end) : [], color: "#d4a017" },
              ].map(({ label, months, color }) => months.length > 0 && (
                <div key={label} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: "#4a7a5a", marginBottom: 6, fontWeight: 600 }}>{label}</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {months.map(m => (
                      <span key={m} style={{ background: m === currentMonth ? color : "rgba(255,255,255,0.08)", color: m === currentMonth ? "#0d1a0f" : color, border: `1px solid ${color}40`, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: m === currentMonth ? 700 : 400 }}>
                        {MONTHS[m - 1]}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}

            {selectedCrop.variety && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "#4a7a5a", marginBottom: 4, fontWeight: 600 }}>
                  {selectedCrop.category === "livestock" ? "BREEDS" : "RECOMMENDED VARIETIES"}
                </div>
                <div style={{ fontSize: 13, color: "#c8e8d4" }}>{selectedCrop.variety}</div>
              </div>
            )}
            {selectedCrop.notes && (
              <div style={{ background: "#1a2e1e", borderRadius: 10, padding: 12, borderLeft: "3px solid #2d7a4f" }}>
                <div style={{ fontSize: 10, color: "#4a7a5a", marginBottom: 4, fontWeight: 600 }}>AGRITEX NOTES</div>
                <div style={{ fontSize: 13, color: "#c8e8d4", lineHeight: 1.6 }}>{selectedCrop.notes}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EDIT LISTING MODAL ────────────────────────────────────────────────────────
function EditListingModal({ listing, onClose, onSave }) {
  const [fields, setFields] = useState({
    crop: listing.crop || "",
    quantity: listing.quantity || "",
    price: listing.price || "",
    location: listing.location || "",
    description: listing.description || "",
    phone: listing.phone || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setFields(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await onSave({ ...fields, updated_at: new Date().toISOString() });
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#c8e8d4" }}>Edit Listing</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#4a7a5a", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        {[
          ["CROP / PRODUCE", "crop", "e.g. Maize, Cattle"],
          ["QUANTITY", "quantity", "e.g. 10 tonnes"],
          ["PRICE", "price", "e.g. USD 298/tonne"],
          ["LOCATION", "location", "e.g. Mazowe"],
          ["WHATSAPP NUMBER", "phone", "+263 77X XXX XXX"],
        ].map(([label, key, ph]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#5c8f6b", display: "block", marginBottom: 5 }}>{label}</label>
            <input className="input-field" value={fields[key]} onChange={e => set(key, e.target.value)} placeholder={ph} />
          </div>
        ))}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, color: "#5c8f6b", display: "block", marginBottom: 5 }}>DESCRIPTION</label>
          <textarea className="input-field" value={fields.description} onChange={e => set("description", e.target.value)} rows={3} style={{ resize: "none" }} placeholder="Describe your produce..." />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn-primary" style={{ flex: 2 }} onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PRICE FEEDS TAB ───────────────────────────────────────────────────────────
function PriceFeedsTab() {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    db.get("price_feed", "?order=crop").then(data => {
      setPrices(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  const categories = ["All", "Grains", "Cash Crops", "Livestock", "Horticulture"];
  const catMap = {
    "Grains": ["Maize", "Wheat", "Sorghum", "Soya Beans", "Groundnuts", "Pearl Millet"],
    "Cash Crops": ["Tobacco", "Cotton", "Sunflower", "Sugar Cane"],
    "Livestock": ["Cattle", "Goats", "Pigs", "Poultry"],
    "Horticulture": ["Tomatoes", "Potatoes", "Onions", "Butternut", "Cabbage"],
  };

  const filtered = filter === "All" ? prices : prices.filter(p =>
    (catMap[filter] || []).some(c => p.crop?.toLowerCase().includes(c.toLowerCase()))
  );

  const updatedDate = prices[0]?.created_at ? new Date(prices[0].created_at).toLocaleDateString("en-ZW", { day: "numeric", month: "short", year: "numeric" }) : "—";

  return (
    <div className="fade-in single-col">
      <div style={{ fontSize: 20, fontWeight: 700, color: "#c8e8d4", marginBottom: 4 }}>Market Prices</div>
      <div style={{ fontSize: 12, color: "#4a7a5a", marginBottom: 20 }}>Live prices from GMB, Cottco, ZFU and Mbare Musika · Updated {updatedDate}</div>

      {/* Summary strip */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 20 }}>
        {[
          { label: "Maize", icon: "🌽" }, { label: "Tobacco", icon: "🍂" },
          { label: "Cattle", icon: "🐄" }, { label: "Tomatoes", icon: "🍅" },
        ].map(({ label, icon }) => {
          const p = prices.find(x => x.crop === label);
          if (!p) return null;
          return (
            <div key={label} style={{ background: "#152218", border: `1px solid ${p.trend === "up" ? "#2d5a36" : "#5a2020"}`, borderRadius: 12, padding: "10px 14px", flexShrink: 0, minWidth: 110 }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
              <div style={{ fontSize: 11, color: "#8aaa94", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#c8e8d4" }}>USD {p.price_usd}/{p.unit}</div>
              <div style={{ fontSize: 11, color: p.trend === "up" ? "#5cd68a" : "#e07060", marginTop: 2 }}>
                {p.trend === "up" ? "▲" : "▼"} {p.change_pct > 0 ? "+" : ""}{p.change_pct}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Category filter */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
        {categories.map(c => (
          <span key={c} className={`chip ${filter === c ? "active" : ""}`} onClick={() => setFilter(c)} style={{ fontSize: 11 }}>{c}</span>
        ))}
      </div>

      {/* Full price table */}
      <div className="card">
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px", gap: 8, padding: "8px 0 12px", borderBottom: "1px solid #1a2e1e", marginBottom: 4 }}>
          {["COMMODITY", "PRICE", "SOURCE", "CHANGE"].map(h => (
            <div key={h} style={{ fontSize: 9, color: "#3d6b4a", fontWeight: 600, letterSpacing: "0.1em" }}>{h}</div>
          ))}
        </div>
        {loading ? [1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8, marginBottom: 6 }} />) :
          filtered.map((p, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px", gap: 8, padding: "12px 0", borderBottom: i < filtered.length - 1 ? "1px solid #1a2e1e" : "none", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#c8e8d4" }}>{p.crop}</div>
              <div>
                <div style={{ fontSize: 13, color: "#7ec99a", fontWeight: 700 }}>USD {p.price_usd}</div>
                <div style={{ fontSize: 10, color: "#4a7a5a" }}>/{p.unit}</div>
              </div>
              <div style={{ fontSize: 11, color: "#5c8f6b" }}>{p.source}</div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: p.trend === "up" ? "#5cd68a" : p.trend === "down" ? "#e07060" : "#8aaa94" }}>
                  {p.trend === "up" ? "▲" : p.trend === "down" ? "▼" : "—"} {Math.abs(p.change_pct)}%
                </span>
                {p.previous_price && (
                  <div style={{ fontSize: 10, color: "#3d6b4a" }}>was {p.previous_price}</div>
                )}
              </div>
            </div>
          ))
        }
      </div>

      <div style={{ marginTop: 16, background: "#1a2e1e", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#5c8f6b", borderLeft: "3px solid #2d7a4f" }}>
        💡 Prices are updated weekly from GMB, Cottco, ZFU and Mbare Musika. Use the AI Advisor for personalised price strategy.
      </div>
    </div>
  );
}

// ─── FARM DIARY TAB ────────────────────────────────────────────────────────────
const ACTIVITY_TYPES = [
  { id: "planting", icon: "🌱", label: "Planting", color: "#5cd68a" },
  { id: "fertilising", icon: "🧪", label: "Fertilising", color: "#7ab0e0" },
  { id: "spraying", icon: "💧", label: "Spraying", color: "#5a9fd4" },
  { id: "irrigation", icon: "🚿", label: "Irrigation", color: "#5a9fd4" },
  { id: "harvesting", icon: "🌾", label: "Harvesting", color: "#d4a017" },
  { id: "selling", icon: "💰", label: "Selling", color: "#7ec99a" },
  { id: "livestock", icon: "🐄", label: "Livestock", color: "#cc80e0" },
  { id: "other", icon: "📝", label: "Other", color: "#8aaa94" },
];
const WEATHER_OPTIONS = [
  { id: "sunny", icon: "☀️", label: "Sunny" },
  { id: "cloudy", icon: "⛅", label: "Cloudy" },
  { id: "rainy", icon: "🌧️", label: "Rainy" },
  { id: "dry", icon: "🌵", label: "Dry" },
];

function FarmDiaryTab({ authUser, setActiveTab }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState("all");

  const loadEntries = async () => {
    setLoading(true);
    const data = await db.get("farm_diary", "?order=activity_date.desc&limit=50");
    setEntries(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { loadEntries(); }, []);

  const filtered = filter === "all" ? entries : entries.filter(e => e.activity_type === filter);

  // Group by date
  const grouped = {};
  filtered.forEach(e => {
    const d = e.activity_date;
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(e);
  });

  const formatDate = (d) => {
    const date = new Date(d + "T00:00:00");
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d === today.toISOString().split("T")[0]) return "Today";
    if (d === yesterday.toISOString().split("T")[0]) return "Yesterday";
    return date.toLocaleDateString("en-ZW", { weekday: "short", day: "numeric", month: "short" });
  };

  // Stats
  const thisWeek = entries.filter(e => {
    const d = new Date(e.activity_date);
    const now = new Date();
    const weekAgo = new Date(now.setDate(now.getDate() - 7));
    return d >= weekAgo;
  });

  return (
    <div className="fade-in single-col">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#c8e8d4" }}>Farm Diary</div>
          <div style={{ fontSize: 12, color: "#4a7a5a" }}>{entries.length} activities logged</div>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ background: "linear-gradient(135deg, #2d7a4f, #1f5a39)", border: "none", borderRadius: 10, padding: "10px 16px", color: "#e8dfc8", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
          + Log Activity
        </button>
      </div>

      {/* Weekly stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, margin: "16px 0" }}>
        {[
          { label: "This Week", value: thisWeek.length, icon: "📅" },
          { label: "Plantings", value: entries.filter(e => e.activity_type === "planting").length, icon: "🌱" },
          { label: "Harvests", value: entries.filter(e => e.activity_type === "harvesting").length, icon: "🌾" },
          { label: "Livestock", value: entries.filter(e => e.activity_type === "livestock").length, icon: "🐄" },
        ].map(s => (
          <div key={s.label} style={{ background: "#152218", border: "1px solid #1f3525", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#7ec99a" }}>{s.value}</div>
            <div style={{ fontSize: 9, color: "#4a7a5a", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Activity type filter */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
        <span className={`chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")} style={{ fontSize: 11 }}>All</span>
        {ACTIVITY_TYPES.map(a => (
          <span key={a.id} className={`chip ${filter === a.id ? "active" : ""}`} onClick={() => setFilter(a.id)} style={{ fontSize: 11 }}>{a.icon} {a.label}</span>
        ))}
      </div>

      {/* Entries grouped by date */}
      {loading ? [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12, marginBottom: 10 }} />) :
        Object.keys(grouped).length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📓</div>
            <div style={{ fontSize: 14, color: "#5c8f6b", marginBottom: 8 }}>No activities logged yet</div>
            <div style={{ fontSize: 12, color: "#3d6b4a", marginBottom: 20 }}>Start tracking your farm activities daily to build a record of your season.</div>
            <button onClick={() => setShowAdd(true)} className="btn-primary" style={{ width: "auto", padding: "10px 24px" }}>Log Your First Activity</button>
          </div>
        ) : (
          Object.entries(grouped).map(([date, dayEntries]) => (
            <div key={date} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#4a7a5a", marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {formatDate(date)}
              </div>
              {dayEntries.map((e, i) => {
                const type = ACTIVITY_TYPES.find(a => a.id === e.activity_type) || ACTIVITY_TYPES[7];
                const weather = WEATHER_OPTIONS.find(w => w.id === e.weather);
                return (
                  <div key={i} style={{ background: "#152218", border: "1px solid #1f3525", borderRadius: 12, padding: "14px", marginBottom: 8, borderLeft: `3px solid ${type.color}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ width: 36, height: 36, background: `${type.color}20`, border: `1px solid ${type.color}40`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                        {type.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#c8e8d4" }}>{type.label}{e.crop_name ? ` — ${e.crop_name}` : ""}</div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            {weather && <span style={{ fontSize: 14 }}>{weather.icon}</span>}
                            {e.cost_usd && <span style={{ fontSize: 10, color: "#d4a017", background: "rgba(212,160,23,0.15)", padding: "2px 7px", borderRadius: 8 }}>USD {e.cost_usd}</span>}
                          </div>
                        </div>
                        <div style={{ fontSize: 13, color: "#8aaa94", marginTop: 4, lineHeight: 1.5 }}>{e.notes}</div>
                        {e.quantity && <div style={{ fontSize: 11, color: "#5c8f6b", marginTop: 4 }}>📦 {e.quantity}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )
      }

      {/* Add Activity Modal */}
      {showAdd && <AddDiaryEntryModal onClose={() => setShowAdd(false)} onSave={async (entry) => { await db.post("farm_diary", entry); setShowAdd(false); loadEntries(); }} />}
    </div>
  );
}

function AddDiaryEntryModal({ onClose, onSave }) {
  const today = new Date().toISOString().split("T")[0];
  const [fields, setFields] = useState({
    activity_date: today,
    activity_type: "planting",
    crop_name: "",
    notes: "",
    quantity: "",
    cost_usd: "",
    weather: "sunny",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setFields(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!fields.notes.trim()) return;
    setSaving(true);
    await onSave({
      ...fields,
      cost_usd: fields.cost_usd ? parseFloat(fields.cost_usd) : null,
      crop_name: fields.crop_name || null,
      quantity: fields.quantity || null,
    });
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#c8e8d4" }}>Log Activity</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#4a7a5a", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {/* Activity type selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, color: "#5c8f6b", display: "block", marginBottom: 8 }}>ACTIVITY TYPE</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
            {ACTIVITY_TYPES.map(a => (
              <button key={a.id} onClick={() => set("activity_type", a.id)}
                style={{ background: fields.activity_type === a.id ? `${a.color}25` : "#1a2e1e", border: `1px solid ${fields.activity_type === a.id ? a.color : "#2d5a36"}`, borderRadius: 8, padding: "8px 4px", cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: 18, marginBottom: 3 }}>{a.icon}</div>
                <div style={{ fontSize: 9, color: fields.activity_type === a.id ? a.color : "#5c8f6b" }}>{a.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, color: "#5c8f6b", display: "block", marginBottom: 5 }}>DATE</label>
          <input type="date" className="input-field" value={fields.activity_date} onChange={e => set("activity_date", e.target.value)} />
        </div>

        {/* Crop */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, color: "#5c8f6b", display: "block", marginBottom: 5 }}>CROP / LIVESTOCK</label>
          <input className="input-field" value={fields.crop_name} onChange={e => set("crop_name", e.target.value)} placeholder="e.g. Maize, Cattle, Tomatoes" />
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, color: "#5c8f6b", display: "block", marginBottom: 5 }}>NOTES *</label>
          <textarea className="input-field" value={fields.notes} onChange={e => set("notes", e.target.value)}
            placeholder="What did you do today? Include any observations, problems or results..." rows={3} style={{ resize: "none" }} />
        </div>

        {/* Quantity + Cost side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 10, color: "#5c8f6b", display: "block", marginBottom: 5 }}>QUANTITY</label>
            <input className="input-field" value={fields.quantity} onChange={e => set("quantity", e.target.value)} placeholder="e.g. 2 bags, 5 head" />
          </div>
          <div>
            <label style={{ fontSize: 10, color: "#5c8f6b", display: "block", marginBottom: 5 }}>COST (USD)</label>
            <input type="number" className="input-field" value={fields.cost_usd} onChange={e => set("cost_usd", e.target.value)} placeholder="0.00" />
          </div>
        </div>

        {/* Weather */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 10, color: "#5c8f6b", display: "block", marginBottom: 8 }}>WEATHER</label>
          <div style={{ display: "flex", gap: 8 }}>
            {WEATHER_OPTIONS.map(w => (
              <button key={w.id} onClick={() => set("weather", w.id)}
                style={{ flex: 1, background: fields.weather === w.id ? "#1a3d24" : "#1a2e1e", border: `1px solid ${fields.weather === w.id ? "#2d7a4f" : "#2d5a36"}`, borderRadius: 8, padding: "8px 4px", cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: 20 }}>{w.icon}</div>
                <div style={{ fontSize: 9, color: fields.weather === w.id ? "#7ec99a" : "#4a7a5a", marginTop: 3 }}>{w.label}</div>
              </button>
            ))}
          </div>
        </div>

        <button className="btn-primary" onClick={handleSave} disabled={saving || !fields.notes.trim()} style={{ opacity: fields.notes.trim() ? 1 : 0.4 }}>
          {saving ? "Saving..." : "Save Entry ✓"}
        </button>
      </div>
    </div>
  );
}

// ─── SPONSOR CARD ──────────────────────────────────────────────────────────────
function SponsorCard() {
  const [sponsor, setSponsor] = useState(null);

  useEffect(() => {
    db.get("sponsors", "?active=eq.true&limit=1").then(data => {
      if (Array.isArray(data) && data.length > 0) setSponsor(data[0]);
    });
  }, []);

  if (!sponsor) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 9, color: "#3d6b4a", letterSpacing: "0.1em", marginBottom: 6, textAlign: "right" }}>SPONSORED</div>
      <a href={sponsor.cta_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
        <div style={{ background: `linear-gradient(135deg, ${sponsor.color}18, #152218)`, border: `1px solid ${sponsor.color}40`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, background: `${sponsor.color}25`, border: `1px solid ${sponsor.color}40`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
            {sponsor.logo_emoji}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#c8e8d4", marginBottom: 2 }}>{sponsor.name}</div>
            <div style={{ fontSize: 11, color: "#8aaa94", lineHeight: 1.4 }}>{sponsor.tagline}</div>
          </div>
          <div style={{ background: `${sponsor.color}30`, border: `1px solid ${sponsor.color}50`, borderRadius: 8, padding: "6px 10px", color: sponsor.color, fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
            {sponsor.cta_text} →
          </div>
        </div>
      </a>
    </div>
  );
}

// ─── FEATURE LISTING MODAL ─────────────────────────────────────────────────────
function FeatureListingModal({ listing, onClose, onSave }) {
  const [weeks, setWeeks] = useState(1);
  const [method, setMethod] = useState("ecocash");
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);
  const price = weeks * 2;

  const METHODS = [
    { id: "ecocash", label: "EcoCash", icon: "📱", number: "*151*2*1*FARMLINK#" },
    { id: "onemoney", label: "OneMoney", icon: "💳", number: "*111*FARMLINK#" },
    { id: "bank", label: "Bank Transfer", icon: "🏦", number: "FBC: 1234567890" },
  ];

  const selected = METHODS.find(m => m.id === method);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#c8e8d4" }}>⭐ Feature This Listing</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#4a7a5a", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {/* Listing preview */}
        <div style={{ background: "#1a2e1e", borderRadius: 10, padding: "10px 14px", marginBottom: 16, border: "1px solid #2d5a36" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#c8e8d4" }}>{listing.crop}</div>
          <div style={{ fontSize: 11, color: "#5c8f6b" }}>{listing.location} · {listing.price}</div>
        </div>

        {/* What you get */}
        <div style={{ background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.3)", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#d4a017", fontWeight: 700, marginBottom: 8 }}>WHAT YOU GET</div>
          {["⭐ Featured badge on your listing", "📌 Pinned to top of marketplace", "👁 3x more visibility to buyers", "📱 Priority in search results"].map((b, i) => (
            <div key={i} style={{ fontSize: 12, color: "#c8e8d4", marginBottom: 4 }}>{b}</div>
          ))}
        </div>

        {/* Duration picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, color: "#5c8f6b", display: "block", marginBottom: 8, fontWeight: 600 }}>HOW LONG?</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[1, 2, 4].map(w => (
              <button key={w} onClick={() => setWeeks(w)}
                style={{ background: weeks === w ? "rgba(212,160,23,0.2)" : "#152218", border: `1px solid ${weeks === w ? "#d4a017" : "#1f3525"}`, borderRadius: 10, padding: "12px 8px", cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: weeks === w ? "#d4a017" : "#c8e8d4" }}>{w} {w === 1 ? "week" : "weeks"}</div>
                <div style={{ fontSize: 12, color: weeks === w ? "#d4a017" : "#5c8f6b", marginTop: 2 }}>USD {w * 2}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Payment method */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, color: "#5c8f6b", display: "block", marginBottom: 8, fontWeight: 600 }}>PAYMENT METHOD</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {METHODS.map(m => (
              <button key={m.id} onClick={() => setMethod(m.id)}
                style={{ flex: 1, background: method === m.id ? "#1a3d24" : "#152218", border: `1px solid ${method === m.id ? "#2d7a4f" : "#1f3525"}`, borderRadius: 8, padding: "8px", cursor: "pointer" }}>
                <div style={{ fontSize: 18 }}>{m.icon}</div>
                <div style={{ fontSize: 10, color: method === m.id ? "#7ec99a" : "#4a7a5a", marginTop: 3 }}>{m.label}</div>
              </button>
            ))}
          </div>
          <div style={{ background: "#1a2e1e", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#8aaa94" }}>
            Pay <span style={{ color: "#7ec99a", fontWeight: 700 }}>USD {price}</span> to: <span style={{ color: "#c8e8d4" }}>{selected?.number}</span>
            <div style={{ fontSize: 11, color: "#4a7a5a", marginTop: 4 }}>Reference: FEATURE-{listing.id?.slice(0, 8).toUpperCase()}</div>
          </div>
        </div>

        {/* Payment reference */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 10, color: "#5c8f6b", display: "block", marginBottom: 6, fontWeight: 600 }}>PAYMENT CONFIRMATION NUMBER</label>
          <input className="input-field" value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. ECO1234567890" />
          <div style={{ fontSize: 10, color: "#3d6b4a", marginTop: 4 }}>Enter the transaction ID from your payment confirmation SMS</div>
        </div>

        <button className="btn-primary" onClick={async () => { setSaving(true); await onSave(weeks, ref, method); setSaving(false); }}
          disabled={saving || !ref.trim()} style={{ opacity: ref.trim() ? 1 : 0.4, background: "linear-gradient(135deg, #b8860b, #8b6914)" }}>
          {saving ? "Activating..." : `Activate Featured Listing — USD ${price} ✓`}
        </button>
        <div style={{ fontSize: 10, color: "#3d6b4a", textAlign: "center", marginTop: 8 }}>
          Your listing will be featured immediately after payment verification
        </div>
      </div>
    </div>
  );
}

// ─── LEGAL TAB ─────────────────────────────────────────────────────────────────
const TOS_SECTIONS = [
  { title: "1. Introduction", content: "Welcome to FarmLink Zim. FarmLink Zim is an agricultural marketplace and advisory platform connecting farmers, buyers, and agricultural service providers across Zimbabwe.\n\nBy accessing or using the FarmLink Zim Platform, you agree to be bound by these Terms of Service. If you do not agree to these Terms, please do not use the Platform." },
  { title: "2. Eligibility", content: "You must be at least 18 years of age to use this Platform. By using FarmLink Zim, you represent that you are a resident of Zimbabwe or conducting agricultural business in Zimbabwe, have the legal capacity to enter into these Terms, and will use the Platform only for lawful purposes." },
  { title: "3. Account Registration", content: "To access certain features you may register using your email address or mobile phone number. We use one-time passwords (OTP) for verification. You are responsible for maintaining the confidentiality of your credentials and must provide accurate, current information." },
  { title: "4. Marketplace Listings", content: "Registered farmers may list agricultural produce and livestock for sale. By posting a listing, you represent that you are the legitimate owner of the produce, all information is accurate, the produce meets applicable Zimbabwean food safety standards, and you hold any necessary licences.\n\nProhibited items include stolen produce, products not meeting food safety standards, protected wildlife products, and items whose sale is prohibited under Zimbabwean law." },
  { title: "5. Transactions and Payments", content: "FarmLink Zim is a marketplace platform. We facilitate connections between buyers and sellers but are not a party to any transaction. Users are responsible for negotiating terms, arranging payment directly, ensuring compliance with tax obligations, and resolving any disputes." },
  { title: "6. AI Advisory Services", content: "The AI Advisor provides general agricultural guidance only. It does not constitute professional agronomic, veterinary, or legal advice. You should consult qualified professionals before making significant farming decisions. FarmLink Zim is not liable for losses arising from reliance on AI-generated advice." },
  { title: "7. Farm Diary and Personal Data", content: "The Farm Diary feature allows you to record your agricultural activities. Data you enter is stored on our servers and may be used to improve our services and provide personalised recommendations. Please refer to our Privacy Policy for full details." },
  { title: "8. Intellectual Property", content: `The FarmLink Zim name, logo, platform design, and all content created by FarmLink Zim are protected by copyright. © ${new Date().getFullYear()} FarmLink Zim. All rights reserved.\n\nUser-generated content remains the intellectual property of the respective user. By posting content, you grant FarmLink Zim a non-exclusive, royalty-free licence to use and display such content for the purposes of operating the Platform.` },
  { title: "9. Prohibited Conduct", content: "Users must not post false or fraudulent listings, harass or abuse other users, attempt unauthorised access to the Platform, distribute spam or malware, scrape Platform data without consent, or use the Platform in violation of Zimbabwean laws." },
  { title: "10. Limitation of Liability", content: "To the maximum extent permitted by Zimbabwean law, FarmLink Zim shall not be liable for indirect or consequential damages, losses from transactions between users, inaccuracies in market data or AI content, or Platform unavailability. Our total liability shall not exceed amounts paid to us in the preceding 12 months." },
  { title: "11. Governing Law", content: "These Terms shall be governed by the laws of Zimbabwe. Any disputes shall be subject to the exclusive jurisdiction of the courts of Zimbabwe." },
  { title: "12. Changes to These Terms", content: "We reserve the right to update these Terms at any time. We will notify registered users of material changes via email or in-app notification. Continued use of the Platform following notification constitutes acceptance of the updated Terms." },
  { title: "13. Contact Us", content: "For questions about these Terms, contact us at:\n\nFarmLink Zim\nEmail: legal@farmlinkzim.com\nPlatform: farmlink-zim-vm8p.vercel.app\nZimbabwe" },
];

const PP_SECTIONS = [
  { title: "1. Introduction", content: "FarmLink Zim is committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, and protect data in accordance with Zimbabwe's Cyber and Data Protection Act, 2021." },
  { title: "2. Information We Collect", content: "We collect information you provide (name, email, phone, farm location, crops, livestock, listings, diary entries, messages) and information collected automatically (device type, IP address, pages visited, access times). We use Open-Meteo for weather data using your province location." },
  { title: "3. How We Use Your Information", content: "We use your information to create and manage your account, display marketplace listings, provide personalised AI agricultural advice, send notifications about prices and alerts, generate anonymised agricultural insights, improve the Platform, and comply with legal obligations." },
  { title: "4. Sharing Your Information", content: "We do not sell your personal information. Marketplace listings are visible to all Platform users. Farm diary entries are private.\n\nWe use the following services: Supabase (database, EU servers), Vercel (hosting), Anthropic Claude AI (advisory queries), and Open-Meteo (weather). We may disclose information if required by Zimbabwean law." },
  { title: "5. Data Security", content: "We implement encrypted data transmission (HTTPS/TLS), secure OTP authentication, database-level row security policies, and regular security reviews. However, no internet transmission is 100% secure. Please notify us immediately if you suspect unauthorised account access." },
  { title: "6. Data Retention", content: "We retain your personal information for as long as your account is active. You may request deletion at any time by contacting us. We will process deletion requests within 30 days, except where retention is required by law." },
  { title: "7. Your Rights", content: "Under Zimbabwe's Cyber and Data Protection Act, 2021, you have the right to access your personal information, correct inaccurate data, request deletion, object to certain processing, and withdraw consent. Contact legal@farmlinkzim.com to exercise these rights." },
  { title: "8. Children's Privacy", content: "FarmLink Zim is not directed at children under 18. We do not knowingly collect information from children. If we discover we have inadvertently done so, we will delete it promptly." },
  { title: "9. Cookies and Storage", content: "The Platform uses browser local storage to maintain your login session and user preferences. We do not use advertising or tracking cookies. You may clear your browser storage at any time, which will log you out." },
  { title: "10. International Data Transfers", content: "Your data may be processed on servers outside Zimbabwe (including the EU via Supabase). We ensure appropriate safeguards are in place for such transfers in accordance with applicable data protection laws." },
  { title: "11. Changes to This Policy", content: "We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification. The updated policy will be effective from the date shown at the top." },
  { title: "12. Contact Us", content: "For privacy questions or to exercise your data rights:\n\nFarmLink Zim — Data Controller\nEmail: legal@farmlinkzim.com\nPlatform: farmlink-zim-vm8p.vercel.app\nZimbabwe\n\nYou also have the right to lodge a complaint with POTRAZ if you believe your data protection rights have been violated." },
];

function LegalTab({ page, setActiveTab }) {
  const isTos = page === "tos";
  const sections = isTos ? TOS_SECTIONS : PP_SECTIONS;
  const [expanded, setExpanded] = useState(null);
  const effectiveDate = new Date().toLocaleDateString("en-ZW", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="fade-in single-col">
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0f2218, #1a3d24)", border: "1px solid #2d5a36", borderRadius: 16, padding: "24px 20px", marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "#5cd68a", fontWeight: 600, letterSpacing: "0.1em", marginBottom: 8 }}>
          🌿 FARMLINK ZIM · LEGAL
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#c8e8d4", marginBottom: 6 }}>
          {isTos ? "Terms of Service" : "Privacy Policy"}
        </div>
        <div style={{ fontSize: 12, color: "#5c8f6b" }}>Effective: {effectiveDate}</div>
      </div>

      {/* Toggle between docs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[["tos", "Terms of Service"], ["pp", "Privacy Policy"]].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(`legal-${id}`)}
            style={{ flex: 1, background: page === id ? "#2d7a4f" : "#152218", border: `1px solid ${page === id ? "#3a9962" : "#1f3525"}`, borderRadius: 8, padding: "10px", color: page === id ? "#e8f5ed" : "#5c8f6b", fontSize: 12, cursor: "pointer", fontWeight: page === id ? 600 : 400 }}>
            {label}
          </button>
        ))}
      </div>

      {/* Accordion sections */}
      {sections.map((s, i) => (
        <div key={i} style={{ background: "#152218", border: "1px solid #1f3525", borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
          <button onClick={() => setExpanded(expanded === i ? null : i)}
            style={{ width: "100%", background: "none", border: "none", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", textAlign: "left" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#c8e8d4" }}>{s.title}</span>
            <span style={{ fontSize: 16, color: "#4a7a5a", flexShrink: 0, marginLeft: 8 }}>{expanded === i ? "−" : "+"}</span>
          </button>
          {expanded === i && (
            <div style={{ padding: "0 16px 16px", borderTop: "1px solid #1a2e1e" }}>
              {s.content.split("\n\n").map((para, j) => (
                <p key={j} style={{ fontSize: 13, color: "#8aaa94", lineHeight: 1.7, marginTop: 12, marginBottom: 0 }}>{para}</p>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Footer */}
      <div style={{ marginTop: 24, padding: "16px", background: "#0f2218", borderRadius: 12, border: "1px solid #1f3525", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "#3d6b4a", marginBottom: 4 }}>© {new Date().getFullYear()} FarmLink Zim. All rights reserved.</div>
        <div style={{ fontSize: 11, color: "#2d5236" }}>Questions? Email legal@farmlinkzim.com</div>
      </div>
    </div>
  );
}

// ─── ADMIN DASHBOARD ───────────────────────────────────────────────────────────
function AdminTab({ farmers, listings }) {
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoadingMsgs(true);
      try {
        const data = await db.get("messages", "?order=created_at.desc&limit=20");
        setMessages(Array.isArray(data) ? data : []);
      } catch (e) {}
      setLoadingMsgs(false);
    };
    load();
  }, []);

  const cropTally = {};
  farmers.forEach(f => { if (f.province) cropTally[f.province] = (cropTally[f.province] || 0) + 1; });
  const topProvinces = Object.entries(cropTally).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="fade-in single-col">
      <div style={{ fontSize: 20, fontWeight: 700, color: "#c8e8d4", marginBottom: 4 }}>Admin Dashboard</div>
      <div style={{ fontSize: 12, color: "#4a7a5a", marginBottom: 20 }}>Platform overview & management</div>

      {/* Key metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[{ label: "Total Farmers", value: farmers.length, icon: "👩🏾‍🌾", color: "#7ec99a" }, { label: "Active Listings", value: listings.length, icon: "🛒", color: "#7ec99a" }, { label: "Messages Received", value: messages.length, icon: "💬", color: "#5a9fd4" }, { label: "Provinces Active", value: Object.keys(cropTally).length, icon: "📍", color: "#d4a017" }].map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontSize: 24 }}>{s.icon}</div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
            <div style={{ fontSize: 11, color: "#5c8f6b", marginTop: 6, fontFamily: "'Space Mono', monospace" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Top provinces */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">Farmers by Province</div>
        {topProvinces.map(([prov, count], i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, fontSize: 13, color: "#c8e8d4" }}>{prov}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ height: 6, borderRadius: 3, background: "linear-gradient(90deg, #2d7a4f, #5cd68a)", width: Math.max(20, (count / farmers.length) * 120) }} />
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#7ec99a", minWidth: 16 }}>{count}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent farmers */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">Recent Farmer Registrations</div>
        {farmers.slice(0, 5).map((f, i) => (
          <div key={i} style={{ padding: "8px 0", borderTop: i > 0 ? "1px solid #1a2e1e" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{ fontSize: 22 }}>👩🏾‍🌾</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#c8e8d4" }}>{maskName(f.name)}</div>
                <div style={{ fontSize: 10, color: "#4a7a5a", fontFamily: "'Space Mono', monospace" }}>{f.district}, {f.province}</div>
              </div>
              {f.phone && <div style={{ fontSize: 11, color: "#5c8f6b" }}>{f.phone}</div>}
            </div>
            {f.farmer_crops && f.farmer_crops.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingLeft: 32 }}>
                {f.farmer_crops.map((c, j) => (
                  <span key={j} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: c.type === "livestock" ? "rgba(90,143,163,0.15)" : "rgba(45,122,79,0.15)", color: c.type === "livestock" ? "#5a9fd4" : "#7ec99a", fontFamily: "'Space Mono', monospace" }}>
                    {c.type === "livestock" ? "🐄" : "🌾"} {c.crop_name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {farmers.length === 0 && <div style={{ fontSize: 12, color: "#4a7a5a", textAlign: "center", padding: "12px 0" }}>No registrations yet</div>}
      </div>

      {/* Recent messages */}
      <div className="card">
        <div className="section-title">Recent Buyer Messages</div>
        {loadingMsgs ? <div className="skeleton" style={{ height: 60, borderRadius: 8 }} /> :
          messages.length === 0 ? <div style={{ fontSize: 12, color: "#4a7a5a", textAlign: "center", padding: "12px 0" }}>No messages yet</div> :
          messages.slice(0, 5).map((m, i) => (
            <div key={i} style={{ padding: "10px 0", borderTop: i > 0 ? "1px solid #1a2e1e" : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#c8e8d4" }}>{m.sender_name}</div>
                {m.sender_phone && <div style={{ fontSize: 11, color: "#5c8f6b" }}>{m.sender_phone}</div>}
              </div>
              <div style={{ fontSize: 12, color: "#8aaa94", lineHeight: 1.4 }}>{m.message}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ─── AUTH MODAL ────────────────────────────────────────────────────────────────
function AuthModal({ onClose, authUser, onAuth, onLogout, setActiveTab }) {
  const [step, setStep] = useState("input");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [profileTab, setProfileTab] = useState("overview");
  const [myListings, setMyListings] = useState([]);
  const [myDiary, setMyDiary] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const isEmail = identifier.includes("@");

  const handleSendOtp = async () => {
    if (!identifier.trim()) return;
    setLoading(true); setError("");
    const { error: err } = await auth.sendOtp(identifier.trim());
    setLoading(false);
    if (err) {
      const msg = err.message || err.msg || JSON.stringify(err);
      if (msg.includes("rate limit") || msg.includes("429")) setError("Too many attempts. Please wait a few minutes and try again.");
      else if (msg.includes("invalid") || msg.includes("email")) setError("Invalid email address. Please check and try again.");
      else if (msg.includes("not enabled") || msg.includes("disabled")) setError("Email sign-in is not enabled in Supabase. Go to Authentication > Providers > Email > Enable.");
      else setError("Could not send code: " + msg);
      return;
    }
    setSentTo(identifier.trim());
    setStep("verify");
  };

  const handleVerify = async () => {
    if (otp.length < 6) return;
    setLoading(true); setError("");
    const { user, error: err } = await auth.verifyOtp(sentTo, otp.trim());
    setLoading(false);
    if (err || !user) { setError("Invalid or expired code. Please try again."); return; }
    onAuth(user);
  };

  const loadProfileData = async () => {
    setLoadingData(true);
    const [listings, diary] = await Promise.all([
      db.get("listings", "?active=eq.true&order=created_at.desc"),
      db.get("farm_diary", "?order=activity_date.desc&limit=10"),
    ]);
    setMyListings(Array.isArray(listings) ? listings : []);
    setMyDiary(Array.isArray(diary) ? diary : []);
    setLoadingData(false);
  };

  if (authUser) {
    const email = authUser.email || "";
    const phone = authUser.phone || "";
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: "92vh", overflowY: "auto", padding: 0 }}>
          <div style={{ background: "linear-gradient(135deg, #0f2218, #1a3d24)", padding: "20px 20px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 52, height: 52, background: "linear-gradient(135deg, #2d7a4f, #1a5c36)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{"👩🏾‍🌾"}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#c8e8d4" }}>{email || phone}</div>
                  <div style={{ fontSize: 10, color: "#4a7a5a", marginTop: 2, display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#5cd68a" }} />
                    VERIFIED FARMER
                  </div>
                </div>
              </div>
              <button onClick={onClose} style={{ background: "none", border: "none", color: "#4a7a5a", fontSize: 22, cursor: "pointer" }}>{"✕"}</button>
            </div>
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1f3525" }}>
              {[["overview", "Overview"], ["listings", "Listings"], ["diary", "Diary"], ["farm", "Farm"]].map(([id, label]) => (
                <button key={id} onClick={() => { setProfileTab(id); if (id !== "overview") loadProfileData(); }}
                  style={{ flex: 1, background: "none", border: "none", borderBottom: profileTab === id ? "2px solid #7ec99a" : "2px solid transparent", padding: "10px 4px", color: profileTab === id ? "#7ec99a" : "#4a7a5a", fontSize: 11, cursor: "pointer", fontWeight: profileTab === id ? 600 : 400 }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: "16px 20px 20px" }}>
            {profileTab === "overview" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {[{ label: "Listings", icon: "🛒" }, { label: "Diary", icon: "📓" }, { label: "Free Plan", icon: "⭐" }].map((s, i) => (
                    <div key={i} style={{ background: "#152218", border: "1px solid #1f3525", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                      <div style={{ fontSize: 9, color: "#4a7a5a", marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="section-title">Quick Actions</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {[
                    { icon: "🛒", label: "Manage My Listings", sub: "Edit, feature or remove listings", action: () => { setProfileTab("listings"); loadProfileData(); } },
                    { icon: "📓", label: "View Farm Diary", sub: "See your activity log", action: () => { setProfileTab("diary"); loadProfileData(); } },
                    { icon: "📈", label: "Market Prices", sub: "Latest GMB and ZFU prices", action: () => { onClose(); setActiveTab("prices"); } },
                    { icon: "🗓️", label: "Planting Calendar", sub: "View seasonal schedule", action: () => { onClose(); setActiveTab("calendar"); } },
                  ].map((a, i) => (
                    <button key={i} onClick={a.action} style={{ display: "flex", alignItems: "center", gap: 12, background: "#152218", border: "1px solid #1f3525", borderRadius: 12, padding: "12px 14px", cursor: "pointer", textAlign: "left" }}>
                      <span style={{ fontSize: 22 }}>{a.icon}</span>
                      <div><div style={{ fontSize: 13, fontWeight: 600, color: "#c8e8d4" }}>{a.label}</div><div style={{ fontSize: 11, color: "#4a7a5a" }}>{a.sub}</div></div>
                      <span style={{ marginLeft: "auto", color: "#3d6b4a", fontSize: 16 }}>{"›"}</span>
                    </button>
                  ))}
                </div>
                <div style={{ background: "linear-gradient(135deg, #1e2d18, #152218)", border: "1px solid #d4a017", borderRadius: 12, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: "#d4a017", fontWeight: 700, marginBottom: 6 }}>{"⭐"} FARMLINK PREMIUM — USD 5/month</div>
                  {["Verified badge on all listings", "Unlimited listings (free: 2)", "Priority marketplace placement"].map((b, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#8aaa94", marginBottom: 3 }}>{"✓"} {b}</div>
                  ))}
                  <button style={{ width: "100%", background: "linear-gradient(135deg, #b8860b, #8b6914)", border: "none", borderRadius: 8, padding: "10px", color: "#fff8e8", fontSize: 12, cursor: "pointer", fontWeight: 600, marginTop: 10 }}>Upgrade to Premium {"→"}</button>
                </div>
                <button onClick={onLogout} className="btn-secondary" style={{ width: "100%", color: "#e07060", borderColor: "#5a2020" }}>Sign Out</button>
              </>
            )}

            {profileTab === "listings" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#c8e8d4" }}>My Listings</div>
                  <button onClick={() => { onClose(); setActiveTab("market"); }} style={{ background: "#152218", border: "1px solid #2d7a4f", borderRadius: 8, padding: "6px 12px", color: "#7ec99a", fontSize: 11, cursor: "pointer" }}>{"+"} New Listing</button>
                </div>
                {loadingData ? <div className="skeleton" style={{ height: 80, borderRadius: 10 }} /> :
                  myListings.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px 20px" }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>🛒</div>
                      <div style={{ fontSize: 13, color: "#5c8f6b", marginBottom: 12 }}>No listings yet</div>
                      <button onClick={() => { onClose(); setActiveTab("market"); }} className="btn-primary" style={{ width: "auto", padding: "8px 20px" }}>Post Your First Listing</button>
                    </div>
                  ) : myListings.map((l, i) => (
                    <div key={i} style={{ background: "#1a2e1e", border: "1px solid #1f3525", borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#c8e8d4" }}>{l.crop}</div>
                        {l.is_featured && <span style={{ fontSize: 9, background: "rgba(212,160,23,0.2)", color: "#d4a017", padding: "2px 7px", borderRadius: 8 }}>{"⭐"} FEATURED</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "#5c8f6b", marginBottom: 4 }}>{"📍"} {l.location} · {l.price}</div>
                      <button onClick={() => { onClose(); setActiveTab("market"); }} style={{ background: "#152218", border: "1px solid #2d5a36", borderRadius: 7, padding: "5px 12px", color: "#7ec99a", fontSize: 11, cursor: "pointer" }}>{"✏️"} Edit in Marketplace</button>
                    </div>
                  ))
                }
              </>
            )}

            {profileTab === "diary" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#c8e8d4" }}>Recent Activity</div>
                  <button onClick={() => { onClose(); setActiveTab("diary"); }} style={{ background: "#152218", border: "1px solid #2d7a4f", borderRadius: 8, padding: "6px 12px", color: "#7ec99a", fontSize: 11, cursor: "pointer" }}>{"+"} Log Activity</button>
                </div>
                {loadingData ? <div className="skeleton" style={{ height: 80, borderRadius: 10 }} /> :
                  myDiary.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px 20px" }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>📓</div>
                      <div style={{ fontSize: 13, color: "#5c8f6b", marginBottom: 12 }}>No diary entries yet</div>
                      <button onClick={() => { onClose(); setActiveTab("diary"); }} className="btn-primary" style={{ width: "auto", padding: "8px 20px" }}>Start Your Farm Diary</button>
                    </div>
                  ) : myDiary.map((e, i) => {
                    const type = ACTIVITY_TYPES.find(a => a.id === e.activity_type) || ACTIVITY_TYPES[7];
                    return (
                      <div key={i} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: i < myDiary.length - 1 ? "1px solid #1a2e1e" : "none" }}>
                        <div style={{ width: 32, height: 32, background: type.color + "20", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{type.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#c8e8d4" }}>{type.label}{e.crop_name ? " — " + e.crop_name : ""}</div>
                          <div style={{ fontSize: 11, color: "#5c8f6b" }}>{new Date(e.activity_date + "T00:00:00").toLocaleDateString("en-ZW", { day: "numeric", month: "short" })}</div>
                          <div style={{ fontSize: 11, color: "#8aaa94", marginTop: 2 }}>{(e.notes || "").slice(0, 60)}{(e.notes || "").length > 60 ? "..." : ""}</div>
                        </div>
                      </div>
                    );
                  })
                }
                <button onClick={() => { onClose(); setActiveTab("diary"); }} className="btn-secondary" style={{ width: "100%", marginTop: 12 }}>View Full Diary {"→"}</button>
              </>
            )}

            {profileTab === "farm" && (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#c8e8d4", marginBottom: 16 }}>Farm Details</div>
                <div style={{ background: "#1a2e1e", borderRadius: 12, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "#4a7a5a", marginBottom: 8, fontWeight: 600 }}>UPDATE FARM REGISTRATION</div>
                  <div style={{ fontSize: 13, color: "#8aaa94", lineHeight: 1.6, marginBottom: 12 }}>Update your province, district, crops and livestock through the Register Farm tab.</div>
                  <button onClick={() => { onClose(); setActiveTab("register"); }} className="btn-primary">Update Farm Details {"→"}</button>
                </div>
                <div style={{ background: "#1a2e1e", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "#4a7a5a", marginBottom: 8, fontWeight: 600 }}>CROP AND LIVESTOCK TRACKING</div>
                  <div style={{ fontSize: 13, color: "#8aaa94", lineHeight: 1.6, marginBottom: 12 }}>Update hectares and headcount on the interactive farmer map.</div>
                  <button onClick={() => { onClose(); setActiveTab("home"); }} className="btn-secondary" style={{ width: "100%" }}>Open Farmer Map {"→"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

// ─── PRICE FEEDS TAB ───────────────────────────────────────────────────────────

// ─── PLANTING CALENDAR TAB ─────────────────────────────────────────────────────

// ─── INPUT SUPPLIERS TAB ───────────────────────────────────────────────────────

// ─── INSIGHTS TAB ──────────────────────────────────────────────────────────────
function InsightsTab() {
  const [cropData, setCropData] = useState([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [livestockData, setLivestockData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await db.get("farmer_crops", "?select=id,crop_name,type,hectares,head_count,farmer_id");
        if (Array.isArray(data)) {
          const agg = {};
          data.forEach(row => {
            const isLive = row.type === "livestock";
            // Only include rows that have the relevant metric set
            if (isLive && row.head_count == null) return;
            if (!isLive && row.hectares == null) return;
            const key = row.crop_name;
            if (!agg[key]) agg[key] = { crop_name: row.crop_name, type: row.type, total: 0, farmer_count: 0 };
            agg[key].total += isLive ? (parseInt(row.head_count) || 0) : (parseFloat(row.hectares) || 0);
            agg[key].farmer_count += 1;
          });
          const sorted = Object.values(agg).sort((a, b) => b.total - a.total);
          setCropData(sorted.filter(d => d.type === "crop"));
          setLivestockData(sorted.filter(d => d.type === "livestock"));
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, []);

  const yieldData = [
    { region: "Mash Central", crop: "Maize", yield: 4.2, forecast: 3.6, change: -14 },
    { region: "Mash East", crop: "Tobacco", yield: 1.8, forecast: 2.1, change: 17 },
    { region: "Manicaland", crop: "Coffee", yield: 0.9, forecast: 1.0, change: 11 },
    { region: "Midlands", crop: "Soya", yield: 2.3, forecast: 2.0, change: -13 },
    { region: "Mat North", crop: "Cattle", yield: 820, forecast: 790, change: -4 },
  ];

  const maxCrop = Math.max(...cropData.map(d => d.total), 1);
  const maxLive = Math.max(...livestockData.map(d => d.total), 1);
  const totalCropHa = cropData.reduce((s, d) => s + d.total, 0);
  const totalLiveHead = livestockData.reduce((s, d) => s + d.total, 0);

  const CROP_COLORS = ["#2d7a4f", "#3a9962", "#5cd68a", "#7ec99a", "#4aad72", "#1f5a39", "#27803d", "#60c070"];
  const LIVE_COLORS = ["#5a9fd4", "#3a7ab5", "#7abde8", "#2d6fa0", "#4a8fc4"];

  return (
    <div className="fade-in single-col">
      <div style={{ fontSize: 20, fontWeight: 700, color: "#c8e8d4", marginBottom: 4 }}>Market Insights</div>
      <div style={{ fontSize: 12, color: "#4a7a5a", marginBottom: 20 }}>AI-powered yield & price intelligence</div>

      {/* ── CROP COVERAGE CHARTS ── */}
      {loading ? (
        <div className="skeleton" style={{ height: 200, borderRadius: 12, marginBottom: 16 }} />
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ background: "linear-gradient(135deg, #152218, #0f2218)", border: "1px solid #2d5a36", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#5c8f6b", marginBottom: 6 }}>TOTAL CROP AREA</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#7ec99a" }}>{totalCropHa.toFixed(1)}</div>
              <div style={{ fontSize: 11, color: "#4a7a5a", fontFamily: "'Space Mono', monospace" }}>HECTARES · {cropData.length} CROPS</div>
            </div>
            <div style={{ background: "linear-gradient(135deg, #152218, #0f1a2a)", border: "1px solid #2d4a6a", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#4a6a8f", marginBottom: 6 }}>TOTAL LIVESTOCK AREA</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#5a9fd4" }}>{totalLiveHead.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: "#4a6a8f", fontFamily: "'Space Mono', monospace" }}>HEAD · {livestockData.length} TYPES</div>
            </div>
          </div>

          {/* Crops bar chart */}
          {cropData.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div className="section-title" style={{ margin: 0 }}>🌾 Crops by Hectares</div>
                <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#4a7a5a" }}>LIVE · ALL FARMERS</div>
              </div>
              <svg viewBox={`0 0 400 ${Math.max(cropData.length * 44 + 20, 80)}`} style={{ width: "100%", height: "auto" }}>
                {cropData.map((d, i) => {
                  const barW = Math.max((d.total / maxCrop) * 280, 4);
                  const y = i * 44 + 8;
                  const color = CROP_COLORS[i % CROP_COLORS.length];
                  const pct = ((d.total / totalCropHa) * 100).toFixed(1);
                  return (
                    <g key={i}>
                      {/* Label */}
                      <text x="0" y={y + 12} fill="#c8e8d4" fontSize="11" fontFamily="monospace">{d.crop_name}</text>
                      <text x="0" y={y + 24} fill="#4a7a5a" fontSize="9" fontFamily="monospace">{d.farmer_count} farmer{d.farmer_count > 1 ? "s" : ""}</text>
                      {/* Background track */}
                      <rect x="110" y={y + 4} width="280" height="18" rx="4" fill="#1a2e1e" />
                      {/* Bar */}
                      <rect x="110" y={y + 4} width={barW} height="18" rx="4" fill={color} opacity="0.9" />
                      {/* Value - inside bar if wide, outside if narrow */}
                      {barW > 180
                        ? <text x={110 + barW - 6} y={y + 16} fill="#0d1a0f" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="end">{d.total.toFixed(1)} ha  {pct}%</text>
                        : <g><text x={110 + barW + 6} y={y + 16} fill={color} fontSize="10" fontFamily="monospace" fontWeight="bold">{d.total.toFixed(1)} ha</text>
                          <text x="388" y={y + 16} fill="#5c8f6b" fontSize="9" fontFamily="monospace" textAnchor="end">{pct}%</text></g>
                      }
                    </g>
                  );
                })}
              </svg>

              {/* Donut chart */}
              <div style={{ marginTop: 16, borderTop: "1px solid #1a2e1e", paddingTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <svg viewBox="0 0 100 100" style={{ width: 100, height: 100, flexShrink: 0 }}>
                    {(() => {
                      let offset = 0;
                      const total = cropData.reduce((s, d) => s + d.total, 0);
                      const r = 35, cx = 50, cy = 50, circ = 2 * Math.PI * r;
                      return cropData.map((d, i) => {
                        const pct = d.total / total;
                        const dash = pct * circ;
                        const gap = circ - dash;
                        const seg = (
                          <circle key={i} cx={cx} cy={cy} r={r}
                            fill="none" stroke={CROP_COLORS[i % CROP_COLORS.length]} strokeWidth="18"
                            strokeDasharray={`${dash} ${gap}`}
                            strokeDashoffset={-offset * circ}
                            style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }} />
                        );
                        offset += pct;
                        return seg;
                      });
                    })()}
                    <text x="50" y="47" textAnchor="middle" fill="#c8e8d4" fontSize="10" fontFamily="monospace" fontWeight="bold">{totalCropHa.toFixed(0)}</text>
                    <text x="50" y="58" textAnchor="middle" fill="#4a7a5a" fontSize="7" fontFamily="monospace">ha total</text>
                  </svg>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {cropData.map((d, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: CROP_COLORS[i % CROP_COLORS.length], flexShrink: 0 }} />
                        <span style={{ fontSize: 10, color: "#8aaa94", fontFamily: "'Space Mono', monospace" }}>{d.crop_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Livestock bar chart */}
          {livestockData.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div className="section-title" style={{ margin: 0 }}>🐄 Livestock by Head Count</div>
                <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#4a7a5a" }}>LIVE · ALL FARMERS</div>
              </div>
              <svg viewBox={`0 0 400 ${Math.max(livestockData.length * 44 + 20, 80)}`} style={{ width: "100%", height: "auto" }}>
                {livestockData.map((d, i) => {
                  const barW = Math.max((d.total / maxLive) * 280, 4);
                  const y = i * 44 + 8;
                  const color = LIVE_COLORS[i % LIVE_COLORS.length];
                  const pct = ((d.total / totalLiveHead) * 100).toFixed(1);
                  return (
                    <g key={i}>
                      <text x="0" y={y + 12} fill="#c8e8d4" fontSize="11" fontFamily="monospace">{d.crop_name}</text>
                      <text x="0" y={y + 24} fill="#4a7a5a" fontSize="9" fontFamily="monospace">{d.farmer_count} farmer{d.farmer_count > 1 ? "s" : ""}</text>
                      <rect x="110" y={y + 4} width="280" height="18" rx="4" fill="#1a2218" />
                      <rect x="110" y={y + 4} width={barW} height="18" rx="4" fill={color} opacity="0.9" />
                      {barW > 180
                        ? <text x={110 + barW - 6} y={y + 16} fill="#0d1a0f" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="end">{Math.round(d.total)} head  {pct}%</text>
                        : <g><text x={110 + barW + 6} y={y + 16} fill={color} fontSize="10" fontFamily="monospace" fontWeight="bold">{Math.round(d.total)} head</text>
                          <text x="388" y={y + 16} fill="#4a6a8f" fontSize="9" fontFamily="monospace" textAnchor="end">{pct}%</text></g>
                      }
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {cropData.length === 0 && livestockData.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: "32px 20px", marginBottom: 16 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 13, color: "#5c8f6b", fontFamily: "'Space Mono', monospace", marginBottom: 8 }}>NO DATA YET</div>
              <div style={{ fontSize: 12, color: "#4a7a5a" }}>Open the Farmer Map and tap Edit on any crop or livestock to add data.</div>
            </div>
          )}
        </>
      )}

      {/* AI forecast */}
      <div style={{ background: "linear-gradient(135deg, #1a2e1e, #0f2218)", border: "1px solid #2d5a36", borderRadius: 14, padding: "16px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ fontSize: 28 }}>🛰️</div>
          <div>
            <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: "#5cd68a", marginBottom: 4 }}>AI SATELLITE FORECAST · 2024/25 SEASON</div>
            <div style={{ fontSize: 15, color: "#e8dfc8", lineHeight: 1.5 }}>Mashonaland maize yield expected to drop <strong style={{ color: "#e07060" }}>12–15%</strong> due to reduced rainfall. Manicaland tobacco shows strong recovery.</div>
          </div>
        </div>
      </div>

      {/* Yield table */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">Regional Yield Forecast</div>
        {yieldData.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: i < yieldData.length - 1 ? "1px solid #1a2e1e" : "none" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: "#c8e8d4", marginBottom: 2 }}>{d.region}</div>
              <div style={{ fontSize: 10, color: "#4a7a5a", fontFamily: "'Space Mono', monospace" }}>{d.crop}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: "#8aaa94" }}>{d.yield} → {d.forecast} {d.crop === "Cattle" ? "kg/head" : "t/ha"}</div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: d.change > 0 ? "#5cd68a" : "#e07060" }}>{d.change > 0 ? "▲" : "▼"} {Math.abs(d.change)}%</div>
            </div>
          </div>
        ))}
      </div>

      {/* Premium upsell */}
      <div style={{ background: "linear-gradient(135deg, #1e2d18, #152218)", border: "1px solid #d4a017", borderRadius: 14, padding: "16px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: "#d4a017", marginBottom: 8 }}>PREMIUM INSIGHTS</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#c8e8d4", marginBottom: 6 }}>Unlock Full Market Intelligence</div>
        <div style={{ fontSize: 13, color: "#8aaa94", lineHeight: 1.5, marginBottom: 14 }}>Daily price predictions, GMB tender alerts, buyer demand signals, and export market data.</div>
        <button className="btn-primary" style={{ background: "linear-gradient(135deg, #b8860b, #8b6914)" }}>Subscribe — USD 12/month</button>
      </div>

      {/* Pest alerts */}
      <div className="section-title">🚨 Current Pest & Disease Alerts</div>
      {[{ name: "Fall Armyworm", risk: "High", regions: "Mash West, Mash Central", action: "Apply chlorpyrifos immediately" }, { name: "Stalk Borer", risk: "Medium", regions: "Midlands, Masvingo", action: "Monitor trap counts weekly" }, { name: "Tick Season", risk: "High", regions: "Matabeleland", action: "Dip cattle weekly with Triatix" }].map((p, i) => (
        <div key={i} style={{ background: "#152218", border: `1px solid ${p.risk === "High" ? "#5a2020" : "#3a4a20"}`, borderRadius: 10, padding: "12px", marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#c8e8d4" }}>{p.name}</div>
            <span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", background: p.risk === "High" ? "rgba(224,112,96,0.2)" : "rgba(200,180,60,0.2)", color: p.risk === "High" ? "#e07060" : "#c8b43c", padding: "2px 8px", borderRadius: 8 }}>{p.risk} Risk</span>
          </div>
          <div style={{ fontSize: 11, color: "#5c8f6b", marginBottom: 4 }}>📍 {p.regions}</div>
          <div style={{ fontSize: 12, color: "#8aaa94" }}>💊 {p.action}</div>
        </div>
      ))}
    </div>
  );
}
}
 
