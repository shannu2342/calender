
import * as dotenv from 'dotenv';
dotenv.config();
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'hello',
}).then(res => {
    console.log('SUCCESS:', res.text);
}).catch(err => {
    console.error('ERROR:', err);
});
