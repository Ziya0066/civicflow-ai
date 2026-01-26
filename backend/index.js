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

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const imagePart = fileToGenerativePart(req.file.path, req.file.mimetype);
    
    const FINAL_PROMPT = `
      You are 'CivicFlow AI', an intelligent civic assistant for Udaipur City.
      
      **STRICT DATA CONSTRAINTS:**
      1. You MUST use the exact email and phone numbers listed below in the Routing Logic.
      2. Do NOT invent new emails. Do NOT use '.gov.in' unless explicitly written below.
      3. If a Category doesn't match perfectly, default to "Municipal Corporation Udaipur".

      **ROUTING LOGIC (COPY THESE EXACTLY):**
      - **Jalkumbhi (Water Hyacinth)** -> Name: "Lake Conservation Committee"
          -> Email: "commudr@gmail.com"
          -> Phone: "02942426262"
      
      - **Dead/Injured Animal**
          -> Name: "Animal Aid Unlimited"
          -> Email: " info@animalaidunlimited.org"
          -> Phone: "09829843726"

      - **Garbage / Roads / Streetlights / Others**
          -> Name: "Municipal Corporation Udaipur"
          -> Email: "commudr@gmail.com"
          -> Phone: "02942426262"

      **GENERATION RULES:**
      1. Language: Generate response in ${userLanguage} ONLY.
      2. Tone: Extremely Formal. Start with "Respected Sir/Madam,".
      3. Forbidden Word: "Dear".

      **Output JSON Structure:**
      {
        "category": "String (Translated to ${userLanguage})",
        "priority": "High/Medium/Low",
        "recipient_name": "String (Exact match from Logic)",
        "recipient_email": "String (Exact match from Logic)",
        "recipient_phone": "String (Exact match from Logic)", 
        "description": "String (1 sentence description)",
        "eco_tip": "String (Eco tip)",
        "email_draft": {
          "subject": "String (Formal subject)",
          "body": "String (Formal complaint body)"
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

  
    const protocol = req.protocol;
    const host = req.get('host'); 
    data.image_url = `${protocol}://${host}/uploads/${req.file.filename}`;

    res.json(data);

  } catch (error) {
    console.error("SERVER CRASH ERROR:", error); 
    res.status(500).json({ error: 'Analysis failed', details: error.message });
  }
});


// === ROUTE 2: MANUAL TEXT ANALYSIS (The Letter Writer) ===
app.post('/manual-analyze', upload.none(), async (req, res) => {
    try {
        const { category, description, location, language } = req.body;
        console.log(`Manual Report: ${category} - ${description}`);

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const PROMPT = `
            You are an expert government liaison officer. 
            
            **ROUTING LOGIC (USE EXACTLY):**
            - **Lake/Water Issues:** Email: "commudr@gmail.com", Phone: "02942426262"
            - **Animal Issues:** Email: "info@animalaidunlimited.org", Phone: "09829843726"
            - **All Other Issues:** Email: "commudr@gmail.com", Phone: "02942426262"

            **YOUR TASK:**
            1. Analyze user notes: "${description}" (Category: ${category}).
            2. Select the correct Recipient details from the list above. DO NOT HALLUCINATE EMAILS.
            3. Rewrite the description into a formal complaint letter.

            **Return STRICT JSON:**
            {
                "category": "${category}",
                "priority": "High/Medium/Low",
                "recipient_name": "Name of Dept",
                "recipient_email": "Email from Logic above",
                "recipient_phone": "Phone from Logic above", 
                "description": "Summarized description",
                "eco_tip": "Eco tip",
                "email_draft": {
                    "subject": "Formal Subject",
                    "body": "Respected Sir/Madam,\n\n[Formal Complaint Content]\n\nLocation: ${location}\n\nSincerely,\nConcerned Citizen"
                }
            }
        `;

        const result = await model.generateContent(PROMPT);
        const response = await result.response;
        const text = response.text();
        const cleanJson = text.replace(/```json|```/g, '').trim();
        const data = JSON.parse(cleanJson);

      
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