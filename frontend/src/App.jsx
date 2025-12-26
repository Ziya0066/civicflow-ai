// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css'; 
import Confetti from 'react-confetti';

function App() {
  const [isListening, setIsListening] = useState(false); // To show pulsing animation
  const [user, setUser] = useState(null); 
  const [guestName, setGuestName] = useState("");
  const [activeView, setActiveView] = useState("home"); // 'home', 'vehicle_edit', 'manual_form'
  
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [address, setAddress] = useState(""); 
  const [locationStatus, setLocationStatus] = useState("");
  const [language, setLanguage] = useState("English"); 
  
  const [reportHistory, setReportHistory] = useState([]);
  const [points, setPoints] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [level, setLevel] = useState("Rookie Citizen");

  const [manualForm, setManualForm] = useState({
    category: "Garbage Dump",
    description: ""
  });

  // 1. LOAD DATA
  useEffect(() => {
    const savedUser = localStorage.getItem('civicGuestUser');
    if (savedUser) setUser(JSON.parse(savedUser));
    
    const savedPoints = parseInt(localStorage.getItem('civicPoints') || '0');
    updateLevel(savedPoints);

    const savedHistory = JSON.parse(localStorage.getItem('civicHistory') || '[]');
    setReportHistory(savedHistory);
  }, []);

  const updateLevel = (currentPoints) => {
    setPoints(currentPoints);
    if (currentPoints < 100) setLevel("🌱 Rookie Citizen");
    else if (currentPoints < 300) setLevel("🛡️ Civic Guardian");
    else setLevel("🦸 Udaipur Hero");
  };

  const handleGuestLogin = (e) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    const fakeUser = {
      displayName: guestName,
      email: `${guestName.toLowerCase().replace(/\s/g, '')}@citizen.com`,
      photoURL: "https://cdn-icons-png.flaticon.com/512/149/149071.png"
    };
    localStorage.setItem('civicGuestUser', JSON.stringify(fakeUser));
    setUser(fakeUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('civicGuestUser');
    setUser(null); resetApp();
  };

  const resetApp = () => {
    setResult(null); setImage(null); setPreview(null);
    setAddress(""); setActiveView("home"); setManualForm({ category: "Garbage Dump", description: "" });
  };

  const cleanText = (text) => {
    if (!text) return "";
    return text.replace(/\*\*/g, "").replace(/\*/g, "").replace(/#/g, "");
  };

  const getGPSLocation = () => {
    setLocationStatus(language === "English" ? "📍 Locating..." : "📍 स्थान खोज रहा है...");
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(async (position) => {
          const { latitude, longitude } = position.coords;
          try {
             const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
             const res = await fetch(url);
             const data = await res.json();
             setAddress(data.display_name);
             setLocationStatus("✅");
          } catch(e) { 
             setAddress(`${latitude}, ${longitude}`); 
             setLocationStatus("⚠️ GPS Only");
          }
      });
    } else {
        setLocationStatus("❌ No GPS");
    }
  };

  // --- FEATURE 1: VEHICLE ABSENCE ---
  const startVehicleReport = () => {
    setActiveView("vehicle_edit");
    if (!address) getGPSLocation();
  };

  // --- FEATURE 1: VEHICLE ABSENCE (Now generates Full Report) ---
  const sendVehicleReport = () => {
    if (!address) return alert(language === "English" ? "Please wait for location..." : "कृपया स्थान का इंतज़ार करें...");

    setLoading(true); // Show processing state

    // Simulate "Drafting" for 1.5 seconds so it feels like the app is working
    setTimeout(() => {
        const vehicleResult = {
            category: language === "English" ? "Garbage Vehicle Missed" : "कचरा गाड़ी अनुपस्थित",
            priority: "High 🔥", // Always High Priority for missed trucks
            recipient_name: "Nagar Nigam (Vehicle Dept)",
            recipient_email: "help@udaipur.gov.in",
            description: language === "English" 
                ? "The daily garbage collection vehicle did not arrive in my area today, causing waste accumulation."
                : "आज मेरे क्षेत्र में दैनिक कचरा संग्रहण गाड़ी नहीं आई, जिसके कारण कचरा जमा हो गया है।",
            eco_tip: language === "English" 
                ? "Report missed pickups immediately to prevent street littering."
                : "सड़क पर कचरा फैलने से रोकने के लिए तुरंत रिपोर्ट करें।",
            // Truck Icon Image
            image_url: "https://cdn-icons-png.flaticon.com/512/2554/2554936.png", 
            email_draft: {
                subject: language === "English" 
                    ? `URGENT: Garbage Truck Missed at ${address.substring(0, 30)}...`
                    : `अति आवश्यक: कचरा गाड़ी नहीं आई - ${address.substring(0, 30)}...`,
                body: language === "English"
                    ? `Respected Sir/Madam,\n\nI wish to report that the municipal garbage collection vehicle failed to visit our area today.\n\nLocation: ${address}\n\nThis negligence is leading to waste piling up on the streets. I request you to send a backup vehicle immediately.\n\nSincerely,\n${user.displayName || "Concerned Citizen"}`
                    : `सेवा में,\n\nश्रीमान स्वास्थ्य अधिकारी जी,\n\nसविनय निवेदन है कि आज हमारे क्षेत्र में नगर निगम की कचरा गाड़ी नहीं आई है।\n\nस्थान: ${address}\n\nइस कारण मोहल्ले में गंदगी जमा हो रही है। आपसे अनुरोध है कि कृपया तुरंत गाड़ी भिजवाने की व्यवस्था करें।\n\nभवदीय,\n${user.displayName || "जागरूक नागरिक"}`
            }
        };

        setResult(vehicleResult);
        addPointsAndHistory(vehicleResult.category);
        setLoading(false);
        setActiveView("home"); // This triggers the Result Screen to show up
        
    }, 1500);
  };

  // --- FEATURE 2: MANUAL COMPLAINT (AI WRITER) ---
  const submitManualComplaint = async () => {
    if (!address) return alert("Please enter a location!");
    if (!manualForm.description) return alert("Please describe the issue!");
    
    setLoading(true);

    try {
        const formData = new FormData();
        formData.append('category', manualForm.category);
        formData.append('description', manualForm.description);
        formData.append('location', address);
        formData.append('language', language);

        // Call the backend AI writer
        const response = await axios.post('http://localhost:5000/manual-analyze', formData);
        
        setResult(response.data);
        addPointsAndHistory(response.data.category);
        setLoading(false);
        setActiveView("home"); 

    } catch (error) {
        console.error(error);
        alert("Server Error! Check backend terminal.");
        setLoading(false);
    }
  };

  // --- FEATURE 3: PHOTO REPORT ---
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file)); 
      setResult(null); setAddress(""); setLocationStatus("");
      getGPSLocation();
    }
  };

  const handleSubmit = async () => {
    if (!image) return alert("Please select an image first!");
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('image', image);
      formData.append('location', address);
      formData.append('language', language); 
      
      const response = await axios.post('http://localhost:5000/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(response.data);
      addPointsAndHistory(response.data.category);

    } catch (error) {
      console.error("Error:", error);
      alert("Backend Error! Is 'npm run dev' running?");
    } finally {
      setLoading(false);
    }
  };

  const addPointsAndHistory = (catName) => {
      const newPoints = points + 50;
      localStorage.setItem('civicPoints', newPoints.toString());
      updateLevel(newPoints);
      
      const newReport = {
        id: Date.now(),
        date: new Date().toLocaleDateString(),
        category: cleanText(catName),
        location: address.split(",")[0] || "Unknown Location",
        status: "Submitted"
      };
      const updatedHistory = [newReport, ...reportHistory];
      setReportHistory(updatedHistory);
      localStorage.setItem('civicHistory', JSON.stringify(updatedHistory));

      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
  };

  const t = {
    title: language === "English" 
      ? (<div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'10px'}}>CivicFlow AI <span className="emoji-logo" style={{fontSize:'35px'}}>🏙️</span></div>)
      : (<div style={{display:'flex', flexDirection:'column', alignItems:'center'}}><div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'10px'}}>CivicFlow AI <span className="emoji-logo" style={{fontSize:'35px'}}>🏙️</span></div><div style={{ fontSize: '0.6em', marginTop: '5px', fontWeight: '400', color: '#555', WebkitTextFillColor: 'initial' }}>(नागरिक सुविधा AI)</div></div>),
    subtitle: language === "English" ? "Udaipur's Smart Civic Assistant" : "उदयपुर का स्मार्ट सहायक",
    takePhoto: language === "English" ? "📸 Snap & Solve" : "📸 फोटो खींचें",
    uploadFile: language === "English" ? "📂 Upload File" : "📂 फाइल चुनें",
    manualBtn: language === "English" ? "📝 Complain Manually" : "📝 लिखकर शिकायत करें",
    vehicleBtn: language === "English" ? "🚛 Report Garbage Vehicle" : "🚛 कचरा गाड़ी नहीं आई?",
    analyze: language === "English" ? "🤖 Analyze Issue" : "🤖 समस्या जांचें",
    analyzing: language === "English" ? "☁️ Analyzing..." : "☁️ जांच कर रहा है...",
    locLabel: language === "English" ? "📍 Incident Location:" : "📍 घटना का स्थान:",
    draftTitle: language === "English" ? "📩 Drafted Complaint" : "📩 शिकायत पत्र",
    shareWA: language === "English" ? "💬 Share on WhatsApp" : "💬 व्हाट्सएप पर भेजें",
    callNagar: language === "English" ? "☎️ Call Nagar Nigam" : "☎️ नगर निगम को कॉल करें",
    callAnimal: language === "English" ? "📞 Call Animal Rescue" : "📞 पशु बचाव को कॉल करें",
    historyTitle: language === "English" ? "📜 My Reports" : "📜 मेरी रिपोर्टें"
  };

  if (!user) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '60px', marginBottom: '20px' }}>🏙️</div>
          <h1 style={{ marginBottom: '10px' }}>CivicFlow AI</h1>
          <p style={{ color: '#666', marginBottom: '30px' }}>Enter your name to start reporting.</p>
          <form onSubmit={handleGuestLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="text" placeholder="Your Name" value={guestName} onChange={(e) => setGuestName(e.target.value)} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '16px' }} required />
            <button type="submit" className="analyze-btn">🚀 Start Application</button>
          </form>
        </div>
      </div>
    );
  }


  // --- FEATURE 4: VOICE INPUT (ACCESSIBILITY) ---
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Voice input is not supported in this browser. Try Chrome!");
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = language === "English" ? "en-US" : "hi-IN"; // Detects Hindi or English
    recognition.continuous = false;
    recognition.interimResults = false;

    setIsListening(true);

    recognition.onstart = () => {
      // You can play a beep sound here if you want
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      // Append the spoken text to the existing description
      setManualForm(prev => ({ 
          ...prev, 
          description: (prev.description + " " + transcript).trim() 
      }));
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error("Speech Error:", event.error);
      setIsListening(false);
      alert("Could not hear you. Please try again.");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <div className="app-container">
      {showConfetti && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={200} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={user.photoURL} alt="User" style={{ width: '35px', height: '35px', borderRadius: '50%', border: '2px solid white', objectFit: 'cover' }} />
          <div>
            <div style={{ fontSize: '10px', color: '#555', fontWeight: 'bold' }}>{level}</div>
            <div style={{ fontSize: '12px', color: '#1a73e8', fontWeight: 'bold' }}>{points} pts</div>
          </div>
        </div>
        <div style={{display:'flex', gap:'10px'}}>
           <button onClick={() => setLanguage(language === "English" ? "Hindi" : "English")} style={{ padding: '6px 12px', borderRadius: '20px', border: '1px solid #ccc', background: 'white', color: '#333', cursor: 'pointer', fontSize: '12px' }}>{language === "English" ? "🇮🇳" : "🇬🇧"}</button>
           <button onClick={handleLogout} style={{ border: 'none', background: 'none', color: '#d32f2f', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Exit</button>
        </div>
      </div>

      <header className="header">
        <h1>{t.title}</h1>
        <p>{t.subtitle}</p>
      </header>

      {/* === VIEW 1: HOME SCREEN (BUTTONS) === */}
      {activeView === "home" && !result && (
        <div className="card">
           <h3 style={{fontSize:'14px', color:'#555', marginBottom:'10px'}}>📸 Photo Report</h3>
           <div className="upload-section">
              <input type="file" accept="image/*" capture="environment" id="cameraInput" onChange={handleImageChange} hidden />
              <label htmlFor="cameraInput" className="upload-btn camera-btn">{t.takePhoto}</label>
              <input type="file" accept="image/*" id="fileInput" onChange={handleImageChange} hidden />
              <label htmlFor="fileInput" className="upload-btn gallery-btn">{t.uploadFile}</label>
            </div>

            <hr style={{margin:'20px 0', border:'0', borderTop:'1px solid #eee'}}/>

            {/* QUICK TOOLS*/}
            <h3 style={{fontSize:'14px', color:'#555', marginBottom:'10px'}}>⚡ Quick Tools</h3>
            
            <button 
                onClick={startVehicleReport} 
                className="action-btn-secondary" 
                style={{
                    marginBottom:'10px', 
                    background:'#fff3cd', 
                    color:'#856404', 
                    border:'1px solid #ffeeba', 
                    width: '100%', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    cursor: 'pointer', 
                    fontWeight: 'bold',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
            >
                {t.vehicleBtn}
            </button>

            <button 
                onClick={() => { setActiveView("manual_form"); getGPSLocation(); }} 
                className="action-btn-secondary" 
                style={{
                    background:'#e3f2fd', 
                    color:'#0d47a1', 
                    border:'1px solid #bbdefb', 
                    width: '100%', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    cursor: 'pointer', 
                    fontWeight: 'bold'
                }}
            >
                {t.manualBtn}
            </button>
        </div>
      )}

      {/* === VIEW 2: VEHICLE REPORT (EDITABLE) === */}
     
      
      {activeView === "vehicle_edit" && (
        <div className="card">
            <h3>🚛 Garbage Vehicle Report</h3>
            <p style={{fontSize:'13px', color:'#666'}}>Please confirm your location so the truck can find you.</p>
            
            <div className="location-input-box" style={{marginTop:'15px'}}>
              <label>{t.locLabel}</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="address-input" />
              <small className="status-text">{locationStatus}</small>
            </div>

            <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                <button onClick={resetApp} style={{flex:1, padding:'12px', borderRadius:'8px', border:'none', background:'#f99c38ff', color:'#333'}}>Cancel</button>
                
                {/* UPDATED BUTTON: Now says "Generate Report" instead of "WhatsApp" */}
                <button 
                    onClick={sendVehicleReport} 
                    disabled={loading}
                    style={{
                        flex:1, 
                        padding:'12px', 
                        borderRadius:'8px', 
                        border:'none', 
                        background:'#56d72bff', // Orange color for high priority
                        color:'white', 
                        fontWeight:'bold'
                    }}
                >
                    {loading ? "Processing..." : "Generate Official Report 📄"}
                </button>
            </div>
        </div>
      )}

      {/* === VIEW 3: MANUAL COMPLAINT FORM === */}
      {activeView === "manual_form" && (
        <div className="card">
            <h3>📝 Manual Complaint</h3>
            <p style={{fontSize:'12px', color:'#666'}}>AI will write the formal letter for you.</p>
            
            <label style={{fontSize:'12px', fontWeight:'bold', color:'#555'}}>Category</label>
            <select value={manualForm.category} onChange={(e) => setManualForm({...manualForm, category: e.target.value})} style={{width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid #ccc', marginBottom:'15px'}}>
                <option value="Garbage Dump">Garbage Dump</option>
                <option value="Water Leakage">Water Leakage</option>
                <option value="Street Light">Broken Street Light</option>
                <option value="Pothole">Pothole / Road</option>
                <option value="Stray Animal">Stray Animal</option>
            </select>

            {/* REPLACE THE DESCRIPTION INPUT WITH THIS BLOCK */}
            
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <label style={{fontSize:'12px', fontWeight:'bold', color:'#555'}}>Describe Issue (Rough Notes)</label>
                
                {/* 🎙️ NEW MIC BUTTON */}
                <button 
                    onClick={startListening}
                    style={{
                        background: isListening ? '#ff4444' : 'white',
                        color: isListening ? 'white' : '#1a73e8',
                        border: '1px solid #1a73e8',
                        borderRadius: '20px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '5px',
                        fontWeight: 'bold',
                        marginBottom: '5px'
                    }}
                >
                    {isListening ? "Listening... 🔴" : "🎤 Tap to Speak"}
                </button>
            </div>

            <textarea 
                placeholder={language === "English" ? "Type or speak (e.g. 'Garbage pile next to park')..." : "लिखें या बोलें (जैसे: 'पार्क के पास कचरा पड़ा है')..."}
                value={manualForm.description} 
                onChange={(e) => setManualForm({...manualForm, description: e.target.value})} 
                style={{width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid #ccc', minHeight:'80px', marginBottom:'15px'}} 
            />

            <div className="location-input-box"><label>{t.locLabel}</label><input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="address-input" /><small className="status-text">{locationStatus}</small></div>

            <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                <button onClick={resetApp} style={{flex:1, padding:'12px', borderRadius:'8px', border:'none', background:'#eee', color:'#333'}}>Cancel</button>
                <button onClick={submitManualComplaint} disabled={loading} style={{flex:1, padding:'12px', borderRadius:'8px', border:'none', background:'#1a73e8', color:'white', fontWeight:'bold'}}>
                    {loading ? "AI Writing..." : "Generate Letter ✨"}
                </button>
            </div>
        </div>
      )}

      {/* === IMAGE PREVIEW MODE === */}
      {preview && !result && activeView === "home" && (
        <div className="card">
            <div className="preview-box">
            <img src={preview} alt="Preview" />
            <div className="location-input-box">
              <label>{t.locLabel}</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="address-input" />
              <small className="status-text">{locationStatus}</small>
            </div>
          </div>
          <div style={{display:'flex', gap:'10px', marginTop:'10px'}}>
             <button onClick={resetApp} style={{flex:1, padding:'10px', background:'#eee', border:'none', borderRadius:'8px'}}>Cancel</button>
             <button onClick={handleSubmit} disabled={loading} className="analyze-btn" style={{flex:1}}>{loading ? t.analyzing : t.analyze}</button>
          </div>
        </div>
      )}

      {/* === RESULT DISPLAY === */}
      {result && (
          <div className="card">
            <div className="result-box">
            <div style={{ textAlign: 'center', marginBottom: '15px', padding: '10px', background: '#e6f4ea', borderRadius: '10px', color: '#137333' }}>
              <strong>🎉 Complaint Drafted! (+50 pts)</strong>
            </div>
            <div className={`badge ${result.priority ? result.priority.toLowerCase().split(' ')[0] : 'medium'}`}>
              Priority: {cleanText(result.priority)}
            </div>
            <h2>{cleanText(result.category)}</h2>
            <p className="desc">{cleanText(result.description)}</p>
            {result.eco_tip && <div className="eco-tip"><strong>🌱 Tip:</strong> {cleanText(result.eco_tip)}</div>}

            <div className="email-draft">
              <h3>{t.draftTitle}</h3>
              
              <div className="email-content">
                 <p><strong>To:</strong> {result.recipient_name}</p>
                 <p><strong>Subject:</strong> {cleanText(result.email_draft.subject)}</p>
                 <hr />
                 <p style={{ whiteSpace: 'pre-line' }}>{cleanText(result.email_draft.body)}</p>
              </div>

              {/* VISIBLE BUTTONS */}
              <div className="button-group">
                {result.recipient_name.includes("Animal") ? (
                   <a href="tel:+919602302323" className="send-btn call-animal" style={{color:'white', fontWeight:'bold', display:'block', textAlign:'center', padding:'10px', backgroundColor:'#d32f2f', borderRadius:'8px', marginBottom:'10px', textDecoration:'none'}}>📞 Call Animal Rescue</a>
                ) : result.category.includes("Jalkumbhi") ? (
                   <a href="tel:18001806666" className="send-btn" style={{color:'white', fontWeight:'bold', display:'block', textAlign:'center', padding:'10px', backgroundColor:'#0288d1', borderRadius:'8px', marginBottom:'10px', textDecoration:'none'}}>🌊 Call Lake Patrol</a>
                ) : (
                   <a href="tel:18001806666" className="send-btn call-nagar" style={{color:'white', fontWeight:'bold', display:'block', textAlign:'center', padding:'10px', backgroundColor:'#f57c00', borderRadius:'8px', marginBottom:'10px', textDecoration:'none'}}>☎️ Call Nagar Nigam</a>
                )}
                
                <a href={`https://wa.me/?text=${encodeURIComponent(`*Civic Report*\n${cleanText(result.category)}\n\n${cleanText(result.description)}\n\nLoc: ${address}`)}`} target="_blank" rel="noopener noreferrer" className="send-btn whatsapp" style={{color:'white', fontWeight:'bold', display:'block', textAlign:'center', padding:'10px', backgroundColor:'#25D366', borderRadius:'8px', marginBottom:'10px', textDecoration:'none'}}>
                  💬 Share on WhatsApp
                </a>

                 <div className="email-row">
                    <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${result.recipient_email}&su=${encodeURIComponent(cleanText(result.email_draft.subject))}&body=${encodeURIComponent(cleanText(result.email_draft.body) + "\n\nLocation: " + address)}`} target="_blank" rel="noopener noreferrer" className="send-btn gmail" style={{color:'white', fontWeight:'bold'}}>Gmail</a>
                    <a href={`https://outlook.live.com/owa/?path=/mail/action/compose&to=${result.recipient_email}&subject=${encodeURIComponent(cleanText(result.email_draft.subject))}&body=${encodeURIComponent(cleanText(result.email_draft.body) + "\n\nLocation: " + address)}`} target="_blank" rel="noopener noreferrer" className="send-btn outlook" style={{color:'white', fontWeight:'bold'}}>Outlook</a>
                </div>
              </div>

              <button onClick={resetApp} style={{width:'100%', marginTop:'20px', padding:'12px', background:'#f66bccff', border:'1px solid #ddd', borderRadius:'8px', cursor:'pointer'}}>Back to Home</button>
            </div>
          </div>
          </div>
        )}

      {/* === HISTORY SECTION === */}
      {reportHistory.length > 0 && !result && activeView === "home" && (
        <div style={{ marginTop: '30px', paddingBottom: '20px' }}>
          <h3 style={{ marginLeft: '10px', color: '#555' }}>{t.historyTitle}</h3>
          {reportHistory.map((item) => (
            <div key={item.id} className="card" style={{ marginBottom: '10px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.category}</div>
                <div style={{ fontSize: '12px', color: '#777' }}>📍 {item.location}</div>
                <div style={{ fontSize: '10px', color: '#999' }}>📅 {item.date}</div>
              </div>
              <div style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '12px', background: Math.random() > 0.5 ? '#e6f4ea' : '#fff8e1', color: Math.random() > 0.5 ? '#137333' : '#b06000', fontWeight: 'bold' }}>
                {Math.random() > 0.5 ? "✅ Solved" : "⏳ Pending"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;