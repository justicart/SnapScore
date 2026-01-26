
import { GoogleGenAI, Type } from "@google/genai";
import { ScanResult, GamePreset } from "../types";

const getSystemPrompt = (preset: GamePreset) => {
  if (preset === 'gnoming_around') {
    return `
    You are an expert card game assistant specializing in the game "Gnoming Around". 
    Your task is to identify and list exactly 9 cards arranged in a 3x3 grid.

    CARD TYPES TO RECOGNIZE:
    1. **Numbers**: Integers from -2 to 10. Pay extreme attention to '-' signs.
    2. **Special Cards**:
       - 'Star' (Mulligan): A colorful star symbol with no number. Rank: 'Star', Suit: 'None'.
       - 'X' (Hazard): A large 'X' symbol. Rank: 'X', Suit: 'None'.
    3. **Empty Slots**: If a slot is missing a card, use Rank: 'Empty'.

    GRID LOGIC (MANDATORY):
    You MUST return the cards in "Reading Order" for a 3x3 grid (Left-to-Right, Top-to-Bottom):
    - Item 1: Top-Left
    - Item 2: Top-Middle
    - Item 3: Top-Right
    - Item 4: Middle-Left
    - Item 5: Center
    - Item 6: Middle-Right
    - Item 7: Bottom-Left
    - Item 8: Bottom-Middle
    - Item 9: Bottom-Right

    RESPONSE FORMAT:
    Return Rank and Suit for each card.
    Rank: '-2'...'10', 'Star', 'X', 'Empty'.
    Suit: 'None'.
    `;
  }

  return `
    You are an expert card game assistant. Your task is to identify all playing cards visible in the photo.
    Identify each card's Rank and Suit accurately.

    STANDARD RANKS: '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', 'Joker'.
    STANDARD SUITS: 'Spades', 'Hearts', 'Diamonds', 'Clubs'.

    SPECIAL RANKS (Look for these in variants like Flip 7): 
    - Additive Cards: '+1', '+2', '+5', '+10'
    - Multiplier Cards: 'x2', 'x3'
    - Values: '-1', '-2'
    
    If the card has no suit or is a special symbol, use 'None' for the Suit.
    Return all detected cards in a flat list.
  `;
};

export const analyzeHand = async (base64Image: string, preset: GamePreset = 'standard'): Promise<ScanResult> => {
  try {
    // Adheres to VITE_GEMINI_API_KEY if present, otherwise falls back to standard API_KEY
    const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.API_KEY;
    const ai = new GoogleGenAI({ apiKey: apiKey! });
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
            text: getSystemPrompt(preset)
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
                    rank: { type: Type.STRING, description: "Rank (e.g., 'A', '10', 'K', '+2', 'Star')" },
                    suit: { type: Type.STRING, description: "Suit (e.g., 'Spades', 'None')" }
                },
                required: ["rank", "suit"]
              },
              description: "List of detected cards in the image."
            }
          },
          required: ["cards"]
        },
        temperature: 0.1,
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
