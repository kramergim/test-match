'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Event, Schedule, Warning, ScheduleEntry, MatchResult, GroupStandings } from '@/lib/types';
import { groupBy, formatDuration, getWarningSeverityClass } from '@/lib/utils';
import { exportToPDF, exportToCSV, exportToJSON, downloadJSON, importFromJSON, exportToExcel, downloadExcel } from '@/lib/export';
import { calculateGroupStandings } from '@/lib/results';
import ScoreEntryModal from '@/components/ScoreEntryModal';
import ResultBadge from '@/components/ResultBadge';
import StandingsTable from '@/components/StandingsTable';

export default function SchedulePage() {
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [results, setResults] = useState<Map<string, MatchResult>>(new Map());
  const [selectedMatch, setSelectedMatch] = useState<ScheduleEntry | null>(null);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [groupStandings, setGroupStandings] = useState<GroupStandings[]>([]);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Filters and navigation
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Charger les données depuis sessionStorage
    const eventData = sessionStorage.getItem('event');
    const scheduleData = sessionStorage.getItem('schedule');
    const warningsData = sessionStorage.getItem('warnings');
    const resultsData = sessionStorage.getItem('results');

    if (!eventData || !scheduleData) {
      router.push('/');
      return;
    }

    const parsedEvent = JSON.parse(eventData);
    const parsedSchedule = JSON.parse(scheduleData);

    setEvent(parsedEvent);
    setSchedule(parsedSchedule);
    setWarnings(warningsData ? JSON.parse(warningsData) : []);

    // Set default selected area to first area
    if (parsedEvent.areas.length > 0) {
      setSelectedAreaId(parsedEvent.areas[0].id);
      // Select all groups by default
      const allGroupIds = new Set<string>();
      parsedEvent.areas.forEach((area: any) => {
        area.groups.forEach((group: any) => {
          allGroupIds.add(group.id);
        });
      });
      setSelectedGroupIds(allGroupIds);
    }

    // Load results if available
    if (resultsData) {
      const resultsArray: MatchResult[] = JSON.parse(resultsData);
      const resultsMap = new Map(resultsArray.map((r) => [r.matchId, r]));
      setResults(resultsMap);
    }
  }, [router]);

  // Save results and recalculate statistics when results change
  useEffect(() => {
    if (results.size > 0) {
      const resultsArray = Array.from(results.values());
      sessionStorage.setItem('results', JSON.stringify(resultsArray));

      // Recalculate statistics when results change
      if (event && schedule) {
        const standings = calculateGroupStandings(event, schedule, results);
        setGroupStandings(standings);
      }
    } else if (event && schedule) {
      // Even with no results, calculate standings to show 0-0 records
      const standings = calculateGroupStandings(event, schedule, results);
      setGroupStandings(standings);
    }
  }, [results, event, schedule]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsGroupDropdownOpen(false);
      }
    };

    if (isGroupDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isGroupDropdownOpen]);

  // Auto-save every 10 minutes
  useEffect(() => {
    if (!event || !schedule) return;

    const autoSave = () => {
      setAutoSaveStatus('saving');
      const workbook = exportToExcel(schedule, event, results, groupStandings);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      downloadExcel(workbook, `${event.name.replace(/\s+/g, '_')}_autosave_${timestamp}.xlsx`);
      setLastAutoSave(new Date());
      setAutoSaveStatus('saved');

      // Reset status after 3 seconds
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
    };

    // Auto-save every 10 minutes (600000 ms)
    const intervalId = setInterval(autoSave, 600000);

    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, [event, schedule, results, groupStandings]);

  // Warn before leaving page if there are unsaved results
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (results.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [results]);

  const handleExportPDF = () => {
    if (!schedule || !event) return;
    const doc = exportToPDF(schedule, event);
    doc.save(`${event.name.replace(/\s+/g, '_')}_planning.pdf`);
  };

  const handleExportCSV = () => {
    if (!schedule || !event) return;
    const csv = exportToCSV(schedule, event);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${event.name.replace(/\s+/g, '_')}_planning.csv`;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBackClick = () => {
    if (results.size > 0) {
      const confirmed = window.confirm(
        'You have entered match results. Going back to the home page will keep your data in this browser session, but creating a new event will overwrite it.\n\nMake sure to export your results (Excel or JSON) before creating a new event.\n\nDo you want to continue?'
      );
      if (!confirmed) return;
    }
    router.push('/');
  };

  const handleMatchClick = (entry: ScheduleEntry) => {
    setSelectedMatch(entry);
    setIsScoreModalOpen(true);
  };

  const handleSaveResult = (result: MatchResult) => {
    setResults(new Map(results.set(result.matchId, result)));
    setIsScoreModalOpen(false);
  };

  const handleExportJSON = () => {
    if (!schedule || !event) return;
    const json = exportToJSON(schedule, event, results);
    downloadJSON(json, `${event.name.replace(/\s+/g, '_')}_with_results.json`);
  };

  const handleExportExcel = () => {
    if (!schedule || !event) return;
    const workbook = exportToExcel(schedule, event, results, groupStandings);
    downloadExcel(workbook, `${event.name.replace(/\s+/g, '_')}_with_results.xlsx`);
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const content = await file.text();
    const result = importFromJSON(content);

    if (!result.success) {
      alert(`Import failed: ${result.error}`);
      return;
    }

    const { event: importedEvent, schedule: importedSchedule, results: importedResults } = result.data!;
    setEvent(importedEvent);
    setSchedule(importedSchedule);
    setResults(new Map(importedResults.map((r) => [r.matchId, r])));

    // Save to sessionStorage
    sessionStorage.setItem('event', JSON.stringify(importedEvent));
    sessionStorage.setItem('schedule', JSON.stringify(importedSchedule));
    sessionStorage.setItem('results', JSON.stringify(importedResults));

    alert('Import successful!');
  };

  const printAreaSheet = (area: Event['areas'][0], entries: ScheduleEntry[]) => {
    if (!event) return;

    // Créer une nouvelle fenêtre pour l'impression
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Grouper par groupe pour afficher les catégories
    const entriesByGroup = groupBy(entries, 'groupId');

    // Générer le HTML de la fiche de suivi
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Fiche de suivi - ${area.name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      max-width: 210mm;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 15px;
    }
    .header h1 {
      font-size: 24px;
      color: #1e40af;
      margin-bottom: 5px;
    }
    .header .event-name {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 3px;
    }
    .header .date {
      font-size: 12px;
      color: #94a3b8;
    }
    .summary {
      display: flex;
      justify-content: space-around;
      margin-bottom: 20px;
      padding: 10px;
      background: #f1f5f9;
      border-radius: 8px;
    }
    .summary-item {
      text-align: center;
    }
    .summary-item .label {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
    }
    .summary-item .value {
      font-size: 18px;
      font-weight: bold;
      color: #1e293b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    thead {
      background: #2563eb;
      color: white;
    }
    th {
      padding: 10px 8px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
    }
    th.num { width: 50px; text-align: center; }
    th.time { width: 70px; }
    th.category { width: 150px; }
    td {
      padding: 8px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
    }
    td.num {
      text-align: center;
      font-weight: bold;
      color: #2563eb;
    }
    td.time {
      font-family: 'Courier New', monospace;
      font-weight: 600;
    }
    td.category {
      color: #64748b;
      font-size: 10px;
    }
    tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    tbody tr:hover {
      background: #e0f2fe;
    }
    .checkbox {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid #94a3b8;
      border-radius: 3px;
      vertical-align: middle;
      position: relative;
    }
    .checkbox.completed {
      background-color: #22c55e;
      border-color: #16a34a;
    }
    .checkbox.completed::after {
      content: '✓';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-weight: bold;
      font-size: 12px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 2px solid #e2e8f0;
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
    }
    @media print {
      body { padding: 10mm; }
      .summary { break-inside: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📍 TRACKING SHEET - ${area.name}</h1>
    <div class="event-name">${event.name}</div>
    <div class="date">${event.date}</div>
  </div>

  <div class="summary">
    <div class="summary-item">
      <div class="label">Fights</div>
      <div class="value">${entries.length}</div>
    </div>
    <div class="summary-item">
      <div class="label">Groups</div>
      <div class="value">${Object.keys(entriesByGroup).length}</div>
    </div>
    <div class="summary-item">
      <div class="label">Start</div>
      <div class="value">${entries[0]?.scheduledTime || '-'}</div>
    </div>
    <div class="summary-item">
      <div class="label">End</div>
      <div class="value">${entries[entries.length - 1]?.scheduledTime || '-'}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="num">#</th>
        <th class="time">Time</th>
        <th class="category">Category</th>
        <th>Fight</th>
        <th style="width: 40px; text-align: center;">✓</th>
      </tr>
    </thead>
    <tbody>
      ${entries.map(entry => {
        const group = area.groups.find(g => g.id === entry.groupId);
        const result = results.get(entry.matchId);
        const hasResult = !!result;

        let athlete1Display = entry.athlete1Name;
        let athlete2Display = entry.athlete2Name;

        if (result) {
          if (result.winnerId === entry.athlete1Id) {
            athlete1Display = `<strong style="background-color: #22c55e; color: white; padding: 2px 6px; border-radius: 4px;">🏆 ${entry.athlete1Name}</strong>`;
            athlete2Display = entry.athlete2Name;
          } else if (result.winnerId === entry.athlete2Id) {
            athlete1Display = entry.athlete1Name;
            athlete2Display = `<strong style="background-color: #22c55e; color: white; padding: 2px 6px; border-radius: 4px;">🏆 ${entry.athlete2Name}</strong>`;
          } else {
            // Draw
            athlete1Display = `<strong>${entry.athlete1Name}</strong>`;
            athlete2Display = `<strong>${entry.athlete2Name}</strong>`;
          }
        } else {
          athlete1Display = `<strong>${entry.athlete1Name}</strong>`;
          athlete2Display = `<strong>${entry.athlete2Name}</strong>`;
        }

        return `
          <tr>
            <td class="num">${entry.sequenceNumber}</td>
            <td class="time">${entry.scheduledTime}</td>
            <td class="category">${group?.name || ''}</td>
            <td>${athlete1Display} vs ${athlete2Display}</td>
            <td style="text-align: center;"><span class="checkbox ${hasResult ? 'completed' : ''}"></span></td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <div class="footer">
    Generated on ${new Date().toLocaleDateString('en-US')} at ${new Date().toLocaleTimeString('en-US')}
  </div>

  <script>
    // Automatically print on load
    window.onload = () => {
      window.print();
    };
  </script>
</body>
</html>
    `;

    // Écrire le HTML dans la nouvelle fenêtre
    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (!event || !schedule) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Filter helpers
  const toggleGroupFilter = (groupId: string) => {
    const newSelected = new Set(selectedGroupIds);
    if (newSelected.has(groupId)) {
      newSelected.delete(groupId);
    } else {
      newSelected.add(groupId);
    }
    setSelectedGroupIds(newSelected);
  };

  const toggleAllGroups = (areaId: string) => {
    const area = event.areas.find(a => a.id === areaId);
    if (!area) return;

    const areaGroupIds = area.groups.map(g => g.id);
    const allSelected = areaGroupIds.every(id => selectedGroupIds.has(id));

    const newSelected = new Set(selectedGroupIds);
    if (allSelected) {
      // Deselect all groups in this area
      areaGroupIds.forEach(id => newSelected.delete(id));
    } else {
      // Select all groups in this area
      areaGroupIds.forEach(id => newSelected.add(id));
    }
    setSelectedGroupIds(newSelected);
  };

  const entriesByArea = groupBy(schedule.entries, 'areaId');
  const selectedArea = event.areas.find(a => a.id === selectedAreaId);

  // Filter entries by selected area, groups, and search query
  const filteredEntries = selectedArea && selectedAreaId
    ? (entriesByArea[selectedAreaId] || []).filter(entry => {
        // Filter by group
        if (!selectedGroupIds.has(entry.groupId)) return false;

        // Filter by search query
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          return (
            entry.athlete1Name.toLowerCase().includes(query) ||
            entry.athlete2Name.toLowerCase().includes(query)
          );
        }

        return true;
      })
    : [];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header avec actions */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6 no-print">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{event.name}</h1>
              <p className="text-gray-600">{event.date}</p>
              {/* Auto-save indicator */}
              <div className="mt-2 flex items-center gap-2 text-sm">
                {autoSaveStatus === 'saving' && (
                  <span className="text-blue-600 flex items-center gap-1">
                    <span className="animate-pulse">💾</span> Saving backup...
                  </span>
                )}
                {autoSaveStatus === 'saved' && (
                  <span className="text-green-600 flex items-center gap-1">
                    ✓ Auto-saved
                  </span>
                )}
                {autoSaveStatus === 'idle' && lastAutoSave && (
                  <span className="text-gray-500">
                    Last backup: {lastAutoSave.toLocaleTimeString()}
                  </span>
                )}
                {autoSaveStatus === 'idle' && !lastAutoSave && (
                  <span className="text-gray-500">
                    Auto-save every 10 minutes
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleBackClick}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              ← Back
            </button>
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="mb-4 space-y-2">
              {warnings.map((warning, idx) => (
                <div
                  key={idx}
                  className={`p-3 border-l-4 rounded ${getWarningSeverityClass(warning.severity)}`}
                >
                  <p className="font-medium">{warning.message}</p>
                  {warning.suggestion && (
                    <p className="text-sm mt-1 whitespace-pre-line">{warning.suggestion}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Export buttons */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              📄 Export PDF
            </button>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              📊 Export CSV
            </button>
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors font-medium"
            >
              📗 Export Excel (with Results)
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              🖨️ Print
            </button>
          </div>
        </div>

        {/* Print header */}
        <div className="print-only mb-8 text-center">
          <h1 className="text-3xl font-bold">{event.name}</h1>
          <p className="text-gray-600">{event.date}</p>
        </div>

        {/* Area Tabs Navigation */}
        <div className="bg-white shadow-sm rounded-lg mb-6 no-print">
          <div className="border-b border-gray-200">
            <nav className="flex overflow-x-auto">
              {event.areas.map((area) => (
                <button
                  key={area.id}
                  onClick={() => setSelectedAreaId(area.id)}
                  className={`px-6 py-4 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                    selectedAreaId === area.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  📍 {area.name}
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-100">
                    {entriesByArea[area.id]?.length || 0}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {/* Group Filters & Search */}
          {selectedArea && (
            <div className="p-4 border-b border-gray-200">
              {/* Search Bar */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="🔍 Search athletes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Group Filters */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <span className="text-blue-600">🎯</span>
                    Filter by Group
                  </label>
                  <button
                    onClick={() => toggleAllGroups(selectedAreaId!)}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
                  >
                    {selectedArea.groups.every(g => selectedGroupIds.has(g.id)) ? '✓ Deselect All' : 'Select All'}
                  </button>
                </div>

                {/* Custom Dropdown with Checkboxes */}
                <div ref={dropdownRef} className="relative mb-3">
                  <button
                    type="button"
                    onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)}
                    className="w-full px-4 py-3 text-left bg-white border-2 border-gray-300 rounded-lg hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors flex items-center justify-between"
                  >
                    <span className="text-sm text-gray-700">
                      {selectedGroupIds.size === 0 && 'Select groups...'}
                      {selectedGroupIds.size === selectedArea.groups.length && 'All groups selected'}
                      {selectedGroupIds.size > 0 && selectedGroupIds.size < selectedArea.groups.length && (
                        <span>
                          {selectedGroupIds.size} group{selectedGroupIds.size !== 1 ? 's' : ''} selected
                        </span>
                      )}
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${isGroupDropdownOpen ? 'transform rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Panel */}
                  {isGroupDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                      {selectedArea.groups.map((group) => {
                        const groupEntriesCount = (entriesByArea[selectedAreaId!] || []).filter(e => e.groupId === group.id).length;
                        const isSelected = selectedGroupIds.has(group.id);
                        return (
                          <label
                            key={group.id}
                            className="flex items-center px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleGroupFilter(group.id)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="ml-3 text-sm flex-1">
                              <span className={`${isSelected ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                                {group.name}
                              </span>
                              <span className="text-gray-500 ml-2">
                                ({groupEntriesCount} match{groupEntriesCount !== 1 ? 'es' : ''})
                              </span>
                            </span>
                            {isSelected && (
                              <span className="ml-2 text-blue-600 font-bold">✓</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Selected groups summary */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-xs font-medium text-gray-600">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded-md">
                      <span className="font-bold">{selectedGroupIds.size}</span>
                      <span>of {selectedArea.groups.length} selected</span>
                    </span>
                  </span>
                  {selectedGroupIds.size > 0 && selectedGroupIds.size < selectedArea.groups.length && (
                    <div className="flex gap-1 flex-wrap">
                      {selectedArea.groups
                        .filter(g => selectedGroupIds.has(g.id))
                        .slice(0, 5)
                        .map(group => (
                          <span
                            key={group.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white rounded text-xs font-medium"
                          >
                            {group.name}
                            <button
                              onClick={() => toggleGroupFilter(group.id)}
                              className="hover:text-blue-200 font-bold ml-0.5"
                              title="Remove filter"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      {selectedArea.groups.filter(g => selectedGroupIds.has(g.id)).length > 5 && (
                        <span className="inline-flex items-center px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs font-medium">
                          +{selectedArea.groups.filter(g => selectedGroupIds.has(g.id)).length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Results summary */}
              <div className="mt-3 text-sm text-gray-600">
                Showing <strong>{filteredEntries.length}</strong> match{filteredEntries.length !== 1 ? 'es' : ''}
                {searchQuery && ` matching "${searchQuery}"`}
              </div>
            </div>
          )}
        </div>

        {/* Selected Area Content */}
        {selectedArea && filteredEntries.length > 0 && (() => {
          const entries = filteredEntries;
          const area = selectedArea;
          const areaId = selectedAreaId;

          const entriesByGroup = groupBy(entries, 'groupId');
          const areaStats = schedule.stats.areaStats.find(s => s.areaId === areaId);

          // Calculer les statistiques de l'aire (filtered)
          const totalMatchesInArea = entries.length;
          const selectedGroupsInArea = area.groups.filter(g => selectedGroupIds.has(g.id));
          const totalAthletesInArea = selectedGroupsInArea.reduce((sum, g) => sum + g.athletes.length, 0);
          const firstMatch = entries[0];
          const lastMatch = entries[entries.length - 1];

          return (
            <div key={areaId} className="mb-8 page-break">
              {/* Récapitulatif de l'aire */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg rounded-lg p-6 mb-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold flex items-center">
                    <span className="mr-2">📍</span>
                    {area.name}
                  </h2>
                  <button
                    onClick={() => printAreaSheet(area, entries)}
                    className="px-4 py-2 bg-white text-blue-700 rounded-md hover:bg-blue-50 transition-colors flex items-center gap-2 font-semibold no-print"
                  >
                    <span>🖨️</span>
                    Tracking Sheet
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-sm opacity-90">Fights</div>
                    <div className="text-2xl font-bold">{totalMatchesInArea}</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-sm opacity-90">Groups</div>
                    <div className="text-2xl font-bold">{selectedGroupsInArea.length}</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-sm opacity-90">Athletes</div>
                    <div className="text-2xl font-bold">{totalAthletesInArea}</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-sm opacity-90">Duration</div>
                    <div className="text-2xl font-bold">
                      {areaStats ? formatDuration(areaStats.duration) : '-'}
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/20 pt-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="opacity-75">First fight:</span>
                      <span className="ml-2 font-semibold">{firstMatch?.scheduledTime || '-'}</span>
                    </div>
                    <div>
                      <span className="opacity-75">Last fight:</span>
                      <span className="ml-2 font-semibold">{lastMatch?.scheduledTime || '-'}</span>
                    </div>
                    <div>
                      <span className="opacity-75">Margin:</span>
                      {areaStats && (
                        <span className={`ml-2 font-semibold ${areaStats.marginOrOverflow >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                          {areaStats.marginOrOverflow >= 0 ? '+' : ''}{formatDuration(Math.abs(areaStats.marginOrOverflow))}
                          {areaStats.marginOrOverflow >= 0 ? ' ✓' : ' ⚠'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {Object.entries(entriesByGroup).map(([groupId, groupEntries]) => {
                const group = area.groups.find(g => g.id === groupId);
                if (!group) return null;

                return (
                  <div key={groupId} className="bg-white shadow-sm rounded-lg p-6 mb-6">
                    {/* Titre du groupe */}
                    <div className="mb-4 pb-3 border-b-2 border-gray-800">
                      <h2 className="text-xl font-bold text-gray-900">
                        {area.name} - {group.name}
                      </h2>
                    </div>

                    {/* Fight table */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-800">
                        <thead>
                          <tr className="bg-white">
                            <th className="border border-gray-800 px-3 py-2 text-left font-bold">#</th>
                            <th className="border border-gray-800 px-3 py-2 text-left font-bold">Time</th>
                            <th className="border border-gray-800 px-3 py-2 text-left font-bold">Fight</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono">
                          {groupEntries.map((entry) => {
                            const result = results.get(entry.matchId);
                            return (
                              <tr
                                key={entry.id}
                                className="cursor-pointer hover:bg-blue-50 transition-colors"
                                onClick={() => handleMatchClick(entry)}
                              >
                                <td className="border border-gray-800 px-3 py-2">{entry.sequenceNumber}</td>
                                <td className="border border-gray-800 px-3 py-2">{entry.scheduledTime}</td>
                                <td className="border border-gray-800 px-3 py-2">
                                  {entry.athlete1Name} vs {entry.athlete2Name}
                                  {result && <ResultBadge result={result} />}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Group summary */}
                    {areaStats && (
                      <div className="mt-3 text-sm text-gray-700">
                        <p>
                          <span className="font-medium">Summary:</span> {groupEntries.length} fights •
                          Duration: {formatDuration(areaStats.duration)} •
                          Margin:{' '}
                          {areaStats.marginOrOverflow >= 0 ? (
                            <span className="text-green-700">
                              +{formatDuration(areaStats.marginOrOverflow)} ✓
                            </span>
                          ) : (
                            <span className="text-red-700">
                              {formatDuration(Math.abs(areaStats.marginOrOverflow))} ⚠
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Empty state when no matches found */}
        {selectedArea && filteredEntries.length === 0 && (
          <div className="bg-white shadow-sm rounded-lg p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No matches found</h3>
            <p className="text-gray-600">
              {searchQuery
                ? `No matches found for "${searchQuery}"`
                : 'Try selecting different groups or adjusting your filters'}
            </p>
          </div>
        )}

        {/* Rest statistics */}
        <div className="bg-white shadow-sm rounded-lg p-6 page-break">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Rest Statistics by Athlete
          </h2>

          {event.areas.map((area) => {
            return area.groups.map((group) => {
              const groupStats = schedule.stats.athleteStats.filter(
                (s) => s.groupId === group.id
              );

              if (groupStats.length === 0) return null;

              return (
                <div key={group.id} className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    {area.name} - {group.name}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-800">
                      <thead>
                        <tr className="bg-white">
                          <th className="border border-gray-800 px-3 py-2 text-left font-bold">
                            Athlete
                          </th>
                          <th className="border border-gray-800 px-3 py-2 text-center font-bold">
                            Fights
                          </th>
                          <th className="border border-gray-800 px-3 py-2 text-center font-bold">
                            Min Rest
                          </th>
                          <th className="border border-gray-800 px-3 py-2 text-center font-bold">
                            Max Rest
                          </th>
                          <th className="border border-gray-800 px-3 py-2 text-center font-bold">
                            Avg Rest
                          </th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {groupStats.map((stat) => (
                          <tr key={stat.athleteId}>
                            <td className="border border-gray-800 px-3 py-2">
                              {stat.athleteName}
                            </td>
                            <td className="border border-gray-800 px-3 py-2 text-center">
                              {stat.matchCount}
                            </td>
                            <td className="border border-gray-800 px-3 py-2 text-center">
                              {formatDuration(stat.minRestSeconds)}
                            </td>
                            <td className="border border-gray-800 px-3 py-2 text-center">
                              {formatDuration(stat.maxRestSeconds)}
                            </td>
                            <td className="border border-gray-800 px-3 py-2 text-center">
                              {formatDuration(Math.round(stat.avgRestSeconds))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            });
          })}

          {warnings.filter((w) => w.type === 'REST_VIOLATION').length === 0 && (
            <p className="text-green-700 font-medium mt-4">
              ✓ No minimum rest violations detected
            </p>
          )}
        </div>

        {/* TIME_BOXED Equity Statistics */}
        {schedule.stats.timeBoxedStats && (
          <div className="bg-blue-50 shadow-sm rounded-lg p-6 page-break">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Schedule Equity (TIME_BOXED Mode)
            </h2>

            {/* Global metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Min fights/athlete</div>
                <div className="text-2xl font-bold text-gray-900">
                  {schedule.stats.timeBoxedStats.minMatchesPerAthlete}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Max fights/athlete</div>
                <div className="text-2xl font-bold text-gray-900">
                  {schedule.stats.timeBoxedStats.maxMatchesPerAthlete}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">Average</div>
                <div className="text-2xl font-bold text-gray-900">
                  {schedule.stats.timeBoxedStats.avgMatchesPerAthlete.toFixed(1)}
                </div>
              </div>
              <div
                className={`p-4 rounded-lg border ${
                  schedule.stats.timeBoxedStats.matchCountGap <= 1
                    ? 'bg-green-50 border-green-300'
                    : schedule.stats.timeBoxedStats.matchCountGap <= 2
                    ? 'bg-yellow-50 border-yellow-300'
                    : 'bg-red-50 border-red-300'
                }`}
              >
                <div className="text-sm text-gray-600 mb-1">Gap (max-min)</div>
                <div
                  className={`text-2xl font-bold ${
                    schedule.stats.timeBoxedStats.matchCountGap <= 1
                      ? 'text-green-700'
                      : schedule.stats.timeBoxedStats.matchCountGap <= 2
                      ? 'text-yellow-700'
                      : 'text-red-700'
                  }`}
                >
                  {schedule.stats.timeBoxedStats.matchCountGap}
                </div>
              </div>
            </div>

            {/* Distribution by group */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Fight Distribution by Group
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-800">
                  <thead>
                    <tr className="bg-white">
                      <th className="border border-gray-800 px-3 py-2 text-left font-bold">
                        Group
                      </th>
                      <th className="border border-gray-800 px-3 py-2 text-center font-bold">
                        Fighters
                      </th>
                      <th className="border border-gray-800 px-3 py-2 text-center font-bold">
                        Scheduled Fights
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {schedule.stats.timeBoxedStats.groupStats.map((groupStat) => {
                      // Trouver le groupe pour obtenir le nombre d'athlètes
                      const group = event.areas
                        .flatMap(a => a.groups)
                        .find(g => g.id === groupStat.groupId);
                      const athleteCount = group?.athletes.length || 0;

                      return (
                        <tr key={groupStat.groupId}>
                          <td className="border border-gray-800 px-3 py-2">
                            {groupStat.groupName}
                          </td>
                          <td className="border border-gray-800 px-3 py-2 text-center">
                            {athleteCount}
                          </td>
                          <td className="border border-gray-800 px-3 py-2 text-center">
                            {groupStat.totalMatches}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Time utilization and rematches */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Time Utilization</h4>
                <div className="text-lg">
                  <span className="font-bold text-gray-900">
                    {schedule.stats.timeBoxedStats.timeUtilizationPercentage.toFixed(1)}%
                  </span>
                  <span className="text-sm text-gray-600 ml-2">
                    ({formatDuration(schedule.stats.timeBoxedStats.timeUsedSeconds)} /{' '}
                    {formatDuration(schedule.stats.timeBoxedStats.timeAvailableSeconds)})
                  </span>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Rematches Used</h4>
                <div className="text-lg">
                  <span className="font-bold text-gray-900">
                    {schedule.stats.timeBoxedStats.rematchesCount}
                  </span>
                  <span className="text-sm text-gray-600 ml-2">
                    {schedule.stats.timeBoxedStats.rematchesCount === 0
                      ? '(no rematches)'
                      : `rematch${schedule.stats.timeBoxedStats.rematchesCount > 1 ? 'es' : ''}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Equity interpretation */}
            <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
              <p className="text-sm text-gray-700">
                {schedule.stats.timeBoxedStats.matchCountGap === 0 ? (
                  <span className="text-green-700 font-semibold">
                    ✓ Perfect equity: all athletes have the same number of fights
                  </span>
                ) : schedule.stats.timeBoxedStats.matchCountGap === 1 ? (
                  <span className="text-green-700 font-semibold">
                    ✓ Excellent equity: gap of only one fight between athletes
                  </span>
                ) : schedule.stats.timeBoxedStats.matchCountGap === 2 ? (
                  <span className="text-yellow-700 font-semibold">
                    ⚠ Fair equity: gap of 2 fights between athletes
                  </span>
                ) : (
                  <span className="text-red-700 font-semibold">
                    ⚠ Sub-optimal equity: gap of {schedule.stats.timeBoxedStats.matchCountGap}{' '}
                    fights. Consider increasing event duration.
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Competition Standings */}
        {groupStandings.length > 0 && groupStandings.some((g) => g.completionPercentage > 0) && (
          <div className="bg-white shadow-sm rounded-lg p-6 page-break">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Competition Standings</h2>
            {groupStandings.map((standing) => (
              <StandingsTable key={standing.groupId} standing={standing} />
            ))}
          </div>
        )}
      </div>

      {/* Score Entry Modal */}
      {selectedMatch && (
        <ScoreEntryModal
          isOpen={isScoreModalOpen}
          onClose={() => setIsScoreModalOpen(false)}
          scheduleEntry={selectedMatch}
          existingResult={results.get(selectedMatch.matchId)}
          onSave={handleSaveResult}
        />
      )}
    </div>
  );
}
