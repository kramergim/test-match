# Guide de Démarrage Rapide

## Installation et démarrage

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer le serveur de développement
npm run dev

# 3. Ouvrir votre navigateur sur http://localhost:3000
```

## Test rapide avec des données d'exemple

### Exemple 1 : Tournoi simple (1 aire, 1 groupe, 4 athlètes)

**Configuration :**
- Nom : "Tournoi Test"
- Durée combat : 2 min 0 sec
- Rotation : 30 secondes
- Horaires : 09:00 → 12:00
- Cycles : 1

**Aire 1 - Groupe A :**
```
Sophie Martin
Nadia Dubois
Emma Leroy
Lina Petit
```

**Résultat attendu :**
- 6 combats (C(4,2))
- 3 rounds de 2 matchs
- Durée totale : ~15 minutes

---

### Exemple 2 : Tournoi multi-groupes (1 aire, 2 groupes)

**Configuration :**
- Nom : "Tournoi Départemental"
- Durée combat : 2 min 0 sec
- Rotation : 30 secondes
- Horaires : 09:00 → 12:00
- Cycles : 1
- Repos minimum : 5 min

**Aire 1 - Groupe A (Minimes -45kg) :**
```
Sophie Martin
Nadia Dubois
Emma Leroy
Lina Petit
```

**Aire 1 - Groupe B (Cadets -60kg) :**
```
Lucas Moreau
Tom Bernard
Hugo Roux
```

**Résultat attendu :**
- Groupe A : 6 combats (3 rounds)
- Groupe B : 3 combats (3 rounds)
- Alternance : A-Round1, B-Round1, A-Round2, B-Round2...
- Durée totale : ~23 minutes

---

### Exemple 3 : Multi-aires

**Configuration :**
- Nom : "Tournoi Régional"
- Durée combat : 2 min 0 sec
- Rotation : 30 secondes
- Horaires : 09:00 → 12:00
- Cycles : 2 (double round-robin)

**Aire 1 - Groupe A :**
```
Sophie Martin
Nadia Dubois
Emma Leroy
```

**Aire 2 - Groupe B :**
```
Lucas Moreau
Tom Bernard
Hugo Roux
Paul Durand
```

**Résultat attendu :**
- Aire 1 : 3 matchs × 2 cycles = 6 combats
- Aire 2 : 6 matchs × 2 cycles = 12 combats
- Les deux aires fonctionnent en parallèle

---

## Fonctionnalités à tester

### 1. Validation temporelle

Essayez de créer un événement impossible :
- 10 athlètes (45 combats)
- Durée combat : 3 min
- Rotation : 1 min
- Horaires : 09:00 → 10:00 (seulement 1h)

Résultat : Warning TIME_OVERFLOW avec suggestions chiffrées

### 2. Repos minimum

Configurez :
- Repos minimum : 10 min
- Rotation : 30 sec

Résultat : Warnings REST_VIOLATION pour les athlètes avec repos < 10 min

### 3. Export

Après génération :
- Cliquez "Exporter PDF" → fichier A4 imprimable
- Cliquez "Exporter CSV" → fichier Excel
- Cliquez "Imprimer" → impression navigateur

### 4. Cycles multiples

Configurez cyclesPerGroup = 3
- Chaque paire se rencontre 3 fois
- Total combats = C(n,2) × 3

---

## Vérification de l'algorithme Circle Method

Pour 4 athlètes [A, B, C, D], vérifiez que les rounds sont :

**Round 1 :**
- A vs B
- C vs D

**Round 2 :**
- A vs C
- D vs B

**Round 3 :**
- A vs D
- B vs C

**Validation :**
- ✓ Chaque athlète combat 1 fois par round
- ✓ Toutes les paires sont générées
- ✓ Pas de combat consécutif

---

## Structure du projet

```
tournament-scheduler/
├── app/
│   ├── api/schedule/generate/route.ts  # API génération
│   ├── schedule/page.tsx                # Page résultats
│   ├── page.tsx                         # Formulaire
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── scheduler.ts                     # Algo Circle Method
│   ├── export.ts                        # Export PDF/CSV
│   ├── utils.ts                         # Utilitaires
│   └── types.ts                         # Types TypeScript
└── README.md                            # Documentation complète
```

---

## Dépannage

### Erreur "Failed to compile"
```bash
# Supprimer node_modules et réinstaller
rm -rf node_modules
npm install
```

### Port 3000 déjà utilisé
```bash
# Utiliser un autre port
PORT=3001 npm run dev
```

### Export PDF ne fonctionne pas
Vérifiez que jsPDF et jspdf-autotable sont installés :
```bash
npm install jspdf jspdf-autotable
```

---

## Prochaines étapes

1. Testez avec vos données réelles
2. Ajustez les paramètres selon vos besoins
3. Exportez et imprimez le planning
4. Consultez README.md pour la roadmap v2

**Bon tournoi ! 🥋**
