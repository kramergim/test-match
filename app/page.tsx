'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Event, Area, Group, Athlete, EventFormData, AreaFormData, GroupFormData } from '@/lib/types';
import { generateId, parseAthleteNames } from '@/lib/utils';
import { importAthletesFromExcel, generateExcelTemplate } from '@/lib/importExcel';

export default function Home() {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [hasExistingSession, setHasExistingSession] = useState(false);
  const [existingEventName, setExistingEventName] = useState<string>('');
  const [formData, setFormData] = useState<EventFormData>({
    name: '',
    date: new Date().toISOString().split('T')[0],
    fightDurationMinutes: 2,
    fightDurationSeconds: 0,
    rotationTimeSeconds: 60,
    startTime: '09:00',
    endTime: '12:00',
    minRestBetweenFightsMinutes: 2,
    areas: [
      {
        name: 'Area 1',
        groups: [
          {
            name: 'Group A',
            athleteNames: '',
          },
        ],
      },
    ],
  });

  // Check for existing session on mount
  useEffect(() => {
    const eventData = sessionStorage.getItem('event');
    const scheduleData = sessionStorage.getItem('schedule');
    if (eventData && scheduleData) {
      const event = JSON.parse(eventData);
      setHasExistingSession(true);
      setExistingEventName(event.name);
    }
  }, []);

  const addArea = () => {
    setFormData({
      ...formData,
      areas: [
        ...formData.areas,
        {
          name: `Area ${formData.areas.length + 1}`,
          groups: [{ name: 'Group A', athleteNames: '' }],
        },
      ],
    });
  };

  const removeArea = (areaIndex: number) => {
    setFormData({
      ...formData,
      areas: formData.areas.filter((_, i) => i !== areaIndex),
    });
  };

  const addGroup = (areaIndex: number) => {
    const newAreas = [...formData.areas];
    const groupLetter = String.fromCharCode(65 + newAreas[areaIndex].groups.length);
    newAreas[areaIndex].groups.push({
      name: `Group ${groupLetter}`,
      athleteNames: '',
    });
    setFormData({ ...formData, areas: newAreas });
  };

  const removeGroup = (areaIndex: number, groupIndex: number) => {
    const newAreas = [...formData.areas];
    newAreas[areaIndex].groups = newAreas[areaIndex].groups.filter((_, i) => i !== groupIndex);
    setFormData({ ...formData, areas: newAreas });
  };

  const updateArea = (areaIndex: number, field: keyof AreaFormData, value: any) => {
    const newAreas = [...formData.areas];
    newAreas[areaIndex] = { ...newAreas[areaIndex], [field]: value };
    setFormData({ ...formData, areas: newAreas });
  };

  const updateGroup = (areaIndex: number, groupIndex: number, field: keyof GroupFormData, value: any) => {
    const newAreas = [...formData.areas];
    newAreas[areaIndex].groups[groupIndex] = {
      ...newAreas[areaIndex].groups[groupIndex],
      [field]: value,
    };
    setFormData({ ...formData, areas: newAreas });
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset messages
    setImportErrors([]);
    setImportWarnings([]);
    setImportSuccess(null);

    try {
      const result = await importAthletesFromExcel(file);

      if (!result.success) {
        setImportErrors(result.errors);
        setImportWarnings(result.warnings);
        return;
      }

      // Import successful - update form
      setFormData({
        ...formData,
        areas: result.areas,
      });

      setImportSuccess(`Import successful: ${result.areas.length} area(s) and ${result.areas.reduce((sum, a) => sum + a.groups.length, 0)} group(s) imported`);
      setImportWarnings(result.warnings);

    } catch (error) {
      setImportErrors([`Unexpected error: ${error instanceof Error ? error.message : 'unknown error'}`]);
    }

    // Reset input to allow reimporting the same file
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const blob = generateExcelTemplate();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-import-athletes.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Warn if there's an existing session
    if (hasExistingSession) {
      const confirmed = window.confirm(
        `Warning: You have an active session for "${existingEventName}".\n\nCreating a new event will overwrite your current session data.\n\nMake sure you've exported your results (Excel or JSON) before continuing.\n\nDo you want to create a new event?`
      );
      if (!confirmed) return;
    }

    setIsGenerating(true);

    try {
      // Convert form data to Event
      const event: Event = {
        id: generateId('event'),
        name: formData.name,
        date: formData.date,
        fightDuration: formData.fightDurationMinutes * 60 + formData.fightDurationSeconds,
        rotationTime: formData.rotationTimeSeconds,
        startTime: formData.startTime,
        endTime: formData.endTime,
        minRestBetweenFightsSeconds: formData.minRestBetweenFightsMinutes * 60,
        areas: formData.areas.map((areaData, areaIdx) => {
          const areaId = generateId(`area_${areaIdx}`);
          const area: Area = {
            id: areaId,
            name: areaData.name,
            groups: areaData.groups.map((groupData, groupIdx) => {
              const athleteNames = parseAthleteNames(groupData.athleteNames);
              const groupId = generateId(`group_${areaIdx}_${groupIdx}`);
              const group: Group = {
                id: groupId,
                name: groupData.name,
                areaId: areaId,
                athletes: athleteNames.map((name, athleteIdx) => ({
                  id: generateId(`athlete_${areaIdx}_${groupIdx}_${athleteIdx}`),
                  name,
                  groupId: groupId,
                })),
              };
              return group;
            }),
          };
          return area;
        }),
      };

      // Call API
      const response = await fetch('/api/schedule/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        throw new Error('Error during generation');
      }

      const { schedule, warnings } = await response.json();

      // Store in sessionStorage and navigate to results page
      sessionStorage.setItem('event', JSON.stringify(event));
      sessionStorage.setItem('schedule', JSON.stringify(schedule));
      sessionStorage.setItem('warnings', JSON.stringify(warnings));

      router.push('/schedule');
    } catch (error) {
      console.error('Error:', error);
      alert('Error generating schedule');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Existing session banner */}
        {hasExistingSession && (
          <div className="bg-blue-100 border border-blue-300 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔄</span>
              <div>
                <p className="font-semibold text-blue-900">
                  Active Session Detected
                </p>
                <p className="text-sm text-blue-700">
                  Continue working on: <strong>{existingEventName}</strong>
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/schedule')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Continue Session →
            </button>
          </div>
        )}

        <div className="bg-white shadow-sm rounded-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Tournament Schedule Generator
          </h1>
          <p className="text-gray-600 mb-8">
            Automatically create a fair schedule for your competitions
          </p>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Import Excel */}
            <div className="border-b pb-6 bg-blue-50 -mx-6 -mt-6 px-6 pt-6 rounded-t-lg">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <span className="mr-2">📊</span>
                Import Excel
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Import your athletes grouped by area from an Excel file. Each sheet = one area.
              </p>

              <div className="flex flex-wrap gap-3">
                {/* Download template button */}
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <span>📥</span>
                  Download Excel Template
                </button>

                {/* Import button */}
                <label className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-2">
                  <span>📤</span>
                  Import Excel File
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImportExcel}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Success messages */}
              {importSuccess && (
                <div className="mt-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md">
                  <p className="font-semibold">✓ {importSuccess}</p>
                </div>
              )}

              {/* Warnings */}
              {importWarnings.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md">
                  <p className="font-semibold mb-1">⚠ Warnings:</p>
                  <ul className="list-disc list-inside text-sm">
                    {importWarnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Errors */}
              {importErrors.length > 0 && (
                <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
                  <p className="font-semibold mb-1">✗ Errors:</p>
                  <ul className="list-disc list-inside text-sm">
                    {importErrors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 p-3 bg-white border border-gray-200 rounded-md">
                <p className="text-sm text-gray-700 font-semibold mb-1">Expected format:</p>
                <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                  <li>Each Excel sheet = one area (sheet name = area name)</li>
                  <li>Column A: Group name</li>
                  <li>Column B: Athlete name</li>
                  <li>Athletes with the same group name will be grouped together</li>
                </ul>
              </div>
            </div>

            {/* General information */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">General Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Event Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Swiss Taekwondo Test Match"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Timing parameters */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">Timing Parameters</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fight Duration
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="number"
                        min="0"
                        value={formData.fightDurationMinutes}
                        onChange={(e) =>
                          setFormData({ ...formData, fightDurationMinutes: parseInt(e.target.value) || 0 })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="text-xs text-gray-500">minutes</span>
                    </div>
                    <div className="flex-1">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={formData.fightDurationSeconds}
                        onChange={(e) =>
                          setFormData({ ...formData, fightDurationSeconds: parseInt(e.target.value) || 0 })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="text-xs text-gray-500">seconds</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rotation Time (seconds)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.rotationTimeSeconds}
                    onChange={(e) =>
                      setFormData({ ...formData, rotationTimeSeconds: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Advanced parameters */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">Advanced Parameters</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Rest Between Fights (minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minRestBetweenFightsMinutes}
                    onChange={(e) =>
                      setFormData({ ...formData, minRestBetweenFightsMinutes: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Areas and groups */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Areas and Groups</h2>
                <button
                  type="button"
                  onClick={addArea}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  + Add Area
                </button>
              </div>

              {formData.areas.map((area, areaIndex) => (
                <div key={areaIndex} className="mb-6 border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <input
                      type="text"
                      value={area.name}
                      onChange={(e) => updateArea(areaIndex, 'name', e.target.value)}
                      className="text-lg font-medium px-2 py-1 border-b border-gray-300 bg-transparent focus:border-blue-500 outline-none"
                    />
                    {formData.areas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArea(areaIndex)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove Area
                      </button>
                    )}
                  </div>

                  {area.groups.map((group, groupIndex) => (
                    <div key={groupIndex} className="mb-4 bg-white rounded-md p-4">
                      <div className="flex items-center justify-between mb-2">
                        <input
                          type="text"
                          value={group.name}
                          onChange={(e) => updateGroup(areaIndex, groupIndex, 'name', e.target.value)}
                          className="font-medium px-2 py-1 border-b border-gray-300 bg-transparent focus:border-blue-500 outline-none"
                        />
                        {area.groups.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeGroup(areaIndex, groupIndex)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <textarea
                        value={group.athleteNames}
                        onChange={(e) => updateGroup(areaIndex, groupIndex, 'athleteNames', e.target.value)}
                        placeholder="Enter athlete names, one per line&#10;Example:&#10;Sophie Martin&#10;Nadia Dubois&#10;Emma Leroy"
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {parseAthleteNames(group.athleteNames).length} athlete(s)
                      </p>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addGroup(areaIndex)}
                    className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    + Add Group
                  </button>
                </div>
              ))}
            </div>

            {/* Submit button */}
            <div className="flex justify-end pt-6">
              <button
                type="submit"
                disabled={isGenerating}
                className="px-8 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? 'Generating...' : 'Generate Schedule'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
