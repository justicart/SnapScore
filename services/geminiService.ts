
import { GoogleGenAI, Type } from "@google/genai";
import { ScanResult } from "../types";

const SYSTEM_PROMPT = `
    You are an expert card game assistant. Your task is to accurately identify and list every unique physical playing card visible in the provided image.

    SPECIAL CARDS (Operation Cards):
    In some games (like Flip 7), cards have operators instead of just numbers.
    - **Additive Cards**: If a card has a "+" followed by a number (e.g., +2, +10), set Rank to that string (e.g., "+2") and Suit to "None".
    - **Multiplicative Cards**: If a card has an "x" followed by a number (e.g., x2), set Rank to that string (e.g., "x2") and Suit to "None".
    - **Number Cards**: Identify standard numbers (0-12 are common in Flip 7).

    CRITICAL REASONING TO PREVENT DOUBLE-COUNTING:
    1. **Dual Indices Awareness**: Standard playing cards have rank and suit indices in at least two corners. YOU MUST NOT record these as two separate cards.
    2. **Physical Object Detection**: Focus on identifying distinct pieces of physical card stock.
    3. **Fanned Hand Analysis**: Only the top edges/corners of overlapping cards are fully visible. The bottom index of the final card is often the same card's opposite end; ignore it.

    INSTRUCTIONS:
    1. Return the Rank and Suit for each unique card detected.
    2. Rank: '0'-'12', 'J', 'Q', 'K', 'A', 'Joker', '+1', '+2', '+5', '+10', 'x2', 'x3'.
    3. Suit: 'Spades', 'Hearts', 'Diamonds', 'Clubs', 'Stars', 'None'.
    4. **CRITICAL: Identify specific Jokers.** 
       - Cards with '$' or 'S' in the corner are Jokers.
       - Cards explicitly labeled 'JOKER' are Jokers.
       - For Jokers, set Rank: 'Joker' and Suit: 'None'.
`;

export const analyzeHand = async (base64Image: string): Promise<ScanResult> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                    rank: { type: Type.STRING, description: "Rank of the card (e.g., '10', '+2', 'x2', 'Joker')" },
                    suit: { type: Type.STRING, description: "Suit of the card (e.g., 'Hearts', 'None')" }
                },
                required: ["rank", "suit"]
              },
              description: "A list of the unique detected cards."
            }
          },
          required: ["cards"]
        },
        temperature: 0.1,
        thinkingConfig: {
          thinkingBudget: 2048
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    return JSON.parse(text.trim()) as ScanResult;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
