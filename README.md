# Générateur de Planning de Tournois

Application web moderne pour générer automatiquement des plannings de combats équitables pour tournois sportifs.

## Fonctionnalités

### ✅ MVP (Version 1.0)

- **Génération automatique de planning**
  - Algorithme Circle Method pour garantie d'équité structurelle
  - Round-robin complet : chaque athlète affronte chaque autre au moins une fois
  - Support multi-cycles (répéter le round-robin 2, 3, 4... fois)
  - Alternance intelligente par round entre groupes sur une même aire

- **Équité maximale**
  - Garantie mathématique : 1 combat maximum par round par athlète
  - Calcul précis des temps de repos (next.start - prev.end)
  - Validation du repos minimum configurable
  - Stats détaillées par athlète (repos min/max/moyen)

- **Contraintes strictes**
  - Respect des horaires de début et fin
  - Détection des dépassements avec suggestions chiffrées
  - Aires fixes par groupe (pas de mélange)
  - Durée combat et temps rotation configurables

- **Export professionnel**
  - PDF A4 optimisé impression (tableaux + stats)
  - CSV compatible Excel
  - Fonction imprimer navigateur

- **Interface utilisateur**
  - Formulaire intuitif de saisie
  - Affichage tableaux ultra-lisibles (format terrain)
  - Responsive mobile/tablette
  - Design minimaliste

## Architecture Technique

### Stack
- **Frontend:** Next.js 14 (App Router) + React + TypeScript
- **Styling:** Tailwind CSS
- **Export:** jsPDF + jspdf-autotable
- **State:** React hooks (pas de lib externe pour le MVP)

### Structure
```
tournament-scheduler/
├── app/
│   ├── api/
│   │   └── schedule/
│   │       └── generate/
│   │           └── route.ts         # API génération planning
│   ├── schedule/
│   │   └── page.tsx                 # Page résultats
│   ├── layout.tsx                   # Layout global
│   ├── page.tsx                     # Page formulaire
│   └── globals.css                  # Styles globaux
├── lib/
│   ├── types.ts                     # Types TypeScript
│   ├── scheduler.ts                 # Algorithme Circle Method
│   ├── utils.ts                     # Fonctions utilitaires
│   └── export.ts                    # Export PDF/CSV
├── components/                      # (vide pour MVP)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

## Installation

### Prérequis
- Node.js 18+ (recommandé : 20.x)
- npm ou yarn

### Étapes

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer le serveur de développement
npm run dev

# 3. Ouvrir http://localhost:3000
```

## Utilisation

### 1. Créer un événement

Remplissez le formulaire :
- **Nom** : "Tournoi Départemental Karaté"
- **Date** : 2026-03-15
- **Durée combat** : 2 min 0 sec
- **Rotation** : 30 secondes
- **Horaires** : 09:00 → 12:00
- **Cycles** : 1 (round-robin simple)
- **Repos minimum** : 5 minutes

### 2. Configurer les aires et groupes

**Aire 1**
- **Groupe A - Minimes -45kg**
  ```
  Sophie Martin
  Nadia Dubois
  Emma Leroy
  Lina Petit
  ```

**Aire 2**
- **Groupe B - Cadets -60kg**
  ```
  Lucas Moreau
  Tom Bernard
  Hugo Roux
  ```

### 3. Générer le planning

Cliquez sur "Générer le planning"

Le système va :
1. Valider la faisabilité temporelle
2. Générer les rounds via Circle Method
3. Calculer les horaires précis
4. Afficher le planning + stats

### 4. Exporter

- **PDF** : Planning complet imprimable (A4)
- **CSV** : Import Excel pour modifications manuelles
- **Imprimer** : Impression directe depuis le navigateur

## Algorithme

### Circle Method (Méthode du Cercle)

Pour N athlètes, génère N-1 rounds (ou N si impair).

**Exemple : 4 athlètes [A, B, C, D]**

```
Round 1: (A-B), (C-D)
Round 2: (A-C), (D-B)
Round 3: (A-D), (B-C)
```

**Garanties :**
- Chaque athlète combat 1 fois max par round
- Toutes les paires uniques sont générées
- Équité structurelle parfaite

### Multi-groupes sur une aire

Alternance par **round** (pas par match individuel) :

```
Aire 1 : Groupe A (4 athlètes, 3 rounds) + Groupe B (3 athlètes, 3 rounds)

Séquence :
1-2.   A Round 1 (2 matchs)
3.     B Round 1 (1 match)
4-5.   A Round 2 (2 matchs)
6.     B Round 2 (1 match)
7-8.   A Round 3 (2 matchs)
9.     B Round 3 (1 match)
```

Avantages :
- Meilleure lisibilité
- Équité préservée
- Repos équilibré

### Calcul du repos

**Formule correcte :** `rest = next.start - prev.end`

Exemple :
- Combat 1 : 09:00 → 09:02 (120s)
- Combat 2 : 09:07 → 09:09 (120s)
- **Repos** : 09:07 - 09:02 = **5 minutes** ✓

## Validation et Warnings

### Erreurs bloquantes (rouge)
- **TIME_OVERFLOW** : Pas assez de temps
  - Suggestion : prolonger fin, réduire rotation, ajouter aire, réduire cycles

### Avertissements (jaune)
- **REST_VIOLATION** : Repos < minimum requis
  - Suggestion : augmenter rotation ou réorganiser

### Infos (bleu)
- Statistiques générales

## Développement

### Commandes

```bash
# Développement
npm run dev

# Build production
npm run build

# Démarrer production
npm start

# Linter
npm run lint

# Tests (si configurés)
npm test
```

### Ajouter des tests

Créer `lib/scheduler.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { generateRoundsForGroup } from './scheduler';

describe('generateRoundsForGroup', () => {
  it('génère 3 rounds pour 4 athlètes', () => {
    const athletes = [
      { id: '1', name: 'A', groupId: 'g1' },
      { id: '2', name: 'B', groupId: 'g1' },
      { id: '3', name: 'C', groupId: 'g1' },
      { id: '4', name: 'D', groupId: 'g1' }
    ];

    const rounds = generateRoundsForGroup(athletes, 'g1', 1);

    expect(rounds.length).toBe(3); // N-1 rounds
    rounds.forEach(round => {
      expect(round.matches.length).toBe(2); // N/2 matchs par round
    });
  });
});
```

Lancer : `npm test`

## Déploiement

### Vercel (recommandé)

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel
```

### Autres options
- Netlify
- Railway
- AWS Amplify
- Azure Static Web Apps

## Roadmap v2

- [ ] Drag & drop réorganisation manuelle
- [ ] Mode édition en temps réel
- [ ] Sauvegarde cloud + partage par lien
- [ ] Import CSV/Excel (athlètes)
- [ ] Templates événements récurrents
- [ ] Affichage live sur écran (mode kiosque)
- [ ] Multi-langue (FR/EN)
- [ ] Notifications push
- [ ] Gestion blessures/forfaits en temps réel

## Support

Pour toute question ou bug :
- Ouvrir une issue sur GitHub
- Email : support@tournament-scheduler.app (à configurer)

## Licence

MIT License - Libre d'utilisation et modification

---

**Développé avec ❤️ pour les organisateurs de tournois**
