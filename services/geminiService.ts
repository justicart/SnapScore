
import { GoogleGenAI, Type } from "@google/genai";
import { ScanResult } from "../types";

const SYSTEM_PROMPT = `
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
                    rank: { type: Type.STRING, description: "Rank (e.g., '5', '-2', 'Star', 'X')" },
                    suit: { type: Type.STRING, description: "Suit" }
                },
                required: ["rank", "suit"]
              },
              minItems: 9,
              maxItems: 9,
              description: "List of exactly 9 detected cards in 3x3 reading order."
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
