# 📧 Tests de Validation Email (SPF/DKIM/DMARC/MX)

Ce dossier contient une suite de tests complète pour valider les règles de validation email implémentées dans `dns2mermaid.js`.

## 🎯 Objectif

Tester les 10 règles de validation email avec 3 niveaux de sévérité :
- 🚨 **CRITICAL** (2 règles) : Violations bloquantes
- ⚠️ **WARNING** (5 règles) : Problèmes à corriger
- ℹ️ **INFO** (3 règles) : Bonnes pratiques

## 📁 Structure

```
tests/email-validation/
├── README.md                              # Ce fichier
├── COVERAGE.md                            # Détail de la couverture
├── run-tests.js                           # Script de test JavaScript (cross-platform)
│
├── 01_valid_email_full.csv                # ✅ Configuration valide complète
├── 02_critical_spf_permissive.csv         # 🚨 SPF +all
├── 03_critical_dmarc_missing.csv          # 🚨 DMARC manquant
├── 04_warning_spf_too_many_lookups.csv    # ⚠️ SPF >10 lookups
├── 05_warning_mx_not_in_spf.csv           # ⚠️ MX absent du SPF
├── 06_warning_dkim_invalid.csv            # ⚠️ DKIM invalide
├── 07_info_dmarc_policy_none.csv          # ℹ️ DMARC p=none
├── 08_info_dkim_missing.csv               # ℹ️ DKIM manquant
├── 09_info_autodiscover_missing.csv       # ℹ️ Autodiscover manquant
└── 10_multiple_violations.csv             # 🔥 Violations multiples
```

## 🚀 Exécution des Tests

### Via npm (recommandé)

```bash
npm run test:email    # Tests email uniquement
npm test              # Tous les tests (DNS + Email)
```

### Directement avec Node.js

```bash
cd tests/email-validation
node run-tests.js
```

## 📋 Détail des Tests

### Test #01 : Configuration Email Valide ✅

**Fichier** : `01_valid_email_full.csv`

**Description** : Configuration email complète et conforme
- SPF avec `-all`
- DKIM présent avec clé valide
- DMARC avec `p=quarantine`
- Autodiscover configuré

**Résultat attendu** : ✅ Aucune violation détectée

---

### Test #02 : SPF Trop Permissif 🚨 CRITICAL

**Fichier** : `02_critical_spf_permissive.csv`

**Règle** : `SPF_ALL_PERMISSIVE`  
**Sévérité** : 🚨 CRITICAL

**Problème** : SPF avec `+all` permet à n'importe qui d'envoyer des emails au nom du domaine

**Exemple** :
```dns
bad-spf.com.  IN  TXT  "v=spf1 +all"
```

**Référence** : RFC 7208 Section 5.1

---

### Test #03 : DMARC Manquant avec MX Publics 🚨 CRITICAL

**Fichier** : `03_critical_dmarc_missing.csv`

**Règle** : `DMARC_MISSING_WITH_PUBLIC_MX`  
**Sévérité** : 🚨 CRITICAL

**Problème** : Domaine avec serveurs MX publics mais sans politique DMARC → Risque de phishing/spoofing

**Solution** : Ajouter un enregistrement DMARC :
```dns
_dmarc.example.com.  IN  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com"
```

**Référence** : RFC 7489 Section 6.3

---

### Test #04 : SPF Trop de Lookups ⚠️ WARNING

**Fichier** : `04_warning_spf_too_many_lookups.csv`

**Règle** : `SPF_TOO_MANY_LOOKUPS`  
**Sévérité** : ⚠️ WARNING

**Problème** : SPF avec plus de 10 lookups DNS → Risque de `PermError`

**Mécanismes comptés** :
- `include:`
- `a:` / `mx:` / `ptr:` / `exists:`
- `redirect=`
- `a` et `mx` implicites

**Limite RFC 7208** : 10 lookups maximum

**Solution** : Réduire le nombre d'`include:` ou utiliser des plages IP directes

---

### Test #05 : MX Non Inclus dans SPF ⚠️ WARNING

**Fichier** : `05_warning_mx_not_in_spf.csv`

**Règle** : `MX_NOT_IN_SPF`  
**Sévérité** : ⚠️ WARNING

**Problème** : Les serveurs MX ne sont pas autorisés dans le SPF → Emails sortants risquent d'être rejetés

**Exemple problématique** :
```dns
example.com.  IN  MX    10 mail1.example.com.
example.com.  IN  MX    20 mail2.example.com.
example.com.  IN  TXT   "v=spf1 ip4:203.0.113.50 -all"  ❌ MX absents
```

**Solution** : Ajouter mécanisme `mx` :
```dns
example.com.  IN  TXT   "v=spf1 mx ip4:203.0.113.50 -all"
```

**Référence** : RFC 7208 Section 5.4

---

### Test #06 : DKIM Format Invalide ⚠️ WARNING

**Fichier** : `06_warning_dkim_invalid.csv`

**Règle** : `DKIM_INVALID_FORMAT`  
**Sévérité** : ⚠️ WARNING

**Problèmes détectés** :
- ❌ Absence de `v=DKIM1`
- ❌ Clé publique vide (`p=`)
- ❌ Clé manquante

**Exemple invalide** :
```dns
selector1._domainkey.example.com.  IN  TXT  "k=rsa; p="  ❌
```

**Format valide** :
```dns
selector1._domainkey.example.com.  IN  TXT  "v=DKIM1; k=rsa; p=MIGfMA0GCS..."
```

**Référence** : RFC 6376 Section 3.6.1

---

### Test #07 : DMARC Policy None ℹ️ INFO

**Fichier** : `07_info_dmarc_policy_none.csv`

**Règle** : `DMARC_POLICY_NONE`  
**Sévérité** : ℹ️ INFO

**Situation** : DMARC en mode monitoring uniquement (`p=none`)

**Recommandation** : Évoluer vers `p=quarantine` ou `p=reject` après analyse des rapports

**Progression recommandée** :
1. **Phase 1** : `p=none` (observation)
2. **Phase 2** : `p=quarantine; pct=25` (mise en quarantaine progressive)
3. **Phase 3** : `p=quarantine; pct=100` (mise en quarantaine complète)
4. **Phase 4** : `p=reject` (rejet)

**Référence** : RFC 7489 Section 6.3

---

### Test #08 : DKIM Manquant ℹ️ INFO

**Fichier** : `08_info_dkim_missing.csv`

**Règle** : `DKIM_MISSING`  
**Sévérité** : ℹ️ INFO

**Situation** : Domaine avec MX publics mais sans DKIM

**Impact** :
- ❌ Pas de signature email
- ❌ Authentification DMARC incomplète (SPF seul)
- ⚠️ Taux de délivrabilité potentiellement réduit

**Solution** : Configurer DKIM avec sélecteur :
```dns
selector1._domainkey.example.com.  IN  TXT  "v=DKIM1; k=rsa; p=..."
```

**Référence** : RFC 6376

---

### Test #09 : Autodiscover Manquant ℹ️ INFO

**Fichier** : `09_info_autodiscover_missing.csv`

**Règle** : `AUTODISCOVER_MISSING`  
**Sévérité** : ℹ️ INFO

**Situation** : Pas de configuration autodiscover/autoconfig

**Impact** : Configuration manuelle requise pour clients email (Outlook, Thunderbird)

**Solutions** :
```dns
# Exchange / Office365
autodiscover.example.com.  IN  CNAME  autodiscover.outlook.com.

# Thunderbird / Mozilla
autoconfig.example.com.     IN  A      203.0.113.50
```

**Référence** : Bonne pratique (Exchange/Office365/Thunderbird)

---

### Test #10 : Violations Multiples 🔥

**Fichier** : `10_multiple_violations.csv`

**Description** : Configuration avec plusieurs violations simultanées
- 🚨 SPF `+all`
- 🚨 DMARC manquant
- ⚠️ SPF >10 lookups
- ⚠️ MX non dans SPF
- ⚠️ DKIM invalide

**Objectif** : Tester la détection cumulative

---

## 📊 Résultats Attendus

```
============================================================================
RÉSUMÉ DES TESTS
============================================================================

Total de tests   : 10
Tests réussis    : 10
Tests échoués    : 0

✅ Tous les tests sont passés !

🎉 La validation email fonctionne correctement.
   Vous pouvez maintenant utiliser --email-validation en production.
```

## 🔧 Dépannage

### Test échoué : "Violation non détectée"

**Cause** : La règle n'est pas implémentée ou la condition de détection ne fonctionne pas

**Solution** :
1. Vérifier que le flag `--email-validation` est bien passé
2. Examiner le rapport généré : `tests/email-validation/output/XX/validation_report.txt`
3. Vérifier l'implémentation de la règle dans `validateEmailRecords()`

### Test échoué : "Rapport non généré"

**Cause** : Erreur lors de l'exécution de `dns2mermaid.js`

**Solution** :
1. Exécuter manuellement : `node dns2mermaid.js -i tests/email-validation/XX_test.csv --email-validation`
2. Vérifier les messages d'erreur
3. Vérifier que le CSV est bien formé

### Tous les tests échouent

**Causes possibles** :
1. Flag `--email-validation` non reconnu
2. Fonction `validateEmailRecords()` non définie
3. Node.js non installé ou version incompatible

**Diagnostic** :
```bash
node --version                                     # Doit être >= 14
node run-tests.js                                  # Test direct
node dns2mermaid.js --help | grep "email-validation"
```

## 📖 Références

- **RFC 7208** : Sender Policy Framework (SPF)
- **RFC 6376** : DomainKeys Identified Mail (DKIM)
- **RFC 7489** : Domain-based Message Authentication, Reporting, and Conformance (DMARC)
- **RFC 5321** : Simple Mail Transfer Protocol (SMTP)

## 🤝 Contribution

Pour ajouter un nouveau test :

1. Créer un fichier CSV : `XX_description.csv`
2. Ajouter le test dans `run-tests.js` (fonction `checkViolation()`)
3. Documenter le test dans ce README et `COVERAGE.md`
4. Exécuter la suite complète : `npm run test:email`

## 📝 Licence

MIT License - Voir fichier LICENSE du projet principal
