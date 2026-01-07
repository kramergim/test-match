/**
 * Fonctions d'export (PDF et CSV)
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Schedule, Event, ScheduleEntry, AreaStats, MatchResult, EventExport, GroupStandings } from './types';
import { groupBy, formatDuration } from './utils';

/**
 * Exporte le planning en CSV
 */
export function exportToCSV(schedule: Schedule, event: Event): string {
  const header = ['#', 'Area', 'Group', 'Time', 'Fight'];

  const rows = schedule.entries.map(entry => {
    const area = event.areas.find(a => a.id === entry.areaId);
    const group = area?.groups.find(g => g.id === entry.groupId);

    return [
      entry.sequenceNumber.toString(),
      area?.name || '',
      group?.name || '',
      entry.scheduledTime,
      `${entry.athlete1Name} vs ${entry.athlete2Name}`,
    ];
  });

  return [header, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
}

/**
 * Exporte le planning en PDF
 */
export function exportToPDF(schedule: Schedule, event: Event): jsPDF {
  const doc = new jsPDF('portrait', 'mm', 'a4');

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(event.name, 105, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(event.date, 105, 22, { align: 'center' });

  // Grouper les entrées par aire
  const entriesByArea = groupBy(schedule.entries, 'areaId');

  let startY = 30;
  let pageNumber = 1;

  for (const [areaId, entries] of Object.entries(entriesByArea)) {
    const area = event.areas.find(a => a.id === areaId);
    if (!area) continue;

    // Vérifier si on a assez d'espace pour le récapitulatif
    if (startY > 220) {
      doc.addPage();
      startY = 20;
      pageNumber++;
    }

    // === RÉCAPITULATIF DE L'AIRE ===
    const areaStats = schedule.stats.areaStats.find(s => s.areaId === areaId);
    const totalMatchesInArea = entries.length;
    const totalGroupsInArea = area.groups.length;
    const totalAthletesInArea = area.groups.reduce((sum, g) => sum + g.athletes.length, 0);
    const firstMatch = entries[0];
    const lastMatch = entries[entries.length - 1];

    // Titre de l'aire avec fond
    doc.setFillColor(59, 130, 246); // Bleu
    doc.rect(14, startY - 3, 182, 12, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(area.name, 16, startY + 5);
    doc.setTextColor(0, 0, 0);
    startY += 15;

    // Statistiques de l'aire
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Combats : ${totalMatchesInArea}`, 16, startY);
    doc.text(`Groupes : ${totalGroupsInArea}`, 60, startY);
    doc.text(`Athlètes : ${totalAthletesInArea}`, 100, startY);
    if (areaStats) {
      doc.text(`Durée : ${formatDuration(areaStats.duration)}`, 140, startY);
    }
    startY += 5;

    doc.text(`Premier combat : ${firstMatch?.scheduledTime || '-'}`, 16, startY);
    doc.text(`Dernier combat : ${lastMatch?.scheduledTime || '-'}`, 80, startY);
    if (areaStats) {
      const marginText = areaStats.marginOrOverflow >= 0
        ? `+${formatDuration(areaStats.marginOrOverflow)}`
        : `-${formatDuration(Math.abs(areaStats.marginOrOverflow))}`;
      doc.text(`Marge : ${marginText}`, 140, startY);
    }
    startY += 8;

    // Ligne de séparation
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(14, startY, 196, startY);
    startY += 8;

    // Grouper par groupe dans cette aire
    const entriesByGroup = groupBy(entries, 'groupId');

    for (const [groupId, groupEntries] of Object.entries(entriesByGroup)) {
      const group = area.groups.find(g => g.id === groupId);
      if (!group) continue;

      // Vérifier si on a assez d'espace
      if (startY > 240) {
        doc.addPage();
        startY = 20;
        pageNumber++;
      }

      // Titre du groupe
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${area.name} - ${group.name}`, 14, startY);
      startY += 7;

      // Tableau des combats
      const tableData = groupEntries.map(e => [
        e.sequenceNumber.toString(),
        e.scheduledTime,
        `${e.athlete1Name} vs ${e.athlete2Name}`,
      ]);

      autoTable(doc, {
        startY: startY,
        head: [['#', 'Time', 'Fight']],
        body: tableData,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 9,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          lineWidth: 0.5,
          lineColor: [0, 0, 0],
        },
        margin: { left: 14, right: 14 },
      });

      startY = (doc as any).lastAutoTable.finalY + 5;

      // Résumé du groupe
      const areaStats = schedule.stats.areaStats.find(s => s.areaId === areaId);
      if (areaStats) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');

        const marginText = areaStats.marginOrOverflow >= 0
          ? `+${formatDuration(areaStats.marginOrOverflow)}`
          : `-${formatDuration(Math.abs(areaStats.marginOrOverflow))}`;

        doc.text(
          `Resume : ${groupEntries.length} combats - Duree : ${formatDuration(areaStats.duration)} - Marge : ${marginText}`,
          14,
          startY
        );
        startY += 10;
      }
    }
  }

  // Rest statistics (new page)
  doc.addPage();
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Rest Statistics by Athlete', 14, 20);

  startY = 30;

  // Grouper les stats par groupe
  const statsByGroup = groupBy(schedule.stats.athleteStats, 'groupId');

  for (const [groupId, athleteStats] of Object.entries(statsByGroup)) {
    if (athleteStats.length === 0) continue;

    const groupName = athleteStats[0].groupName;

    if (startY > 240) {
      doc.addPage();
      startY = 20;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(groupName, 14, startY);
    startY += 7;

    const statsData = athleteStats.map(stat => [
      stat.athleteName,
      stat.matchCount.toString(),
      formatDuration(stat.minRestSeconds),
      formatDuration(stat.maxRestSeconds),
      formatDuration(Math.round(stat.avgRestSeconds)),
    ]);

    autoTable(doc, {
      startY: startY,
      head: [['Athlete', 'Fights', 'Min Rest', 'Max Rest', 'Avg Rest']],
      body: statsData,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
      margin: { left: 14, right: 14 },
    });

    startY = (doc as any).lastAutoTable.finalY + 10;
  }

  // TIME_BOXED equity statistics (if available)
  if (schedule.stats.timeBoxedStats) {
    const tbStats = schedule.stats.timeBoxedStats;

    // New page for TIME_BOXED stats
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Equity Statistics (TIME_BOXED Mode)', 14, 20);

    startY = 30;

    // Global metrics
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Global Metrics', 14, startY);
    startY += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Min fights per athlete: ${tbStats.minMatchesPerAthlete}`, 14, startY);
    startY += 5;
    doc.text(`Max fights per athlete: ${tbStats.maxMatchesPerAthlete}`, 14, startY);
    startY += 5;
    doc.text(`Average: ${tbStats.avgMatchesPerAthlete.toFixed(1)}`, 14, startY);
    startY += 5;

    doc.setFont('helvetica', 'bold');
    doc.text(`Gap (max-min): ${tbStats.matchCountGap}`, 14, startY);
    startY += 10;

    // Distribution by group
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Distribution by Group', 14, startY);
    startY += 7;

    const groupData = tbStats.groupStats.map(g => {
      // Trouver le groupe pour obtenir le nombre d'athlètes
      const group = event.areas
        .flatMap(a => a.groups)
        .find(gr => gr.id === g.groupId);
      const athleteCount = group?.athletes.length || 0;

      return [
        g.groupName,
        athleteCount.toString(),
        g.totalMatches.toString(),
      ];
    });

    autoTable(doc, {
      startY: startY,
      head: [['Group', 'Fighters', 'Scheduled Fights']],
      body: groupData,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
      margin: { left: 14, right: 14 },
    });

    startY = (doc as any).lastAutoTable.finalY + 10;

    // Time utilization and rematches
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Time Utilization and Rematches', 14, startY);
    startY += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Time utilization: ${tbStats.timeUtilizationPercentage.toFixed(1)}% (${formatDuration(tbStats.timeUsedSeconds)}/${formatDuration(tbStats.timeAvailableSeconds)})`,
      14,
      startY
    );
    startY += 5;
    doc.text(
      `Rematches used: ${tbStats.rematchesCount} rematch${tbStats.rematchesCount > 1 ? 'es' : ''}`,
      14,
      startY
    );
    startY += 10;

    // Interpretation
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    const interpretation =
      tbStats.matchCountGap === 0
        ? 'Perfect equity: all athletes have the same number of fights'
        : tbStats.matchCountGap === 1
        ? 'Excellent equity: gap of only one fight between athletes'
        : tbStats.matchCountGap === 2
        ? 'Fair equity: gap of 2 fights between athletes'
        : `Sub-optimal equity: gap of ${tbStats.matchCountGap} fights`;

    doc.text(interpretation, 14, startY);
  }

  // Footer sur toutes les pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Page ${i}/${totalPages}`,
      105,
      287,
      { align: 'center' }
    );
  }

  return doc;
}

/**
 * Export complete event data with results to JSON
 */
export function exportToJSON(
  schedule: Schedule,
  event: Event,
  results: Map<string, MatchResult>
): string {
  const exportData: EventExport = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    event,
    schedule,
    results: Array.from(results.values()),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Trigger JSON file download
 */
export function downloadJSON(jsonString: string, filename: string) {
  const blob = new Blob([jsonString], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Parse and validate imported JSON file
 */
export function importFromJSON(fileContent: string): {
  success: boolean;
  data?: EventExport;
  error?: string;
} {
  try {
    const parsed = JSON.parse(fileContent);

    // Validate structure
    if (!parsed.version || !parsed.event || !parsed.schedule) {
      return {
        success: false,
        error: 'Invalid file format: missing required fields',
      };
    }

    // Version check
    if (parsed.version !== '1.0') {
      return {
        success: false,
        error: `Unsupported version: ${parsed.version}`,
      };
    }

    return {
      success: true,
      data: parsed as EventExport,
    };
  } catch (e) {
    return {
      success: false,
      error: `Failed to parse JSON: ${(e as Error).message}`,
    };
  }
}

/**
 * Export complete event data with results to Excel
 */
export function exportToExcel(
  schedule: Schedule,
  event: Event,
  results: Map<string, MatchResult>,
  groupStandings: GroupStandings[]
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Event Info
  const eventInfo = [
    ['Event Information'],
    ['Name', event.name],
    ['Date', event.date],
    ['Start Time', event.startTime],
    ['End Time', event.endTime],
    ['Fight Duration', formatDuration(event.fightDuration)],
    ['Rotation Time', formatDuration(event.rotationTime)],
    ['Min Rest Between Fights', formatDuration(event.minRestBetweenFightsSeconds || 0)],
    [],
    ['Statistics'],
    ['Total Matches', schedule.stats.totalMatches],
    ['Total Duration', formatDuration(schedule.stats.totalDuration)],
  ];
  const eventSheet = XLSX.utils.aoa_to_sheet(eventInfo);
  XLSX.utils.book_append_sheet(workbook, eventSheet, 'Event Info');

  // Sheet 2: Complete Schedule with Results
  const scheduleData: any[][] = [
    ['#', 'Area', 'Group', 'Time', 'Athlete 1', 'Athlete 2', 'Score', 'Winner'],
  ];

  for (const entry of schedule.entries) {
    const area = event.areas.find((a) => a.id === entry.areaId);
    const group = area?.groups.find((g) => g.id === entry.groupId);
    const result = results.get(entry.matchId);

    scheduleData.push([
      entry.sequenceNumber,
      area?.name || '',
      group?.name || '',
      entry.scheduledTime,
      entry.athlete1Name,
      entry.athlete2Name,
      result ? `${result.athlete1Score}-${result.athlete2Score}` : '',
      result
        ? result.winnerId === null
          ? 'Draw'
          : result.winnerId === entry.athlete1Id
          ? entry.athlete1Name
          : entry.athlete2Name
        : '',
    ]);
  }

  const scheduleSheet = XLSX.utils.aoa_to_sheet(scheduleData);
  // Set column widths
  scheduleSheet['!cols'] = [
    { wch: 5 },  // #
    { wch: 15 }, // Area
    { wch: 15 }, // Group
    { wch: 8 },  // Time
    { wch: 20 }, // Athlete 1
    { wch: 20 }, // Athlete 2
    { wch: 10 }, // Score
    { wch: 20 }, // Winner
  ];
  XLSX.utils.book_append_sheet(workbook, scheduleSheet, 'Schedule');

  // Sheet 3+: Standings per Group
  for (const standing of groupStandings) {
    if (standing.athletes.length === 0) continue;

    const standingsData: any[][] = [
      [
        `${standing.areaName} - ${standing.groupName}`,
        '',
        '',
        '',
        '',
        '',
        '',
        `${standing.completionPercentage.toFixed(0)}% Complete`,
      ],
      [
        'Rank',
        'Athlete',
        'Fights (Played/Scheduled)',
        'Wins',
        'Draws',
        'Losses',
        'Win %',
        'Points Scored',
        'Points Against',
        '+/-',
      ],
    ];

    for (const athlete of standing.athletes) {
      standingsData.push([
        athlete.rank || '',
        athlete.athleteName,
        `${athlete.matchesPlayed}/${athlete.matchesScheduled}`,
        athlete.wins,
        athlete.draws,
        athlete.losses,
        `${athlete.winPercentage.toFixed(1)}%`,
        athlete.totalPointsScored,
        athlete.totalPointsAgainst,
        athlete.pointsDifferential > 0
          ? `+${athlete.pointsDifferential}`
          : athlete.pointsDifferential,
      ]);
    }

    const standingSheet = XLSX.utils.aoa_to_sheet(standingsData);
    // Set column widths
    standingSheet['!cols'] = [
      { wch: 6 },  // Rank
      { wch: 20 }, // Athlete
      { wch: 22 }, // Fights
      { wch: 6 },  // Wins
      { wch: 6 },  // Draws
      { wch: 8 },  // Losses
      { wch: 8 },  // Win %
      { wch: 14 }, // Points Scored
      { wch: 15 }, // Points Against
      { wch: 6 },  // +/-
    ];

    // Create safe sheet name (max 31 chars, no special chars)
    const sheetName = `${standing.groupName}`.substring(0, 31).replace(/[:\\/\?\*\[\]]/g, '_');
    XLSX.utils.book_append_sheet(workbook, standingSheet, sheetName);
  }

  return workbook;
}

/**
 * Download Excel workbook
 */
export function downloadExcel(workbook: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(workbook, filename);
}
