import { GoogleGenAI } from '@google/genai';
import { NightDeathRecord } from '../../types/engine';
import { PlayerSession } from '../../types/game';
import { MinigameSubStates } from '../../types/minigames';
import { getGeminiApiKeyPool, GEMINI_CANDIDATE_MODELS } from './gemini-keys';
import { AZ_DANTE_CIRCLES } from '../../config/i18n/az';

export interface NewspaperStoryResult {
  readonly headline: string;
  readonly story: string;
}

/**
 * Procedural Azerbaijani story generator with deterministic resilience for offline play.
 */
export function generateProceduralStory(
  roundNumber: number,
  deaths: readonly NightDeathRecord[],
  players: Readonly<Record<string, PlayerSession>>,
  protectedIds?: readonly string[],
  minigames?: MinigameSubStates,
  armorBrokenPlayerIds?: readonly string[]
): NewspaperStoryResult {
  const getVictimName = (id: string): string => players[id]?.username ?? id;

  // Zero-death scenarios
  if (deaths.length === 0) {
    const zeroHeadlines = [
      'Sükut İçində Səhər: Gecə Şəhərə Rəhm Etdi',
      'Dinc Səhər: İtki Qeydə Alınmadı',
      'Gecə Patrulları Təhlükəni Dəf Etdi',
      'Gecənin Sirləri: Şəhər Hələ Də Nəfəs Alır',
    ];
    const headline = zeroHeadlines[roundNumber % zeroHeadlines.length]!;

    let story = `Raund ${roundNumber} başa çatdı. Dünən gecə şəhər küçələrində nisbi sakitlik hökm sürdü və heç bir itki qeydə alınmadı.`;
    if (protectedIds && protectedIds.length > 0) {
      const savedNames = protectedIds.map(getVictimName).join(', ');
      story += ` Lakin şayiələrə görə, ${savedNames} gecə hədəfə alınsa da, ayıq-sayıq mühafizəçilər tərəfindən ölümdən xilas edildi!`;
    } else {
      story += ` Lakin kölgələrdəki fısıltılar kəsilmir — hər kəs növbəti gecənin gətirəcəyi təhlükəni gözləyir.`;
    }

    if (armorBrokenPlayerIds && armorBrokenPlayerIds.length > 0) {
      const armorNames = armorBrokenPlayerIds.map(getVictimName).join(', ');
      story += ` Qeyd: ${armorNames} gecə ağır hücuma məruz qalsa da, Dəmir İradə zirehi sayəsində sağ qaldı (zireh qırıldı)!`;
    }

    if (minigames?.chernobyl) {
      story += ` Çernobıl radiasiya sızması: ${minigames.chernobyl.zoneContaminationLevel} mSv/raund.`;
    }

    if (minigames?.dantesInferno) {
      const circleInfo = AZ_DANTE_CIRCLES[minigames.dantesInferno.currentCircle];
      if (circleInfo) {
        story += ` Cəhənnəmin dərinlikləri çağırır: ${circleInfo.name}.`;
      }
    }

    return { headline, story };
  }

  // Deaths present
  const deathHeadlines = [
    'Qanlı Gecə: Şəhər Dəhşət İçində Oyandı!',
    'Gecə Terroru: Cinayətkar Şəbəkə Zərbə Vurdu!',
    'Kölgələrin Qurbanları: Məhkəmə Ədalət Tələb Edir!',
    'Gözlənilməz İtkilər: Şəhərdə Həyəcan Siqnalı!',
  ];
  const headline = deathHeadlines[(roundNumber + deaths.length) % deathHeadlines.length]!;

  const victimStories = deaths.map(d => {
    const name = getVictimName(d.victimPlayerId);
    switch (d.cause) {
      case 'CROSSFIRE':
        return `${name} iki tərəfin amansız çarpaz atəşi arasında qalaraq həlak oldu.`;
      case 'GORT_VAPORISATION':
        return `${name} Qortun kosmik lazer şüası ilə bir göz qırpımında külə çevrildi.`;
      case 'BRIEFCASE_DETONATION':
        return `Partlayıcı dolu portfel işə düşdü! Şiddətli partlayış nəticəsində ${name} hadisə yerindəcə həyatını itirdi.`;
      case 'RETALIATION_FUSE_COUNTER':
        return `${name} tələyə düşərək əks-hücuma məruz qaldı və zərərsizləşdirildi.`;
      case 'MAFIA_KILL':
        return `${name} mafiyanın qanlı sui-qəsdi nəticəsində həyatını itirdi.`;
      case 'YAKUZA_KILL':
        return `${name} Yakuza klanının qisas əməliyyatı nəticəsində qətlə yetirildi.`;
      case 'VOID_CULT_SACRIFICE':
        return `${name} Boşluq Kultunun qaranlıq ayinində qurban verildi.`;
      case 'NEUTRAL_KILLER_KILL':
        return `${name} tək fəaliyyət göstərən amansız qatil tərəfindən məhv edildi.`;
      case 'JESTER_REVENGE':
        return `${name} Təlxəyin qisas lənətinə tuş gəldi.`;
      case 'BODYGUARD_SACRIFICE':
        return `${name} (Mühafizəçi) öz bədənini sipər edərək qoruduğu vətəndaşın həyatını xilas etdi və qəhrəmancasına şəhid oldu.`;
      case 'BODYGUARD_COUNTER':
        return `${name} sui-qəsd törətmək istəyərkən ayıq-sayıq Mühafizəçinin qisas zərbəsi ilə zərərsizləşdirildi!`;
      case 'RADIATION_SICKNESS':
        return `${name} Çernobıl təcrid zonasının ölümcül radiasiya dozasına tab gətirə bilməyərək şüa xəstəliyindən həyatını itirdi.`;
      default:
        return `${name} müəmmalı şəraitdə həyatını itirdi.`;
    }
  });

  let story = `Raund ${roundNumber} sübh tezdən açıldı. ${victimStories.join(' ')}`;

  if (protectedIds && protectedIds.length > 0) {
    const savedNames = protectedIds.map(getVictimName).join(', ');
    story += ` Xoşbəxtlikdən, ${savedNames} son anda ölümdən xilas ola bildi.`;
  }

  if (armorBrokenPlayerIds && armorBrokenPlayerIds.length > 0) {
    const armorNames = armorBrokenPlayerIds.map(getVictimName).join(', ');
    story += ` Həmçinin ${armorNames} ağır hücuma məruz qalsa da, Dəmir İradə bacarığı sayəsində ölümdən döndü (zireh qırıldı)!`;
  }

  if (minigames?.valkyrie?.briefcaseLocationPlayerId) {
    story += ` Partlayıcı portfelin vaxtı daralır: ${minigames.valkyrie.fuseTimerDaysRemaining} gün qalır.`;
  } else if (minigames?.earthStoodStill) {
    story += ` Qiyamət Saatı: ${minigames.earthStoodStill.doomsdayClockHours}/12 saat.`;
  } else if (minigames?.stanfordPrison) {
    story += ` Həbsxanada gərginlik yüksəlir: üsyan göstəricisi ${minigames.stanfordPrison.revoltMeter}%.`;
  } else if (minigames?.chernobyl) {
    story += ` Çernobıl təcrid zonası: radiasiya səviyyəsi ${minigames.chernobyl.zoneContaminationLevel} mSv/raund təşkil edir.`;
  }

  return { headline, story };
}

export async function generateMorningNewspaperStory(
  roundNumber: number,
  deaths: NightDeathRecord[],
  players: Record<string, PlayerSession>,
  protectedIds?: readonly string[],
  minigames?: MinigameSubStates,
  armorBrokenPlayerIds?: readonly string[]
): Promise<NewspaperStoryResult> {
  const fallback = generateProceduralStory(roundNumber, deaths, players, protectedIds, minigames, armorBrokenPlayerIds);

  const keys = getGeminiApiKeyPool();
  if (keys.length === 0) return fallback;

  const ai = new GoogleGenAI({ apiKey: keys[Math.floor(Math.random() * keys.length)] });

  const deathDetails = deaths.map(d => {
    const p = players[d.victimPlayerId];
    return `- ${p?.username || d.victimPlayerId} was found dead. Cause: ${d.cause}.`;
  }).join('\n');

  let prompt = `You are the dramatic newspaper editor/narrator of an Azerbaijani Mafia social deduction game.\n`;
  prompt += `Round: ${roundNumber}.\n`;
  if (deaths.length === 0) {
    prompt += `No players died tonight.\n`;
  } else {
    prompt += `Casualties:\n${deathDetails}\n`;
  }
  if (protectedIds && protectedIds.length > 0) {
    const names = protectedIds.map(id => players[id]?.username ?? id).join(', ');
    prompt += `Players saved from death by protectors: ${names}.\n`;
  }
  if (armorBrokenPlayerIds && armorBrokenPlayerIds.length > 0) {
    const names = armorBrokenPlayerIds.map(id => players[id]?.username ?? id).join(', ');
    prompt += `Players who survived lethal attack due to Iron Will armor shatter: ${names}.\n`;
  }

  prompt += `Respond strictly in valid JSON format:
{
  "headline": "A short dramatic newspaper headline in Azerbaijani (under 8 words)",
  "story": "A dramatic 2-3 sentence morning newspaper report in Azerbaijani detailing the night events without revealing any alive player's secret role."
}`;

  const candidateModels = GEMINI_CANDIDATE_MODELS;
  for (const model of candidateModels) {
    try {
      // @ts-ignore
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
      });
      if (response.text) {
        const parsed = JSON.parse(response.text.trim());
        if (parsed.headline && parsed.story) {
          return {
            headline: String(parsed.headline).trim(),
            story: String(parsed.story).trim(),
          };
        }
      }
    } catch {
      // Try next model or fallback
    }
  }

  return fallback;
}
