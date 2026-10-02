import { GoogleGenAI } from '@google/genai';
import { MorningNewspaper, NightDeathRecord } from '../../types/engine';
import { PlayerSession } from '../../types/game';

function getEnvKeyPool(): string[] {
  const keys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
  ];
  return keys.filter((k) => !!k) as string[];
}

export async function generateMorningNewspaperStory(
  roundNumber: number,
  deaths: NightDeathRecord[],
  players: Record<string, PlayerSession>
): Promise<string | null> {
  const keys = getEnvKeyPool();
  if (keys.length === 0) return null;

  const ai = new GoogleGenAI({ apiKey: keys[Math.floor(Math.random() * keys.length)] });

  const deathDetails = deaths.map(d => {
    const p = players[d.playerId];
    return `- ${p?.username || d.playerId} was found dead. Cause of death: ${d.cause}.`;
  }).join('\\n');

  let prompt = `You are the dramatic AI Mayor (Narrator) of a Mafia/Social Deduction game.\\n`;
  prompt += `It is the morning of Round ${roundNumber}.\\n`;
  
  if (deaths.length === 0) {
    prompt += `No one died tonight! The city is safe... for now.\\n`;
  } else {
    prompt += `The following gruesome events occurred:\\n${deathDetails}\\n`;
  }

  prompt += `Write a short, suspenseful 2-3 sentence morning newspaper headline and story (in Azerbaijani language). Do not reveal hidden roles of the alive players. Be dramatic, dark, and mysterious. Use HTML formatting like <strong> or <em> if needed.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0.7 }
    });
    return response.text || null;
  } catch (err) {
    console.error('Failed to generate AI Newspaper:', err);
    return null;
  }
}
