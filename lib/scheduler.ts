/**
 * Algorithme de génération de planning de tournois
 * Utilise la méthode du cercle (Circle Method) pour générer des rounds structurés
 */

import {
  Event,
  Area,
  Group,
  Athlete,
  Match,
  Round,
  ScheduleEntry,
  Schedule,
  ScheduleStats,
  AreaStats,
  AthleteStats,
  Warning,
  AthleteSchedulingState,
  GroupSchedulingState,
  TimeBoxedStats,
  GroupTimeBoxedStats,
} from './types';
import { parseTime, formatTime, combinations, generateId } from './utils';

/**
 * Génère les rounds pour un groupe via Circle Method
 *
 * Pour 4 athlètes [A, B, C, D] :
 * Round 1: (A-B), (C-D)
 * Round 2: (A-C), (D-B)
 * Round 3: (A-D), (B-C)
 *
 * Garantie : chaque athlète combat exactement 1 fois par round
 */
export function generateRoundsForGroup(
  athletes: Athlete[],
  groupId: string,
  cyclesPerGroup: number = 1
): Round[] {
  const rounds: Round[] = [];
  const n = athletes.length;

  if (n < 2) return rounds;

  // Ajouter un "BYE" fictif si nombre impair
  const participants = [...athletes];
  const hasBye = n % 2 === 1;
  if (hasBye) {
    participants.push({
      id: 'BYE',
      name: 'BYE',
      groupId,
    });
  }

  const numRounds = participants.length - 1;
  const halfSize = participants.length / 2;

  // Index circulaire : [0, 1, 2, 3, ...] où 0 reste fixe
  const indexes = participants.map((_, i) => i);

  for (let cycle = 1; cycle <= cyclesPerGroup; cycle++) {
    for (let round = 0; round < numRounds; round++) {
      const roundMatches: Match[] = [];

      for (let i = 0; i < halfSize; i++) {
        const homeIdx = indexes[i];
        const awayIdx = indexes[participants.length - 1 - i];

        const home = participants[homeIdx];
        const away = participants[awayIdx];

        // Ignorer matchs avec BYE
        if (home.id === 'BYE' || away.id === 'BYE') continue;

        roundMatches.push({
          id: generateId(`match_${groupId}_c${cycle}_r${round}`),
          groupId,
          athlete1Id: home.id,
          athlete2Id: away.id,
          cycle,
        });
      }

      rounds.push({
        roundNumber: (cycle - 1) * numRounds + round + 1,
        groupId,
        matches: roundMatches,
      });

      // Rotation circulaire : premier fixe (0), les autres tournent
      indexes.splice(1, 0, indexes.pop()!);
    }
  }

  return rounds;
}

/**
 * Planifie plusieurs groupes sur une même aire
 * en alternant par ROUND (pas par match individuel)
 */
export function scheduleRoundsForMultiGroupArea(
  area: Area,
  groups: Group[],
  fightDuration: number,
  rotationTime: number,
  startTimeSeconds: number,
  cyclesPerGroup: number
): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];

  // Générer tous les rounds par groupe
  const groupRounds = groups.map(group => ({
    groupId: group.id,
    groupName: group.name,
    athletes: group.athletes,
    rounds: generateRoundsForGroup(group.athletes, group.id, cyclesPerGroup),
  }));

  // Trouver le nombre max de rounds parmi tous les groupes
  const maxRounds = Math.max(...groupRounds.map(gr => gr.rounds.length));

  let currentTime = startTimeSeconds;
  let sequenceNumber = 1;

  // Alternance par round
  for (let roundIdx = 0; roundIdx < maxRounds; roundIdx++) {
    for (const gr of groupRounds) {
      if (roundIdx >= gr.rounds.length) continue; // ce groupe a fini

      const round = gr.rounds[roundIdx];

      for (const match of round.matches) {
        const athlete1 = gr.athletes.find(a => a.id === match.athlete1Id)!;
        const athlete2 = gr.athletes.find(a => a.id === match.athlete2Id)!;

        entries.push({
          id: generateId('sch'),
          areaId: area.id,
          groupId: gr.groupId,
          matchId: match.id,
          sequenceNumber: sequenceNumber++,
          scheduledTime: formatTime(currentTime),
          startTimeSeconds: currentTime,
          endTimeSeconds: currentTime + fightDuration,
          athlete1Id: match.athlete1Id,
          athlete2Id: match.athlete2Id,
          athlete1Name: athlete1.name,
          athlete2Name: athlete2.name,
          roundNumber: round.roundNumber,
        });

        currentTime += fightDuration + rotationTime;
      }
    }
  }

  return entries;
}

/**
 * Détecte les violations de repos minimum
 */
export function validateMinRestBetweenFights(
  entries: ScheduleEntry[],
  athletes: Athlete[],
  minRestSeconds: number
): Warning[] {
  const warnings: Warning[] = [];

  if (minRestSeconds <= 0) return warnings; // pas de contrainte

  for (const athlete of athletes) {
    // Tous les matchs de cet athlète, triés par temps
    const athleteMatches = entries
      .filter(e => e.athlete1Id === athlete.id || e.athlete2Id === athlete.id)
      .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

    for (let i = 1; i < athleteMatches.length; i++) {
      const prev = athleteMatches[i - 1];
      const curr = athleteMatches[i];

      // Calcul précis du repos
      const restSeconds = curr.startTimeSeconds - prev.endTimeSeconds;

      if (restSeconds < minRestSeconds) {
        const restMin = Math.floor(restSeconds / 60);
        const restSec = restSeconds % 60;
        const minRestMin = Math.floor(minRestSeconds / 60);

        warnings.push({
          type: 'REST_VIOLATION',
          severity: 'warning',
          message: `${athlete.name} : repos de ${restMin}min ${restSec}s (minimum requis: ${minRestMin}min)`,
          affectedItems: [athlete.id, prev.id, curr.id],
          suggestion: 'Augmenter le temps de rotation ou réorganiser les rounds',
        });
      }
    }
  }

  return warnings;
}

/**
 * Calcule les stats de repos PRÉCISES pour tous les athlètes
 *
 * CORRECTION MAJEURE : rest = next.START - prev.END (pas next.START - prev.START)
 */
export function computeAthleteStats(
  entries: ScheduleEntry[],
  athletes: Athlete[],
  groupsMap: Map<string, Group>,
  minRestBetweenFightsSeconds: number
): AthleteStats[] {
  const stats: AthleteStats[] = [];

  for (const athlete of athletes) {
    const athleteMatches = entries
      .filter(e => e.athlete1Id === athlete.id || e.athlete2Id === athlete.id)
      .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);

    if (athleteMatches.length === 0) continue;

    const restTimes: number[] = [];
    let consecutiveCount = 0;

    for (let i = 1; i < athleteMatches.length; i++) {
      const prev = athleteMatches[i - 1];
      const curr = athleteMatches[i];

      // CORRECTION : rest = début du prochain - fin du précédent
      const restSeconds = curr.startTimeSeconds - prev.endTimeSeconds;
      restTimes.push(restSeconds);

      // Comptage des violations
      if (restSeconds < minRestBetweenFightsSeconds) {
        consecutiveCount++;
      }
    }

    const group = groupsMap.get(athlete.groupId);
    if (!group) continue;

    stats.push({
      athleteId: athlete.id,
      athleteName: athlete.name,
      groupId: athlete.groupId,
      groupName: group.name,
      matchCount: athleteMatches.length,
      minRestSeconds: restTimes.length > 0 ? Math.min(...restTimes) : 0,
      maxRestSeconds: restTimes.length > 0 ? Math.max(...restTimes) : 0,
      avgRestSeconds:
        restTimes.length > 0
          ? restTimes.reduce((a, b) => a + b, 0) / restTimes.length
          : 0,
      totalRestSeconds: restTimes.reduce((a, b) => a + b, 0),
      consecutiveMatchesCount: consecutiveCount,
    });
  }

  return stats;
}

/**
 * Valide que tous les combats rentrent dans le temps imparti
 * NOTE: Cette fonction est conservée pour compatibilité avec l'ancien mode Circle Method
 * Elle n'est plus utilisée en mode TIME_BOXED
 */
export function validateScheduleFeasibility(event: Event): Warning[] {
  const warnings: Warning[] = [];

  const totalTimeAvailable = parseTime(event.endTime) - parseTime(event.startTime);
  // En mode TIME_BOXED, on ne valide plus la faisabilité de cette manière
  // On planifie simplement jusqu'à épuisement du temps disponible

  // Cette fonction reste pour compatibilité mais retourne toujours OK
  return warnings;
}

/**
 * Calcule le nombre maximal de cycles qui rentrent dans le temps disponible
 */
function calculateMaxCycles(
  groups: Group[],
  fightDuration: number,
  rotationTime: number,
  availableTime: number
): number {
  // Calculer le nombre total de matchs par cycle
  let matchesPerCycle = 0;
  for (const group of groups) {
    const n = group.athletes.length;
    matchesPerCycle += combinations(n);
  }

  if (matchesPerCycle === 0) return 1;

  // Calculer le temps nécessaire par cycle
  const timePerCycle = matchesPerCycle * (fightDuration + rotationTime) - rotationTime;

  // Calculer le nombre max de cycles
  const maxCycles = Math.floor(availableTime / timePerCycle);

  return Math.max(1, maxCycles);
}

/**
 * Génère le planning complet pour tout l'événement
 */
export function generateFullSchedule(event: Event): {
  schedule: Schedule;
  warnings: Warning[];
} {
  // 1) Validation préalable
  let warnings = validateScheduleFeasibility(event);

  if (warnings.some(w => w.severity === 'error')) {
    return {
      schedule: {
        eventId: event.id,
        entries: [],
        stats: {
          totalMatches: 0,
          totalDuration: 0,
          areaStats: [],
          athleteStats: [],
        },
        warnings,
      },
      warnings,
    };
  }

  // 2) Génération par aire
  const allEntries: ScheduleEntry[] = [];
  const minRestSeconds = event.minRestBetweenFightsSeconds ?? 0;
  const availableTime = parseTime(event.endTime) - parseTime(event.startTime);

  for (const area of event.areas) {
    // Calculer le nombre max de cycles pour cette aire
    const maxCycles = calculateMaxCycles(
      area.groups,
      event.fightDuration,
      event.rotationTime,
      availableTime
    );

    // NOTE: cyclesPerGroup retiré en mode TIME_BOXED, utiliser maxCycles pour compatibilité
    const cyclesPerGroup = maxCycles;

    // Ajouter un info si on génère plus d'1 cycle
    if (cyclesPerGroup > 1) {
      warnings.push({
        type: 'INFO',
        severity: 'info',
        message: `${area.name} : ${cyclesPerGroup} cycles générés pour utiliser le temps disponible (chaque paire se rencontre ${cyclesPerGroup} fois)`,
        affectedItems: [area.id],
      });
    }

    const areaEntries = scheduleRoundsForMultiGroupArea(
      area,
      area.groups,
      event.fightDuration,
      event.rotationTime,
      parseTime(event.startTime),
      cyclesPerGroup
    );
    allEntries.push(...areaEntries);
  }

  // 3) Calcul des stats
  const allAthletes = event.areas.flatMap(a => a.groups.flatMap(g => g.athletes));
  const groupsMap = new Map<string, Group>();
  event.areas.forEach(a => a.groups.forEach(g => groupsMap.set(g.id, g)));

  const athleteStats = computeAthleteStats(
    allEntries,
    allAthletes,
    groupsMap,
    minRestSeconds
  );

  const areaStats = event.areas.map(area => {
    const areaEntries = allEntries.filter(e => e.areaId === area.id);
    const duration =
      areaEntries.length > 0
        ? areaEntries[areaEntries.length - 1].endTimeSeconds -
          areaEntries[0].startTimeSeconds
        : 0;
    const available = parseTime(event.endTime) - parseTime(event.startTime);

    return {
      areaId: area.id,
      areaName: area.name,
      matchCount: areaEntries.length,
      duration,
      marginOrOverflow: available - duration,
    };
  });

  // 4) Validation du repos minimum
  const restWarnings = validateMinRestBetweenFights(
    allEntries,
    allAthletes,
    minRestSeconds
  );
  warnings = [...warnings, ...restWarnings];

  const schedule: Schedule = {
    eventId: event.id,
    entries: allEntries,
    stats: {
      totalMatches: allEntries.length,
      totalDuration:
        allEntries.length > 0
          ? allEntries[allEntries.length - 1].endTimeSeconds -
            allEntries[0].startTimeSeconds
          : 0,
      areaStats,
      athleteStats,
    },
    warnings,
  };

  return { schedule, warnings };
}

/**
 * ============================================================
 * MODE TIME_BOXED : Algorithme greedy avec maximisation d'équité
 * ============================================================
 */

/**
 * Interface pour une paire candidate à planifier
 */
interface CandidatePair {
  athlete1: Athlete;
  athlete2: Athlete;
  fairnessScore: number;
  isRematch: boolean;
}

/**
 * Trouve la meilleure paire d'athlètes à planifier pour un groupe
 * Critères : privilégier nouveaux adversaires, puis autoriser rematchs, favoriser équité
 */
function findBestPairForGroup(
  group: Group,
  state: GroupSchedulingState,
  currentTime: number,
  minRestSeconds: number
): CandidatePair | null {
  const candidatesNewOpponents: CandidatePair[] = [];
  const candidatesRematches: CandidatePair[] = [];

  // Calculer la moyenne de combats du groupe pour le scoring
  const avgMatchCount =
    group.athletes.length > 0
      ? state.totalMatches / group.athletes.length
      : 0;

  // Générer toutes les paires possibles
  for (let i = 0; i < group.athletes.length; i++) {
    for (let j = i + 1; j < group.athletes.length; j++) {
      const athlete1 = group.athletes[i];
      const athlete2 = group.athletes[j];

      const state1 = state.athleteStates.get(athlete1.id)!;
      const state2 = state.athleteStates.get(athlete2.id)!;

      // Vérifier contrainte de repos
      if (
        state1.availableAt > currentTime ||
        state2.availableAt > currentTime
      ) {
        continue; // Un des athlètes n'est pas encore disponible
      }

      // Vérifier si c'est un rematch
      const isRematch = state1.opponents.has(athlete2.id);

      // Scoring : favoriser les athlètes avec moins de combats
      // Score plus bas = meilleur choix
      const matchCountScore = (state1.matchCount + state2.matchCount) * 10;
      const balancePenalty =
        Math.abs(state1.matchCount - avgMatchCount) +
        Math.abs(state2.matchCount - avgMatchCount);

      const fairnessScore = matchCountScore + balancePenalty;

      const candidate = {
        athlete1,
        athlete2,
        fairnessScore,
        isRematch,
      };

      // Séparer nouveaux adversaires et rematchs
      if (isRematch) {
        candidatesRematches.push(candidate);
      } else {
        candidatesNewOpponents.push(candidate);
      }
    }
  }

  // Prioriser les nouveaux adversaires, sinon utiliser les rematchs
  let selectedCandidates: CandidatePair[];
  if (candidatesNewOpponents.length > 0) {
    selectedCandidates = candidatesNewOpponents;
  } else if (candidatesRematches.length > 0) {
    selectedCandidates = candidatesRematches;
  } else {
    return null; // Aucune paire valide disponible
  }

  // Trier par fairness score (croissant) et retourner le meilleur
  selectedCandidates.sort((a, b) => a.fairnessScore - b.fairnessScore);
  return selectedCandidates[0];
}

/**
 * Sélectionne le prochain groupe à planifier sur une aire multi-groupes
 * Priorité au groupe avec la moyenne de combats/athlète la plus basse
 */
function selectNextGroup(
  groups: Group[],
  groupStates: Map<string, GroupSchedulingState>,
  currentTime: number,
  minRestSeconds: number
): string | null {
  interface GroupMetric {
    groupId: string;
    avgMatchesPerAthlete: number;
    hasValidPairs: boolean;
  }

  const metrics: GroupMetric[] = groups.map(group => {
    const state = groupStates.get(group.id)!;
    const athletes = group.athletes.length;
    const avgMatchesPerAthlete = athletes > 0 ? state.totalMatches / athletes : 0;

    // Vérifier s'il existe au moins une paire valide
    const hasValidPairs =
      findBestPairForGroup(group, state, currentTime, minRestSeconds) !== null;

    return {
      groupId: group.id,
      avgMatchesPerAthlete,
      hasValidPairs,
    };
  });

  // Filtrer les groupes avec au moins une paire valide
  const eligible = metrics.filter(m => m.hasValidPairs);

  if (eligible.length === 0) {
    return null; // Aucun groupe ne peut planifier de combat
  }

  // Sélectionner le groupe avec la moyenne la plus basse
  eligible.sort((a, b) => a.avgMatchesPerAthlete - b.avgMatchesPerAthlete);
  return eligible[0].groupId;
}

/**
 * Planifie les combats pour une aire en mode TIME_BOXED
 * Gère l'alternance multi-groupes et le scheduling greedy
 */
function scheduleTimeBoxedMatchesForArea(
  area: Area,
  groups: Group[],
  fightDuration: number,
  rotationTime: number,
  startTimeSeconds: number,
  endTimeSeconds: number,
  minRestSeconds: number
): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];

  // Initialiser les états de tracking pour chaque groupe
  const groupStates = new Map<string, GroupSchedulingState>();

  for (const group of groups) {
    const athleteStates = new Map<string, AthleteSchedulingState>();

    for (const athlete of group.athletes) {
      athleteStates.set(athlete.id, {
        athleteId: athlete.id,
        matchCount: 0,
        opponents: new Set<string>(),
        lastMatchEndTime: startTimeSeconds,
        availableAt: startTimeSeconds,
      });
    }

    groupStates.set(group.id, {
      groupId: group.id,
      athleteStates,
      totalMatches: 0,
      lastScheduledTime: startTimeSeconds,
    });
  }

  let currentTime = startTimeSeconds;
  let sequenceNumber = 0;

  // Boucle principale : tant qu'il reste du temps
  while (currentTime + fightDuration <= endTimeSeconds) {
    // Sélectionner le groupe prioritaire
    const selectedGroupId = selectNextGroup(
      groups,
      groupStates,
      currentTime,
      minRestSeconds
    );

    if (!selectedGroupId) {
      // Aucun groupe ne peut planifier de combat actuellement
      // Avancer le temps au prochain availableAt le plus proche
      let nextAvailable = endTimeSeconds;

      for (const state of groupStates.values()) {
        for (const athleteState of state.athleteStates.values()) {
          if (
            athleteState.availableAt > currentTime &&
            athleteState.availableAt < nextAvailable
          ) {
            nextAvailable = athleteState.availableAt;
          }
        }
      }

      if (nextAvailable >= endTimeSeconds) {
        break; // Plus de temps disponible
      }

      currentTime = nextAvailable;
      continue;
    }

    const selectedGroup = groups.find(g => g.id === selectedGroupId)!;
    const groupState = groupStates.get(selectedGroupId)!;

    // Trouver la meilleure paire pour ce groupe
    const bestPair = findBestPairForGroup(
      selectedGroup,
      groupState,
      currentTime,
      minRestSeconds
    );

    if (!bestPair) {
      // Théoriquement impossible car selectNextGroup a vérifié
      break;
    }

    // Créer l'entrée de planning
    sequenceNumber++;
    const matchId = generateId(`match_${area.id}_${selectedGroupId}`);

    entries.push({
      id: generateId(`entry_${area.id}`),
      areaId: area.id,
      groupId: selectedGroupId,
      matchId,
      sequenceNumber,
      scheduledTime: formatTime(currentTime),
      startTimeSeconds: currentTime,
      endTimeSeconds: currentTime + fightDuration,
      athlete1Id: bestPair.athlete1.id,
      athlete2Id: bestPair.athlete2.id,
      athlete1Name: bestPair.athlete1.name,
      athlete2Name: bestPair.athlete2.name,
      // roundNumber omis (optionnel en TIME_BOXED)
    });

    // Mettre à jour les états
    const state1 = groupState.athleteStates.get(bestPair.athlete1.id)!;
    const state2 = groupState.athleteStates.get(bestPair.athlete2.id)!;

    const matchEndTime = currentTime + fightDuration;

    state1.matchCount++;
    state1.opponents.add(bestPair.athlete2.id);
    state1.lastMatchEndTime = matchEndTime;
    state1.availableAt = matchEndTime + minRestSeconds;

    state2.matchCount++;
    state2.opponents.add(bestPair.athlete1.id);
    state2.lastMatchEndTime = matchEndTime;
    state2.availableAt = matchEndTime + minRestSeconds;

    groupState.totalMatches++;
    groupState.lastScheduledTime = currentTime;

    // Avancer le temps
    currentTime = matchEndTime + rotationTime;
  }

  return entries;
}

/**
 * Calcule les statistiques d'équité pour le mode TIME_BOXED
 */
function computeTimeBoxedStats(
  entries: ScheduleEntry[],
  event: Event
): TimeBoxedStats {
  // Regrouper les combats par groupe
  const entriesByGroup = new Map<string, ScheduleEntry[]>();
  const groupsMap = new Map<string, Group>();

  for (const area of event.areas) {
    for (const group of area.groups) {
      groupsMap.set(group.id, group);
      entriesByGroup.set(group.id, []);
    }
  }

  for (const entry of entries) {
    const list = entriesByGroup.get(entry.groupId);
    if (list) {
      list.push(entry);
    }
  }

  // Calculer le nombre de rematchs
  const pairMatchCounts = new Map<string, number>();

  for (const entry of entries) {
    // Créer une clé unique pour la paire (ordre alphabétique pour cohérence)
    const pairKey = [entry.athlete1Id, entry.athlete2Id].sort().join('-');
    pairMatchCounts.set(pairKey, (pairMatchCounts.get(pairKey) || 0) + 1);
  }

  // Compter les paires qui se sont affrontées plus d'une fois
  let rematchesCount = 0;
  for (const count of pairMatchCounts.values()) {
    if (count > 1) {
      rematchesCount += count - 1; // nombre de fois où c'était un rematch
    }
  }

  // Calculer les stats par groupe
  const groupStats: GroupTimeBoxedStats[] = [];
  const allMatchCounts: number[] = [];

  for (const [groupId, group] of groupsMap) {
    const groupEntries = entriesByGroup.get(groupId) || [];

    // Compter les combats par athlète dans ce groupe
    const athleteMatchCounts = new Map<string, number>();

    for (const athlete of group.athletes) {
      athleteMatchCounts.set(athlete.id, 0);
    }

    for (const entry of groupEntries) {
      athleteMatchCounts.set(
        entry.athlete1Id,
        (athleteMatchCounts.get(entry.athlete1Id) || 0) + 1
      );
      athleteMatchCounts.set(
        entry.athlete2Id,
        (athleteMatchCounts.get(entry.athlete2Id) || 0) + 1
      );
    }

    const matchCounts = Array.from(athleteMatchCounts.values());
    allMatchCounts.push(...matchCounts);

    const minMatches = matchCounts.length > 0 ? Math.min(...matchCounts) : 0;
    const maxMatches = matchCounts.length > 0 ? Math.max(...matchCounts) : 0;
    const sumMatches = matchCounts.reduce((a, b) => a + b, 0);
    const avgMatches = matchCounts.length > 0 ? sumMatches / matchCounts.length : 0;
    const gap = maxMatches - minMatches;

    const theoreticalMax = combinations(group.athletes.length);
    const completenessPercentage =
      theoreticalMax > 0 ? (groupEntries.length / theoreticalMax) * 100 : 100;

    groupStats.push({
      groupId: group.id,
      groupName: group.name,
      athleteCount: group.athletes.length,
      totalMatches: groupEntries.length,
      theoreticalMax,
      completenessPercentage,
      minMatchesPerAthlete: minMatches,
      maxMatchesPerAthlete: maxMatches,
      avgMatchesPerAthlete: avgMatches,
      matchCountGap: gap,
    });
  }

  // Calculer les métriques globales
  const globalMin = allMatchCounts.length > 0 ? Math.min(...allMatchCounts) : 0;
  const globalMax = allMatchCounts.length > 0 ? Math.max(...allMatchCounts) : 0;
  const globalSum = allMatchCounts.reduce((a, b) => a + b, 0);
  const globalAvg =
    allMatchCounts.length > 0 ? globalSum / allMatchCounts.length : 0;
  const globalGap = globalMax - globalMin;

  // Calculer la complétude globale
  const totalTheoretical = groupStats.reduce((sum, g) => sum + g.theoreticalMax, 0);
  const totalScheduled = entries.length;
  const overallCompletenessPercentage =
    totalTheoretical > 0 ? (totalScheduled / totalTheoretical) * 100 : 100;

  // Calculer l'utilisation du temps
  const timeAvailable = parseTime(event.endTime) - parseTime(event.startTime);
  const timeUsed =
    entries.length > 0
      ? entries[entries.length - 1].endTimeSeconds - entries[0].startTimeSeconds
      : 0;
  const timeUtilizationPercentage =
    timeAvailable > 0 ? (timeUsed / timeAvailable) * 100 : 0;

  return {
    minMatchesPerAthlete: globalMin,
    maxMatchesPerAthlete: globalMax,
    avgMatchesPerAthlete: globalAvg,
    matchCountGap: globalGap,
    groupStats,
    totalMatchesScheduled: totalScheduled,
    totalTheoreticalMatches: totalTheoretical,
    overallCompletenessPercentage,
    rematchesCount,
    timeUsedSeconds: timeUsed,
    timeAvailableSeconds: timeAvailable,
    timeUtilizationPercentage,
  };
}

/**
 * Point d'entrée principal pour le mode TIME_BOXED
 * Remplace generateFullSchedule en mode TIME_BOXED
 */
export function generateTimeBoxedSchedule(event: Event): {
  schedule: Schedule;
  warnings: Warning[];
} {
  const warnings: Warning[] = [];
  const minRestSeconds = event.minRestBetweenFightsSeconds ?? 0;
  const startTimeSeconds = parseTime(event.startTime);
  const endTimeSeconds = parseTime(event.endTime);

  // Vérification de base : temps suffisant pour au moins 1 combat
  if (startTimeSeconds + event.fightDuration > endTimeSeconds) {
    warnings.push({
      type: 'TIME_OVERFLOW',
      severity: 'error',
      message: `Temps insuffisant : impossible de planifier même un seul combat.`,
      affectedItems: [event.id],
      suggestion: `Augmenter la durée de l'événement ou réduire la durée des combats.`,
    });

    return {
      schedule: {
        eventId: event.id,
        entries: [],
        stats: {
          totalMatches: 0,
          totalDuration: 0,
          areaStats: [],
          athleteStats: [],
        },
        warnings,
      },
      warnings,
    };
  }

  // Génération par aire
  const allEntries: ScheduleEntry[] = [];

  for (const area of event.areas) {
    if (area.groups.length === 0) continue;

    // Vérifier qu'il y a au moins un groupe avec au moins 2 athlètes
    const validGroups = area.groups.filter(g => g.athletes.length >= 2);

    if (validGroups.length === 0) {
      warnings.push({
        type: 'INFO',
        severity: 'warning',
        message: `${area.name} : aucun groupe avec au moins 2 athlètes, aucun combat planifié.`,
        affectedItems: [area.id],
      });
      continue;
    }

    const areaEntries = scheduleTimeBoxedMatchesForArea(
      area,
      validGroups,
      event.fightDuration,
      event.rotationTime,
      startTimeSeconds,
      endTimeSeconds,
      minRestSeconds
    );

    allEntries.push(...areaEntries);
  }

  // Calcul des statistiques TIME_BOXED
  const timeBoxedStats = computeTimeBoxedStats(allEntries, event);

  // Calcul des stats d'athlètes (réutilise la fonction existante)
  const allAthletes = event.areas.flatMap(a => a.groups.flatMap(g => g.athletes));
  const groupsMap = new Map<string, Group>();
  event.areas.forEach(a => a.groups.forEach(g => groupsMap.set(g.id, g)));

  const athleteStats = computeAthleteStats(
    allEntries,
    allAthletes,
    groupsMap,
    minRestSeconds
  );

  // Calcul des stats par aire
  const areaStats = event.areas.map(area => {
    const areaEntries = allEntries.filter(e => e.areaId === area.id);
    const duration =
      areaEntries.length > 0
        ? areaEntries[areaEntries.length - 1].endTimeSeconds -
          areaEntries[0].startTimeSeconds
        : 0;
    const available = endTimeSeconds - startTimeSeconds;

    return {
      areaId: area.id,
      areaName: area.name,
      matchCount: areaEntries.length,
      duration,
      marginOrOverflow: available - duration,
    };
  });

  // Validation du repos minimum
  const restWarnings = validateMinRestBetweenFights(
    allEntries,
    allAthletes,
    minRestSeconds
  );
  warnings.push(...restWarnings);

  // Avertissements sur l'équité
  if (timeBoxedStats.matchCountGap > 2) {
    warnings.push({
      type: 'INFO',
      severity: 'warning',
      message: `Équité non optimale : écart de ${timeBoxedStats.matchCountGap} combats entre athlètes (min: ${timeBoxedStats.minMatchesPerAthlete}, max: ${timeBoxedStats.maxMatchesPerAthlete}).`,
      affectedItems: [event.id],
      suggestion: `Augmenter la durée de l'événement ou réduire la taille des groupes pour améliorer l'équité.`,
    });
  }

  // Avertissements sur la complétude
  if (timeBoxedStats.overallCompletenessPercentage < 50) {
    warnings.push({
      type: 'INFO',
      severity: 'warning',
      message: `Complétude faible : seulement ${timeBoxedStats.overallCompletenessPercentage.toFixed(1)}% du planning complet théorique a pu être planifié.`,
      affectedItems: [event.id],
      suggestion: `Augmenter la durée de l'événement pour permettre plus de combats.`,
    });
  }

  const schedule: Schedule = {
    eventId: event.id,
    entries: allEntries,
    stats: {
      totalMatches: allEntries.length,
      totalDuration:
        allEntries.length > 0
          ? allEntries[allEntries.length - 1].endTimeSeconds -
            allEntries[0].startTimeSeconds
          : 0,
      areaStats,
      athleteStats,
      timeBoxedStats, // NOUVEAU : statistiques TIME_BOXED
    },
    warnings,
  };

  return { schedule, warnings };
}
