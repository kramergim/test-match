/**
 * Types pour l'application de planning de tournois
 * Version 2.0 - Avec rounds structurés et stats améliorées
 */

export interface Event {
  id: string;
  name: string;
  date: string; // ISO 8601
  fightDuration: number; // secondes
  rotationTime: number; // secondes
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  areas: Area[];
  minRestBetweenFightsSeconds?: number; // défaut 0 (pas de contrainte)
  createdAt?: string;
  updatedAt?: string;
}

export interface Area {
  id: string;
  name: string;
  groups: Group[];
}

export interface Group {
  id: string;
  name: string;
  areaId: string;
  athletes: Athlete[];
}

export interface Athlete {
  id: string;
  name: string;
  groupId: string;
}

export interface Match {
  id: string;
  groupId: string;
  athlete1Id: string;
  athlete2Id: string;
  cycle: number; // numéro du cycle (1, 2, 3...) si cyclesPerGroup > 1
}

/**
 * Result of a match with scores and winner
 */
export interface MatchResult {
  matchId: string; // References Match.id or ScheduleEntry.matchId
  athlete1Score: number;
  athlete2Score: number;
  winnerId: string | null; // athleteId of the winner, null for draws
  recordedAt: string; // ISO timestamp
}

/**
 * Competition statistics for an athlete
 */
export interface AthleteResult {
  athleteId: string;
  athleteName: string;
  groupId: string;
  groupName: string;
  areaId: string;
  areaName: string;
  matchesPlayed: number;
  matchesScheduled: number;
  wins: number;
  losses: number;
  draws: number;
  totalPointsScored: number;
  totalPointsAgainst: number;
  winPercentage: number; // 0-100
  pointsDifferential: number; // scored - against
  rank?: number; // Within their group
}

/**
 * Rankings within a group
 */
export interface GroupStandings {
  groupId: string;
  groupName: string;
  areaId: string;
  areaName: string;
  athletes: AthleteResult[]; // Sorted by rank
  completionPercentage: number; // % of matches with results
}

/**
 * Complete export package with event, schedule, and results
 */
export interface EventExport {
  version: string; // e.g., "1.0"
  exportedAt: string; // ISO timestamp
  event: Event;
  schedule: Schedule;
  results: MatchResult[]; // Serialized as array (not Map)
}

/**
 * Round représente un ensemble de matchs
 * où chaque athlète combat AU PLUS UNE FOIS
 */
export interface Round {
  roundNumber: number; // 1, 2, 3...
  groupId: string;
  matches: Match[];
}

/**
 * ScheduleEntry avec temps précis et informations enrichies
 */
export interface ScheduleEntry {
  id: string;
  areaId: string;
  groupId: string;
  matchId: string;
  sequenceNumber: number; // numéro global sur l'aire (1, 2, 3...)
  scheduledTime: string; // "HH:MM" (format affichage)
  startTimeSeconds: number; // secondes depuis minuit
  endTimeSeconds: number; // startTimeSeconds + fightDuration
  athlete1Id: string;
  athlete2Id: string;
  athlete1Name: string; // conservé pour affichage
  athlete2Name: string;
  roundNumber?: number; // numéro du round dans le groupe (optionnel pour TIME_BOXED)
  result?: MatchResult; // Optional: attached result if available
}

export interface Schedule {
  eventId: string;
  entries: ScheduleEntry[];
  stats: ScheduleStats;
  warnings: Warning[];
}

export interface ScheduleStats {
  totalMatches: number;
  totalDuration: number; // secondes
  areaStats: AreaStats[];
  athleteStats: AthleteStats[];
  timeBoxedStats?: TimeBoxedStats; // statistiques spécifiques au mode TIME_BOXED
}

export interface AreaStats {
  areaId: string;
  areaName: string;
  matchCount: number;
  duration: number; // secondes
  marginOrOverflow: number; // secondes (positif = OK, négatif = débordement)
}

/**
 * AthleteStats basé sur IDs + calcul précis du repos
 */
export interface AthleteStats {
  athleteId: string;
  athleteName: string;
  groupId: string;
  groupName: string;
  matchCount: number;
  minRestSeconds: number; // rest = next.start - prev.end
  maxRestSeconds: number;
  avgRestSeconds: number;
  totalRestSeconds: number;
  consecutiveMatchesCount: number; // nombre de fois où rest < minRestBetweenFights
}

export interface Warning {
  type: 'TIME_OVERFLOW' | 'REST_VIOLATION' | 'CONSECUTIVE_MATCHES' | 'INFO';
  severity: 'error' | 'warning' | 'info';
  message: string;
  affectedItems: string[]; // IDs des aires/athlètes/matchs
  suggestion?: string;
}

/**
 * État de tracking d'un athlète pendant la planification TIME_BOXED
 */
export interface AthleteSchedulingState {
  athleteId: string;
  matchCount: number;
  opponents: Set<string>; // IDs des adversaires déjà affrontés
  lastMatchEndTime: number; // secondes depuis minuit
  availableAt: number; // prochaine disponibilité (lastMatchEndTime + minRest)
}

/**
 * État de tracking d'un groupe pendant la planification TIME_BOXED
 */
export interface GroupSchedulingState {
  groupId: string;
  athleteStates: Map<string, AthleteSchedulingState>;
  totalMatches: number;
  lastScheduledTime: number;
}

/**
 * Statistiques d'équité pour un groupe en mode TIME_BOXED
 */
export interface GroupTimeBoxedStats {
  groupId: string;
  groupName: string;
  athleteCount: number;
  totalMatches: number;
  theoreticalMax: number; // C(n,2)
  completenessPercentage: number;
  minMatchesPerAthlete: number;
  maxMatchesPerAthlete: number;
  avgMatchesPerAthlete: number;
  matchCountGap: number; // max - min
}

/**
 * Statistiques globales pour le mode TIME_BOXED
 */
export interface TimeBoxedStats {
  // Équité globale
  minMatchesPerAthlete: number;
  maxMatchesPerAthlete: number;
  avgMatchesPerAthlete: number;
  matchCountGap: number; // max - min

  // Par groupe
  groupStats: GroupTimeBoxedStats[];

  // Complétude globale
  totalMatchesScheduled: number;
  totalTheoreticalMatches: number;
  overallCompletenessPercentage: number;
  rematchesCount: number; // nombre de rematchs utilisés (paires qui se sont affrontées plus d'une fois)

  // Utilisation du temps
  timeUsedSeconds: number;
  timeAvailableSeconds: number;
  timeUtilizationPercentage: number;
}

/**
 * Types pour les formulaires (input de l'utilisateur)
 */
export interface EventFormData {
  name: string;
  date: string;
  fightDurationMinutes: number;
  fightDurationSeconds: number;
  rotationTimeSeconds: number;
  startTime: string;
  endTime: string;
  minRestBetweenFightsMinutes: number;
  areas: AreaFormData[];
}

export interface AreaFormData {
  name: string;
  groups: GroupFormData[];
}

export interface GroupFormData {
  name: string;
  athleteNames: string; // noms séparés par des sauts de ligne
}
