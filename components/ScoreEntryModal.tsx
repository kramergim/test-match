/**
 * Modal component for entering match scores
 */

'use client';

import { useState, useEffect } from 'react';
import { MatchResult, ScheduleEntry } from '@/lib/types';

interface ScoreEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleEntry: ScheduleEntry;
  existingResult?: MatchResult;
  onSave: (result: MatchResult) => void;
}

export default function ScoreEntryModal({
  isOpen,
  onClose,
  scheduleEntry,
  existingResult,
  onSave,
}: ScoreEntryModalProps) {
  const [athlete1Score, setAthlete1Score] = useState<string>('');
  const [athlete2Score, setAthlete2Score] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);

  // Initialize scores if editing existing result
  useEffect(() => {
    if (existingResult) {
      setAthlete1Score(existingResult.athlete1Score.toString());
      setAthlete2Score(existingResult.athlete2Score.toString());
    } else {
      setAthlete1Score('');
      setAthlete2Score('');
    }
    setErrors([]);
  }, [existingResult, scheduleEntry]);

  // Validate scores
  const validateScores = (score1: string, score2: string): string[] => {
    const errors: string[] = [];
    const num1 = parseFloat(score1);
    const num2 = parseFloat(score2);

    if (score1 === '' || score2 === '') {
      errors.push('Both scores are required');
      return errors;
    }

    if (isNaN(num1) || isNaN(num2)) {
      errors.push('Scores must be valid numbers');
      return errors;
    }

    if (num1 < 0 || num2 < 0) {
      errors.push('Scores must be 0 or greater');
    }

    if (!Number.isInteger(num1) || !Number.isInteger(num2)) {
      errors.push('Scores must be whole numbers');
    }

    return errors;
  };

  // Handle input change with validation
  const handleScoreChange = (
    athlete: 'athlete1' | 'athlete2',
    value: string
  ) => {
    if (athlete === 'athlete1') {
      setAthlete1Score(value);
      setErrors(validateScores(value, athlete2Score));
    } else {
      setAthlete2Score(value);
      setErrors(validateScores(athlete1Score, value));
    }
  };

  // Handle save
  const handleSave = () => {
    const validationErrors = validateScores(athlete1Score, athlete2Score);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    const num1 = parseInt(athlete1Score);
    const num2 = parseInt(athlete2Score);
    const winnerId = num1 > num2 ? scheduleEntry.athlete1Id : num1 < num2 ? scheduleEntry.athlete2Id : null;

    const result: MatchResult = {
      matchId: scheduleEntry.matchId,
      athlete1Score: num1,
      athlete2Score: num2,
      winnerId,
      recordedAt: new Date().toISOString(),
    };

    onSave(result);
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isValid = errors.length === 0 && athlete1Score !== '' && athlete2Score !== '';
  const num1 = parseFloat(athlete1Score);
  const num2 = parseFloat(athlete2Score);
  const showWinner = !isNaN(num1) && !isNaN(num2) && num1 !== num2;
  const isDraw = !isNaN(num1) && !isNaN(num2) && num1 === num2;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {existingResult ? 'Edit Match Result' : 'Enter Match Result'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {scheduleEntry.scheduledTime} - Match #{scheduleEntry.sequenceNumber}
            </p>
          </div>

          {/* Score inputs */}
          <div className="space-y-4">
            {/* Athlete 1 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {scheduleEntry.athlete1Name}
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={athlete1Score}
                onChange={(e) => handleScoreChange('athlete1', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                placeholder="Score"
                autoFocus
              />
            </div>

            {/* Athlete 2 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {scheduleEntry.athlete2Name}
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={athlete2Score}
                onChange={(e) => handleScoreChange('athlete2', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                placeholder="Score"
              />
            </div>
          </div>

          {/* Winner/Draw indicator */}
          {showWinner && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm font-medium text-green-800">
                Winner:{' '}
                {num1 > num2
                  ? scheduleEntry.athlete1Name
                  : scheduleEntry.athlete2Name}
              </p>
            </div>
          )}
          {isDraw && (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-300 rounded-md">
              <p className="text-sm font-medium text-gray-700">
                Draw - Both athletes tied
              </p>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <ul className="text-sm text-red-700 space-y-1">
                {errors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Buttons */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSave}
              disabled={!isValid}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300 font-medium"
            >
              Save Result
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
