
import { GoogleGenAI, Type } from "@google/genai";
import { ScanResult, CardSettings } from "../types";

/**
 * Analyzes a hand of cards using Gemini vision capabilities.
 */
export const analyzeHand = async (base64Image: string, settings: CardSettings): Promise<ScanResult> => {
  const preset = settings.preset;

  try {
    // The API key must be obtained from the environment. We check Vite's import.meta.env first 
    // as per production requirements, falling back to the mandatory process.env.API_KEY.
    // DO NOT CHANGE THIS
    const ai = new GoogleGenAI({ 
      apiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.API_KEY 
    });
    
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        cards: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              rank: { type: Type.STRING, description: "Card rank/value." },
              suit: { type: Type.STRING, description: "Card suit." }
            },
            required: ["rank", "suit"]
          },
          description: "Detected cards."
        }
      },
      required: ["cards"]
    };

    console.info("[Vision] Using Standard Single-Shot Prompting");
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            parts: [
                { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
                { text: `Identify the cards in this image for a game of ${preset}. Return only the JSON list of cards.` }
            ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0.1,
        }
    });

    const text = response.text;
    if (!text) throw new Error("Vision: Empty response from model.");
    return JSON.parse(text.trim()) as ScanResult;

  } catch (error) {
    console.error("[Vision Error]", error);
    throw error;
  }
};