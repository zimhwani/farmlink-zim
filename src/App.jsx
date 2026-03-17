import { useState, useEffect, useRef, useCallback } from "react";

const SUPABASE_URL = "https://buyvgrxgseubplqesvjp.supabase.co";
const SUPABASE_KEY = "sb_publishable_TJH0e7GMsengGdAUjG5HYg_hkpBrBxA";

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
  const [authUser, setAuthUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [weather, setWeather] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);
  useEffect(() => { loadListings(); loadCounts(); loadFarmers(); fetchWeather(); checkAuth(); }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${localStorage.getItem("sb_token") || ""}` }
      });
      if (res.ok) { const u = await res.json(); if (u.id) setAuthUser(u); }
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
      const data = await db.get("farmers", "?select=id,name,province,district,ward,latitude,longitude,farmer_crops(crop_name,type)&order=created_at.desc");
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
          ...selectedCrops.map(c => ({ farmer_id: farmer.id, crop_name: c, type: "crop" })),
          ...selectedLivestock.map(l => ({ farmer_id: farmer.id, crop_name: l, type: "livestock" })),
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
    { id: "register", icon: "📍", label: "Register Farm" },
    { id: "advisory", icon: "🤖", label: "AI Advisor" },
    { id: "prices", icon: "📈", label: "Price Feeds" },
    { id: "calendar", icon: "🗓️", label: "Planting Calendar" },
    { id: "suppliers", icon: "🏪", label: "Input Suppliers" },
    { id: "insights", icon: "📊", label: "Insights" },
    { id: "calendar", icon: "🗓️", label: "Calendar" },
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
            <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#3d6b4a", marginBottom: 6 }}>PLATFORM STATUS</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#5cd68a" }} className="pulse" />
              <span style={{ fontSize: 11, color: "#5c8f6b" }}>Live · Supabase connected</span>
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
                <div style={{ background: "#152218", border: "1px solid #1f3525", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>🔔</div>
                <div onClick={() => setShowAuthModal(true)} style={{ background: authUser ? "#1a3d24" : "#152218", border: `1px solid ${authUser ? "#2d7a4f" : "#1f3525"}`, borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontFamily: "'Space Mono', monospace", color: authUser ? "#7ec99a" : "#4a7a5a" }}>
                  {authUser ? "✓ Logged in" : "👤 Login"}
                </div>
              </div>
            </div>
          </div>

          {/* Page content */}
          <div className="page-content">
            {activeTab === "home" && <HomeTab setActiveTab={setActiveTab} farmerCount={farmerCount} listingCount={listingCount} weather={weather} getWeatherIcon={getWeatherIcon} onFarmerMapClick={() => setShowFarmerMap(true)} />}
            {activeTab === "market" && <MarketTab listings={listings} loadingListings={loadingListings} filterCrop={filterCrop} setFilterCrop={setFilterCrop} setShowListingModal={setShowListingModal} setShowContactModal={setShowContactModal} setShowListingDetail={setShowListingDetail} />}
            {activeTab === "register" && <RegisterTab wizardStep={wizardStep} setWizardStep={setWizardStep} province={province} setProvince={setProvince} district={district} setDistrict={setDistrict} ward={ward} setWard={setWard} selectedCrops={selectedCrops} setSelectedCrops={setSelectedCrops} selectedLivestock={selectedLivestock} setSelectedLivestock={setSelectedLivestock} farmSize={farmSize} setFarmSize={setFarmSize} farmerName={farmerName} setFarmerName={setFarmerName} farmerPhone={farmerPhone} setFarmerPhone={setFarmerPhone} toggleItem={toggleItem} registrationDone={registrationDone} registeredFarmer={registeredFarmer} registerFarmer={registerFarmer} resetRegistration={resetRegistration} />}
            {activeTab === "advisory" && <AdvisoryTab chatMessages={chatMessages} chatInput={chatInput} setChatInput={setChatInput} sendChat={sendChat} isTyping={isTyping} chatEndRef={chatEndRef} />}
            {activeTab === "prices" && <PriceFeedsTab />}
            {activeTab === "calendar" && <PlantingCalendarTab />}
            {activeTab === "suppliers" && <InputSuppliersTab />}
            {activeTab === "insights" && <InsightsTab />}
            {activeTab === "calendar" && <CalendarTab />}
            {activeTab === "admin" && <AdminTab farmers={farmers} listings={listings} />}
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
      {showContactModal && <ContactModal listing={showContactModal} onClose={() => setShowContactModal(null)} onSend={async (msg) => { await db.post("messages", { listing_id: showContactModal.id, ...msg }); setShowContactModal(null); }} />}
      {showFarmerMap && <FarmerMapModal farmers={farmers} onClose={() => setShowFarmerMap(false)} loadFarmers={loadFarmers} />}
      {showListingDetail && <ListingDetailModal listing={showListingDetail} onClose={() => setShowListingDetail(null)} onContact={() => { setShowContactModal(showListingDetail); setShowListingDetail(null); }} />}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} onAuth={(user) => { setAuthUser(user); setShowAuthModal(false); }} />}
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

// ─── CROP HECTARE ROW (inline editable) ───────────────────────────────────────
function CropHectareRow({ crop, onUpdate }) {
  const isLivestock = crop.type === "livestock";
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    isLivestock ? (crop.head_count ?? "") : (crop.hectares ?? "")
  );
  const [saving, setSaving] = useState(false);

  const currentVal = isLivestock ? crop.head_count : crop.hectares;
  const unit = isLivestock ? "head" : "ha";
  const placeholder = isLivestock ? "e.g. 24" : "e.g. 5.5";

  const handleSave = async () => {
    setSaving(true);
    const parsed = value !== "" ? (isLivestock ? parseInt(value) : parseFloat(value)) : null;
    const updateData = isLivestock ? { head_count: parsed } : { hectares: parsed };
    await onUpdate(crop.id, updateData);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <span style={{
        fontSize: 10, padding: "2px 8px", borderRadius: 10,
        background: isLivestock ? "rgba(90,143,163,0.2)" : "rgba(45,122,79,0.2)",
        color: isLivestock ? "#5a9fd4" : "#7ec99a",
        fontFamily: "'Space Mono', monospace", flexShrink: 0,
      }}>
        {isLivestock ? "🐄" : "🌾"} {crop.crop_name}
      </span>

      {editing ? (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={placeholder}
            style={{
              width: 64, background: "#1a2e1e", border: "1px solid #4aad72",
              borderRadius: 6, padding: "2px 6px", color: "#e8dfc8",
              fontSize: 11, fontFamily: "'Space Mono', monospace", outline: "none",
            }}
            autoFocus
            onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
          />
          <span style={{ fontSize: 10, color: "#4a7a5a", fontFamily: "'Space Mono', monospace" }}>{unit}</span>
          <button onClick={handleSave} disabled={saving} style={{ background: "#2d7a4f", border: "none", borderRadius: 6, padding: "2px 8px", color: "#e8dfc8", fontSize: 10, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>
            {saving ? "..." : "✓"}
          </button>
          <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", color: "#4a7a5a", fontSize: 12, cursor: "pointer" }}>✕</button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, color: currentVal ? "#c8b43c" : "#3d6b4a", fontFamily: "'Space Mono', monospace" }}>
            {currentVal != null ? `${currentVal} ${unit}` : `— ${unit}`}
          </span>
          <button onClick={() => setEditing(true)} style={{ background: "none", border: "1px solid #2d5a36", borderRadius: 5, padding: "1px 6px", color: "#4a7a5a", fontSize: 9, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>
            edit
          </button>
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
                    <div style={{ fontSize: 13, color: "#c8e8d4", fontWeight: 600 }}>{f.name}</div>
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
          {[{ label: "Listings", value: listingCount, icon: "🛒" }, { label: "Districts", value: "60+", icon: "📍" }].map(s => (
            <div key={s.label} style={{ background: "#152218", border: "1px solid #1f3525", borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
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
        <div className="section-title">Live Price Alerts</div>
        <div style={{ display: "grid", gap: 8, marginBottom: 16 }} className="price-grid">
          {PRICE_ALERTS.map((p, i) => (
            <div key={i} style={{ background: "#152218", border: "1px solid #1f3525", borderRadius: 10, padding: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#c8e8d4" }}>{p.crop}</div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: p.trend === "up" ? "#5cd68a" : "#e07060" }}>{p.change}</div>
              </div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: "#7ec99a", margin: "6px 0 4px" }}>{p.price}</div>
              <div style={{ fontSize: 10, color: "#4a7a5a" }}>{p.region}</div>
            </div>
          ))}
        </div>

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
function MarketTab({ listings, loadingListings, filterCrop, setFilterCrop, setShowListingModal, setShowContactModal, setShowListingDetail }) {
  const filters = ["All", "Grain", "Livestock", "Horticulture", "Cash Crops"];
  const filterMap = { "Grain": ["Maize", "Wheat", "Sorghum"], "Livestock": ["Cattle", "Goats", "Sheep", "Pigs", "Poultry"], "Horticulture": ["Tomatoes", "Vegetables", "Sweet Potatoes"], "Cash Crops": ["Tobacco", "Cotton", "Coffee", "Soya", "Sunflower", "Groundnuts"] };
  const [search, setSearch] = useState("");
  const filtered = listings
    .filter(l => filterCrop === "All" || (filterMap[filterCrop] || []).some(f => l.crop?.toLowerCase().includes(f.toLowerCase())))
    .filter(l => !search || l.crop?.toLowerCase().includes(search.toLowerCase()) || l.location?.toLowerCase().includes(search.toLowerCase()) || l.farmer_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fade-in single-col">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#c8e8d4" }}>Marketplace</div>
          <div style={{ fontSize: 12, color: "#4a7a5a" }}>{listings.length} active listings</div>
        </div>
        <button onClick={() => setShowListingModal(true)} style={{ background: "#152218", border: "1px solid #2d7a4f", borderRadius: 8, padding: "8px 14px", color: "#7ec99a", fontSize: 12, cursor: "pointer", fontFamily: "'Space Mono', monospace", whiteSpace: "nowrap" }}>+ List Produce</button>
      </div>

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
                <span style={{ background: badgeColorBg(l.badge), color: badgeColorText(l.badge), fontSize: 9, fontFamily: "'Space Mono', monospace", padding: "2px 7px", borderRadius: 10, flexShrink: 0 }}>{l.badge}</span>
              </div>
              <div style={{ fontSize: 11, color: "#5c8f6b", marginBottom: 6 }}>📍 {l.location}</div>
              {l.description && <div style={{ fontSize: 12, color: "#8aaa94", marginBottom: 8, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{l.description}</div>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: "#7ec99a" }}>{l.price}</span>
                  <span style={{ fontSize: 11, color: "#4a7a5a", marginLeft: 6 }}>{l.quantity}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
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
  const waMsg = encodeURIComponent(`Hi ${l.farmer_name}, I saw your listing on FarmLink Zim for ${l.crop} (${l.quantity} at ${l.price}). I'm interested, please contact me.`);

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
              <div style={{ fontSize: 12, color: "#5c8f6b", marginTop: 2 }}>👩🏾‍🌾 {l.farmer_name} · 📍 {l.location}</div>
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
function RegisterTab({ wizardStep, setWizardStep, province, setProvince, district, setDistrict, ward, setWard, selectedCrops, setSelectedCrops, selectedLivestock, setSelectedLivestock, farmSize, setFarmSize, farmerName, setFarmerName, farmerPhone, setFarmerPhone, toggleItem, registrationDone, registeredFarmer, registerFarmer, resetRegistration }) {
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
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="section-title">Crops Being Grown</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {CROPS.map(c => <span key={c} className={`chip ${selectedCrops.includes(c) ? "active" : ""}`} style={{ fontSize: 11 }} onClick={() => toggleItem(selectedCrops, setSelectedCrops, c)}>{selectedCrops.includes(c) ? "✓ " : ""}{c}</span>)}
            </div>
          </div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">Livestock Raised</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {LIVESTOCK.map(l => <span key={l} className={`chip ${selectedLivestock.includes(l) ? "active" : ""}`} style={{ fontSize: 11 }} onClick={() => toggleItem(selectedLivestock, setSelectedLivestock, l)}>{selectedLivestock.includes(l) ? "✓ " : ""}{l}</span>)}
            </div>
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
              {selectedCrops.map(c => <span key={c} style={{ background: "rgba(45,122,79,0.2)", color: "#7ec99a", fontSize: 10, padding: "3px 8px", borderRadius: 8, fontFamily: "'Space Mono', monospace" }}>🌾 {c}</span>)}
              {selectedLivestock.map(l => <span key={l} style={{ background: "rgba(90,143,163,0.2)", color: "#5a9fd4", fontSize: 10, padding: "3px 8px", borderRadius: 8, fontFamily: "'Space Mono', monospace" }}>🐄 {l}</span>)}
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
    <div className="fade-in chat-col">
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
  const currentMonth = new Date().getMonth() + 1; // 1-12

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

  // Group by crop_name, merge zones
  const grouped = {};
  filtered.forEach(c => {
    if (!grouped[c.crop_name]) grouped[c.crop_name] = { ...c, zones: [c.province_zone] };
    else grouped[c.crop_name].zones.push(c.province_zone);
  });
  const crops = Object.values(grouped);

  // What's active this month
  const activeNow = calData.filter(c => {
    const planting = monthsInRange(c.plant_month_start, c.plant_month_end);
    const harvesting = monthsInRange(c.harvest_month_start, c.harvest_month_end);
    const fertilising = c.fertilise_month_start ? monthsInRange(c.fertilise_month_start, c.fertilise_month_end) : [];
    return planting.includes(currentMonth) || harvesting.includes(currentMonth) || fertilising.includes(currentMonth);
  });

  return (
    <div className="fade-in single-col">
      <div style={{ fontSize: 20, fontWeight: 700, color: "#c8e8d4", marginBottom: 4 }}>Planting Calendar</div>
      <div style={{ fontSize: 12, color: "#4a7a5a", marginBottom: 20 }}>AGRITEX seasonal guide for Zimbabwe 2025/26</div>

      {/* This month banner */}
      <div style={{ background: "linear-gradient(135deg, #1a3d24, #0f2218)", border: "1px solid #2d7a4f", borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#5cd68a", marginBottom: 8 }}>
          🗓️ {MONTHS[currentMonth - 1].toUpperCase()} — WHAT TO DO NOW
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {activeNow.length === 0 ? <div style={{ fontSize: 12, color: "#4a7a5a" }}>No activities this month for selected filters.</div> :
            [...new Set(activeNow.map(c => c.crop_name))].map(name => {
              const c = activeNow.find(x => x.crop_name === name);
              const isPlanting = monthsInRange(c.plant_month_start, c.plant_month_end).includes(currentMonth);
              const isHarvesting = monthsInRange(c.harvest_month_start, c.harvest_month_end).includes(currentMonth);
              const isFertilising = c.fertilise_month_start && monthsInRange(c.fertilise_month_start, c.fertilise_month_end).includes(currentMonth);
              const col = CAT_COLORS[c.category] || CAT_COLORS.grain;
              return (
                <div key={name} onClick={() => setSelectedCrop(c)} style={{ background: col.bg, border: `1px solid ${col.border}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>
                  <div style={{ fontSize: 12, color: col.text, fontWeight: 600 }}>{CAT_ICONS[c.category]} {name}</div>
                  <div style={{ fontSize: 9, fontFamily: "'Space Mono', monospace", color: col.dot, marginTop: 2 }}>
                    {[isPlanting && "🌱 PLANT", isFertilising && "🧪 FERTILISE", isHarvesting && "🌾 HARVEST"].filter(Boolean).join(" · ")}
                  </div>
                </div>
              );
            })
          }
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

      {/* Gantt-style calendar grid */}
      {loading ? <div className="skeleton" style={{ height: 300, borderRadius: 12 }} /> : (
        <div className="card" style={{ overflowX: "auto", padding: "16px 12px" }}>
          {/* Month header */}
          <div style={{ display: "grid", gridTemplateColumns: "120px repeat(12, 1fr)", gap: 2, marginBottom: 8 }}>
            <div />
            {MONTHS.map((m, i) => (
              <div key={m} style={{ textAlign: "center", fontSize: 9, fontFamily: "'Space Mono', monospace", color: i + 1 === currentMonth ? "#7ec99a" : "#3d6b4a", fontWeight: i + 1 === currentMonth ? 700 : 400, background: i + 1 === currentMonth ? "rgba(45,122,79,0.15)" : "transparent", borderRadius: 4, padding: "3px 0" }}>{m}</div>
            ))}
          </div>

          {/* Crop rows */}
          {crops.map((c, idx) => {
            const col = CAT_COLORS[c.category] || CAT_COLORS.grain;
            const plantMonths = monthsInRange(c.plant_month_start, c.plant_month_end);
            const harvestMonths = monthsInRange(c.harvest_month_start, c.harvest_month_end);
            const fertiliseMonths = c.fertilise_month_start ? monthsInRange(c.fertilise_month_start, c.fertilise_month_end) : [];
            return (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "120px repeat(12, 1fr)", gap: 2, marginBottom: 3, cursor: "pointer" }} onClick={() => setSelectedCrop(c)}>
                <div style={{ fontSize: 11, color: col.text, display: "flex", alignItems: "center", gap: 4, paddingRight: 8, overflow: "hidden" }}>
                  <span>{CAT_ICONS[c.category]}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.crop_name}</span>
                </div>
                {MONTHS.map((_, mi) => {
                  const m = mi + 1;
                  const isPlant = plantMonths.includes(m);
                  const isHarvest = harvestMonths.includes(m);
                  const isFert = fertiliseMonths.includes(m);
                  const isCurrent = m === currentMonth;
                  let bg = "transparent";
                  let emoji = null;
                  if (isHarvest) { bg = "rgba(212,160,23,0.5)"; emoji = "🌾"; }
                  else if (isPlant) { bg = `${col.border}60`; emoji = "🌱"; }
                  else if (isFert) { bg = "rgba(90,143,200,0.3)"; emoji = "🧪"; }
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
          <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            {[["🌱", "rgba(45,122,79,0.4)", "Plant"], ["🧪", "rgba(90,143,200,0.3)", "Fertilise"], ["🌾", "rgba(212,160,23,0.5)", "Harvest"]].map(([icon, bg, label]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 20, height: 14, borderRadius: 3, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>{icon}</div>
                <span style={{ fontSize: 10, color: "#5c8f6b", fontFamily: "'Space Mono', monospace" }}>{label}</span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 20, height: 14, borderRadius: 3, border: "1px solid #7ec99a" }} />
              <span style={{ fontSize: 10, color: "#5c8f6b", fontFamily: "'Space Mono', monospace" }}>Current month</span>
            </div>
          </div>
        </div>
      )}

      {/* Crop detail modal */}
      {selectedCrop && (
        <div className="modal-overlay" onClick={() => setSelectedCrop(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#c8e8d4" }}>{CAT_ICONS[selectedCrop.category]} {selectedCrop.crop_name}</div>
                <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#4a7a5a", marginTop: 2 }}>{(CAT_COLORS[selectedCrop.category] || CAT_COLORS.grain).text && selectedCrop.category?.replace("_", " ").toUpperCase()} · ZONE {selectedCrop.agro_zone}</div>
              </div>
              <button onClick={() => setSelectedCrop(null)} style={{ background: "none", border: "none", color: "#4a7a5a", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>

            {/* Timeline pills */}
            {[
              { label: "🌱 PLANT", months: monthsInRange(selectedCrop.plant_month_start, selectedCrop.plant_month_end), color: "#7ec99a" },
              { label: "🧪 FERTILISE", months: selectedCrop.fertilise_month_start ? monthsInRange(selectedCrop.fertilise_month_start, selectedCrop.fertilise_month_end) : [], color: "#7ab0e0" },
              { label: "🌾 HARVEST", months: monthsInRange(selectedCrop.harvest_month_start, selectedCrop.harvest_month_end), color: "#d4a017" },
            ].map(({ label, months, color }) => months.length > 0 && (
              <div key={label} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#4a7a5a", marginBottom: 6 }}>{label}</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {months.map(m => (
                    <span key={m} style={{ background: m === currentMonth ? color : "rgba(255,255,255,0.08)", color: m === currentMonth ? "#0d1a0f" : color, border: `1px solid ${color}40`, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontFamily: "'Space Mono', monospace", fontWeight: m === currentMonth ? 700 : 400 }}>
                      {MONTHS[m - 1]}
                    </span>
                  ))}
                </div>
              </div>
            ))}

            {selectedCrop.variety && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#4a7a5a", marginBottom: 4 }}>RECOMMENDED VARIETIES</div>
                <div style={{ fontSize: 13, color: "#c8e8d4" }}>{selectedCrop.variety}</div>
              </div>
            )}
            {selectedCrop.notes && (
              <div style={{ background: "#1a2e1e", borderRadius: 10, padding: 12, borderLeft: "3px solid #2d7a4f" }}>
                <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#4a7a5a", marginBottom: 4 }}>AGRITEX NOTES</div>
                <div style={{ fontSize: 13, color: "#c8e8d4", lineHeight: 1.6 }}>{selectedCrop.notes}</div>
              </div>
            )}
          </div>
        </div>
      )}
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
                <div style={{ fontSize: 13, color: "#c8e8d4" }}>{f.name}</div>
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
function AuthModal({ onClose, onAuth }) {
  const [step, setStep] = useState("phone"); // phone | otp | done
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sendOTP = async () => {
    if (!phone.trim()) return;
    setLoading(true); setError("");
    const formatted = phone.startsWith("+") ? phone : `+263${phone.replace(/^0/, "")}`;
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formatted, channel: "sms" }),
      });
      if (res.ok) { setStep("otp"); }
      else { const d = await res.json(); setError(d.msg || "Failed to send OTP"); }
    } catch (e) { setError("Network error"); }
    setLoading(false);
  };

  const verifyOTP = async () => {
    if (!otp.trim()) return;
    setLoading(true); setError("");
    const formatted = phone.startsWith("+") ? phone : `+263${phone.replace(/^0/, "")}`;
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=phone_otp`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formatted, token: otp, type: "sms" }),
      });
      const data = await res.json();
      if (data.access_token) {
        localStorage.setItem("sb_token", data.access_token);
        onAuth(data.user);
      } else { setError(data.msg || "Invalid code"); }
    } catch (e) { setError("Network error"); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#c8e8d4" }}>Farmer Login</div>
            <div style={{ fontSize: 11, color: "#4a7a5a", fontFamily: "'Space Mono', monospace", marginTop: 2 }}>Secure phone verification</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#4a7a5a", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {step === "phone" && (
          <>
            <div style={{ fontSize: 36, textAlign: "center", marginBottom: 16 }}>📱</div>
            <div style={{ fontSize: 14, color: "#8aaa94", textAlign: "center", marginBottom: 20, lineHeight: 1.6 }}>
              Enter your mobile number to receive a one-time code. Your data stays private and secure.
            </div>
            <label style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#5c8f6b", display: "block", marginBottom: 6 }}>MOBILE NUMBER</label>
            <input className="input-field" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+263 77X XXX XXX" style={{ marginBottom: 12 }} onKeyDown={e => e.key === "Enter" && sendOTP()} />
            {error && <div style={{ color: "#e07060", fontSize: 12, marginBottom: 12 }}>{error}</div>}
            <button className="btn-primary" onClick={sendOTP} style={{ opacity: phone.trim() ? 1 : 0.4 }}>
              {loading ? "Sending..." : "Send Verification Code →"}
            </button>
          </>
        )}

        {step === "otp" && (
          <>
            <div style={{ fontSize: 36, textAlign: "center", marginBottom: 16 }}>🔐</div>
            <div style={{ fontSize: 14, color: "#8aaa94", textAlign: "center", marginBottom: 20, lineHeight: 1.6 }}>
              Enter the 6-digit code sent to <strong style={{ color: "#7ec99a" }}>{phone}</strong>
            </div>
            <label style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#5c8f6b", display: "block", marginBottom: 6 }}>VERIFICATION CODE</label>
            <input className="input-field" value={otp} onChange={e => setOtp(e.target.value)} placeholder="123456" maxLength={6} style={{ marginBottom: 12, fontSize: 24, letterSpacing: "0.3em", textAlign: "center" }} onKeyDown={e => e.key === "Enter" && verifyOTP()} />
            {error && <div style={{ color: "#e07060", fontSize: 12, marginBottom: 12 }}>{error}</div>}
            <button className="btn-primary" onClick={verifyOTP} style={{ opacity: otp.length === 6 ? 1 : 0.4, marginBottom: 10 }}>
              {loading ? "Verifying..." : "Verify & Login ✓"}
            </button>
            <button onClick={() => { setStep("phone"); setError(""); }} style={{ background: "none", border: "none", color: "#4a7a5a", fontSize: 12, cursor: "pointer", width: "100%", fontFamily: "'Space Mono', monospace" }}>
              ← Use different number
            </button>
          </>
        )}

        <div style={{ marginTop: 20, padding: "12px", background: "#1a2e1e", borderRadius: 8, fontSize: 11, color: "#4a7a5a", lineHeight: 1.6 }}>
          🔒 Your number is only used for login. We never share it with buyers or third parties.
        </div>
      </div>
    </div>
  );
}

// ─── PRICE FEEDS TAB ───────────────────────────────────────────────────────────
function PriceFeedsTab() {
  const [prices, setPrices] = useState([]);
  const [selected, setSelected] = useState("Maize");
  const [loading, setLoading] = useState(true);
  const crops = ["Maize", "Tobacco", "Soya Beans", "Cotton", "Wheat", "Groundnuts"];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await db.get("price_feeds", "?order=recorded_date.asc&limit=200");
      setPrices(Array.isArray(data) ? data : []);
      setLoading(false);
    };
    load();
  }, []);

  const cropPrices = prices.filter(p => p.crop_name === selected);
  const latest = cropPrices[cropPrices.length - 1];
  const prev = cropPrices[cropPrices.length - 2];
  const change = latest && prev ? ((latest.price_usd - prev.price_usd) / prev.price_usd * 100).toFixed(1) : null;

  // SVG line chart
  const chartW = 340, chartH = 100;
  const vals = cropPrices.map(p => p.price_usd);
  const minV = Math.min(...vals) * 0.97;
  const maxV = Math.max(...vals) * 1.03;
  const points = cropPrices.map((p, i) => {
    const x = (i / (cropPrices.length - 1)) * chartW;
    const y = chartH - ((p.price_usd - minV) / (maxV - minV)) * chartH;
    return `${x},${y}`;
  }).join(" ");
  const areaPoints = `0,${chartH} ${points} ${chartW},${chartH}`;

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // All latest prices for the summary table
  const latestByAgg = {};
  prices.forEach(p => {
    if (!latestByAgg[p.crop_name] || p.recorded_date > latestByAgg[p.crop_name].recorded_date) {
      latestByAgg[p.crop_name] = p;
    }
  });

  return (
    <div className="fade-in single-col">
      <div style={{ fontSize: 20, fontWeight: 700, color: "#c8e8d4", marginBottom: 4 }}>Price Feeds</div>
      <div style={{ fontSize: 12, color: "#4a7a5a", marginBottom: 20 }}>Live commodity prices — GMB, Cottco & Auction Floors</div>

      {/* Latest prices grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
        {Object.values(latestByAgg).map((p, i) => {
          const hist = prices.filter(x => x.crop_name === p.crop_name);
          const prev = hist[hist.length - 2];
          const chg = prev ? ((p.price_usd - prev.price_usd) / prev.price_usd * 100).toFixed(1) : null;
          return (
            <div key={i} onClick={() => setSelected(p.crop_name)}
              style={{ background: selected === p.crop_name ? "#1a3d24" : "#152218", border: `1px solid ${selected === p.crop_name ? "#2d7a4f" : "#1f3525"}`, borderRadius: 10, padding: "10px 8px", cursor: "pointer", transition: "all 0.2s" }}>
              <div style={{ fontSize: 11, color: "#5c8f6b", marginBottom: 4, fontFamily: "'Space Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.crop_name}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#7ec99a", fontFamily: "'Space Mono', monospace" }}>{p.price_usd < 10 ? `$${p.price_usd}` : `$${p.price_usd}`}</div>
              <div style={{ fontSize: 9, color: "#3d6b4a", fontFamily: "'Space Mono', monospace" }}>/{p.unit}</div>
              {chg && <div style={{ fontSize: 10, color: parseFloat(chg) >= 0 ? "#5cd68a" : "#e07060", fontFamily: "'Space Mono', monospace", marginTop: 2 }}>{parseFloat(chg) >= 0 ? "▲" : "▼"} {Math.abs(chg)}%</div>}
            </div>
          );
        })}
      </div>

      {/* Price chart */}
      {loading ? <div className="skeleton" style={{ height: 180, borderRadius: 12, marginBottom: 16 }} /> : (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#c8e8d4" }}>{selected}</div>
              <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#4a7a5a" }}>{latest?.source} · 6 Month Trend</div>
            </div>
            {latest && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#7ec99a", fontFamily: "'Space Mono', monospace" }}>${latest.price_usd}/{latest.unit}</div>
                {change && <div style={{ fontSize: 11, color: parseFloat(change) >= 0 ? "#5cd68a" : "#e07060", fontFamily: "'Space Mono', monospace" }}>{parseFloat(change) >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs last month</div>}
              </div>
            )}
          </div>

          {cropPrices.length > 1 && (
            <svg viewBox={`0 0 ${chartW} ${chartH + 20}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
                <line key={i} x1="0" y1={chartH * t} x2={chartW} y2={chartH * t} stroke="#1a2e1e" strokeWidth="1" />
              ))}
              {/* Area fill */}
              <polygon points={areaPoints} fill="rgba(45,122,79,0.15)" />
              {/* Line */}
              <polyline points={points} fill="none" stroke="#2d7a4f" strokeWidth="2.5" strokeLinejoin="round" />
              {/* Dots */}
              {cropPrices.map((p, i) => {
                const x = (i / (cropPrices.length - 1)) * chartW;
                const y = chartH - ((p.price_usd - minV) / (maxV - minV)) * chartH;
                return <circle key={i} cx={x} cy={y} r="4" fill={i === cropPrices.length - 1 ? "#5cd68a" : "#2d7a4f"} stroke="#0d1a0f" strokeWidth="1.5" />;
              })}
              {/* X labels */}
              {cropPrices.map((p, i) => {
                const x = (i / (cropPrices.length - 1)) * chartW;
                const d = new Date(p.recorded_date);
                return <text key={i} x={x} y={chartH + 14} textAnchor="middle" fill="#4a7a5a" fontSize="9" fontFamily="monospace">{MONTHS[d.getMonth()]}</text>;
              })}
              {/* Y labels */}
              <text x="-4" y="10" textAnchor="end" fill="#4a7a5a" fontSize="8" fontFamily="monospace">${maxV.toFixed(0)}</text>
              <text x="-4" y={chartH} textAnchor="end" fill="#4a7a5a" fontSize="8" fontFamily="monospace">${minV.toFixed(0)}</text>
            </svg>
          )}
        </div>
      )}

      {/* Sources info */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">Data Sources</div>
        {[
          { name: "GMB", full: "Grain Marketing Board", crops: "Maize, Wheat, Sorghum", update: "Weekly" },
          { name: "Cottco", full: "Cotton Company of Zimbabwe", crops: "Cotton", update: "Seasonal" },
          { name: "Auction Floors", full: "Zimbabwe Tobacco Auction", crops: "Tobacco", update: "Daily (season)" },
          { name: "Commodity Exchange", full: "ZSE Commodity Exchange", crops: "Soya, Groundnuts", update: "Weekly" },
        ].map((s, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < 3 ? "1px solid #1a2e1e" : "none" }}>
            <div>
              <div style={{ fontSize: 13, color: "#c8e8d4", fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: "#4a7a5a" }}>{s.crops}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#5c8f6b", fontFamily: "'Space Mono', monospace" }}>{s.update}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Price alert subscription */}
      <div style={{ background: "linear-gradient(135deg, #1a3d24, #0f2218)", border: "1px solid #2d7a4f", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#c8e8d4", marginBottom: 6 }}>📲 Price Alerts</div>
        <div style={{ fontSize: 12, color: "#8aaa94", marginBottom: 12 }}>Get SMS alerts when prices move more than 5% in your crops.</div>
        <button className="btn-primary" style={{ fontSize: 11 }}>Enable Price Alerts</button>
      </div>
    </div>
  );
}

// ─── PLANTING CALENDAR TAB ─────────────────────────────────────────────────────
function PlantingCalendarTab() {
  const [calendar, setCalendar] = useState([]);
  const [selectedProvince, setSelectedProvince] = useState("All");
  const [selectedCrop, setSelectedCrop] = useState("All");
  const [loading, setLoading] = useState(true);

  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await db.get("planting_calendar", "?order=crop_name.asc");
      setCalendar(Array.isArray(data) ? data : []);
      setLoading(false);
    };
    load();
  }, []);

  const provinces = ["All", ...new Set(calendar.map(c => c.province).filter(p => p !== "All"))];
  const cropNames = ["All", ...new Set(calendar.map(c => c.crop_name))];

  const filtered = calendar.filter(c =>
    (selectedProvince === "All" || c.province === "All" || c.province === selectedProvince) &&
    (selectedCrop === "All" || c.crop_name === selectedCrop)
  );

  const getMonthRange = (start, end) => {
    const months = [];
    let m = start;
    while (m !== end + 1) {
      months.push(m > 12 ? m - 12 : m);
      m++;
      if (m > 24) break;
    }
    return months;
  };

  const isActiveNow = (entry) => {
    const planting = getMonthRange(entry.planting_start, entry.planting_end);
    const harvest = getMonthRange(entry.harvest_start, entry.harvest_end);
    return planting.includes(currentMonth) || harvest.includes(currentMonth);
  };

  return (
    <div className="fade-in single-col">
      <div style={{ fontSize: 20, fontWeight: 700, color: "#c8e8d4", marginBottom: 4 }}>Planting Calendar</div>
      <div style={{ fontSize: 12, color: "#4a7a5a", marginBottom: 16 }}>AGRITEX-aligned planting & harvest guide for Zimbabwe</div>

      {/* Current month banner */}
      <div style={{ background: "linear-gradient(135deg, #1a3d24, #0f2218)", border: "1px solid #2d7a4f", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 28 }}>📅</div>
        <div>
          <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: "#5cd68a" }}>CURRENT MONTH — {MONTH_NAMES[currentMonth - 1].toUpperCase()}</div>
          <div style={{ fontSize: 13, color: "#c8e8d4", marginTop: 2 }}>
            {filtered.filter(isActiveNow).length > 0
              ? `${filtered.filter(c => getMonthRange(c.planting_start, c.planting_end).includes(currentMonth)).length} crops to plant · ${filtered.filter(c => getMonthRange(c.harvest_start, c.harvest_end).includes(currentMonth)).length} crops to harvest`
              : "No active planting or harvesting this month for selected filters"}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 9, fontFamily: "'Space Mono', monospace", color: "#5c8f6b", display: "block", marginBottom: 4 }}>PROVINCE</label>
          <select className="select-field" value={selectedProvince} onChange={e => setSelectedProvince(e.target.value)}>
            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 9, fontFamily: "'Space Mono', monospace", color: "#5c8f6b", display: "block", marginBottom: 4 }}>CROP</label>
          <select className="select-field" value={selectedCrop} onChange={e => setSelectedCrop(e.target.value)}>
            {cropNames.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Month header bar */}
      <div style={{ display: "grid", gridTemplateColumns: "120px repeat(12, 1fr)", gap: 2, marginBottom: 8, alignItems: "center" }}>
        <div style={{ fontSize: 9, fontFamily: "'Space Mono', monospace", color: "#3d6b4a" }}>CROP</div>
        {MONTH_NAMES.map((m, i) => (
          <div key={i} style={{ fontSize: 9, textAlign: "center", fontFamily: "'Space Mono', monospace", color: i + 1 === currentMonth ? "#7ec99a" : "#3d6b4a", background: i + 1 === currentMonth ? "rgba(45,122,79,0.2)" : "transparent", borderRadius: 4, padding: "2px 0", fontWeight: i + 1 === currentMonth ? "700" : "400" }}>{m}</div>
        ))}
      </div>

      {/* Calendar rows */}
      {loading ? [1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 8, marginBottom: 6 }} />) :
        filtered.map((entry, idx) => {
          const plantMonths = getMonthRange(entry.planting_start, entry.planting_end);
          const harvestMonths = getMonthRange(entry.harvest_start, entry.harvest_end);
          const fertMonth = entry.fertilising_month;
          const active = isActiveNow(entry);

          return (
            <div key={idx} style={{ background: active ? "#1a2e1e" : "#152218", border: `1px solid ${active ? "#2d7a4f" : "#1f3525"}`, borderRadius: 8, marginBottom: 6, padding: "8px 10px", transition: "all 0.2s" }}>
              <div style={{ display: "grid", gridTemplateColumns: "120px repeat(12, 1fr)", gap: 2, alignItems: "center", marginBottom: entry.notes ? 6 : 0 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#c8e8d4", fontWeight: 600 }}>{entry.crop_name}</div>
                  {entry.province !== "All" && <div style={{ fontSize: 9, color: "#4a7a5a", fontFamily: "'Space Mono', monospace" }}>{entry.province}</div>}
                </div>
                {MONTH_NAMES.map((_, i) => {
                  const m = i + 1;
                  const isPlant = plantMonths.includes(m);
                  const isHarvest = harvestMonths.includes(m);
                  const isFert = fertMonth === m;
                  const isCurrent = m === currentMonth;
                  return (
                    <div key={i} style={{ height: 20, borderRadius: 3, position: "relative",
                      background: isHarvest ? "rgba(212,160,23,0.8)" : isPlant ? "rgba(45,122,79,0.85)" : isFert ? "rgba(90,143,163,0.6)" : "transparent",
                      outline: isCurrent ? "1px solid #7ec99a" : "none",
                      title: isPlant ? "Plant" : isHarvest ? "Harvest" : isFert ? "Fertilise" : ""
                    }} />
                  );
                })}
              </div>
              {entry.notes && <div style={{ fontSize: 11, color: "#8aaa94", marginTop: 4, paddingLeft: 0 }}>{entry.notes}</div>}
              {entry.variety && <div style={{ fontSize: 10, color: "#4a7a5a", fontFamily: "'Space Mono', monospace", marginTop: 2 }}>Varieties: {entry.variety}</div>}
            </div>
          );
        })
      }

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
        {[
          { color: "rgba(45,122,79,0.85)", label: "Planting" },
          { color: "rgba(212,160,23,0.8)", label: "Harvest" },
          { color: "rgba(90,143,163,0.6)", label: "Fertilise" },
        ].map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 16, height: 12, borderRadius: 3, background: l.color }} />
            <span style={{ fontSize: 11, color: "#5c8f6b", fontFamily: "'Space Mono', monospace" }}>{l.label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 16, height: 12, borderRadius: 3, border: "1px solid #7ec99a" }} />
          <span style={{ fontSize: 11, color: "#5c8f6b", fontFamily: "'Space Mono', monospace" }}>Current Month</span>
        </div>
      </div>
    </div>
  );
}

// ─── INPUT SUPPLIERS TAB ───────────────────────────────────────────────────────
function InputSuppliersTab() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("All");
  const [filterProvince, setFilterProvince] = useState("All");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  const TYPES = ["All", "agrodealer", "seed", "fertiliser", "chemical", "equipment"];
  const TYPE_LABELS = { agrodealer: "Agrodealer", seed: "Seed Company", fertiliser: "Fertiliser", chemical: "Chemical", equipment: "Equipment" };
  const TYPE_COLORS = { agrodealer: "#2d7a4f", seed: "#5cd68a", fertiliser: "#c8b43c", chemical: "#5a9fd4", equipment: "#9a7ae0" };
  const TYPE_ICONS = { agrodealer: "🏪", seed: "🌱", fertiliser: "🧪", chemical: "⚗️", equipment: "🚜" };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await db.get("input_suppliers", "?order=verified.desc,name.asc");
      setSuppliers(Array.isArray(data) ? data : []);
      setLoading(false);
    };
    load();
  }, []);

  const provinces = ["All", ...new Set(suppliers.map(s => s.province))].sort();
  const filtered = suppliers.filter(s =>
    (filterType === "All" || s.type === filterType) &&
    (filterProvince === "All" || s.province === filterProvince) &&
    (!search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.products || []).some(p => p.toLowerCase().includes(search.toLowerCase())))
  );

  return (
    <div className="fade-in single-col">
      <div style={{ fontSize: 20, fontWeight: 700, color: "#c8e8d4", marginBottom: 4 }}>Input Suppliers</div>
      <div style={{ fontSize: 12, color: "#4a7a5a", marginBottom: 16 }}>Find agrodealers, seed companies & suppliers near you</div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#3d6b4a", fontSize: 14 }}>🔍</span>
        <input className="input-field" placeholder="Search by name or product..." style={{ paddingLeft: 36 }} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <select className="select-field" value={filterProvince} onChange={e => setFilterProvince(e.target.value)}>
            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
        {TYPES.map(t => (
          <span key={t} className={`chip ${filterType === t ? "active" : ""}`} onClick={() => setFilterType(t)} style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, whiteSpace: "nowrap" }}>
            {t === "All" ? "All" : `${TYPE_ICONS[t]} ${TYPE_LABELS[t]}`}
          </span>
        ))}
      </div>

      {/* Count */}
      <div style={{ fontSize: 11, color: "#4a7a5a", fontFamily: "'Space Mono', monospace", marginBottom: 12 }}>{filtered.length} SUPPLIERS FOUND</div>

      {/* Supplier cards */}
      {loading ? [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12, marginBottom: 10 }} />) :
        filtered.map((s, i) => (
          <div key={i} style={{ background: "#152218", border: "1px solid #1f3525", borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", cursor: "pointer" }} onClick={() => setExpanded(expanded === i ? null : i)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 18 }}>{TYPE_ICONS[s.type] || "🏪"}</span>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#c8e8d4" }}>{s.name}</div>
                    {s.verified && <span style={{ fontSize: 9, background: "rgba(45,122,79,0.3)", color: "#5cd68a", padding: "1px 6px", borderRadius: 8, fontFamily: "'Space Mono', monospace" }}>✓ VERIFIED</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#4a7a5a" }}>📍 {s.district ? `${s.district}, ` : ""}{s.province}</div>
                  <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {(s.products || []).slice(0, 3).map((p, j) => (
                      <span key={j} style={{ fontSize: 10, background: "rgba(45,122,79,0.15)", color: "#7ec99a", padding: "2px 8px", borderRadius: 8, fontFamily: "'Space Mono', monospace" }}>{p}</span>
                    ))}
                    {(s.products || []).length > 3 && <span style={{ fontSize: 10, color: "#4a7a5a", fontFamily: "'Space Mono', monospace", padding: "2px 4px" }}>+{s.products.length - 3} more</span>}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#3d6b4a", marginLeft: 8 }}>{expanded === i ? "▲" : "▼"}</div>
              </div>
            </div>

            {/* Expanded details */}
            {expanded === i && (
              <div style={{ borderTop: "1px solid #1a2e1e", padding: "12px 16px", background: "#0f1e12" }}>
                {s.address && <div style={{ fontSize: 12, color: "#8aaa94", marginBottom: 10 }}>📍 {s.address}</div>}
                {(s.products || []).length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#5c8f6b", marginBottom: 6 }}>PRODUCTS & SERVICES</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {s.products.map((p, j) => (
                        <span key={j} style={{ fontSize: 11, background: "rgba(45,122,79,0.15)", color: "#7ec99a", padding: "3px 10px", borderRadius: 8 }}>{p}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {s.phone && (
                    <a href={`tel:${s.phone}`} style={{ display: "flex", alignItems: "center", gap: 6, background: "#152218", border: "1px solid #2d5a36", borderRadius: 8, padding: "8px 14px", color: "#7ec99a", textDecoration: "none", fontSize: 12, fontFamily: "'Space Mono', monospace" }}>
                      📞 {s.phone}
                    </a>
                  )}
                  {s.whatsapp && (
                    <a href={`https://wa.me/${s.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: "flex", alignItems: "center", gap: 6, background: "#1a5c2a", border: "1px solid #25a244", borderRadius: 8, padding: "8px 14px", color: "#4cd964", textDecoration: "none", fontSize: 12, fontFamily: "'Space Mono', monospace" }}>
                      💬 WhatsApp
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        ))
      }

      {/* Add supplier CTA */}
      <div style={{ background: "#152218", border: "1px dashed #2d5a36", borderRadius: 12, padding: 16, textAlign: "center", marginTop: 8 }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>🏪</div>
        <div style={{ fontSize: 13, color: "#c8e8d4", marginBottom: 4 }}>Know a supplier not listed?</div>
        <div style={{ fontSize: 11, color: "#4a7a5a", marginBottom: 12 }}>Help other farmers by adding them to the directory.</div>
        <button className="btn-secondary" style={{ fontSize: 11 }}>+ Add Supplier</button>
      </div>
    </div>
  );
}

// ─── INSIGHTS TAB ──────────────────────────────────────────────────────────────
function InsightsTab() {
  const [cropData, setCropData] = useState([]);
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