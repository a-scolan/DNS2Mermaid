# 🔍 DNS2Mermaid - Démonstration

> **Visualisation & Validation RFC des infrastructures DNS**

Un outil en ligne de commande qui transforme vos enregistrements DNS en diagrammes visuels clairs tout en détectant automatiquement les non-conformités RFC et les problèmes de configuration.

---

## 🎯 Fonctionnalités Principales

| Feature | Description |
|---------|-------------|
| 📊 **Visualisation** | Génère des diagrammes Mermaid et SVG professionnels de votre infrastructure DNS |
| ✅ **Validation RFC** | Détecte automatiquement 19 types de violations RFC et bonnes pratiques |
| 🔒 **Certificats SSL** | Vérifie les certificats SSL/TLS et alerte sur les expirations (40 checks simultanés) |
| 🌐 **HTTP/HTTPS** | Teste la disponibilité des domaines avec codes statut (HTTPS:200, HTTP:404, etc.) |
| 🌐 **Multi-vue** | Supporte les vues Internal/External avec codes couleur |
| 📧 **Email** | Groupe automatiquement les enregistrements DMARC, DKIM, SPF |
| ⚡ **Compact** | Mode layout optimisé pour les grandes infrastructures |

---

## 📋 Cas de Démonstration

Infrastructure DNS d'**ACME Corporation** avec quelques erreurs courantes intentionnelles pour illustrer les capacités de détection.

### 📊 Statistiques

```
🌐 Domaines analysés     : 7
📝 Enregistrements DNS   : 11
🔢 Adresses IP           : 5
⚠️  Violations WARNING   : 2
ℹ️  Recommandations INFO : 4
```

### ⚠️ Violations Détectées

#### 1. 🔗 CNAME_CHAIN (WARNING)

**Domaine** : `blog.acme-corp.com`

**Problème** : Chaîne CNAME à 2 niveaux
```
blog.acme-corp.com → www.acme-corp.com → acme-corp.com
```

**Impact** : Les chaînes CNAME dégradent les performances et augmentent les temps de résolution.

**Référence** : 📖 RFC 2181 Section 10.1

---

#### 2. ⏱️ INCONSISTENT_TTL (WARNING)

**Domaine** : `api.acme-corp.com`

**Problème** : TTL incohérents entre les vues
```
Vue External : 3600s (1 heure)
Vue Internal : 86400s (24 heures)
```

**Impact** : Des TTL incohérents causent un comportement de cache imprévisible entre les vues.

**Référence** : 📖 RFC 1035 Section 3.2.1

---

#### 3. 🌐 MISSING_IPV6 (INFO)

**Domaines affectés** : 4 domaines

**Problème** : Enregistrements A sans AAAA correspondant (IPv6)

**Recommandation** : Supporter IPv6 pour la modernisation de l'infrastructure.

**Référence** : 📖 RFC 8200 (IPv6 Specification)

---

## 🎨 Diagramme Généré

![Diagramme DNS ACME Corporation](demo.svg)

<details>
<summary>📖 Légende des symboles</summary>

![Légende](legend.svg)

</details>

---

## 💻 Installation & Utilisation

### Installation

```bash
# Cloner le dépôt
git clone https://github.com/a-scolan/DNS2Mermaid.git
cd DNS2Mermaid

# Installer les dépendances
npm install
```

### Génération de la démo

```bash
# Commande rapide
npm run demo

# Ou commande complète avec toutes les validations
node dns2mermaid.js -i demo/demo_complete.csv \
  --compact-layout \
  --svg demo.svg \
  --background white
# Note : SSL et HTTP/HTTPS activés par défaut
```

### Résultats

Fichiers générés dans `demo/` :
- ✅ `demo.svg` - Diagramme visuel
- ✅ `demo.mmd` - Source Mermaid
- ✅ `legend.svg` - Légende des symboles
- ✅ `validation_report.txt` - Rapport détaillé des violations

---

## 📝 Fichier Source CSV

```csv
TTL,Name,Type,Value,View
3600,acme-corp.com,A,198.51.100.10,ext
3600,acme-corp.com,MX,10 mail.acme-corp.com,ext
3600,acme-corp.com,NS,ns1.acme-corp.com,ext
3600,acme-corp.com,TXT,"v=spf1 mx ip4:198.51.100.0/24 -all",ext
3600,www.acme-corp.com,CNAME,acme-corp.com,ext
3600,blog.acme-corp.com,CNAME,www.acme-corp.com,ext
3600,mail.acme-corp.com,A,198.51.100.20,ext
3600,ns1.acme-corp.com,A,198.51.100.30,ext
3600,api.acme-corp.com,A,198.51.100.40,ext
86400,api.acme-corp.com,A,10.0.1.40,int
3600,_dmarc.acme-corp.com,TXT,"v=DMARC1; p=quarantine; rua=mailto:dmarc@acme-corp.com",ext
```

---

## 🚀 Fonctionnalités Avancées

### Options de ligne de commande

```bash
# Mode compact pour grandes infrastructures
--compact-layout

# Validation SSL/TLS avec email
--email-validation

# Ignorer certaines règles
--ignore-rules MISSING_IPV6,TTL_TOO_SHORT

# Ignorer les timeouts SSL
--ssl-no-timeout-errors

# Format de sortie
--svg output.svg --background white

# Rapport seul (mode CI/CD)
--no-diagram -r validation_report.txt
```

### Multi-vue (Internal/External)

DNS2Mermaid distingue automatiquement les vues :
- 🔵 **Internal** : Adresses privées RFC 1918
- 🟢 **External** : Adresses publiques
- 🟣 **Both** : Présent dans les deux vues

---

## 📚 Types de Validation

### 🚨 CRITICAL (Bloquant)
- `CNAME_COEXISTENCE` - Un CNAME ne peut coexister avec d'autres types
- `CNAME_ON_APEX` - CNAME interdit sur zone apex
- `CNAME_LOOP` - CNAME pointant vers lui-même
- `MX_TO_CNAME` / `NS_TO_CNAME` - MX/NS vers CNAME interdit
- `SPF_TOO_PERMISSIVE` - SPF avec +all dangereux

### ⚠️ WARNING (Important)
- `CNAME_CHAIN` - Chaînes CNAME dégradent les performances
- `INCONSISTENT_TTL` - TTL incohérents
- `TTL_TOO_SHORT` - TTL < 60s charge excessive
- `MX_ORPHAN` / `NS_ORPHAN` - Pointe vers nom non résolu

### ℹ️ INFO (Recommandations)
- `MISSING_IPV6` - Absence d'IPv6
- `TTL_TOO_LONG` - TTL > 24h ralentit les changements
- `WILDCARD_RESTRICTION` - Wildcards avec certains types
- `DUPLICATE_RECORD` - Enregistrements redondants
- `CNAME_ORPHAN` - CNAME vers domaine externe

---

## 🎓 Rapport de Validation

Le rapport de validation complet est disponible dans le fichier [`validation_report.txt`](./validation_report.txt).

### Extrait du Rapport

```
═══════════════════════════════════════════════════════════
           RAPPORT DE VALIDATION DNS RFC
              & CERTIFICATS SSL/TLS
═══════════════════════════════════════════════════════════

Date: 2025-12-11T16:48:53.192Z
Fichier source: demo/demo_complete.csv
Domaines analysés: 7
Violations détectées: 6

CERTIFICATS SSL/TLS VÉRIFIÉS: 6
🟢 OK (>21j): 1
⚠️  WARNING (7-21j): 0
🚨 CRITICAL (<7j): 0
❌ ERREURS: 4

🚨 Violations BLOQUANTES (CRITICAL): 0
⚠️  Problèmes à corriger (WARNING): 2
ℹ️  Bonnes pratiques (INFO): 4

📊 BILAN PAR RÈGLE:

   ℹ️ MISSING_IPV6: 4 violation(s)
   ⚠️ CNAME_CHAIN: 1 violation(s)
   ⚠️ INCONSISTENT_TTL: 1 violation(s)

───────────────────────────────────────────────────────────


⚠️  PROBLÈMES À CORRIGER RAPIDEMENT:

1. [CNAME_CHAIN] blog.acme-corp.com
   CNAME pointe vers un autre CNAME (www.acme-corp.com -> acme-corp.com)
   Référence: RFC 2181 Section 10.1 (Performance)
   Enregistrements affectés: CNAME www.acme-corp.com

2. [INCONSISTENT_TTL] api.acme-corp.com
   TTL incohérents pour les enregistrements A/AAAA (3600, 86400)
   Référence: RFC 1035 Section 3.2.1 (Cache DNS)
   Enregistrements affectés: A 198.51.100.40, A 10.0.1.40


ℹ️  RECOMMANDATIONS (BONNES PRATIQUES):

1. [MISSING_IPV6] acme-corp.com
   Enregistrement A sans AAAA correspondant (bonne pratique: supporter IPv6)
   Référence: Bonne pratique : RFC 8200 (IPv6 Specification)
   Enregistrements affectés: A 198.51.100.10

2. [MISSING_IPV6] mail.acme-corp.com
   Enregistrement A sans AAAA correspondant (bonne pratique: supporter IPv6)
   Référence: Bonne pratique : RFC 8200 (IPv6 Specification)
   Enregistrements affectés: A 198.51.100.20

3. [MISSING_IPV6] ns1.acme-corp.com
   Enregistrement A sans AAAA correspondant (bonne pratique: supporter IPv6)
   Référence: Bonne pratique : RFC 8200 (IPv6 Specification)
   Enregistrements affectés: A 198.51.100.30

4. [MISSING_IPV6] api.acme-corp.com
   Enregistrement A sans AAAA correspondant (bonne pratique: supporter IPv6)
   Référence: Bonne pratique : RFC 8200 (IPv6 Specification)
   Enregistrements affectés: A 198.51.100.40, A 10.0.1.40

───────────────────────────────────────────────────────────
```

📄 **[Voir le rapport complet](./validation_report.txt)** (180 lignes, inclut les détails SSL/TLS et toutes les règles validées)

---

## 📊 Rapport CSV Enrichi

Le fichier [`analysis_report.csv`](./analysis_report.csv) contient tous les enregistrements DNS avec des colonnes d'analyse ajoutées.

### Aperçu des Données

| Name | Type | Value | Violations | SSL_Status | HTTPS_Status | IP_Type | Is_Orphan |
|------|------|-------|------------|------------|--------------|---------|-----------|
| acme-corp.com | A | 198.51.100.10 | MISSING_IPV6 | Valid | 200 | IPv4 | No |
| acme-corp.com | MX | 10 mail.acme-corp.com | - | Valid | 200 | - | No |
| www.acme-corp.com | CNAME | acme-corp.com | - | Valid | 200 | - | No |
| blog.acme-corp.com | CNAME | www.acme-corp.com | CNAME_CHAIN | Valid | 200 | - | No |
| api.acme-corp.com | A | 198.51.100.40 | MISSING_IPV6;INCONSISTENT_TTL | Valid | Error: Timeout | IPv4 | No |
| api.acme-corp.com | A | 10.0.1.40 | MISSING_IPV6;INCONSISTENT_TTL | Valid | Error: Timeout | IPv4 (Private RFC1918) | No |

**21 colonnes au total** incluant :
- **Colonnes originales** : TTL, Name, Type, Value, View
- **Violations DNS** : Violations, Violation_Severity, Violation_Count
- **SSL/TLS** : SSL_Status, SSL_Expiry_Days, SSL_Issuer
- **HTTP/HTTPS** : HTTP_Status, HTTPS_Status, HTTP_Response_Time, HTTPS_Response_Time
- **IP Analysis** : IP_Type, IP_Count, View_Type
- **Résolution** : Is_Orphan, Points_To, Resolved_IPs

📊 **Cas d'usage** : Analyse Excel avec tableaux croisés dynamiques, scripts Python/Pandas, tableaux de bord Power BI/Tableau, suivi temporel des configurations DNS.

---

## 🔗 Liens Utiles

- 📖 [Documentation complète](../README.md)
- 🐛 [Signaler un bug](https://github.com/a-scolan/DNS2Mermaid/issues)
- 💡 [Demander une fonctionnalité](https://github.com/a-scolan/DNS2Mermaid/issues/new)
- 📦 [Releases](https://github.com/a-scolan/DNS2Mermaid/releases)

---

## 📄 License

AGPL-3.0 License - Powered by Node.js & Mermaid

**Version** : 1.1.0
