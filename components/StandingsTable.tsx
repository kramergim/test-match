/**
 * Table component to display group standings and rankings
 */

import { GroupStandings } from '@/lib/types';

interface StandingsTableProps {
  standing: GroupStandings;
}

export default function StandingsTable({ standing }: StandingsTableProps) {
  const getMedalEmoji = (rank?: number): string => {
    if (!rank) return '';
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return '';
    }
  };

  return (
    <div className="mb-6 last:mb-0">
      {/* Group header */}
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-gray-900">
          {standing.areaName} - {standing.groupName}
        </h3>
        <p className="text-sm text-gray-600">
          {standing.completionPercentage.toFixed(0)}% of matches completed
        </p>
      </div>

      {/* Standings table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold">
                Rank
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold">
                Athlete
              </th>
              <th className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold">
                Fights
              </th>
              <th className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold">
                W-D-L
              </th>
              <th className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold">
                Win %
              </th>
              <th className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold">
                Points
              </th>
              <th className="border border-gray-300 px-3 py-2 text-center text-sm font-semibold">
                +/-
              </th>
            </tr>
          </thead>
          <tbody>
            {standing.athletes.map((athlete) => (
              <tr
                key={athlete.athleteId}
                className={
                  athlete.rank && athlete.rank <= 3
                    ? 'bg-yellow-50'
                    : 'hover:bg-gray-50'
                }
              >
                <td className="border border-gray-300 px-3 py-2 text-center">
                  <span className="font-medium">
                    {getMedalEmoji(athlete.rank)} {athlete.rank}
                  </span>
                </td>
                <td className="border border-gray-300 px-3 py-2 font-medium">
                  {athlete.athleteName}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-center text-sm">
                  {athlete.matchesPlayed}/{athlete.matchesScheduled}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-center text-sm font-medium">
                  {athlete.wins}-{athlete.draws}-{athlete.losses}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-center text-sm">
                  {athlete.winPercentage.toFixed(0)}%
                </td>
                <td className="border border-gray-300 px-3 py-2 text-center text-sm">
                  {athlete.totalPointsScored}-{athlete.totalPointsAgainst}
                </td>
                <td
                  className={`border border-gray-300 px-3 py-2 text-center text-sm font-medium ${
                    athlete.pointsDifferential > 0
                      ? 'text-green-700'
                      : athlete.pointsDifferential < 0
                      ? 'text-red-700'
                      : 'text-gray-700'
                  }`}
                >
                  {athlete.pointsDifferential > 0 ? '+' : ''}
                  {athlete.pointsDifferential}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend for those without results yet */}
      {standing.athletes.some((a) => a.matchesPlayed === 0) && (
        <p className="text-xs text-gray-500 mt-2">
          * Athletes with 0 fights played have no results entered yet
        </p>
      )}
    </div>
  );
}
