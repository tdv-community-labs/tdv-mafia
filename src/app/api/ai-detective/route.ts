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

function generateHeuristicDeduction(alivePlayers: string[], deadPlayers: string[], notes: string, roleDisplay?: string): string {
  const noteLower = (notes || '').toLowerCase();
  const mentionedAlive = alivePlayers.filter(p => noteLower.includes(p.toLowerCase()));
  
  if (mentionedAlive.length > 0) {
    const suspect = mentionedAlive[0];
    return `Xəfiyyə Təhlili: Qeydlərində adı keçən "${suspect}" şəxsinin gündüz səsvermələrindəki mövqeyinə diqqət yetir. Onun kimi qoruduğunu və kimə qarşı səs verdiyini izləsən, gizli ittifaqı dərhal aşkar edəcəksən.`;
  }
  
  if (deadPlayers.length > 0) {
    return `Xəfiyyə Təhlili: Son qətlə yetirilənlər təsadüfi deyil. Mafiya adətən özünə ən çox mane olan və ya şübhələnmədiyi vətəndaşları sıradan çıxarır. Sağ qalan ${alivePlayers.length} nəfər arasında qurbanlarla ən çox ziddiyyətdə olanı axtar.`;
  }

  return `Xəfiyyə Təhlili: Müzakirələrdə həddindən artıq passiv qalan və ya əksinə, hamını tələsik ittiham edənlərə fokuslan. Həqiqi təqsirkar çox vaxt xaosun arxasında gizlənir.`;
}

export async function POST(request: Request) {
  try {
    const { lobbyId, notes, roleDisplay } = await request.json();
    
    const lobby = inMemoryLobbyStore.getLobby(lobbyId);
    if (!lobby) {
      return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    }

    // Gather public game state
    const deadPlayers = Object.values(lobby.players).filter(p => !p.isAlive).map(p => p.username);
    const alivePlayers = Object.values(lobby.players).filter(p => p.isAlive).map(p => p.username);

    const keys = getEnvKeyPool();
    if (keys.length === 0) {
      return NextResponse.json({
        analysis: generateHeuristicDeduction(alivePlayers, deadPlayers, notes, roleDisplay)
      });
    }

    const ai = new GoogleGenAI({ apiKey: keys[Math.floor(Math.random() * keys.length)] });
    
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
    return NextResponse.json({
      analysis: 'Xəfiyyə İpucu: Şübhəli oyunçuların səsvermə zamanı kimləri müdafiə etdiyinə diqqət yetir. Kritik səslərdə mafiyanın bir-birini gizlətməsi qaçılmazdır.'
    });
  }
}
