import { GoogleGenAI } from '@google/genai';

const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
export const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;