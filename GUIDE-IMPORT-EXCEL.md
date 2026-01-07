# Guide d'Import Excel - Athlètes par Groupe

## 📊 Vue d'ensemble

L'import Excel vous permet de charger rapidement tous vos athlètes et leurs groupes depuis un fichier Excel, au lieu de les saisir manuellement dans le formulaire.

## 🚀 Utilisation rapide

### 1. Télécharger le template

1. Ouvrez l'application : http://localhost:3001
2. Cliquez sur **"📥 Télécharger le template Excel"**
3. Un fichier `template-import-athletes.xlsx` sera téléchargé

### 2. Remplir le template

Le fichier template contient 2 feuilles d'exemple :

#### **Feuille "Aire 1"** (exemple)
| Groupe   | Athlète |
|----------|---------|
| Groupe A | Alice   |
| Groupe A | Bob     |
| Groupe A | Charlie |
| Groupe A | David   |
| Groupe B | Eve     |
| Groupe B | Frank   |
| Groupe B | Grace   |
| Groupe B | Henry   |

#### **Feuille "Aire 2"** (exemple)
| Groupe   | Athlète |
|----------|---------|
| Groupe C | Ivy     |
| Groupe C | Jack    |
| Groupe C | Kate    |
| Groupe D | Liam    |
| Groupe D | Mia     |
| Groupe D | Noah    |

### 3. Format du fichier

#### Structure
- **Chaque feuille = une aire**
  - Nom de la feuille = nom de l'aire (ex: "Aire 1", "Tatami Principal", etc.)
- **Colonne A** : Nom du groupe
- **Colonne B** : Nom de l'athlète

#### Règles importantes
- ✅ Les athlètes avec le **même nom de groupe** seront automatiquement regroupés ensemble
- ✅ Vous pouvez avoir **plusieurs groupes** dans la même feuille
- ✅ Vous pouvez ajouter autant de **feuilles** que d'aires nécessaires
- ⚠️ Minimum **2 athlètes** par groupe (sinon avertissement)
- ⚠️ La première ligne (en-têtes "Groupe" / "Athlète") est ignorée

### 4. Importer le fichier

1. Cliquez sur **"📤 Importer un fichier Excel"**
2. Sélectionnez votre fichier `.xlsx` ou `.xls`
3. L'import se fait automatiquement :
   - ✅ **Message vert** : Import réussi
   - ⚠️ **Message jaune** : Avertissements (ex: groupe avec 1 seul athlète)
   - ❌ **Message rouge** : Erreurs bloquantes

## 📝 Exemples de fichiers

### Exemple 1 : Tournoi simple (1 aire, 2 groupes)

**Feuille "Aire Principale"**
```
Groupe    | Athlète
----------|----------
Poussins  | Léo
Poussins  | Emma
Poussins  | Lucas
Poussins  | Chloé
Benjamins | Hugo
Benjamins | Léa
Benjamins | Noah
Benjamins | Zoé
```

→ Résultat : 1 aire, 2 groupes (Poussins = 4 athlètes, Benjamins = 4 athlètes)

### Exemple 2 : Tournoi multi-aires (2 aires, 4 groupes)

**Feuille "Aire 1"**
```
Groupe      | Athlète
------------|----------
Kata Enfant | Pierre
Kata Enfant | Marie
Kata Enfant | Jules
Combat Ado  | Sophie
Combat Ado  | Tom
Combat Ado  | Lisa
```

**Feuille "Aire 2"**
```
Groupe        | Athlète
--------------|----------
Kata Adulte   | Marc
Kata Adulte   | Sarah
Kata Adulte   | Alex
Combat Senior | Jean
Combat Senior | Anne
Combat Senior | Paul
```

→ Résultat : 2 aires, 4 groupes au total

### Exemple 3 : Groupes multiples sur même aire

**Feuille "Tatami 1"**
```
Groupe       | Athlète
-------------|----------
Groupe A     | Athlète1
Groupe A     | Athlète2
Groupe A     | Athlète3
Groupe B     | Athlète4
Groupe B     | Athlète5
Groupe B     | Athlète6
Groupe C     | Athlète7
Groupe C     | Athlète8
Groupe C     | Athlète9
```

→ Résultat : 1 aire "Tatami 1" avec 3 groupes (A, B, C)

## ⚠️ Gestion des erreurs

### Erreurs courantes

**❌ "Le fichier Excel ne contient aucune feuille"**
- Votre fichier est vide ou corrompu
- Solution : Utilisez le template fourni

**❌ "Aucune aire valide trouvée dans le fichier Excel"**
- Toutes vos feuilles sont vides
- Solution : Ajoutez au moins un groupe avec des athlètes

**⚠️ "Groupe X : seulement 1 athlète (minimum 2 requis)"**
- Un groupe n'a qu'un seul athlète
- Solution : Ajoutez au moins un athlète ou supprimez le groupe

**⚠️ "Feuille X : aucun groupe trouvé"**
- La feuille ne contient pas de données valides
- Solution : Vérifiez que les colonnes A et B sont remplies

## 🎯 Conseils et bonnes pratiques

### ✅ Bonnes pratiques
1. **Utilisez le template** comme point de départ
2. **Nommez clairement vos groupes** : "Poussins Kata", "Benjamins Combat", etc.
3. **Nommez vos feuilles** selon vos aires physiques : "Tatami 1", "Tatami 2", etc.
4. **Vérifiez les avertissements** après l'import
5. **Testez avec un petit fichier** avant d'importer une grande compétition

### ❌ À éviter
1. Ne laissez pas de **lignes vides** entre les athlètes
2. N'utilisez pas de **cellules fusionnées**
3. N'ajoutez pas de **formules Excel** dans les cellules
4. Ne mettez pas plusieurs athlètes dans une seule cellule

## 🔄 Ré-import

Vous pouvez **importer plusieurs fois** :
- L'import **écrase** les aires/groupes existants
- Utile pour corriger rapidement des erreurs
- Les autres paramètres du formulaire (nom événement, horaires) restent inchangés

## 💡 Cas d'usage

### Import partiel + saisie manuelle
1. Importez vos groupes principaux via Excel
2. Ajoutez manuellement des groupes supplémentaires si nécessaire
3. Modifiez les noms d'athlètes directement dans le formulaire après import

### Réutilisation de données
1. Sauvegardez vos fichiers Excel de tournois précédents
2. Modifiez uniquement les athlètes qui changent
3. Importez pour recréer rapidement un planning similaire

## 📞 Support

En cas de problème :
1. Vérifiez que votre fichier respecte le format (Colonne A = Groupe, B = Athlète)
2. Téléchargez à nouveau le template si besoin
3. Consultez les messages d'erreur détaillés dans l'interface

---

**Bon planning ! 🥋🏆**
