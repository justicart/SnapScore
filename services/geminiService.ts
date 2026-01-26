
import { GoogleGenAI, Type } from "@google/genai";
import { ScanResult, CardSettings, DetectedCard } from "../types";
import { GambitRegistry } from "./gambitService";
import { calculateRoundScore } from "../utils/scoringUtils";

/**
 * Analyzes a hand of cards by compiling Gambit Decks into a Gemini request.
 * Handles recursive tool calls from the Action Deck to ensure scoring accuracy.
 */
export const analyzeHand = async (base64Image: string, settings: CardSettings): Promise<ScanResult> => {
  const preset = settings.preset;
  const useGambit = !!settings.useGambit;

  try {
    // The API key must be obtained from the environment. We check Vite's import.meta.env first 
    // as per production requirements, falling back to the mandatory process.env.API_KEY.
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

    if (!useGambit) {
        // Standard Single-Shot Mode
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
    }

    // Advanced Gambit Mode (Multi-turn Tool Loop)
    console.info("[Gambit] Using Advanced Multi-Turn AI Architecture");
    const { instructions, actions } = GambitRegistry.getSessionDecks(preset);

    let contents: any[] = [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          { text: `GAMBIT SYSTEM PROMPT INITIALIZED:\n\n${instructions.compileInstructionDeck()}\n\nTask: Identify cards and return a JSON list. Use your tools if you need to verify scoring logic.` }
        ]
      }
    ];

    const config = {
      tools: [{ functionDeclarations: actions.compileActionDeck() }],
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.1,
    };

    let response;
    let turnCount = 0;
    const MAX_TURNS = 5;

    while (turnCount < MAX_TURNS) {
      response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents,
        config
      });

      const candidate = response.candidates?.[0];
      if (!candidate) throw new Error("No response candidate from Gemini.");

      const functionCalls = candidate.content.parts.filter(p => p.functionCall);

      if (functionCalls.length > 0) {
        console.info(`[Gambit] AI utilizing Action Deck (Turn ${turnCount + 1}):`, functionCalls.map(f => f.functionCall?.name));
        contents.push(candidate.content);

        const functionResponses = [];
        for (const fc of functionCalls) {
          const call = fc.functionCall!;
          let toolResult: any = { status: "success" };

          if (call.name === 'calculate_set_bonus') {
            const hand = (call.args.hand || []) as DetectedCard[];
            const score = calculateRoundScore({ type: 'scan', id: 'temp', cards: hand, timestamp: Date.now() }, settings);
            toolResult = { score, message: "Hand verified against system scoring rules." };
          } else if (call.name === 'request_clarification') {
            toolResult = { acknowledgment: "System has logged visual uncertainty. Proceed with best estimate." };
          }

          functionResponses.push({
            functionResponse: { name: call.name, id: call.id, response: toolResult }
          });
        }

        contents.push({ role: 'user', parts: functionResponses });
        turnCount++;
      } else {
        break;
      }
    }

    const text = response?.text;
    if (text) return JSON.parse(text.trim()) as ScanResult;

    const textPart = response?.candidates?.[0].content.parts.find(p => p.text);
    if (textPart?.text) return JSON.parse(textPart.text.trim()) as ScanResult;
    
    throw new Error("Gambit: AI failed to finalize JSON output after tool execution.");

  } catch (error) {
    console.error("[Vision Error]", error);
    throw error;
  }
};
