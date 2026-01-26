
import { GamePreset } from "../types";
import { FunctionDeclaration, Type } from "@google/genai";

/**
 * In the Gambit framework, a "Card" is an atomic module of logic or instruction.
 * It can be an Instruction Card (text for the prompt) or an Action Card (a tool definition).
 */
export class GambitCard {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly content: string,
    public readonly actionDefinition?: FunctionDeclaration
  ) {}
}

/**
 * A "Deck" is a collection of Gambit Cards that together define the AI's persona and capabilities.
 */
export class GambitDeck {
  constructor(public cards: GambitCard[] = []) {}

  addCard(card: GambitCard) {
    this.cards.push(card);
  }

  /**
   * Compiles Instruction Cards into a structured System Prompt.
   */
  compileInstructionDeck(): string {
    return this.cards
      .filter((c) => !c.actionDefinition)
      .map((c) => `### CARD: ${c.title}\n${c.content}`)
      .join("\n\n");
  }

  /**
   * Compiles Action Cards into Gemini-compatible Tool Definitions.
   */
  compileActionDeck(): FunctionDeclaration[] {
    return this.cards
      .filter((c) => !!c.actionDefinition)
      .map((c) => c.actionDefinition!);
  }
}

export class GambitRegistry {
  /**
   * Fetches the required Decks for the specific game session.
   */
  static getSessionDecks(preset: GamePreset): { instructions: GambitDeck, actions: GambitDeck } {
    const instructions = new GambitDeck();
    const actions = new GambitDeck();

    // --- INSTRUCTION DECK SETUP ---
    
    instructions.addCard(new GambitCard(
      'vision-core',
      'Computer Vision Module',
      'Your primary sensor is computer vision. Identify playing card ranks and suits with high precision. Use your Action Deck to validate complex math or flag ambiguity.'
    ));

    instructions.addCard(new GambitCard(
      'output-priority',
      'Final Output Rule',
      'After using any Action Cards (tools), you MUST provide a final response containing the JSON cards list. Do not end the turn on a tool call if you have enough info to fulfill the JSON schema.'
    ));

    if (preset === 'gnoming_around') {
      instructions.addCard(new GambitCard(
        'gnoming-grid-logic',
        'Gnoming Around 3x3 Layout',
        'Environment is a 3x3 grid. Use the calculate_set_bonus tool to verify if rows/cols form valid sets. This ensures your visual identification matches the game score logic.'
      ));
    } else if (preset === 'flip7') {
      instructions.addCard(new GambitCard(
        'flip7-special-vars',
        'Flip 7 Variable Processing',
        'Analyze image for specialized modifiers: +1, +2, +3 and Multipliers x2, x3. These are higher priority than base number cards.'
      ));
    } else {
      instructions.addCard(new GambitCard(
        'standard-52',
        'Standard 52-Card Protocol',
        'Standard suits (Spades, Hearts, Diamonds, Clubs) and ranks (A, 2-10, J, Q, K).'
      ));
    }

    // --- ACTION DECK SETUP (TOOLS) ---

    actions.addCard(new GambitCard(
      'action-clarify',
      'Request Clarification',
      'Use this when visual data is obscured or blurry.',
      {
        name: 'request_clarification',
        description: 'Notify the system that identification is difficult due to image quality.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            reason: { type: Type.STRING, description: 'Reason for ambiguity.' }
          },
          required: ['reason']
        }
      }
    ));

    actions.addCard(new GambitCard(
      'action-set-bonus',
      'Calculate Set Bonus',
      'Use this to run mathematical validation on detected cards.',
      {
        name: 'calculate_set_bonus',
        description: 'Verify score and set combinations via system logic.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            hand: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  rank: { type: Type.STRING },
                  suit: { type: Type.STRING }
                }
              }
            }
          },
          required: ['hand']
        }
      }
    ));

    return { instructions, actions };
  }
}
