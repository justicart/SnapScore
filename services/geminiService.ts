import { GoogleGenAI, Type, Schema } from "@google/genai";
import { CardSettings, ScanResult } from "../types";

const getSystemPrompt = (settings: CardSettings): string => {
  return `
    You are an expert card game scorekeeper. Your job is to identify playing cards in an image and calculate the total score based on specific rules.
    
    SCORING RULES:
    - Jokers are worth ${settings.jokerValue} points. 
      **CRITICAL RECOGNITION RULE**: 
      1. A card with a '$' (dollar sign) symbol is a JOKER.
      2. A card with the letter 'S' symbol is a JOKER.
      These symbols ('$' or 'S') typically appear in the corners, replacing the standard rank (like K, Q, 10). If you see a '$' or 'S' acting as the card's rank, count it strictly as a Joker. Also count standard cards labeled "JOKER".
    - Aces are worth ${settings.aceValue} points.
    - Face Cards (King, Queen, Jack): ${settings.faceCardBehavior === 'face' ? 'Jack is 11, Queen is 12, King is 13.' : `Worth ${settings.fixedFaceValue || 10} points each.`}
    - Number Cards (2 through 10): ${settings.numberCardBehavior === 'face' ? 'Worth their face value (e.g., 2 is 2, 9 is 9).' : `Worth ${settings.fixedNumberValue || 5} points each.`}
    
    INSTRUCTIONS:
    1. Identify every card visible in the image.
    2. If a card is partially obscured but identifiable, include it.
    3. Calculate the individual value of each card based on the rules above.
    4. Sum the values for the total score.
    5. Return the result strictly in JSON format.
  `;
};

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    score: {
      type: Type.NUMBER,
      description: "The total calculated score of all cards in the image."
    },
    cardsDetected: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING
      },
      description: "A list of the card names identified (e.g., 'Ace of Spades', 'Joker ($)', 'Joker (S)', '10 of Hearts')."
    },
    explanation: {
      type: Type.STRING,
      description: "A brief explanation of the math (e.g., '2 Aces (30) + 1 Joker (S) (50) = 80')."
    }
  },
  required: ["score", "cardsDetected", "explanation"]
};

export const analyzeHand = async (
  base64Image: string, 
  settings: CardSettings
): Promise<ScanResult> => {
  try {
    // Normalize base64 string (remove data URL prefix if present)
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
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
            text: getSystemPrompt(settings)
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1 // Low temperature for more deterministic math/recognition
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