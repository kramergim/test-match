/**
 * API Route pour générer un planning de tournoi
 * POST /api/schedule/generate
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateTimeBoxedSchedule } from '@/lib/scheduler';
import { Event } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const event: Event = await request.json();

    // Debug: logger les données reçues
    console.log('=== EVENT RECEIVED ===');
    console.log('Event name:', event.name);
    console.log('Number of areas:', event.areas?.length || 0);
    event.areas?.forEach((area, i) => {
      console.log(`\nArea ${i + 1}: ${area.name}`);
      console.log(`  Groups: ${area.groups?.length || 0}`);
      area.groups?.forEach((group, j) => {
        console.log(`    Group ${j + 1}: ${group.name}`);
        console.log(`      Athletes: ${group.athletes?.length || 0}`);
        group.athletes?.forEach((athlete, k) => {
          console.log(`        ${k + 1}. ${athlete.name}`);
        });
      });
    });

    // Validation basique
    if (!event.name || !event.areas || event.areas.length === 0) {
      return NextResponse.json(
        { error: 'Données d\'événement invalides' },
        { status: 400 }
      );
    }

    // Générer le planning avec l'algorithme TIME_BOXED
    const { schedule, warnings } = generateTimeBoxedSchedule(event);

    console.log('\n=== SCHEDULE GENERATED ===');
    console.log('Total entries:', schedule.entries.length);
    console.log('Warnings:', warnings.length);

    return NextResponse.json({
      schedule,
      warnings,
    });
  } catch (error) {
    console.error('Error generating schedule:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du planning' },
      { status: 500 }
    );
  }
}
