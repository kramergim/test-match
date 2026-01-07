/**
 * Fonctions utilitaires pour le planning de tournois
 */

/**
 * Parse un horaire "HH:MM" en secondes depuis minuit
 * @example parseTime("09:30") => 34200
 */
export function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) {
    throw new Error(`Invalid time format: ${time}`);
  }
  return h * 3600 + m * 60;
}

/**
 * Formate des secondes en "HH:MM"
 * @example formatTime(34200) => "09:30"
 */
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Formate une durée en secondes en format lisible
 * @example formatDuration(3665) => "1h 1min 5s"
 * @example formatDuration(125) => "2min 5s"
 * @example formatDuration(45) => "45s"
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}min`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);

  return parts.join(' ');
}

/**
 * Formate une durée en minutes:secondes
 * @example formatDurationMinSec(125) => "2:05"
 */
export function formatDurationMinSec(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Génère un ID unique
 */
export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Classe CSS pour les niveaux de sévérité des warnings
 */
export function getWarningSeverityClass(severity: 'error' | 'warning' | 'info'): string {
  switch (severity) {
    case 'error':
      return 'bg-red-50 border-red-500 text-red-900';
    case 'warning':
      return 'bg-yellow-50 border-yellow-500 text-yellow-900';
    case 'info':
      return 'bg-blue-50 border-blue-500 text-blue-900';
  }
}

/**
 * Valide un format d'heure HH:MM
 */
export function isValidTimeFormat(time: string): boolean {
  const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(time);
}

/**
 * Convertit des noms séparés par des sauts de ligne en tableau
 * Filtre les lignes vides et trim
 */
export function parseAthleteNames(input: string): string[] {
  return input
    .split('\n')
    .map(name => name.trim())
    .filter(name => name.length > 0);
}

/**
 * Groupe des éléments par clé
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

/**
 * Calcule le nombre de combinaisons C(n, 2) = n * (n-1) / 2
 */
export function combinations(n: number): number {
  if (n < 2) return 0;
  return (n * (n - 1)) / 2;
}

/**
 * Vérifie si deux arrays ont des éléments en commun
 */
export function hasIntersection<T>(arr1: T[], arr2: T[]): boolean {
  return arr1.some(item => arr2.includes(item));
}

/**
 * Clone profond d'un objet (simple, sans fonctions)
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
