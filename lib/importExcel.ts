/**
 * Utilitaire pour importer des athlètes depuis un fichier Excel
 *
 * Format attendu :
 * Feuille 1 (Aire 1), Feuille 2 (Aire 2), etc.
 * Chaque feuille :
 *   Colonne A : Nom du groupe
 *   Colonne B : Nom de l'athlète
 *
 * Exemple :
 * | Groupe A | Alice  |
 * | Groupe A | Bob    |
 * | Groupe A | Charlie|
 * | Groupe B | David  |
 * | Groupe B | Eve    |
 */

import * as XLSX from 'xlsx';
import { AreaFormData, GroupFormData } from './types';

export interface ImportResult {
  success: boolean;
  areas: AreaFormData[];
  errors: string[];
  warnings: string[];
}

/**
 * Parse un fichier Excel et extrait les aires/groupes/athlètes
 */
export async function importAthletesFromExcel(file: File): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    areas: [],
    errors: [],
    warnings: [],
  };

  try {
    // Lire le fichier
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // Vérifier qu'il y a au moins une feuille
    if (workbook.SheetNames.length === 0) {
      result.errors.push('Le fichier Excel ne contient aucune feuille');
      return result;
    }

    // Chaque feuille = une aire
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<{ [key: string]: any }>(sheet, {
        header: ['groupe', 'athlete'],
        defval: '',
      });

      // Grouper les athlètes par groupe
      const groupsMap = new Map<string, string[]>();

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const groupName = String(row.groupe || '').trim();
        const athleteName = String(row.athlete || '').trim();

        // Ignorer les lignes vides ou les en-têtes
        if (!groupName || !athleteName) continue;
        if (groupName.toLowerCase() === 'groupe' || athleteName.toLowerCase() === 'athlete') continue;

        // Ajouter l'athlète au groupe
        if (!groupsMap.has(groupName)) {
          groupsMap.set(groupName, []);
        }
        groupsMap.get(groupName)!.push(athleteName);
      }

      // Vérifier qu'il y a au moins un groupe
      if (groupsMap.size === 0) {
        result.warnings.push(`Feuille "${sheetName}" : aucun groupe trouvé`);
        continue;
      }

      // Créer les groupes pour cette aire
      const groups: GroupFormData[] = [];

      for (const [groupName, athletes] of groupsMap) {
        if (athletes.length === 0) {
          result.warnings.push(`Groupe "${groupName}" dans "${sheetName}" : aucun athlète`);
          continue;
        }

        if (athletes.length === 1) {
          result.warnings.push(`Groupe "${groupName}" dans "${sheetName}" : seulement 1 athlète (minimum 2 requis)`);
        }

        groups.push({
          name: groupName,
          athleteNames: athletes.join('\n'),
        });
      }

      // Ajouter l'aire si elle contient des groupes valides
      if (groups.length > 0) {
        result.areas.push({
          name: sheetName,
          groups,
        });
      }
    }

    // Vérifier qu'on a au moins une aire
    if (result.areas.length === 0) {
      result.errors.push('Aucune aire valide trouvée dans le fichier Excel');
      return result;
    }

    result.success = true;
    return result;

  } catch (error) {
    result.errors.push(`Erreur lors de la lecture du fichier : ${error instanceof Error ? error.message : 'erreur inconnue'}`);
    return result;
  }
}

/**
 * Génère un fichier Excel template pour l'import
 */
export function generateExcelTemplate(): Blob {
  const wb = XLSX.utils.book_new();

  // Feuille 1 : Aire 1 (exemple)
  const ws1Data = [
    ['Groupe', 'Athlète'],
    ['Groupe A', 'Alice'],
    ['Groupe A', 'Bob'],
    ['Groupe A', 'Charlie'],
    ['Groupe A', 'David'],
    ['Groupe B', 'Eve'],
    ['Groupe B', 'Frank'],
    ['Groupe B', 'Grace'],
    ['Groupe B', 'Henry'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
  XLSX.utils.book_append_sheet(wb, ws1, 'Aire 1');

  // Feuille 2 : Aire 2 (exemple)
  const ws2Data = [
    ['Groupe', 'Athlète'],
    ['Groupe C', 'Ivy'],
    ['Groupe C', 'Jack'],
    ['Groupe C', 'Kate'],
    ['Groupe D', 'Liam'],
    ['Groupe D', 'Mia'],
    ['Groupe D', 'Noah'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
  XLSX.utils.book_append_sheet(wb, ws2, 'Aire 2');

  // Générer le fichier
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
