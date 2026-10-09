import { GoogleGenAI } from '@google/genai';
import { MorningNewspaper, NightDeathRecord } from '../../types/engine';
import { PlayerSession } from '../../types/game';
import { getGeminiApiKeyPool } from './gemini-keys';

export async function generateMorningNewspaperStory(
  roundNumber: number,
  deaths: NightDeathRecord[],
  players: Record<string, PlayerSession>
): Promise<string | null> {
  const keys = getGeminiApiKeyPool();
  if (keys.length === 0) return null;

  const ai = new GoogleGenAI({ apiKey: keys[Math.floor(Math.random() * keys.length)] });

  const deathDetails = deaths.map(d => {
    const p = players[d.victimPlayerId];
    return `- ${p?.username || d.victimPlayerId} was found dead. Cause of death: ${d.cause}.`;
  }).join('\n');

  let prompt = `You are the dramatic AI Mayor (Narrator) of a Mafia/Social Deduction game.\n`;
  prompt += `It is the morning of Round ${roundNumber}.\n`;
  
  if (deaths.length === 0) {
    prompt += `No one died tonight! The city is safe... for now.\n`;
  } else {
    prompt += `The following gruesome events occurred:\n${deathDetails}\n`;
  }

  prompt += `Write a short, suspenseful 2-3 sentence morning newspaper headline and story (in Azerbaijani language). Do not reveal hidden roles of the alive players. Be dramatic, dark, and mysterious. Use HTML formatting like <strong> or <em> if needed.`;

  const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  for (const model of candidateModels) {
    try {
      // @ts-ignore
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { temperature: 0.7 }
      });
      if (response.text) {
        return response.text;
      }
    } catch (err) {
      // Fallback to next model
    }
  }

  return null;
}
