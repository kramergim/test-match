/**
 * Utility functions for calculating match results and statistics
 */

import {
  Event,
  Schedule,
  MatchResult,
  AthleteResult,
  GroupStandings,
} from './types';

/**
 * Calculate competition statistics for all athletes
 */
export function calculateAthleteResults(
  event: Event,
  schedule: Schedule,
  results: Map<string, MatchResult>
): AthleteResult[] {
  const athleteMap = new Map<string, AthleteResult>();

  // Initialize all athletes
  for (const area of event.areas) {
    for (const group of area.groups) {
      for (const athlete of group.athletes) {
        athleteMap.set(athlete.id, {
          athleteId: athlete.id,
          athleteName: athlete.name,
          groupId: group.id,
          groupName: group.name,
          areaId: area.id,
          areaName: area.name,
          matchesPlayed: 0,
          matchesScheduled: 0,
          wins: 0,
          losses: 0,
          totalPointsScored: 0,
          totalPointsAgainst: 0,
          winPercentage: 0,
          pointsDifferential: 0,
        });
      }
    }
  }

  // Count scheduled matches
  for (const entry of schedule.entries) {
    const athlete1 = athleteMap.get(entry.athlete1Id);
    const athlete2 = athleteMap.get(entry.athlete2Id);

    if (athlete1) athlete1.matchesScheduled++;
    if (athlete2) athlete2.matchesScheduled++;
  }

  // Process results
  for (const entry of schedule.entries) {
    const result = results.get(entry.matchId);
    if (!result) continue;

    const athlete1 = athleteMap.get(entry.athlete1Id);
    const athlete2 = athleteMap.get(entry.athlete2Id);

    if (athlete1 && athlete2) {
      // Update athlete1
      athlete1.matchesPlayed++;
      athlete1.totalPointsScored += result.athlete1Score;
      athlete1.totalPointsAgainst += result.athlete2Score;
      if (result.winnerId === athlete1.athleteId) {
        athlete1.wins++;
      } else {
        athlete1.losses++;
      }

      // Update athlete2
      athlete2.matchesPlayed++;
      athlete2.totalPointsScored += result.athlete2Score;
      athlete2.totalPointsAgainst += result.athlete1Score;
      if (result.winnerId === athlete2.athleteId) {
        athlete2.wins++;
      } else {
        athlete2.losses++;
      }
    }
  }

  // Calculate derived metrics
  const athleteResults: AthleteResult[] = [];
  for (const athlete of athleteMap.values()) {
    athlete.winPercentage =
      athlete.matchesPlayed > 0 ? (athlete.wins / athlete.matchesPlayed) * 100 : 0;
    athlete.pointsDifferential = athlete.totalPointsScored - athlete.totalPointsAgainst;
    athleteResults.push(athlete);
  }

  return athleteResults;
}

/**
 * Calculate rankings within each group
 */
export function calculateGroupStandings(
  event: Event,
  schedule: Schedule,
  results: Map<string, MatchResult>
): GroupStandings[] {
  const athleteResults = calculateAthleteResults(event, schedule, results);
  const standingsList: GroupStandings[] = [];

  // Group athletes by groupId
  const athletesByGroup = new Map<string, AthleteResult[]>();
  for (const athlete of athleteResults) {
    if (!athletesByGroup.has(athlete.groupId)) {
      athletesByGroup.set(athlete.groupId, []);
    }
    athletesByGroup.get(athlete.groupId)!.push(athlete);
  }

  // Create standings for each group
  for (const [groupId, athletes] of athletesByGroup.entries()) {
    if (athletes.length === 0) continue;

    // Sort by: wins (desc), win% (desc), points differential (desc)
    const sorted = athletes.sort((a, b) => {
      if (a.wins !== b.wins) return b.wins - a.wins;
      if (a.winPercentage !== b.winPercentage) return b.winPercentage - a.winPercentage;
      return b.pointsDifferential - a.pointsDifferential;
    });

    // Assign ranks
    sorted.forEach((athlete, index) => {
      athlete.rank = index + 1;
    });

    // Calculate completion percentage
    const totalMatches = schedule.entries.filter((e) => e.groupId === groupId).length;
    const matchesWithResults = Array.from(results.values()).filter((r) =>
      schedule.entries.find((e) => e.matchId === r.matchId)?.groupId === groupId
    ).length;
    const completionPercentage =
      totalMatches > 0 ? (matchesWithResults / totalMatches) * 100 : 0;

    standingsList.push({
      groupId,
      groupName: sorted[0].groupName,
      areaId: sorted[0].areaId,
      areaName: sorted[0].areaName,
      athletes: sorted,
      completionPercentage,
    });
  }

  return standingsList;
}
