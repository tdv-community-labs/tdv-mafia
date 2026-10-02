import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { inMemoryLobbyStore } from '../../../server/state/memory';

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

export async function POST(request: Request) {
  try {
    const { lobbyId, notes, roleDisplay } = await request.json();
    
    const lobby = inMemoryLobbyStore.getLobby(lobbyId);
    if (!lobby) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    }

    const keys = getEnvKeyPool();
    if (keys.length === 0) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: keys[Math.floor(Math.random() * keys.length)] });

    // Gather public game state
    const deadPlayers = Object.values(lobby.players).filter(p => !p.isAlive).map(p => p.username);
    const alivePlayers = Object.values(lobby.players).filter(p => p.isAlive).map(p => p.username);
    const recentDeaths = lobby.pastNewspapers?.flatMap(n => n.publicDeaths.map(d => d.victimPlayerId)) || [];
    
    let prompt = `Sən usta bir xəfiyyəsən (Sherlock Holmes tərzində). TDV Mafia oyununda bir oyunçuya analiz etməyə kömək edirsən.\n`;
    prompt += `Oyunçunun Rolu: ${roleDisplay || 'Məlum deyil'}\n`;
    prompt += `Sağ olanlar: ${alivePlayers.join(', ')}\n`;
    prompt += `Ölənlər: ${deadPlayers.join(', ')}\n\n`;
    prompt += `Oyunçunun hazırki qeydləri belədir:\n"""${notes}"""\n\n`;
    prompt += `Bu qeydlərə və oyunun vəziyyətinə əsasən, oyunçuya (Maksimum 2-3 cümləlik) ağıllı, sirli və məntiqli bir 'Xəfiyyə Məsləhəti' (Detective Deduction) ver. Oyundakı rolları qəti şəkildə ifşa etmə (çünki sən də bilmirsən), sadəcə qeydlərdəki şübhələri analiz et və ehtimallar irəli sür. Azərbaycan dilində yaz.`;

    // @ts-ignore
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 0.7 }
    });

    return NextResponse.json({ analysis: response.text });
  } catch (error: any) {
    console.error('AI Detective Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
