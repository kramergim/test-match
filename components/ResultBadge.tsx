/**
 * Badge component to display match result inline
 */

import { MatchResult } from '@/lib/types';

interface ResultBadgeProps {
  result: MatchResult;
}

export default function ResultBadge({ result }: ResultBadgeProps) {
  return (
    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
      {result.athlete1Score}-{result.athlete2Score}
    </span>
  );
}
