// backend/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 1. ALLOW ACCESS TO UPLOADED IMAGES
app.use('/uploads', express.static('uploads'));

// 2. SETUP STORAGE
// Ensure the 'uploads' folder exists manually if this crashes
const upload = multer({ dest: 'uploads/' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: fs.readFileSync(path).toString("base64"),
      mimeType,
    },
  };
}

app.post('/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    // Default to English if missing
    const userLocation = req.body.location || "Unknown Location";
    const userLanguage = req.body.language || "English"; 
    
    console.log(`Processing image... Location: ${userLocation}, Lang: ${userLanguage}`);

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const imagePart = fileToGenerativePart(req.file.path, req.file.mimetype);
    
    const FINAL_PROMPT = `
      You are 'CivicFlow AI', an intelligent civic assistant for Udaipur City.
      
      **STRICT RULES:**
      1. Language: Generate response in ${userLanguage} ONLY.
      2. Tone: Extremely Formal and Official.
      3. **FORBIDDEN WORD:** Do NOT use the word "Dear".
      4. **MANDATORY START:** The email body MUST start with "Respected Sir/Madam," (or "सेवा में, श्रीमान" if Hindi).

      1. **Category Detection:**
         - **Jalkumbhi (Water Hyacinth):** If you see green weeds/plants covering a water body (Lake/River), set category to "Jalkumbhi (Invasive Weed)".
         - **Garbage:** Waste on roads/land.
         - **Infrastructure:** Potholes, broken lights.
         - **Dead/Injured Animal:** Deceased or hurt animals.
         - **Invalid:** Selfies, memes, etc.
      
      2. **Routing Logic (Recipient):**
         - Jalkumbhi -> Recipient: "Lake Conservation Committee" (lake.cell@udaipur.gov.in)
         - Injured Animal -> Recipient: "Animal Aid Unlimited" (rescue@animalaid.org)
         - Others -> Recipient: "Municipal Corporation Udaipur" (help@udaipur.gov.in)

      3. **Output JSON Structure:**
      {
        "category": "String (Translated to ${userLanguage})",
        "priority": "High/Medium/Low",
        "recipient_name": "String",
        "recipient_email": "String",
        "description": "String (1 sentence description in ${userLanguage})",
        "eco_tip": "String (Eco tip in ${userLanguage})",
        "email_draft": {
          "subject": "String (Formal subject in ${userLanguage})",
          "body": "String (The formal complaint. Start with 'Respected Sir/Madam,'. Include location: ${userLocation}. End with 'Sincerely, [Your Name]')"
        }
      }
    `;

    const result = await model.generateContent([FINAL_PROMPT, imagePart]);
    const response = await result.response;
    const text = response.text();
    const cleanJson = text.replace(/```json|```/g, '').trim();
    
    let data;
    try {
        data = JSON.parse(cleanJson);
    } catch (e) {
        console.error("AI JSON Error:", text);
        return res.status(500).json({ error: "AI response was not valid JSON" });
    }

    // === CREATE LOCAL URL ===
    // This creates the http://localhost:5000/uploads/filename link
    const protocol = req.protocol;
    const host = req.get('host'); 
    data.image_url = `${protocol}://${host}/uploads/${req.file.filename}`;

    res.json(data);

  } catch (error) {
    console.error("SERVER CRASH ERROR:", error); // Check your terminal for this!
    res.status(500).json({ error: 'Analysis failed', details: error.message });
  }
});

// backend/index.js - PASTE THIS BEFORE app.listen()

// === ROUTE 2: MANUAL TEXT ANALYSIS (The Letter Writer) ===
// backend/index.js (Replace the '/manual-analyze' route with this)

// backend/index.js (Replace the '/manual-analyze' route with this)

// backend/index.js - PASTE THIS BEFORE app.listen()

// === ROUTE 2: MANUAL TEXT ANALYSIS (The Letter Writer) ===
app.post('/manual-analyze', upload.none(), async (req, res) => {
    try {
        const { category, description, location, language } = req.body;
        console.log(`Manual Report: ${category} - ${description}`);

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const PROMPT = `
            You are an expert government liaison officer. 
            A citizen has manually reported an issue.
            
            **Details:**
            - Category: ${category}
            - User's Raw Notes: "${description}"
            - Location: ${location}
            - Language: ${language || "English"}

            **YOUR TASK:**
            1. Analyze the user's raw notes.
            2. REWRITE it into a highly professional, formal complaint letter. 
               - Do NOT copy the user's text directly. 
               - Expand on it to make it sound official and urgent.
               - If the user says "big hole", you write "severe structural damage posing a safety hazard".
            3. Determine the Priority based on the description.
            4. Determine the best Recipient based on the Category.

            **Return STRICT JSON:**
            {
                "category": "${category}",
                "priority": "High/Medium/Low",
                "recipient_name": "Name of Dept",
                "recipient_email": "email@gov.in",
                "description": "A summarized professional description of the issue",
                "eco_tip": "A relevant eco-tip",
                "email_draft": {
                    "subject": "Formal Subject Line",
                    "body": "Respected Sir/Madam,\n\n[Write the rewritten formal complaint here].\n\nLocation: ${location}\n\nSincerely,\nConcerned Citizen"
                }
            }
        `;

        const result = await model.generateContent(PROMPT);
        const response = await result.response;
        const text = response.text();
        const cleanJson = text.replace(/```json|```/g, '').trim();
        const data = JSON.parse(cleanJson);

        // Add a placeholder icon so the UI doesn't break
        data.image_url = "https://cdn-icons-png.flaticon.com/512/12391/12391857.png"; 

        res.json(data);

    } catch (error) {
        console.error("Manual Analysis Error:", error);
        res.status(500).json({ error: 'Manual analysis failed' });
    }
});
app.listen(process.env.PORT || 5000, () => {
  console.log(`✅ Backend running on port ${process.env.PORT || 5000}`);
});