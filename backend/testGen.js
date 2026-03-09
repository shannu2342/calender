import dotenv from 'dotenv';
dotenv.config();
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testGen() {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: "Hello",
        });
        console.log("SUCCESS:", response.text);
    } catch (e) {
        console.error("FAILED:", e.message);
    }
}

testGen();
