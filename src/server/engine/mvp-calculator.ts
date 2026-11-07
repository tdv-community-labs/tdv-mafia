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
  const winningFaction = winnerResult?.winningFaction || 'Town';
  const players = Object.values(lobby.players);

  // 1. Calculate MVP scores for each player
  const scores: MatchMVPScore[] = players.map((p) => {
    const isWinner = winnerResult ? winnerResult.winnerPlayerIds.includes(p.userId) : false;
    const isSurvivor = p.isAlive;
    const roleName = p.displayRole?.localizedRoleName || p.displayRole?.originalRoleName || 'Civilian';
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
      highlights.push('Acquitted on the defense podium');
    }

    // Check mayor reveal
    if (lobby.mayorRevealedUserIds?.includes(p.userId)) {
      actionImpactPoints += 30;
      highlights.push('Proclaimed 3x Mayoral authority');
    }

    // Scan newspapers for clutch actions (Doctor saves, armor fractures, etc.)
    const allNewspapers = [
      ...(lobby.pastNewspapers || []),
      ...(lobby.latestNewspaper ? [lobby.latestNewspaper] : []),
    ];

    for (const paper of allNewspapers) {
      if (paper.protectedIds?.includes(p.userId)) {
        actionImpactPoints += 20;
        highlights.push('Healed from fatal night strike');
      }
      if (paper.armorBrokenPlayerIds?.includes(p.userId)) {
        actionImpactPoints += 25;
        highlights.push('Deflected lethal blow with Iron Will');
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
          highlights.push(`Exposed ${foundGuilty.length} hostile operatives`);
        }
      }
    }

    // Role-specific baseline contribution
    if (isWinner) {
      if (faction === 'MAFIA' || faction === 'YAKUZA') {
        actionImpactPoints += 25;
        highlights.push('Secured victory for the Mafia Family');
      } else if (faction === 'TOWN') {
        votingAccuracyPoints += 20;
        highlights.push('Preserved the Town coalition');
      } else {
        actionImpactPoints += 35;
        highlights.push('Achieved solo neutral victory');
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
    clutchHighlights: ['Most active player of the match'],
  };

  // 2. Compute Turning Points (Dönüş Nöqtələri)
  const turningPoints: MatchTurningPoint[] = [];

  // Round 1 opener
  turningPoints.push({
    round: 1,
    phase: 'NIGHT',
    titleAz: 'The Midnight Awakening',
    descriptionAz: 'First night operations commenced under midnight fog; tensions escalate across the city.',
    impactLevel: 'HIGH',
    involvedPlayerIds: [],
  });

  // Accused / Trial Turning Point
  if (lobby.accusedPlayerId) {
    const accused = lobby.players[lobby.accusedPlayerId];
    turningPoints.push({
      round: Math.max(1, lobby.roundNumber - 1),
      phase: 'TRIAL_DEFENSE',
      titleAz: 'Podium Defense Showdown',
      descriptionAz: `${accused?.username || 'The accused'} presented a dramatic 30-second defense on the court podium. `,
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
      titleAz: 'Mayoral Decree (Mer İxtiyarı)',
      descriptionAz: `${mayor?.username || 'The Mayor'} unveiled their identity, swinging the courtroom verdict with 3x voting power!`, 
      impactLevel: 'GAME_CHANGING',
      involvedPlayerIds: [mayorId],
    });
  }

  // Final Victory Climax
  turningPoints.push({
    round: lobby.roundNumber,
    phase: 'DAY_VOTING',
    titleAz: 'Decisive Victory',
    descriptionAz: `The ${winningFaction} faction outmaneuvered all adversaries to claim total victory!`, 
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
      cause: p.deathCause || 'Shot Dead',
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

  return `🎭 TDV BTL MAFIA — MATCH REPORT (DÖYÜŞ NƏTİCƏSİ)
${factionEmoji} Winning Faction (Qalib Fraksiya): ${winningFaction}
👑 Match MVP: ${mvp.playerName} (${mvp.roleId} — ${mvp.totalScore} Pts)
⏱️ Match Duration: ${totalRounds} Rounds
🔥 Clutch Highlight: ${mvp.clutchHighlights[0] || 'Decisive Victory'}

🎮 Forge your own deception in TDV BTL Mafia:
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
    `🎭 The ${recap.winningFaction} triumphed in TDV BTL MAFIA! MVP: ${recap.mvp.playerName} (${recap.mvp.totalScore} pts)! 🎮\n`
  );
  const url = encodeURIComponent(`https://mafia.tdv.az/lobby/${recap.lobbyId}`);
  return `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
}
