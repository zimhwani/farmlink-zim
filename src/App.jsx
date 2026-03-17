import { useState, useEffect, useRef } from "react";

const SUPABASE_URL = "https://buyvgrxgseubplqesvjp.supabase.co";
const SUPABASE_KEY = "sb_publishable_TJH0e7GMsengGdAUjG5HYg_hkpBrBxA";

const db = {
  async get(table, params = "") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
    });
    return res.json();
  },
  async post(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(data),
    });
    return res.json();
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

const WEATHER_DATA = [
  { day: "Today", icon: "⛅", high: 28, low: 18, rain: "20%" },
  { day: "Wed", icon: "🌧️", high: 24, low: 17, rain: "70%" },
  { day: "Thu", icon: "🌧️", high: 23, low: 16, rain: "80%" },
  { day: "Fri", icon: "⛅", high: 26, low: 18, rain: "30%" },
  { day: "Sat", icon: "☀️", high: 30, low: 19, rain: "5%" },
  { day: "Sun", icon: "☀️", high: 32, low: 20, rain: "5%" },
];

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
  "Maize": "🌽", "Tobacco": "🍂", "Soya Beans": "🫘", "Cotton": "🌼",
  "Sunflower": "🌻", "Wheat": "🌾", "Sorghum": "🌾", "Groundnuts": "🥜",
  "Sweet Potatoes": "🍠", "Vegetables": "🥦", "Coffee Beans": "☕",
  "Tomatoes": "🍅", "Cattle": "🐄", "Goats": "🐐", "Sheep": "🐑",
  "Pigs": "🐷", "Poultry (Broilers)": "🐔", "Poultry (Layers)": "🥚",
  "Rabbits": "🐇", "Fish (Aquaculture)": "🐟",
};

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
  const [farmerCount, setFarmerCount] = useState(0);
  const [listingCount, setListingCount] = useState(0);
  const [loadingListings, setLoadingListings] = useState(true);
  const [showListingModal, setShowListingModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);
  useEffect(() => { loadListings(); loadCounts(); }, []);

  const loadListings = async () => {
    setLoadingListings(true);
    try {
      const data = await db.get("listings", "?active=eq.true&order=created_at.desc");
      setListings(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    setLoadingListings(false);
  };

  const loadCounts = async () => {
    try {
      const farmers = await db.get("farmers", "?select=id");
      const lst = await db.get("listings", "?select=id&active=eq.true");
      setFarmerCount(Array.isArray(farmers) ? farmers.length : 0);
      setListingCount(Array.isArray(lst) ? lst.length : 0);
    } catch (e) {}
  };

  const toggleItem = (list, setList, item) => {
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);
  };

  const registerFarmer = async () => {
    const [farmer] = await db.post("farmers", {
      name: farmerName, phone: farmerPhone || null,
      province, district, ward,
      farm_size_hectares: farmSize ? parseFloat(farmSize) : null,
      sms_alerts: true,
    });
    if (farmer?.id) {
      const cropRows = [
        ...selectedCrops.map(c => ({ farmer_id: farmer.id, crop_name: c, type: "crop" })),
        ...selectedLivestock.map(l => ({ farmer_id: farmer.id, crop_name: l, type: "livestock" })),
      ];
      if (cropRows.length > 0) await db.post("farmer_crops", cropRows);
      setRegisteredFarmer(farmer);
      setRegistrationDone(true);
      loadCounts();
    }
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
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are FarmLink AI, an expert agricultural advisor specialised in Zimbabwe farming. You have deep knowledge of Zimbabwe's agro-ecological regions, local crops (maize, tobacco, cotton, soya, groundnuts), livestock management, AGRITEX recommendations, ZFU guidelines, local pests (armyworm, stalk borer, ticks, Newcastle disease), GMB pricing, Tobacco auction floors, conservation farming and the Pfumvudza/Intwasa programme. Always give practical, locally relevant advice. Keep responses concise (3-5 sentences) and actionable. Occasionally use Shona/Ndebele words naturally.`,
          messages: [{ role: "user", content: msg }]
        })
      });
      const data = await response.json();
      const reply = data.content?.[0]?.text || "Sorry, I could not get a response. Please try again.";
      setIsTyping(false);
      setChatMessages(prev => [...prev, { role: "ai", text: reply }]);
    } catch {
      setIsTyping(false);
      setChatMessages(prev => [...prev, { role: "ai", text: "Network error. Offline tip: for tick control on cattle, use Triatix or Deltamethrin dip every 7 days during peak season." }]);
    }
  };

  const resetRegistration = () => {
    setRegistrationDone(false); setWizardStep(1); setFarmerName(""); setFarmerPhone("");
    setProvince(""); setDistrict(""); setWard(""); setSelectedCrops([]); setSelectedLivestock([]); setFarmSize(""); setRegisteredFarmer(null);
  };

  return (
    <div style={{ fontFamily: "'Crimson Pro', Georgia, serif", background: "#0d1a0f", minHeight: "100vh", color: "#e8dfc8", maxWidth: 480, margin: "0 auto", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;0,700;1,400&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0d1a0f; } ::-webkit-scrollbar-thumb { background: #2d7a4f; border-radius: 2px; }
        .tab-btn { background: none; border: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 12px; transition: all 0.2s; }
        .tab-btn.active { color: #7ec99a !important; } .tab-btn:hover { color: #aee0c0 !important; }
        .tab-icon { font-size: 20px; line-height: 1; } .tab-label { font-size: 9px; letter-spacing: 0.08em; font-family: 'Space Mono', monospace; text-transform: uppercase; }
        .card { background: #152218; border: 1px solid #1f3525; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
        .card-premium { background: linear-gradient(135deg, #1a2e1e, #112215); border-color: #2d5a36; }
        .btn-primary { background: linear-gradient(135deg, #2d7a4f, #1f5a39); color: #e8dfc8; border: none; border-radius: 8px; padding: 12px 24px; font-family: 'Space Mono', monospace; font-size: 12px; cursor: pointer; letter-spacing: 0.05em; transition: all 0.2s; width: 100%; }
        .btn-primary:hover { background: linear-gradient(135deg, #3a9962, #2d7a4f); transform: translateY(-1px); }
        .btn-secondary { background: transparent; color: #7ec99a; border: 1px solid #2d7a4f; border-radius: 8px; padding: 10px 20px; font-family: 'Space Mono', monospace; font-size: 11px; cursor: pointer; transition: all 0.2s; }
        .btn-secondary:hover { background: #1a2e1e; }
        .chip { display: inline-flex; align-items: center; gap: 6px; background: #1a2e1e; border: 1px solid #2d5a36; border-radius: 20px; padding: 5px 12px; font-size: 12px; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .chip.active { background: #2d7a4f; border-color: #3a9962; color: #e8f5ed; } .chip:hover { border-color: #4aad72; }
        .input-field { background: #1a2e1e; border: 1px solid #2d5a36; border-radius: 8px; padding: 10px 14px; color: #e8dfc8; font-family: 'Crimson Pro', serif; font-size: 15px; width: 100%; outline: none; transition: border-color 0.2s; }
        .input-field:focus { border-color: #4aad72; }
        .select-field { background: #1a2e1e; border: 1px solid #2d5a36; border-radius: 8px; padding: 10px 14px; color: #e8dfc8; font-family: 'Crimson Pro', serif; font-size: 15px; width: 100%; outline: none; appearance: none; cursor: pointer; transition: border-color 0.2s; }
        .select-field:focus { border-color: #4aad72; }
        .section-title { font-size: 11px; font-family: 'Space Mono', monospace; letter-spacing: 0.15em; text-transform: uppercase; color: #5c8f6b; margin-bottom: 12px; }
        .chat-bubble-ai { background: #152218; border: 1px solid #1f3525; border-radius: 16px 16px 16px 4px; padding: 12px 14px; max-width: 85%; font-size: 14px; line-height: 1.6; }
        .chat-bubble-user { background: #2d7a4f; border-radius: 16px 16px 4px 16px; padding: 12px 14px; max-width: 85%; font-size: 14px; line-height: 1.6; margin-left: auto; }
        .listing-card { background: #152218; border: 1px solid #1f3525; border-radius: 12px; padding: 14px; margin-bottom: 10px; transition: border-color 0.2s; }
        .listing-card:hover { border-color: #3a7a50; }
        .weather-day { background: #152218; border: 1px solid #1f3525; border-radius: 10px; padding: 10px 8px; text-align: center; flex: 1; }
        .pulse { animation: pulse 2s infinite; } @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .step-dot { width: 8px; height: 8px; border-radius: 50%; transition: all 0.3s; }
        .step-dot.active { background: #7ec99a; width: 24px; border-radius: 4px; } .step-dot.done { background: #2d7a4f; } .step-dot.pending { background: #1f3525; }
        .fade-in { animation: fadeIn 0.4s ease forwards; } @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .hero-grain { position: absolute; inset: 0; opacity: 0.04; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E"); pointer-events: none; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 200; display: flex; align-items: flex-end; justify-content: center; }
        .modal { background: #0d1a0f; border: 1px solid #2d5a36; border-radius: 20px 20px 0 0; padding: 24px 20px; width: 100%; max-width: 480px; max-height: 85vh; overflow-y: auto; }
        .skeleton { background: linear-gradient(90deg, #152218 25%, #1f3525 50%, #152218 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 8px; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>

      <div style={{ background: "linear-gradient(180deg, #0a1a0c 0%, #0d1a0f 100%)", borderBottom: "1px solid #1f3525", padding: "16px 20px 12px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #2d7a4f, #1a5c36)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🌿</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: "#c8e8d4" }}>FarmLink <span style={{ color: "#7ec99a" }}>Zim</span></div>
              <div style={{ fontSize: 9, fontFamily: "'Space Mono', monospace", color: "#4a7a5a", letterSpacing: "0.1em" }}>AGRICULTURAL MARKETPLACE</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ background: "#152218", border: "1px solid #1f3525", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>🔔</div>
            <div style={{ background: "#152218", border: "1px solid #1f3525", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>👤</div>
          </div>
        </div>
      </div>

      <div style={{ paddingBottom: 80, minHeight: "calc(100vh - 130px)" }}>
        {activeTab === "home" && <HomeTab setActiveTab={setActiveTab} farmerCount={farmerCount} listingCount={listingCount} />}
        {activeTab === "market" && <MarketTab listings={listings} loadingListings={loadingListings} filterCrop={filterCrop} setFilterCrop={setFilterCrop} setShowListingModal={setShowListingModal} setShowContactModal={setShowContactModal} />}
        {activeTab === "register" && <RegisterTab wizardStep={wizardStep} setWizardStep={setWizardStep} province={province} setProvince={setProvince} district={district} setDistrict={setDistrict} ward={ward} setWard={setWard} selectedCrops={selectedCrops} setSelectedCrops={setSelectedCrops} selectedLivestock={selectedLivestock} setSelectedLivestock={setSelectedLivestock} farmSize={farmSize} setFarmSize={setFarmSize} farmerName={farmerName} setFarmerName={setFarmerName} farmerPhone={farmerPhone} setFarmerPhone={setFarmerPhone} toggleItem={toggleItem} registrationDone={registrationDone} registeredFarmer={registeredFarmer} registerFarmer={registerFarmer} resetRegistration={resetRegistration} />}
        {activeTab === "advisory" && <AdvisoryTab chatMessages={chatMessages} chatInput={chatInput} setChatInput={setChatInput} sendChat={sendChat} isTyping={isTyping} chatEndRef={chatEndRef} />}
        {activeTab === "insights" && <InsightsTab />}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "rgba(10, 20, 12, 0.97)", backdropFilter: "blur(12px)", borderTop: "1px solid #1f3525", display: "flex", justifyContent: "space-around", padding: "8px 0 12px", zIndex: 100 }}>
        {[{ id: "home", icon: "🛖", label: "Home" }, { id: "market", icon: "🛒", label: "Market" }, { id: "register", icon: "📍", label: "Register" }, { id: "advisory", icon: "🤖", label: "AI Advisor" }, { id: "insights", icon: "📊", label: "Insights" }].map(tab => (
          <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? "active" : ""}`} style={{ color: "#3d6b4a" }} onClick={() => setActiveTab(tab.id)}>
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {showListingModal && <ListingModal onClose={() => setShowListingModal(false)} onSave={async (listing) => { await db.post("listings", listing); setShowListingModal(false); loadListings(); loadCounts(); }} />}
      {showContactModal && <ContactModal listing={showContactModal} onClose={() => setShowContactModal(null)} onSend={async (msg) => { await db.post("messages", { listing_id: showContactModal.id, ...msg }); setShowContactModal(null); }} />}
    </div>
  );
}

function HomeTab({ setActiveTab, farmerCount, listingCount }) {
  return (
    <div className="fade-in" style={{ padding: "20px 16px" }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[{ label: "Farmers", value: farmerCount.toLocaleString(), icon: "👩🏾‍🌾" }, { label: "Listings", value: listingCount.toLocaleString(), icon: "🛒" }, { label: "Districts", value: "60+", icon: "📍" }].map(s => (
          <div key={s.label} style={{ background: "#152218", border: "1px solid #1f3525", borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, color: "#7ec99a", fontWeight: 700 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "#4a7a5a", marginTop: 2, fontFamily: "'Space Mono', monospace" }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="section-title" style={{ margin: 0 }}>Weather — Harare Region</div>
          <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#4a7a5a" }}>ZIMMET</div>
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
          {WEATHER_DATA.map((d, i) => (
            <div key={i} className="weather-day" style={i === 0 ? { borderColor: "#2d7a4f", background: "#1a2e1e" } : {}}>
              <div style={{ fontSize: 9, fontFamily: "'Space Mono', monospace", color: "#4a7a5a", marginBottom: 4 }}>{d.day}</div>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{d.icon}</div>
              <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: "#e8dfc8" }}>{d.high}°</div>
              <div style={{ fontSize: 9, fontFamily: "'Space Mono', monospace", color: "#4a7a5a" }}>{d.low}°</div>
              <div style={{ fontSize: 9, color: "#5a9fd4", marginTop: 4 }}>{d.rain}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, background: "#1a2e1e", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#8aaa94", borderLeft: "3px solid #2d7a4f" }}>
          ⚠️ Heavy rains expected Wed–Thu. Delay fertiliser application. Good planting moisture window opens Saturday.
        </div>
      </div>
      <div className="section-title">Live Price Alerts</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {PRICE_ALERTS.map((p, i) => (
          <div key={i} style={{ background: "#152218", border: "1px solid #1f3525", borderRadius: 10, padding: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#c8e8d4" }}>{p.crop}</div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: p.trend === "up" ? "#5cd68a" : "#e07060" }}>{p.change}</div>
            </div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: "#7ec99a", margin: "6px 0 4px" }}>{p.price}</div>
            <div style={{ fontSize: 10, color: "#4a7a5a" }}>{p.region}</div>
          </div>
        ))}
      </div>
      <div className="section-title">Quick Actions</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[{ label: "AI Farm Advisor", icon: "🤖", desc: "Get instant advice", tab: "advisory" }, { label: "Sell Produce", icon: "📦", desc: "List your harvest", tab: "market" }, { label: "Crop Mapping", icon: "🗺️", desc: "Register your farm", tab: "register" }, { label: "Market Insights", icon: "📈", desc: "Yield & price data", tab: "insights" }].map((a, i) => (
          <button key={i} onClick={() => setActiveTab(a.tab)} style={{ background: "#152218", border: "1px solid #1f3525", borderRadius: 12, padding: "14px 12px", textAlign: "left", cursor: "pointer", transition: "border-color 0.2s" }} onMouseOver={e => e.currentTarget.style.borderColor = "#3a7a50"} onMouseOut={e => e.currentTarget.style.borderColor = "#1f3525"}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{a.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#c8e8d4", marginBottom: 2 }}>{a.label}</div>
            <div style={{ fontSize: 11, color: "#4a7a5a" }}>{a.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MarketTab({ listings, loadingListings, filterCrop, setFilterCrop, setShowListingModal, setShowContactModal }) {
  const filters = ["All", "Grain", "Livestock", "Horticulture", "Cash Crops"];
  const filterMap = { "Grain": ["Maize", "Wheat", "Sorghum"], "Livestock": ["Cattle", "Goats", "Sheep", "Pigs", "Poultry"], "Horticulture": ["Tomatoes", "Vegetables", "Sweet Potatoes"], "Cash Crops": ["Tobacco", "Cotton", "Coffee", "Soya", "Sunflower", "Groundnuts"] };
  const filtered = filterCrop === "All" ? listings : listings.filter(l => (filterMap[filterCrop] || []).some(f => l.crop?.toLowerCase().includes(f.toLowerCase())));

  return (
    <div className="fade-in" style={{ padding: "20px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#c8e8d4" }}>Marketplace</div>
          <div style={{ fontSize: 12, color: "#4a7a5a" }}>{listings.length} active listings</div>
        </div>
        <button onClick={() => setShowListingModal(true)} style={{ background: "#152218", border: "1px solid #2d7a4f", borderRadius: 8, padding: "8px 14px", color: "#7ec99a", fontSize: 12, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}>+ List Produce</button>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
        {filters.map(f => <span key={f} className={`chip ${filterCrop === f ? "active" : ""}`} onClick={() => setFilterCrop(f)} style={{ fontFamily: "'Space Mono', monospace", fontSize: 10 }}>{f}</span>)}
      </div>
      {loadingListings ? [1,2,3].map(i => <div key={i} style={{ marginBottom: 10 }}><div className="skeleton" style={{ height: 80, borderRadius: 12 }} /></div>)
        : filtered.length === 0 ? <div style={{ textAlign: "center", padding: "40px 20px", color: "#4a7a5a" }}><div style={{ fontSize: 40, marginBottom: 12 }}>🌾</div><div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11 }}>No listings in this category</div></div>
        : filtered.map(l => (
          <div key={l.id} className="listing-card">
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 48, height: 48, background: "#1a2e1e", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>{CROP_EMOJIS[l.crop] || l.img || "🌾"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#c8e8d4" }}>{l.crop}</div>
                  <span style={{ background: badgeColorBg(l.badge), color: badgeColorText(l.badge), fontSize: 9, fontFamily: "'Space Mono', monospace", padding: "2px 7px", borderRadius: 10 }}>{l.badge}</span>
                </div>
                <div style={{ fontSize: 12, color: "#5c8f6b", marginBottom: 6 }}>📍 {l.location} · {l.farmer_name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: "#7ec99a" }}>{l.price}</span>
                    <span style={{ fontSize: 11, color: "#4a7a5a", marginLeft: 8 }}>{l.quantity}</span>
                  </div>
                  <button className="btn-secondary" style={{ padding: "5px 14px", fontSize: 10 }} onClick={() => setShowContactModal(l)}>Contact</button>
                </div>
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}

function badgeColorBg(b) { if (b === "Premium") return "rgba(212,160,23,0.2)"; if (b === "Verified") return "rgba(45,122,79,0.25)"; return "rgba(90,143,163,0.2)"; }
function badgeColorText(b) { if (b === "Premium") return "#d4a017"; if (b === "Verified") return "#5cd68a"; return "#5a9fd4"; }

function ListingModal({ onClose, onSave }) {
  const [fields, setFields] = useState({ crop: "", quantity: "", price: "", farmerName: "", location: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setFields(f => ({ ...f, [k]: v }));
  const valid = Object.values(fields).every(v => v.trim());

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    await onSave({ crop: fields.crop, quantity: fields.quantity, price: fields.price, farmer_name: fields.farmerName, location: fields.location, badge: "New", img: CROP_EMOJIS[fields.crop] || "🌾", active: true });
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#c8e8d4" }}>List Your Produce</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#4a7a5a", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        {[["YOUR NAME", "farmerName", "e.g. Tendai Moyo", "text"], ["LOCATION", "location", "e.g. Mazowe, Mashonaland Central", "text"], ["CROP / LIVESTOCK", "crop", "e.g. Maize, Cattle, Tomatoes", "text"], ["QUANTITY", "quantity", "e.g. 10 tonnes, 5 head", "text"], ["PRICE", "price", "e.g. USD 280/tonne", "text"]].map(([label, key, ph]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#5c8f6b", display: "block", marginBottom: 5 }}>{label}</label>
            <input className="input-field" value={fields[key]} onChange={e => set(key, e.target.value)} placeholder={ph} />
          </div>
        ))}
        <button className="btn-primary" onClick={handleSave} style={{ opacity: valid ? 1 : 0.4, marginTop: 8 }}>{saving ? "Saving..." : "Post Listing ✓"}</button>
      </div>
    </div>
  );
}

function ContactModal({ listing, onClose, onSend }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [sent, setSent] = useState(false);
  const [message, setMessage] = useState(`Hi ${listing.farmer_name}, I'm interested in your ${listing.crop} (${listing.quantity} at ${listing.price}).`);

  const handleSend = async () => {
    if (!name || !message) return;
    await onSend({ sender_name: name, sender_phone: phone, message });
    setSent(true);
    setTimeout(onClose, 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#c8e8d4" }}>Contact Seller</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#4a7a5a", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        {sent ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, color: "#7ec99a", fontWeight: 600 }}>Message Sent!</div>
          </div>
        ) : (
          <>
            <div style={{ background: "#1a2e1e", borderRadius: 10, padding: "10px 12px", marginBottom: 16, fontSize: 13, color: "#8aaa94" }}>
              <strong style={{ color: "#c8e8d4" }}>{listing.crop}</strong> · {listing.quantity} · {listing.price}
            </div>
            {[["YOUR NAME", name, setName, "Full name", "text"], ["YOUR PHONE", phone, setPhone, "+263 77X XXX XXX", "tel"]].map(([label, val, setVal, ph, type]) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#5c8f6b", display: "block", marginBottom: 5 }}>{label}</label>
                <input className="input-field" type={type} value={val} onChange={e => setVal(e.target.value)} placeholder={ph} />
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
          {registeredFarmer.phone && <div style={{ fontSize: 13, color: "#8aaa94", marginTop: 4 }}>📱 {registeredFarmer.phone}</div>}
          <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "#3d6b4a", marginTop: 8 }}>ID: {registeredFarmer.id?.slice(0, 8)}...</div>
        </div>
        <button className="btn-primary" onClick={resetRegistration}>Register Another Farm</button>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: "20px 16px" }}>
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
              <span className="chip active" style={{ fontSize: 11 }}>✓ Enable SMS alerts</span>
            </div>
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

function AdvisoryTab({ chatMessages, chatInput, setChatInput, sendChat, isTyping, chatEndRef }) {
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 130px)" }}>
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

function InsightsTab() {
  const yieldData = [
    { region: "Mash Central", crop: "Maize", yield: 4.2, forecast: 3.6, change: -14 },
    { region: "Mash East", crop: "Tobacco", yield: 1.8, forecast: 2.1, change: 17 },
    { region: "Manicaland", crop: "Coffee", yield: 0.9, forecast: 1.0, change: 11 },
    { region: "Midlands", crop: "Soya", yield: 2.3, forecast: 2.0, change: -13 },
    { region: "Mat North", crop: "Cattle", yield: 820, forecast: 790, change: -4 },
  ];
  return (
    <div className="fade-in" style={{ padding: "20px 16px" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#c8e8d4", marginBottom: 4 }}>Market Insights</div>
      <div style={{ fontSize: 12, color: "#4a7a5a", marginBottom: 20 }}>AI-powered yield & price intelligence</div>
      <div style={{ background: "linear-gradient(135deg, #1a2e1e, #0f2218)", border: "1px solid #2d5a36", borderRadius: 14, padding: "16px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ fontSize: 28 }}>🛰️</div>
          <div>
            <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: "#5cd68a", marginBottom: 4 }}>AI SATELLITE FORECAST · 2024/25 SEASON</div>
            <div style={{ fontSize: 15, color: "#e8dfc8", lineHeight: 1.5 }}>Mashonaland maize yield expected to drop <strong style={{ color: "#e07060" }}>12–15%</strong> due to reduced rainfall. Manicaland tobacco shows strong recovery.</div>
          </div>
        </div>
      </div>
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
      <div style={{ background: "linear-gradient(135deg, #1e2d18, #152218)", border: "1px solid #d4a017", borderRadius: 14, padding: "16px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: "#d4a017", marginBottom: 8 }}>PREMIUM INSIGHTS</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#c8e8d4", marginBottom: 6 }}>Unlock Full Market Intelligence</div>
        <div style={{ fontSize: 13, color: "#8aaa94", lineHeight: 1.5, marginBottom: 14 }}>Daily price predictions, GMB tender alerts, buyer demand signals, and export market data.</div>
        <button className="btn-primary" style={{ background: "linear-gradient(135deg, #b8860b, #8b6914)" }}>Subscribe — USD 12/month</button>
      </div>
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