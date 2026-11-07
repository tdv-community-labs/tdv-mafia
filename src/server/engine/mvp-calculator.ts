/**
 * TDV BTL MAFIA - Algorithmic Match Recap & MVP Engine
 * Deterministically computes MVP player score, match turning points,
 * and 1-click viral share snippets for Telegram, WhatsApp, Discord, and X.
 */

import { LobbyState } from '../../types/game';
import { MatchMVPScore, MatchRecap, MatchTurningPoint } from '../../types/progression';

/**
 * Calculates complete match recap, MVP rankings, turning points, and viral share texts.
 */
export function calculateMatchRecap(lobby: LobbyState): MatchRecap {
  const winnerResult = lobby.winnerResult;
  const winningFaction = winnerResult?.winningFaction || 'Şəhər';
  const players = Object.values(lobby.players);

  // 1. Calculate MVP scores for each player
  const scores: MatchMVPScore[] = players.map((p) => {
    const isWinner = winnerResult ? winnerResult.winnerPlayerIds.includes(p.userId) : false;
    const isSurvivor = p.isAlive;
    const roleName = p.displayRole?.localizedRoleName || p.displayRole?.originalRoleName || 'Vətəndaş';
    const faction = p.allInIdentity?.layer1Faction || (p.displayRole?.originalRoleName?.toUpperCase().includes('MAFIA') ? 'MAFIA' : 'TOWN');

    let victoryBonus = isWinner ? 40 : 0;
    let survivalBonus = isSurvivor ? 20 : 0;
    let votingAccuracyPoints = 0;
    let actionImpactPoints = 0;
    let defenseAcquittalPoints = 0;
    const highlights: string[] = [];

    // Check if player was on defense podium and survived or was acquitted
    if (lobby.accusedPlayerId === p.userId && lobby.lastLynchedUserId !== p.userId) {
      defenseAcquittalPoints += 25;
      highlights.push('Məhkəmə kürsüsündə bəraət qazandı');
    }

    // Check mayor reveal
    if (lobby.mayorRevealedUserIds?.includes(p.userId)) {
      actionImpactPoints += 30;
      highlights.push('Bələdiyyə Sədri olaraq 3x səsini elan etdi');
    }

    // Scan newspapers for clutch actions (Doctor saves, armor fractures, etc.)
    const allNewspapers = [
      ...(lobby.pastNewspapers || []),
      ...(lobby.latestNewspaper ? [lobby.latestNewspaper] : []),
    ];

    for (const paper of allNewspapers) {
      if (paper.protectedIds?.includes(p.userId)) {
        actionImpactPoints += 20;
        highlights.push('Ölümcül hücumdan xilas edildi');
      }
      if (paper.armorBrokenPlayerIds?.includes(p.userId)) {
        actionImpactPoints += 25;
        highlights.push('Polad İradə ilə ölümcül zərbəni dəf etdi');
      }
      // Check if investigator found guilty
      const invResults = lobby.privateInvestigations?.[p.userId];
      if (invResults && invResults.length > 0) {
        const foundGuilty = invResults.filter(
          (r) =>
            r.revealedFaction === 'MAFIA' ||
            r.revealedFaction === 'YAKUZA' ||
            r.revealedFaction === 'NEUTRAL_KILLER' ||
            r.revealedFaction === 'VOID_CULT'
        );
        if (foundGuilty.length > 0) {
          actionImpactPoints += 25 * foundGuilty.length;
          highlights.push(`${foundGuilty.length} cinayətkarı ifşa etdi`);
        }
      }
    }

    // Role-specific baseline contribution
    if (isWinner) {
      if (faction === 'MAFIA' || faction === 'YAKUZA') {
        actionImpactPoints += 25;
        highlights.push('Sindikat zəfərini təmin etdi');
      } else if (faction === 'TOWN') {
        votingAccuracyPoints += 20;
        highlights.push('Şəhər ittifaqını qorudu');
      } else {
        actionImpactPoints += 35;
        highlights.push('Təkbaşına neytral qələbə qazandı');
      }
    }

    const totalScore =
      victoryBonus +
      survivalBonus +
      votingAccuracyPoints +
      actionImpactPoints +
      defenseAcquittalPoints;

    return {
      playerId: p.userId,
      playerName: p.username,
      roleId: roleName,
      faction,
      totalScore,
      breakdown: {
        victoryBonus,
        survivalBonus,
        votingAccuracyPoints,
        actionImpactPoints,
        defenseAcquittalPoints,
      },
      clutchHighlights: highlights,
    };
  });

  // Sort scores descending to find MVP
  scores.sort((a, b) => b.totalScore - a.totalScore);
  const mvp = scores[0] || {
    playerId: 'unknown',
    playerName: 'Oyunçu',
    roleId: 'Vətəndaş',
    faction: 'TOWN',
    totalScore: 100,
    breakdown: {
      victoryBonus: 40,
      survivalBonus: 20,
      votingAccuracyPoints: 20,
      actionImpactPoints: 20,
      defenseAcquittalPoints: 0,
    },
    clutchHighlights: ['Matçın ən fəal oyunçusu'],
  };

  // 2. Compute Turning Points (Dönüş Nöqtələri)
  const turningPoints: MatchTurningPoint[] = [];

  // Round 1 opener
  turningPoints.push({
    round: 1,
    phase: 'NIGHT',
    titleAz: 'Qaranlıq Başlanğıc',
    descriptionAz: 'Şəhərdə ilk gecə əməliyyatları başladı və gərginlik artdı.',
    impactLevel: 'HIGH',
    involvedPlayerIds: [],
  });

  // Accused / Trial Turning Point
  if (lobby.accusedPlayerId) {
    const accused = lobby.players[lobby.accusedPlayerId];
    turningPoints.push({
      round: Math.max(1, lobby.roundNumber - 1),
      phase: 'TRIAL_DEFENSE',
      titleAz: 'Məhkəmə Kürsüsü Dueli',
      descriptionAz: `${accused?.username || 'İttiham olunan'} məhkəmə kürsüsündə 30 saniyəlik dramatik müdafiə çıxışı etdi.`,
      impactLevel: 'CRITICAL',
      involvedPlayerIds: [lobby.accusedPlayerId],
    });
  }

  // Mayor Reveal Turning Point
  if (lobby.mayorRevealedUserIds && lobby.mayorRevealedUserIds.length > 0) {
    const mayorId = lobby.mayorRevealedUserIds[0];
    const mayor = lobby.players[mayorId];
    turningPoints.push({
      round: lobby.roundNumber,
      phase: 'DAY_VOTING',
      titleAz: 'Merin Mütləq Hakimiyyəti',
      descriptionAz: `${mayor?.username || 'Mer'} şəxsiyyətini açıqlayaraq 3x səs hüququ ilə məhkəmənin taleyini həll etdi!`,
      impactLevel: 'GAME_CHANGING',
      involvedPlayerIds: [mayorId],
    });
  }

  // Final Victory Climax
  turningPoints.push({
    round: lobby.roundNumber,
    phase: 'DAY_VOTING',
    titleAz: 'Qələbə Zəfəri',
    descriptionAz: `${winningFaction} fraksiyası rəqiblərini tam üstələyərək matçın mütləq qalibi oldu!`,
    impactLevel: 'GAME_CHANGING',
    involvedPlayerIds: winnerResult?.winnerPlayerIds || [],
  });

  // 3. Compile Public Casualties
  const publicCasualties = players
    .filter((p) => !p.isAlive)
    .map((p) => ({
      playerId: p.userId,
      playerName: p.username,
      roleName: p.displayRole?.localizedRoleName || 'Vətəndaş',
      round: p.deathRound || lobby.roundNumber,
      cause: p.deathCause || 'Güllələnib',
    }));

  // 4. Generate Shareable Summary Text
  const shareableSummaryText = generateShareSummary(lobby.lobbyId, winningFaction, mvp, lobby.roundNumber);

  return {
    lobbyId: lobby.lobbyId,
    winningFaction,
    totalRounds: lobby.roundNumber,
    durationSeconds: lobby.phaseDurationSeconds * lobby.roundNumber,
    mvp,
    scores,
    turningPoints,
    publicCasualties,
    shareableSummaryText,
  };
}

/**
 * Builds formatted text summary for copying and social networks.
 */
export function generateShareSummary(
  lobbyId: string,
  winningFaction: string,
  mvp: MatchMVPScore,
  totalRounds: number
): string {
  const factionEmoji =
    winningFaction === 'MAFIA' || winningFaction === 'YAKUZA'
      ? '🩸'
      : winningFaction === 'TOWN'
      ? '🛡️'
      : '🔮';

  return `🎭 TDV BTL MAFIA — DÖYÜŞ NƏTİCƏSİ
${factionEmoji} Qalib Fraksiya: ${winningFaction}
👑 Matçın MVP-si: ${mvp.playerName} (${mvp.roleId} — ${mvp.totalScore} Xal)
⏱️ Döyüş Müddəti: ${totalRounds} Raund
🔥 Ən Yaxşı Performans: ${mvp.clutchHighlights[0] || 'Qələbə zərbəsi'}

🎮 TDV BTL Mafia arenasında sən də öz intriqanı qur:
https://mafia.tdv.az/lobby/${lobbyId}`;
}

export function formatTelegramShareUrl(recap: MatchRecap): string {
  const url = `https://mafia.tdv.az/lobby/${recap.lobbyId}`;
  const text = encodeURIComponent(recap.shareableSummaryText);
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${text}`;
}

export function formatWhatsAppShareUrl(recap: MatchRecap): string {
  const text = encodeURIComponent(recap.shareableSummaryText);
  return `https://api.whatsapp.com/send?text=${text}`;
}

export function formatTwitterShareUrl(recap: MatchRecap): string {
  const text = encodeURIComponent(
    `🎭 TDV BTL MAFIA matçında ${recap.winningFaction} qalib gəldi! MVP: ${recap.mvp.playerName} (${recap.mvp.totalScore} xal)! 🎮\n`
  );
  const url = encodeURIComponent(`https://mafia.tdv.az/lobby/${recap.lobbyId}`);
  return `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
}
