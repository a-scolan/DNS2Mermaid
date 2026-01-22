# DNS2Mermaid - Cas de démonstration

Infrastructure DNS simple d'une entreprise fictive **ACME Corporation** avec quelques erreurs courantes détectées.

## Contenu

**Fichier source** : `demo_complete.csv` (11 enregistrements DNS)

**Infrastructure** :
- Domaine : `acme-corp.com` 
- Services : www, blog, mail, api, ns1
- Multi-vue : Internal (10.0.x.x) / External (198.51.100.x)
- Email : SPF + DMARC configurés

**Erreurs intentionnelles** (pour démonstration) :
- ⚠️ **CNAME_CHAIN** : `blog` → `www` → `acme-corp.com` (2 niveaux)
- ⚠️ **INCONSISTENT_TTL** : `api.acme-corp.com` a des TTL différents selon la vue (3600 vs 86400)

## Génération

```bash
# Commande complète avec toutes les validations
node dns2mermaid.js -i demo/demo_complete.csv --compact-layout --svg demo/demo.svg
# Note : Validations SSL et HTTP/HTTPS activées par défaut (40 checks simultanés)
# Pour désactiver : --no-ssl-check --no-http-check
# Rapport CSV enrichi généré automatiquement
```

**Résultat** : `demo.mmd` (diagramme Mermaid) + `demo.svg` (image) + `legend.svg` (légende) + `validation_report.txt` (rapport RFC + SSL + HTTP) + `analysis_report.csv` (rapport enrichi)

## Démonstration

Ce cas permet de montrer :
- ✅ Visualisation claire d'une infrastructure DNS réelle
- ✅ Multi-vue (Internal/External) avec couleurs distinctes
- ✅ Groupement automatique des sous-domaines email (_dmarc)
- ✅ Détection d'erreurs RFC courantes (chaînes CNAME, TTL incohérents)
- ✅ Vérification certificats SSL/TLS avec barres de progression
- ✅ Tests de disponibilité HTTP/HTTPS avec codes statut intégrés (HTTPS:200, HTTP:404, HTTP/S:KO)
- ✅ Optimisation : SSL valide → HTTPS automatiquement marqué comme disponible
