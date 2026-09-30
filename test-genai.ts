import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({});
ai.models.generateContent({ model: 'gemini', contents: 'hello' });
