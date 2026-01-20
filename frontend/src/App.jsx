// frontend/src/App.jsx - FINAL HACKATHON VERSION WITH STORAGE
import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css'; 
import Confetti from 'react-confetti';

// === FIREBASE IMPORTS ===
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"; // <--- NEW IMPORTS

// Import the functions you need from the SDKs you need

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app); // <--- INITIALIZE STORAGE
const provider = new GoogleAuthProvider();

function App() {
  const [user, setUser] = useState(null); 
  const [activeView, setActiveView] = useState("home"); 
  
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

  const [manualForm, setManualForm] = useState({ category: "Garbage Dump", description: "" });
  const [isListening, setIsListening] = useState(false);

  // 1. LISTEN TO AUTH STATE
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser ? currentUser : null);
    });

    const savedPoints = parseInt(localStorage.getItem('civicPoints') || '0');
    updateLevel(savedPoints);
    setReportHistory(JSON.parse(localStorage.getItem('civicHistory') || '[]'));
    
    return () => unsubscribe();
  }, []);

  const updateLevel = (currentPoints) => {
    setPoints(currentPoints);
    if (currentPoints < 100) setLevel("🌱 Rookie Citizen");
    else if (currentPoints < 300) setLevel("🛡️ Civic Guardian");
    else setLevel("🦸 Udaipur Hero");
  };

  const handleGoogleLogin = async () => {
    try { await signInWithPopup(auth, provider); } 
    catch (error) { console.error(error); alert("Login Failed: " + error.message); }
  };

  const handleLogout = async () => { await signOut(auth); resetApp(); };

  const resetApp = () => {
    setResult(null); setImage(null); setPreview(null);
    setAddress(""); setActiveView("home"); setManualForm({ category: "Garbage Dump", description: "" });
  };

  // Helper to clean formatting AND insert the real User Name
  const cleanText = (text) => {
    if (!text) return "";
    
    // 1. Remove Markdown symbols (*, #)
    let cleaned = text.replace(/\*\*/g, "").replace(/\*/g, "").replace(/#/g, "");
    
    // 2. Replace placeholders with Real Name
    if (user && user.displayName) {
        cleaned = cleaned.replace(/\[Your Name\]/g, user.displayName); // Replaces [Your Name]
        cleaned = cleaned.replace(/\[Name\]/g, user.displayName);      // Replaces [Name]
        cleaned = cleaned.replace(/\[Citizen Name\]/g, user.displayName); // Replaces [Citizen Name]
    }
    
    return cleaned;
  };

  const getGPSLocation = () => {
    // 1. Check if browser supports it
    if (!("geolocation" in navigator)) {
      alert("Geolocation is not supported by this browser.");
      setLocationStatus("❌ Not Supported");
      return;
    }

    setLocationStatus(language === "English" ? "📍 Locating..." : "📍 स्थान खोज रहा है...");

    // 2. Request Position with explicit Error Handling
    navigator.geolocation.getCurrentPosition(
      async (position) => {
          // SUCCESS CASE
          const { latitude, longitude } = position.coords;
          try {
             // 3. Try to get the Address Name (Reverse Geocoding)
             const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
             const res = await fetch(url);
             const data = await res.json();
             
             // If Nominatim fails, fall back to coordinates
             setAddress(data.display_name || `${latitude}, ${longitude}`);
             setLocationStatus("✅");
          } catch(e) { 
             console.error("Nominatim Error:", e);
             setAddress(`${latitude}, ${longitude}`); 
             setLocationStatus("⚠️ GPS Only (Map Error)");
          }
      },
      (error) => {
          // ERROR CASE - This tells you exactly what is wrong!
          console.error("GPS Error:", error);
          
          let errorMsg = "❌ GPS Error";
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMsg = "❌ Permission Denied (Allow in Settings)";
              alert("Please ALLOW Location access in your browser settings!");
              break;
            case error.POSITION_UNAVAILABLE:
              errorMsg = "❌ Signal Weak (Try Mobile)";
              break;
            case error.TIMEOUT:
              errorMsg = "❌ Timeout (Try Again)";
              break;
            default:
              errorMsg = "❌ Unknown Error";
          }
          setLocationStatus(errorMsg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 } // High Accuracy Mode
    );
  };
  // --- FEATURE 1: VEHICLE ABSENCE ---
  const startVehicleReport = () => { setActiveView("vehicle_edit"); if (!address) getGPSLocation(); };

  const sendVehicleReport = () => {
    if (!address) return alert(language === "English" ? "Please wait for location..." : "कृपया स्थान का इंतज़ार करें...");
    setLoading(true);
    setTimeout(() => {
        const vehicleResult = {
            category: language === "English" ? "Garbage Vehicle Missed" : "कचरा गाड़ी अनुपस्थित",
            priority: "High 🔥",
            recipient_name: "Nagar Nigam (Vehicle Dept)",
            recipient_email: "help@udaipur.gov.in",
            description: language === "English" ? "The daily garbage collection vehicle did not arrive in my area today." : "आज मेरे क्षेत्र में दैनिक कचरा संग्रहण गाड़ी नहीं आई।",
            eco_tip: language === "English" ? "Report missed pickups immediately." : "तुरंत रिपोर्ट करें।",
            image_url: "https://cdn-icons-png.flaticon.com/512/2554/2554936.png", 
            email_draft: {
                subject: language === "English" ? `URGENT: Truck Missed at ${address.substring(0, 20)}...` : `अति आवश्यक: कचरा गाड़ी नहीं आई`,
                body: `Respected Sir,\n\nThe garbage vehicle did not arrive at ${address} today.\n\nSincerely,\n${user.displayName}`
            }
        };
        setResult(vehicleResult);
        addPointsAndHistory(vehicleResult.category, vehicleResult.image_url);
        setLoading(false);
        setActiveView("home");
    }, 1500);
  };

  // --- FEATURE 2: MANUAL COMPLAINT ---
  const submitManualComplaint = async () => {
    if (!address) return alert("Please enter a location!");
    setLoading(true);
    try {
        const formData = new FormData();
        formData.append('category', manualForm.category);
        formData.append('description', manualForm.description);
        formData.append('location', address);
        formData.append('language', language);
        
        const response = await axios.post('http://localhost:5000/manual-analyze', formData);
        setResult(response.data);
        addPointsAndHistory(response.data.category, null);
        setLoading(false);
        setActiveView("home"); 
    } catch (error) { console.error(error); alert("Server Error!"); setLoading(false); }
  };

  // --- FEATURE 3: PHOTO REPORT (WITH FIREBASE STORAGE) ---
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
      // 1. UPLOAD TO FIREBASE STORAGE
      const imageRef = ref(storage, `reports/${Date.now()}_${image.name}`);
      const snapshot = await uploadBytes(imageRef, image);
      const downloadURL = await getDownloadURL(snapshot.ref); // Get the public link!

      // 2. SEND TO BACKEND (FOR ANALYSIS)
      const formData = new FormData();
      formData.append('image', image);
      formData.append('location', address);
      formData.append('language', language); 
      
      const response = await axios.post('http://localhost:5000/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // 3. COMBINE RESULT WITH CLOUD IMAGE URL
      const finalResult = { ...response.data, image_url: downloadURL };
      setResult(finalResult);
      addPointsAndHistory(finalResult.category, downloadURL);

    } catch (error) {
      console.error("Error:", error);
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- FEATURE 4 & 5: VOICE ---
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) return alert("Use Chrome!");
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = language === "English" ? "en-US" : "hi-IN";
    recognition.continuous = false;
    setIsListening(true);
    recognition.onresult = (e) => {
      setManualForm(prev => ({ ...prev, description: (prev.description + " " + e.results[0][0].transcript).trim() }));
      setIsListening(false);
    };
    recognition.start();
  };

  const speakText = (text) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "English" ? "en-US" : "hi-IN"; 
    window.speechSynthesis.speak(utterance);
  };

  const addPointsAndHistory = (catName, imgUrl) => {
      const newPoints = points + 50;
      localStorage.setItem('civicPoints', newPoints.toString());
      updateLevel(newPoints);
      
      const newReport = {
        id: Date.now(),
        date: new Date().toLocaleDateString(),
        category: cleanText(catName),
        location: address.split(",")[0] || "Unknown",
        status: "Submitted",
        image: imgUrl // Saving the cloud image URL
      };
      const updatedHistory = [newReport, ...reportHistory];
      setReportHistory(updatedHistory);
      localStorage.setItem('civicHistory', JSON.stringify(updatedHistory));
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
  };

  // ... (t object and render logic remains the same)
  // Re-pasting the "t" object and Return block for safety
  const t = {
    title: language === "English" ? (<div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'10px'}}>CivicFlow AI <span className="emoji-logo" style={{fontSize:'35px'}}>🏙️</span></div>) : (<div style={{display:'flex', flexDirection:'column', alignItems:'center'}}><div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'10px'}}>CivicFlow AI <span className="emoji-logo" style={{fontSize:'35px'}}>🏙️</span></div><div style={{ fontSize: '0.6em', marginTop: '5px', fontWeight: '400', color: '#555' }}>(नागरिक सुविधा AI)</div></div>),
    subtitle: language === "English" ? "Udaipur's Smart Civic Assistant" : "उदयपुर का स्मार्ट सहायक",
    takePhoto: language === "English" ? "📸 Snap & Solve" : "📸 फोटो खींचें",
    uploadFile: language === "English" ? "📂 Upload File" : "📂 फाइल चुनें",
    manualBtn: language === "English" ? "📝 Complain Manually" : "📝 लिखकर शिकायत करें",
    vehicleBtn: language === "English" ? "🚛 Report Garbage Vehicle" : "🚛 कचरा गाड़ी नहीं आई?",
    locLabel: language === "English" ? "📍 Incident Location:" : "📍 घटना का स्थान:",
    analyze: language === "English" ? "Analyze Issue 🔍" : "समस्या की जाँच करें 🔍",
    analyzing: language === "English" ? "Analyzing... ⏳" : "जाँच हो रही है... ⏳",
    draftTitle: language === "English" ? "📩 Drafted Complaint" : "📩 शिकायत पत्र",
    historyTitle: language === "English" ? "📜 My Reports" : "📜 मेरी रिपोर्टें"
  };

  if (!user) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '60px', marginBottom: '20px' }}>🏙️</div>
          <h1 style={{ marginBottom: '10px' }}>CivicFlow AI</h1>
          <p style={{ color: '#666', marginBottom: '30px' }}>Sign in to start reporting issues.</p>
          <button onClick={handleGoogleLogin} className="analyze-btn" style={{background:'white', color:'#333', border:'1px solid #ccc'}}>
             <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" style={{marginRight:'10px'}}/>
             Sign in with Google
          </button>
        </div>
      </div>
    );
  }
const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return (
    <div className="app-container">
      {showConfetti && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={200} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="user-badge">
             <img src={user.photoURL} alt="User" style={{ width: '25px', height: '25px', borderRadius: '50%' }} />
             <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start'}}>
                <span style={{fontSize:'12px', fontWeight:'700'}}>{level}</span>
                <span style={{fontSize:'10px', color:'#2563eb'}}>{points} pts</span>
             </div>
          </div>
        </div>
        <div style={{display:'flex', gap:'10px'}}>
           <button onClick={() => setLanguage(language === "English" ? "Hindi" : "English")} style={{ padding: '8px 16px', borderRadius: '20px', border: '1px solid #ccc', background: 'white', color: '#333', cursor: 'pointer', fontSize: '12px', fontWeight:'bold' }}>{language === "English" ? "🇮🇳 IN" : "🇬🇧 EN"}</button>
           <button onClick={handleLogout} style={{ border: 'none', background: 'none', color: '#d32f2f', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>Exit</button>
        </div>
      </div>

      <header className="header">
        <h1>{t.title}</h1>
        <p>{t.subtitle}</p>
      </header>

      {/* VIEW 1: HOME */}
      {activeView === "home" && !result && (
        <div className="card">
           <h3 style={{fontSize:'13px', textTransform:'uppercase', letterSpacing:'1px', color:'#94a3b8', fontWeight:'700', marginBottom:'15px'}}>📸 Photo Report</h3>
           <div className="upload-section">
              <input type="file" accept="image/*" capture="environment" id="cameraInput" onChange={handleImageChange} hidden />
              <label htmlFor="cameraInput" className="upload-btn camera-btn">{t.takePhoto}</label>
              <input type="file" accept="image/*" id="fileInput" onChange={handleImageChange} hidden />
              <label htmlFor="fileInput" className="upload-btn gallery-btn">{t.uploadFile}</label>
            </div>
            <hr style={{margin:'25px 0', border:'0', borderTop:'1px solid rgba(0,0,0,0.05)'}}/>
            <h3 style={{fontSize:'13px', textTransform:'uppercase', letterSpacing:'1px', color:'#94a3b8', fontWeight:'700', margin:'25px 0 15px 0'}}>⚡ Quick Actions</h3>
            <button onClick={startVehicleReport} className="action-btn-secondary1"><span style={{fontSize:'22px'}}></span> {t.vehicleBtn}</button>
            <button onClick={() => { setActiveView("manual_form"); getGPSLocation(); }} className="action-btn-secondary2"><span style={{fontSize:'22px'}}></span> {t.manualBtn}</button>
        </div>
      )}

      {/* VIEW 2: VEHICLE EDIT */}
      {activeView === "vehicle_edit" && (
        <div className="card">
            <h3>🚛 Garbage Vehicle Report</h3>
            <p style={{fontSize:'13px', color:'#ee992b'}}>Confirm location.</p>
            <div className="location-input-box" style={{marginTop:'15px'}}><label>{t.locLabel}</label><input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="address-input" /><small className="status-text">{locationStatus}</small></div>
            <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                <button onClick={resetApp} style={{flex:1, padding:'12px', borderRadius:'16px', border:'none', background:'#eeeeee', color:'#333'}}>Cancel</button>
                <button onClick={sendVehicleReport} disabled={loading} style={{flex:1, padding:'12px', borderRadius:'16px', border:'none', background:'#f57c00', color:'white', fontWeight:'bold'}}>{loading ? "Processing..." : "Generate Official Report 📄"}</button>
            </div>
        </div>
      )}

      {/* VIEW 3: MANUAL FORM */}
      {activeView === "manual_form" && (
        <div className="card">
            <h3>📝 Manual Complaint</h3>
            <p style={{fontSize:'12px', backgroundcolor:'#3fc225'}}>AI will write the letter.</p>
            <label style={{fontSize:'12px', fontWeight:'bold', color:'#555'}}>Category</label>
            <select value={manualForm.category} onChange={(e) => setManualForm({...manualForm, category: e.target.value})} style={{width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid #ccc', marginBottom:'15px'}}><option value="Garbage Dump">Garbage Dump</option><option value="Water Leakage">Water Leakage</option><option value="Street Light">Broken Street Light</option><option value="Pothole">Pothole / Road</option><option value="Stray Animal">Stray Animal</option></select>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <label style={{fontSize:'12px', fontWeight:'bold', color:'#555'}}>Description</label>
                <button onClick={startListening} style={{background: isListening ? '#ff4444' : 'white', color: isListening ? 'white' : '#1a73e8', border: '1px solid #1a73e8', borderRadius: '20px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', marginBottom: '5px'}}>{isListening ? "Listening... 🔴" : "🎤 Tap to Speak"}</button>
            </div>
            <textarea placeholder={language === "English" ? "Type or speak..." : "लिखें या बोलें..."} value={manualForm.description} onChange={(e) => setManualForm({...manualForm, description: e.target.value})} style={{width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid #ccc', minHeight:'80px', marginBottom:'15px'}} />
            <div className="location-input-box"><label>{t.locLabel}</label><input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="address-input" /><small className="status-text">{locationStatus}</small></div>
            <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                <button onClick={resetApp} style={{flex:1, padding:'12px', borderRadius:'16px', border:'none', background:'#eee', color:'#333'}}>Cancel</button>
                <button onClick={submitManualComplaint} disabled={loading} style={{flex:1, padding:'12px', borderRadius:'16px', border:'none', background:'#1a73e8', color:'white', fontWeight:'bold'}}>{loading ? "AI Writing..." : "Generate Letter ✨"}</button>
            </div>
        </div>
      )}

      {/* VIEW 4: PREVIEW */}
      {preview && !result && activeView === "home" && (
        <div className="card">
            <div className="preview-box"><img src={preview} alt="Preview" /><div className="location-input-box"><label>{t.locLabel}</label><input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="address-input" /><small className="status-text">{locationStatus}</small></div></div>
            <div style={{display:'flex', gap:'10px', marginTop:'10px'}}><button onClick={resetApp} style={{flex:1, background:'#c21d1d', border:'none', borderRadius:'16px'}}>Cancel</button><button onClick={handleSubmit} disabled={loading} className="analyze-btn" style={{flex:1, gap:'10px', marginTop:'10px'}}>{loading ? t.analyzing : t.analyze}</button></div>
        </div>
      )}

      {/* VIEW 5: RESULTS */}
      {result && (
          <div className="card">
            <div className="result-box">
            <div style={{ textAlign: 'center', marginBottom: '15px', padding: '10px', background: '#e6f4ea', borderRadius: '10px', color: '#137333' }}><strong>🎉 Complaint Drafted! (+50 pts)</strong></div>
            <div className={`badge ${result.priority ? result.priority.toLowerCase().split(' ')[0] : 'medium'}`}>Priority: {cleanText(result.priority)}</div>
            
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                <h2 style={{margin:0}}>{cleanText(result.category)}</h2>
                <button onClick={() => speakText(`Official Draft. To ${result.recipient_name}. Subject: ${result.email_draft.subject}. Message: ${result.email_draft.body}`)} style={{background: 'white', border: '1px solid #1a73e8', color: '#1a73e8', borderRadius: '20px', padding: '5px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'}}>🔊 Listen to Letter</button>
            </div>

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

              <div className="button-group">
                {result.recipient_name.includes("Animal") ? (
                   <a href="tel:+919602302323" className="send-btn call-animal" style={{color:'white', fontWeight:'bold', display:'block', textAlign:'center', padding:'10px', backgroundColor:'#d32f2f', borderRadius:'8px', marginBottom:'10px', textDecoration:'none'}}>📞 Call Animal Rescue</a>
                ) : result.category.includes("Jalkumbhi") ? (
                   <a href="tel:18001806666" className="send-btn" style={{color:'white', fontWeight:'bold', display:'block', textAlign:'center', padding:'10px', backgroundColor:'#0288d1', borderRadius:'8px', marginBottom:'10px', textDecoration:'none'}}>🌊 Call Lake Patrol</a>
                ) : (
                   <a href="tel:18001806666" className="send-btn call-nagar" style={{color:'white', fontWeight:'bold', display:'block', textAlign:'center', padding:'10px', backgroundColor:'#f57c00', borderRadius:'8px', marginBottom:'10px', textDecoration:'none'}}>☎️ Call Nagar Nigam</a>
                )}
                <a href={`https://wa.me/?text=${encodeURIComponent(`*Civic Report*\n${cleanText(result.category)}\n\n${cleanText(result.description)}\n\nLoc: ${address}\n\nPhoto: ${result.image_url || 'N/A'}`)}`} target="_blank" rel="noopener noreferrer" className="send-btn whatsapp" style={{color:'white', fontWeight:'bold', display:'block', textAlign:'center', padding:'10px', backgroundColor:'#25D366', borderRadius:'8px', marginBottom:'10px', textDecoration:'none'}}>💬 Share on WhatsApp</a>
                 <div className="email-row">
                    <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${result.recipient_email}&su=${encodeURIComponent(cleanText(result.email_draft.subject))}&body=${encodeURIComponent(cleanText(result.email_draft.body) + "\n\nLocation: " + address + "\nPhoto Proof: " + (result.image_url || 'Attached'))}`} target="_blank" rel="noopener noreferrer" className="send-btn gmail" style={{color:'white', fontWeight:'bold'}}>Gmail</a>
                    <a href={`https://outlook.live.com/owa/?path=/mail/action/compose&to=${result.recipient_email}&subject=${encodeURIComponent(cleanText(result.email_draft.subject))}&body=${encodeURIComponent(cleanText(result.email_draft.body) + "\n\nLocation: " + address + "\nPhoto Proof: " + (result.image_url || 'Attached'))}`} target="_blank" rel="noopener noreferrer" className="send-btn outlook" style={{color:'white', fontWeight:'bold'}}>Outlook</a>
                </div>
              </div>
              <button onClick={resetApp} style={{width:'100%', marginTop:'20px', padding:'12px', background:'#fa48d1', border:'1px solid #fa48d1', borderRadius:'16px', cursor:'pointer'}}>Back to Home</button>
            </div>
          </div>
          </div>
        )}

      {/* VIEW 6: HISTORY */}
      {reportHistory.length > 0 && !result && activeView === "home" && (
        <div style={{ marginTop: '30px', paddingBottom: '20px' }}>
          <h3 style={{ marginLeft: '10px', color: '#555' }}>{t.historyTitle}</h3>
          {reportHistory.map((item) => (
            <div key={item.id} className="card" style={{ marginBottom: '10px', padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                {item.image && <img src={item.image} style={{width:'40px', height:'40px', borderRadius:'8px', objectFit:'cover'}} alt="proof"/>}
                <div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.category}</div>
                    <div style={{ fontSize: '12px', color: '#777' }}>📍 {item.location}</div>
                </div>
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