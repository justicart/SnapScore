
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ScanResult } from "../types";

const SYSTEM_PROMPT = `
    You are an expert card game assistant. Your job is to identify playing cards in an image.
    
    INSTRUCTIONS:
    1. Identify every card visible in the image.
    2. If a card is partially obscured but identifiable, include it.
    3. **CRITICAL**: Identify specific Jokers. 
       - Cards with '$' or 'S' in the corner are Jokers.
       - Cards explicitly labeled JOKER are Jokers.
    4. Return the Rank and Suit for each card.
    
    FORMAT:
    - Rank: Use '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', or 'JOKER'.
    - Suit: Use 'Spades', 'Hearts', 'Diamonds', 'Clubs'. For Jokers, use 'None'.
`;

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    cards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
            rank: { type: Type.STRING, description: "Rank of the card (e.g., 'A', '10', 'K', 'JOKER')" },
            suit: { type: Type.STRING, description: "Suit of the card (e.g., 'Hearts', 'None')" }
        },
        required: ["rank", "suit"]
      },
      description: "A list of the detected cards."
    }
  },
  required: ["cards"]
};

export const analyzeHand = async (base64Image: string): Promise<ScanResult> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.error("CRITICAL ERROR: API Key is missing. process.env.API_KEY is undefined.");
      throw new Error("API Key not found. Please check your configuration and rebuild.");
    }

    // Normalize base64 string (remove data URL prefix if present)
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: SYSTEM_PROMPT
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1
      }
    });

    if (!response.text) {
        throw new Error("No response from AI");
    }

    const result = JSON.parse(response.text) as ScanResult;
    return result;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
