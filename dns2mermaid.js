const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const tls = require('tls'); // Module natif Node.js pour SSL/TLS

// --- PARSING DES ARGUMENTS CLI ---
const args = process.argv.slice(2);
const getArg = (flag, defaultValue) => {
    const index = args.indexOf(flag);
    return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
};
const hasFlag = (flag) => args.includes(flag);

// Afficher l'aide
if (hasFlag('--help') || hasFlag('-h')) {
    console.log(`
┌─────────────────────────────────────────────────────────────┐
│           DNS to Mermaid Converter & Validator             │
└─────────────────────────────────────────────────────────────┘

Usage: node dns2mermaid.js [options]

OPTIONS:
  -i, --input <file>        Fichier CSV d'entrée (défaut: input.csv)
  -o, --output <file>       Fichier Mermaid de sortie (défaut: output.mmd)
  -l, --legend <file>       Fichier légende de sortie (défaut: legend.mmd)
  -r, --report <file>       Rapport de validation (défaut: validation_report.txt)
  --csv-report <file>       Rapport CSV enrichi (défaut: analysis_report.csv)
  --no-csv-report           Désactiver génération du rapport CSV enrichi
  
  --folder <dir>            Traiter tous les CSV d'un dossier (génère sous-dossiers)
  --output-dir <dir>        Dossier de sortie personnalisé (écrase comportement par défaut)
  --no-timestamp            Désactiver suffixe datetime (défaut: activé)
  --svg <file>              Fichier SVG de sortie (défaut: output.svg)
  --legend-svg <file>       Légende SVG de sortie (défaut: legend.svg)
  --no-export               Désactiver l'export SVG
  --no-diagram              Désactiver génération diagramme (rapport seul)
  
  --direction <TB|LR>       Direction du flowchart (défaut: TB)
  --scale <number>          Échelle pour export (défaut: 2)
  --background <color>      Couleur de fond SVG (défaut: white)
  
  --no-validation           Désactiver la validation RFC
  --email-validation        Activer validation email (SPF/DKIM/DMARC/MX)
  --ignore-rules <codes>    Ignorer des règles spécifiques (ex: CNAME_CHAIN,TTL_TOO_SHORT)
  --no-legend               Ne pas générer la légende
  --no-ssl-check            Désactiver la validation SSL/TLS (activée par défaut)
  --ssl-port <port>         Port SSL à vérifier (défaut: 443)
  --ssl-no-timeout-errors   Masquer les erreurs de timeout SSL dans le rapport
  --no-http-check           Désactiver validation HTTP/HTTPS (activée par défaut)
  --http-timeout <ms>       Timeout HTTP en millisecondes (défaut: 5000)
  --show-orphans            Afficher les nœuds orphelins (externes non résolus)
  --compact-layout          Layout compact (réduit l'étalement des subgraphs)
  --quiet                   Mode silencieux (minimal output)
  --language <lang>         Langue des rapports: 'en' (défaut) ou 'fr'
  --lang <lang>             Alias pour --language
  
  -h, --help                Afficher cette aide

EXEMPLES:
  node dns2mermaid.js -i production-dns.csv     # Crée production-dns_20260122_143025/
  node dns2mermaid.js -i zones.csv --no-timestamp  # Comportement original (output.mmd)
  node dns2mermaid.js -i zones.csv --output-dir ./custom-dir  # Dossier personnalisé
  node dns2mermaid.js --no-export --direction LR
  node dns2mermaid.js --folder ./my-dns-zones   # Traiter tous les CSV du dossier
  node dns2mermaid.js --no-ssl-check            # Désactiver validation SSL
  node dns2mermaid.js --no-http-check           # Désactiver validation HTTP/HTTPS
  node dns2mermaid.js --ssl-port 8443           # Port SSL personnalisé
  node dns2mermaid.js --ssl-no-timeout-errors   # Masquer timeouts SSL
  node dns2mermaid.js --email-validation        # Valider SPF/DKIM/DMARC
  node dns2mermaid.js --compact-layout          # Layout compact (gros subgraphs)
  node dns2mermaid.js --ignore-rules CNAME_CHAIN,TTL_TOO_SHORT  # Ignorer certaines règles
  node dns2mermaid.js -i dns.csv --svg export.svg --background transparent
  node dns2mermaid.js --no-diagram              # Rapport de validation uniquement

MODE BATCH (--folder):
  Structure générée (avec timestamps par défaut):
    ./my-dns-zones/
      ├── zone1.csv
      ├── zone2.csv
      └── output/
          ├── zone1_20260122_143025/
          │   ├── output.mmd
          │   ├── output.svg
          │   ├── legend.svg
          │   ├── validation_report.txt
          │   └── analysis_report.csv
          └── zone2_20260122_143026/
              ├── output.mmd
              └── ...

VUES DNS (colonne View dans CSV):
  int, priv    → Vue interne (bleu 🔵)
  ext, pub     → Vue externe (vert 🟢)
  Les deux     → Interne & Externe (violet 🟣)

VALIDATION RFC (17 règles):
  🚨 CRITICAL  → Violations bloquantes (CNAME+A, MX→CNAME, etc.)
  ⚠️  WARNING  → À corriger rapidement (CNAME chaîné, TTL court, ségrégation vues)
  ℹ️  INFO     → Bonnes pratiques (IPv6 manquant, TTL long, etc.)

VALIDATION EMAIL (--email-validation, 10 règles):
  🚨 CRITICAL  → SPF +all, DMARC manquant avec MX publics
  ⚠️  WARNING  → SPF lookups >10, MX non inclus dans SPF, DKIM invalide
  ℹ️  INFO     → DMARC p=none, autodiscover manquant

VALIDATION SSL (activée par défaut):
  🔴 CRITICAL  → Certificat expiré ou expire dans < 7 jours
  🟠 WARNING   → Expire dans 7-21 jours
  🟢 OK        → Expire dans > 21 jours
  ℹ️  Note     → Les zones inverses (*.in-addr.arpa, *.ip6.arpa) sont exclues

VALIDATION HTTP/HTTPS (--http-check):
  ✅ 200-299   → Codes succès (OK)
  🔀 300-399   → Redirections (vérifier configuration)
  ⚠️  400-499  → Erreurs client (domaine accessible mais erreur)
  🚨 500-599   → Erreurs serveur (problème backend)
  ❌ Timeout   → Serveur injoignable
  ℹ️  Note     → Résolution DNS forcée selon le CSV (pas de résolution système)

CODES DE RÈGLES (pour --ignore-rules):
  DNS CRITICAL: CNAME_COEXISTENCE, CNAME_ON_APEX, CNAME_LOOP, 
                MX_POINTING_TO_CNAME, NS_POINTING_TO_CNAME, 
                MX_NS_MISSING_GLUE, SPF_TOO_PERMISSIVE
  DNS WARNING:  CNAME_CHAIN, INCONSISTENT_TTL, TTL_TOO_SHORT, SPF_NEUTRAL,
                CNAME_ORPHAN, VIEW_SEGREGATION_PRIVATE_EXTERNAL
  DNS INFO:     MISSING_IPV6, TTL_TOO_LONG, WILDCARD_RESTRICTION, DUPLICATE_RECORD
  
  EMAIL CRITICAL: SPF_ALL_PERMISSIVE, DMARC_MISSING_WITH_PUBLIC_MX
  EMAIL WARNING:  SPF_TOO_MANY_LOOKUPS, MX_NOT_IN_SPF, DKIM_INVALID_FORMAT,
                  DKIM_WEAK_KEY, DMARC_NO_REPORTING
  EMAIL INFO:     DMARC_POLICY_NONE, DKIM_MISSING, AUTODISCOVER_MISSING
`);
    process.exit(0);
}

// --- CONFIGURATION ---
const BATCH_FOLDER = getArg('--folder', '');
const INPUT_FILE = getArg('-i', getArg('--input', 'input.csv'));
const OUTPUT_FILE = getArg('-o', getArg('--output', 'output.mmd'));
const LEGEND_FILE = getArg('-l', getArg('--legend', 'legend.mmd'));
const VALIDATION_FILE = getArg('-r', getArg('--report', 'validation_report.txt'));
const CSV_REPORT_FILE = getArg('--csv-report', 'analysis_report.csv');
const SVG_FILE = getArg('--svg', 'output.svg');
const LEGEND_SVG_FILE = getArg('--legend-svg', 'legend.svg');
const CUSTOM_OUTPUT_DIR = getArg('--output-dir', '');

const ENABLE_IMG_EXPORT = !hasFlag('--no-export');
const ENABLE_VALIDATION = !hasFlag('--no-validation');
const ENABLE_EMAIL_VALIDATION = hasFlag('--email-validation'); // Désactivé par défaut
const ENABLE_CSV_REPORT = !hasFlag('--no-csv-report'); // Activé par défaut
const ENABLE_LEGEND = !hasFlag('--no-legend');
const ENABLE_DIAGRAM = !hasFlag('--no-diagram'); // NOUVEAU
const ENABLE_SSL_CHECK = !hasFlag('--no-ssl-check'); // Activé par défaut
const SSL_PORT = parseInt(getArg('--ssl-port', '443'), 10);
const SSL_HIDE_TIMEOUT_ERRORS = hasFlag('--ssl-no-timeout-errors'); // Désactivé par défaut
const ENABLE_HTTP_CHECK = !hasFlag('--no-http-check'); // Activé par défaut
const HTTP_TIMEOUT = parseInt(getArg('--http-timeout', '5000'), 10);
const SHOW_ORPHANS = hasFlag('--show-orphans'); // Désactivé par défaut
const COMPACT_LAYOUT = hasFlag('--compact-layout'); // Désactivé par défaut
const QUIET_MODE = hasFlag('--quiet');
const NO_TIMESTAMP = hasFlag('--no-timestamp'); // Désactivé par défaut (timestamps activés)

// Language support (English by default, French with --language fr)
const LANGUAGE = getArg('--language', getArg('--lang', 'en')).toLowerCase();
const LANG = LANGUAGE === 'fr' ? 'fr' : 'en'; // Force 'en' or 'fr'

// Translation strings for reports and messages
const TRANSLATIONS = {
    'en': {
        'report_title': 'DNS RFC VALIDATION REPORT',
        'report_title_with_ssl': 'DNS RFC VALIDATION REPORT\n              & SSL/TLS CERTIFICATES',
        'date': 'Date: ',
        'source_file': 'Source file: ',
        'domains_analyzed': 'Domains analyzed: ',
        'violations_detected': 'Violations detected: ',
        'ignored_rules': 'Ignored rules (--ignore-rules): ',
        'ssl_certificates_verified': 'SSL/TLS CERTIFICATES VERIFIED: ',
        'ssl_ok': '🟢 OK (>21d): ',
        'ssl_warning': '⚠️  WARNING (7-21d): ',
        'ssl_critical': '🚨 CRITICAL (<7d): ',
        'ssl_errors': '❌ ERRORS: ',
        'http_availability': 'HTTP/HTTPS AVAILABILITY: ',
        'http_strategy': 'domain(s) tested (HTTPS-FIRST strategy)',
        'http_ok': '✅ Accessible (2xx): ',
        'http_redirects': '🔀 Redirects (3xx): ',
        'http_client_errors': '⚠️  Client errors (4xx): ',
        'http_server_errors': '🚨 Server errors (5xx): ',
        'http_connection_errors': '❌ Connection errors: ',
        'no_violations': '✅ No DNS violations detected. Configuration complies with RFC standards.',
        'violations_critical': '🚨 BLOCKING VIOLATIONS (CRITICAL): ',
        'violations_warning': '⚠️  ISSUES TO FIX (WARNING): ',
        'violations_info': 'ℹ️  BEST PRACTICES (INFO): ',
        'rule_summary': 'RULE SUMMARY:',
        'violations_header_critical': '🚨 BLOCKING VIOLATIONS (TO FIX IMMEDIATELY):',
        'violations_header_warning': '⚠️  ISSUES TO FIX QUICKLY:',
        'violations_header_info': 'ℹ️  RECOMMENDATIONS (BEST PRACTICES):',
        'rules_validated': 'RULES VALIDATED (',
        'rules_count': ' rules',
        'rules_dns': '19 DNS',
        'rules_email': '10 Email',
        'blocking_violations': '🚨 BLOCKING (CRITICAL) - RFC Violations:',
        'cname_coexistence': 'CNAME_COEXISTENCE: A CNAME cannot coexist with other record types (RFC 1034)',
        'cname_on_apex': 'CNAME_ON_APEX: CNAME forbidden on zone apex/root domain (RFC 1912)',
        'cname_loop': 'CNAME_LOOP: A CNAME cannot point to itself',
        'mx_to_cname': 'MX_TO_CNAME: MX records cannot point to CNAMEs (RFC 2181)',
        'ns_to_cname': 'NS_TO_CNAME: NS records cannot point to CNAMEs (RFC 2181)',
        'mx_no_glue': 'MX_NO_GLUE / NS_NO_GLUE: MX/NS must point to names with A/AAAA records',
        'spf_too_permissive': 'SPF_TOO_PERMISSIVE: SPF with +all allows everyone',
        'spf_all_permissive': 'SPF_ALL_PERMISSIVE: SPF with +all (email validation)',
        'dmarc_missing': 'DMARC_MISSING_WITH_PUBLIC_MX: DMARC missing with public MX',
        'important_warnings': '⚠️  IMPORTANT (WARNING) - To fix quickly:',
        'cname_chain': 'CNAME_CHAIN: Chained CNAMEs degrade performance (RFC 2181)',
        'inconsistent_ttl': 'INCONSISTENT_TTL: Inconsistent TTLs cause unpredictable behavior',
        'ttl_too_short': 'TTL_TOO_SHORT: TTL < 60s generates excessive DNS load',
        'spf_neutral': 'SPF_NEUTRAL: SPF with ?all provides little protection',
        'mx_orphan': 'MX_ORPHAN / NS_ORPHAN: Points to an unresolved name',
        'view_segregation': 'VIEW_SEGREGATION_PRIVATE_EXTERNAL: Private RFC 1918 IP exposed in external view',
        'spf_many_lookups': 'SPF_TOO_MANY_LOOKUPS: SPF with >10 DNS lookups',
        'mx_not_in_spf': 'MX_NOT_IN_SPF: MX servers missing from SPF',
        'dkim_invalid': 'DKIM_INVALID_FORMAT: Invalid DKIM format',
        'dkim_weak': 'DKIM_WEAK_KEY: RSA key <1024 bits',
        'dmarc_no_reporting': 'DMARC_NO_REPORTING: No rua/ruf address',
        'recommendations': 'ℹ️  RECOMMENDATIONS (INFO) - Best practices:',
        'missing_ipv6': 'MISSING_IPV6: A record without AAAA (modernize)',
        'ttl_too_long': 'TTL_TOO_LONG: TTL > 86400s makes changes slow',
        'wildcard_restriction': 'WILDCARD_RESTRICTION: Caution with wildcards and certain types',
        'duplicate_record': 'DUPLICATE_RECORD: Redundant identical records',
        'cname_orphan': 'CNAME_ORPHAN: CNAME points to a name absent from dataset (check if external)',
        'inconsistent_ttl_multiview': 'INCONSISTENT_TTL_MULTIVIEW: Same record with different TTLs across views',
        'dmarc_policy_none': 'DMARC_POLICY_NONE: DMARC in monitoring mode (p=none)',
        'dkim_missing': 'DKIM_MISSING: No DKIM detected',
        'autodiscover_missing': 'AUTODISCOVER_MISSING: No autodiscover/autoconfig',
        'ssl_section': 'SSL/TLS CERTIFICATES TO RENEW',
        'ssl_critical_header': '🚨 CERTIFICATES EXPIRED OR EXPIRING UNDER 7 DAYS:',
        'ssl_expired': '❌ EXPIRED for ',
        'ssl_days': ' day(s)',
        'ssl_expires': '🚨 Expires in ',
        'ssl_issuer': 'Issuer: ',
        'ssl_valid_until': 'Valid until: ',
        'ssl_verified_from': 'Verified from: ',
        'ssl_domains_covered': 'Covered domains (',
        'ssl_warning_header': '⚠️  CERTIFICATES EXPIRING IN 7-21 DAYS:',
        'ssl_expires_in': '⚠️  Expires in ',
        'ssl_connection_errors': '❌ SSL CONNECTION ERRORS:',
        'ssl_error': 'Error: ',
        'ssl_verified_on': 'Verified from: ',
        'http_section': 'HTTP/HTTPS DOMAIN AVAILABILITY',
        'http_strategy_note': 'Strategy: HTTPS-FIRST (tests HTTPS first, HTTP only if HTTPS fails)',
        'http_dns_resolution': 'Note: DNS resolution forced according to CSV file (no system resolution)',
        'http_results_header': 'Test Results:',
        'http_domain': 'Domain: ',
        'http_protocol': 'Protocol: ',
        'http_status': 'Status: ',
    },
    'fr': {
        'report_title': 'RAPPORT DE VALIDATION DNS RFC',
        'report_title_with_ssl': 'RAPPORT DE VALIDATION DNS RFC\n              & CERTIFICATS SSL/TLS',
        'date': 'Date: ',
        'source_file': 'Fichier source: ',
        'domains_analyzed': 'Domaines analysés: ',
        'violations_detected': 'Violations détectées: ',
        'ignored_rules': 'Règles ignorées (--ignore-rules): ',
        'ssl_certificates_verified': 'CERTIFICATS SSL/TLS VÉRIFIÉS: ',
        'ssl_ok': '🟢 OK (>21j): ',
        'ssl_warning': '⚠️  WARNING (7-21j): ',
        'ssl_critical': '🚨 CRITICAL (<7j): ',
        'ssl_errors': '❌ ERREURS: ',
        'http_availability': 'DISPONIBILITÉ HTTP/HTTPS: ',
        'http_strategy': 'domaine(s) testé(s) (stratégie HTTPS-FIRST)',
        'http_ok': '✅ Accessibles (2xx): ',
        'http_redirects': '🔀 Redirections (3xx): ',
        'http_client_errors': '⚠️  Erreurs client (4xx): ',
        'http_server_errors': '🚨 Erreurs serveur (5xx): ',
        'http_connection_errors': '❌ Erreurs connexion: ',
        'no_violations': '✅ Aucune violation DNS détectée. Configuration conforme aux RFC.',
        'violations_critical': '🚨 Violations BLOQUANTES (CRITICAL): ',
        'violations_warning': '⚠️  Problèmes à corriger (WARNING): ',
        'violations_info': 'ℹ️  Bonnes pratiques (INFO): ',
        'rule_summary': 'BILAN PAR RÈGLE:',
        'violations_header_critical': '🚨 VIOLATIONS BLOQUANTES (À CORRIGER IMMÉDIATEMENT):',
        'violations_header_warning': '⚠️  PROBLÈMES À CORRIGER RAPIDEMENT:',
        'violations_header_info': 'ℹ️  RECOMMANDATIONS (BONNES PRATIQUES):',
        'rules_validated': 'RÈGLES VALIDÉES (',
        'rules_count': ' règles',
        'rules_dns': '19 DNS',
        'rules_email': '10 Email',
        'blocking_violations': '🚨 BLOQUANTES (CRITICAL) - Violations RFC:',
        'cname_coexistence': 'CNAME_COEXISTENCE: Un CNAME ne peut coexister avec d\'autres types (RFC 1034)',
        'cname_on_apex': 'CNAME_ON_APEX: CNAME interdit sur zone apex/domaine racine (RFC 1912)',
        'cname_loop': 'CNAME_LOOP: Un CNAME ne peut pointer vers lui-même',
        'mx_to_cname': 'MX_TO_CNAME: Les MX ne peuvent pointer vers des CNAMEs (RFC 2181)',
        'ns_to_cname': 'NS_TO_CNAME: Les NS ne peuvent pointer vers des CNAMEs (RFC 2181)',
        'mx_no_glue': 'MX_NO_GLUE / NS_NO_GLUE: MX/NS doivent pointer vers noms avec A/AAAA',
        'spf_too_permissive': 'SPF_TOO_PERMISSIVE: SPF avec +all autorise tout le monde',
        'spf_all_permissive': 'SPF_ALL_PERMISSIVE: SPF avec +all (email validation)',
        'dmarc_missing': 'DMARC_MISSING_WITH_PUBLIC_MX: DMARC manquant avec MX publics',
        'important_warnings': '⚠️  IMPORTANTES (WARNING) - À corriger rapidement:',
        'cname_chain': 'CNAME_CHAIN: Les CNAMEs chaînés dégradent les performances (RFC 2181)',
        'inconsistent_ttl': 'INCONSISTENT_TTL: TTL incohérents causent comportement imprévisible',
        'ttl_too_short': 'TTL_TOO_SHORT: TTL < 60s génère une charge DNS excessive',
        'spf_neutral': 'SPF_NEUTRAL: SPF avec ?all offre peu de protection',
        'mx_orphan': 'MX_ORPHAN / NS_ORPHAN: Pointe vers un nom non résolu',
        'view_segregation': 'VIEW_SEGREGATION_PRIVATE_EXTERNAL: IP privée RFC 1918 exposée en vue externe',
        'spf_many_lookups': 'SPF_TOO_MANY_LOOKUPS: SPF avec >10 lookups DNS',
        'mx_not_in_spf': 'MX_NOT_IN_SPF: Serveurs MX absents du SPF',
        'dkim_invalid': 'DKIM_INVALID_FORMAT: Format DKIM invalide',
        'dkim_weak': 'DKIM_WEAK_KEY: Clé RSA <1024 bits',
        'dmarc_no_reporting': 'DMARC_NO_REPORTING: Pas d\'adresse rua/ruf',
        'recommendations': 'ℹ️  RECOMMANDATIONS (INFO) - Bonnes pratiques:',
        'missing_ipv6': 'MISSING_IPV6: Enregistrement A sans AAAA (moderniser)',
        'ttl_too_long': 'TTL_TOO_LONG: TTL > 86400s rend les changements lents',
        'wildcard_restriction': 'WILDCARD_RESTRICTION: Attention wildcards avec certains types',
        'duplicate_record': 'DUPLICATE_RECORD: Enregistrements identiques redondants',
        'cname_orphan': 'CNAME_ORPHAN: CNAME pointe vers un nom absent du dataset (vérifier si externe)',
        'inconsistent_ttl_multiview': 'INCONSISTENT_TTL_MULTIVIEW: Même enregistrement avec TTL différents selon les vues',
        'dmarc_policy_none': 'DMARC_POLICY_NONE: DMARC en mode monitoring (p=none)',
        'dkim_missing': 'DKIM_MISSING: Pas de DKIM détecté',
        'autodiscover_missing': 'AUTODISCOVER_MISSING: Pas d\'autodiscover/autoconfig',
        'ssl_section': 'CERTIFICATS SSL/TLS À RENOUVELER',
        'ssl_critical_header': '🚨 CERTIFICATS EXPIRÉS OU EXPIRANT SOUS 7 JOURS:',
        'ssl_expired': '❌ EXPIRÉ depuis ',
        'ssl_days': ' jour(s)',
        'ssl_expires': '🚨 Expire dans ',
        'ssl_issuer': 'Émetteur: ',
        'ssl_valid_until': 'Valide jusqu\'au: ',
        'ssl_verified_from': 'Vérifié depuis: ',
        'ssl_domains_covered': 'Domaines couverts (',
        'ssl_warning_header': '⚠️  CERTIFICATS EXPIRANT DANS 7-21 JOURS:',
        'ssl_expires_in': '⚠️  Expire dans ',
        'ssl_connection_errors': '❌ ERREURS DE CONNEXION SSL:',
        'ssl_error': 'Erreur: ',
        'ssl_verified_on': 'Vérifié depuis: ',
        'http_section': 'DISPONIBILITÉ HTTP/HTTPS DES DOMAINES',
        'http_strategy_note': 'Stratégie: HTTPS-FIRST (teste HTTPS prioritairement, HTTP uniquement si HTTPS échoue)',
        'http_dns_resolution': 'Note: Résolution DNS forcée selon le fichier CSV (pas de résolution système)',
        'http_results_header': 'Résultats des tests:',
        'http_domain': 'Domaine: ',
        'http_protocol': 'Protocole: ',
        'http_status': 'Statut: ',
    }
};

// Helper function to get translated string
const t = (key) => TRANSLATIONS[LANG]?.[key] || TRANSLATIONS['en']?.[key] || key;

// Règles à ignorer (validation à la carte)
const IGNORED_RULES = new Set(
    getArg('--ignore-rules', '')
        .split(',') 
        .map(r => r.trim().toUpperCase())
        .filter(r => r.length > 0)
);

const FLOWCHART_DIRECTION = getArg('--direction', 'LR'); // LR par défaut (changé de TB)
const SVG_BACKGROUND = getArg('--background', 'white');
const SVG_SCALE = getArg('--scale', '2');

// Fonction de log conditionnelle
const log = (message) => {
    if (!QUIET_MODE) console.log(message);
};

// --- FONCTIONS DE BLINDAGE ---

const sanitizeId = (str) => 'node_' + str.replace(/[^a-zA-Z0-9]/g, '_');
const sanitizeGraphId = (str) => 'sg_' + str.replace(/[^a-zA-Z0-9]/g, '_');
const cleanString = (str) => str ? str.replace(/^"|"$/g, '').trim() : '';

// 1. LE WORKAROUND TITRE (Anti-détection de lien)
// On remplace les points et slashs par des entités HTML.
// Mermaid affiche ".", mais le parseur voit "&period;" et ne déclenche pas le mode lien.
const escapeForTitle = (str) => {
    if (!str) return '';
    return str
        .replace(/\./g, '&period;') 
        .replace(/\//g, '&sol;')    
        .replace(/:/g, '&colon;')
        .replace(/_/g, '&lowbar;')
        .replace(/\[/g, '&#91;')
        .replace(/\]/g, '&#93;')
        .replace(/-/g, '#8209;')   // Tiret insécable (non-breaking hyphen)
        .replace(/ /g, '&nbsp;');   // Espace insécable
};

// 2. LE FORCE ONE-LINE (Anti-retour à la ligne dans les nodes)
const forceOneLine = (str) => {
    if (!str) return '';
    return str.split(' ').join('&nbsp;');
};

// 3. Nettoyage standard pour le contenu
const escapeContent = (str) => {
    if (!str) return '';
    return str
        .replace(/"/g, "'")
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
};

const detectDelimiter = (content) => {
    const firstLine = content.split(/\r?\n/)[0];
    const commas = (firstLine.match(/,/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    return semicolons > commas ? ';' : ',';
};

// Parser une ligne CSV en respectant les guillemets
const parseCSVLine = (line, delimiter) => {
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Guillemet échappé "" -> un seul "
                current += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote mode
                inQuotes = !inQuotes;
            }
        } else if (char === delimiter && !inQuotes) {
            // Fin de champ
            fields.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    // Dernier champ
    fields.push(current.trim());
    
    return fields;
};

const getMxPriority = (val) => {
    const match = val.match(/^(\d+)\s/);
    return match ? parseInt(match[1], 10) : 100;
};

const getFinalViewClass = (viewsSet) => {
    const views = Array.from(viewsSet).join(' ').toLowerCase();
    const isInt = views.includes('int') || views.includes('priv');
    const isExt = views.includes('ext') || views.includes('pub');
    if (isInt && isExt) return 'both';      // 🟣 Violet
    if (isInt) return 'internal';           // 🔵 Bleu
    if (isExt) return 'external';           // 🟢 Vert
    return 'target';                        // Cible externe
};

// --- FONCTIONS UTILITAIRES ---

/**
 * Vérifie si une adresse IP est privée (RFC 1918)
 * @param {string} ip - Adresse IPv4 ou IPv6
 * @returns {boolean} True si IP privée
 */
const isPrivateIP = (ip) => {
    // IPv4 RFC 1918
    if (ip.startsWith('10.')) return true; // 10.0.0.0/8
    if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip)) return true; // 172.16.0.0/12
    if (ip.startsWith('192.168.')) return true; // 192.168.0.0/16
    
    // IPv4 Loopback et Link-local
    if (ip.startsWith('127.')) return true; // 127.0.0.0/8
    if (ip.startsWith('169.254.')) return true; // 169.254.0.0/16
    
    // IPv6 privées et spéciales
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // fc00::/7 (ULA)
    if (ip.startsWith('fe80:')) return true; // fe80::/10 (Link-local)
    if (ip === '::1') return true; // ::1 (Loopback)
    
    // IPv6 mappées IPv4 privées (::ffff:192.168.x.x)
    const ipv4MappedMatch = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (ipv4MappedMatch) {
        return isPrivateIP(ipv4MappedMatch[1]);
    }
    
    return false;
};

/**
 * Normalise une adresse IPv6 mappée IPv4 en IPv4
 * @param {string} ip - Adresse IP
 * @returns {string} IP normalisée
 */
const normalizeIPv6MappedIPv4 = (ip) => {
    // Détecter ::ffff:192.168.1.1 -> 192.168.1.1
    const ipv4MappedMatch = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (ipv4MappedMatch) {
        return ipv4MappedMatch[1];
    }
    
    // Détecter ::192.168.1.1 -> 192.168.1.1
    const ipv4EmbeddedMatch = ip.match(/^::(\d+\.\d+\.\d+\.\d+)$/);
    if (ipv4EmbeddedMatch) {
        return ipv4EmbeddedMatch[1];
    }
    
    return ip;
};

/**
 * Obtient l'icône d'IP selon son type (public/privé)
 * @param {string} ip - Adresse IP
 * @returns {string} Emoji représentant le type
 */
const getIPIcon = (ip) => {
    return isPrivateIP(ip) ? '🔒' : '🌐';
};

// --- FONCTIONS DE TRAITEMENT DES DONNÉES ---

/**
 * Transforme les données brutes du CSV en structure interne
 * @param {Array} lines - Lignes du fichier CSV
 * @param {string} delimiter - Délimiteur détecté (,ou ;)
 * @returns {Object} Objets de domaines et liens
 */
const parseCSVData = (lines, delimiter) => {
    const domains = {}; 
    const links = [];
    const ipUsageCount = {};
    const ipNodes = {};

    // --- PARSING ---
    log(`🔍 Analyse des enregistrements DNS...`);
    
    // Détecter les colonnes depuis l'en-tête (en ignorant les lignes de commentaire et vides)
    if (lines.length === 0) return { domains, links, ipUsageCount, ipNodes };
    
    // Trouver la première ligne qui n'est ni un commentaire (commence par #) ni vide
    let headerLineIndex = 0;
    while (headerLineIndex < lines.length) {
        const trimmedLine = lines[headerLineIndex].trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
            break; // Ligne valide trouvée
        }
        headerLineIndex++;
    }
    
    if (headerLineIndex >= lines.length) {
        console.error(`❌ Erreur : Aucune ligne d'en-tête trouvée dans le CSV`);
        return { domains, links, ipUsageCount, ipNodes };
    }
    
    // Parser l'en-tête avec parseCSVLine pour gérer les guillemets correctement
    const headerFields = parseCSVLine(lines[headerLineIndex], delimiter);
    if (!headerFields || headerFields.length === 0) {
        console.error(`❌ Erreur : Impossible de parser l'en-tête CSV`);
        return { domains, links, ipUsageCount, ipNodes };
    }
    
    // Mapper les noms de colonnes (nettoyer et normaliser)
    const columnMap = {};
    headerFields.forEach((col, index) => {
        const colName = col.toLowerCase().trim();
        columnMap[colName] = index;
    });
    
    // Chercher les colonnes attendues (avec synonymes)
    const ttlIndex = columnMap['ttl'] ?? columnMap['rrttl'] ?? columnMap['rr_ttl'] ?? -1;
    const nameIndex = columnMap['name'] ?? columnMap['rrname'] ?? columnMap['rr_name'] ?? columnMap['rr name'] ?? columnMap['rr name (ascii)'] ?? columnMap['hostname'] ?? columnMap['fqdn'] ?? -1;
    const typeIndex = columnMap['type'] ?? columnMap['record_type'] ?? columnMap['rrtype'] ?? columnMap['rr_type'] ?? -1;
    const valueIndex = columnMap['value'] ?? columnMap['data'] ?? columnMap['rdata'] ?? columnMap['target'] ?? columnMap['rrvalue'] ?? columnMap['rr_value'] ?? -1;
    const viewIndex = columnMap['view'] ?? columnMap['vues'] ?? columnMap['views'] ?? -1;
    
    // Vérifier que les colonnes essentielles sont présentes
    if (nameIndex === -1 || typeIndex === -1 || valueIndex === -1) {
        console.error(`❌ Erreur : Colonnes manquantes dans le CSV`);
        console.error(`   Colonnes requises: Name (ou RRName), Type, Value`);
        console.error(`   Colonnes trouvées: ${Object.keys(columnMap).join(', ')}`);
        return { domains, links, ipUsageCount, ipNodes };
    }
    
    // TTL et View sont optionnels (valeurs par défaut)
    const hasTTL = ttlIndex !== -1;
    const hasView = viewIndex !== -1;
    
    if (!hasTTL) log(`⚠️  Colonne TTL non trouvée, utilisation de la valeur par défaut (3600)`);
    if (!hasView) log(`⚠️  Colonne View non trouvée, tous les enregistrements seront marqués "default"`);
    
    lines.forEach((line, index) => {
        // Ignorer les commentaires, l'en-tête et les lignes vides
        if (index <= headerLineIndex || !line.trim() || line.trim().startsWith('#')) return;

        // Parser la ligne avec parseCSVLine pour gérer les guillemets
        const fields = parseCSVLine(line, delimiter);
        if (!fields || fields.length <= Math.max(nameIndex, typeIndex, valueIndex)) return;

        const ttl = hasTTL && ttlIndex < fields.length ? fields[ttlIndex].trim() : '3600';
        const rrName = nameIndex < fields.length ? fields[nameIndex].toLowerCase().trim().replace(/\.$/, '') : '';
        const type = typeIndex < fields.length ? fields[typeIndex].toUpperCase().trim() : '';
        const value = valueIndex < fields.length ? fields[valueIndex].toLowerCase().trim().replace(/\.$/, '') : '';
        const viewRaw = hasView && viewIndex < fields.length ? fields[viewIndex].trim() : 'default';

        // Vérifier que les champs essentiels ne sont pas vides
        if (!rrName || !type || !value) return;

        if (!domains[rrName]) domains[rrName] = [];
        
        // CORRECTION: Ne fusionner QUE si type, value ET ttl sont identiques
        const existingRecord = domains[rrName].find(rec => 
            rec.type === type && rec.value === value && rec.ttl === ttl
        );
        
        if (existingRecord) {
            // Même enregistrement (type + value + TTL identiques) -> Ajouter juste la vue
            existingRecord.views.add(viewRaw);
        } else {
            // Nouvel enregistrement (ou TTL différent) -> Créer un nœud séparé
            const uniqueNodeId = sanitizeId(`${rrName}_${type}_${value.substring(0,5)}_${ttl}_${index}`);
            
            // Comptage des IP et création des nœuds IP
            if (type === 'A' || type === 'AAAA') {
                // NOUVEAU: Normaliser les IPv6 mappées IPv4
                const normalizedIP = normalizeIPv6MappedIPv4(value);
                
                // Utiliser l'IP normalisée comme clé
                if (!ipNodes[normalizedIP]) {
                    ipNodes[normalizedIP] = {
                        id: sanitizeId(`IP_${normalizedIP}`),
                        ip: normalizedIP,
                        originalIPs: new Set([value]), // Garder trace des IPs originales
                        type: normalizedIP.includes(':') ? 'AAAA' : 'A',
                        isPrivate: isPrivateIP(normalizedIP),
                        usedBy: []
                    };
                } else {
                    // Ajouter l'IP originale au set (pour traçabilité)
                    ipNodes[normalizedIP].originalIPs.add(value);
                }
                
                ipUsageCount[normalizedIP] = (ipUsageCount[normalizedIP] || 0) + 1;
                
                // Ajouter le lien A/AAAA -> IP
                ipNodes[normalizedIP].usedBy.push({ fqdn: rrName, recordId: uniqueNodeId });
            }

            domains[rrName].push({
                id: uniqueNodeId, ttl, type, value, views: new Set([viewRaw]), rrName,
                priority: type === 'MX' ? getMxPriority(value) : 999 
            });

            // Ajouter les liens pour CNAME, MX et NS
            if (type === 'CNAME') links.push({ from: uniqueNodeId, targetRR: value, label: 'CNAME' });
            if (type === 'MX') links.push({ from: uniqueNodeId, targetRR: value.replace(/^\d+\s+/, ''), label: 'MX' });
            if (type === 'NS') links.push({ from: uniqueNodeId, targetRR: value, label: 'NS' });
        }
    });

    // Log retiré ici car déjà présent dans processCSVFile()
    return { 
        domains, 
        links, 
        ipUsageCount, 
        ipNodes,
        // Retourner aussi les métadonnées de parsing pour le rapport CSV enrichi
        headerLineIndex,
        ttlIndex,
        nameIndex,
        typeIndex,
        valueIndex,
        viewIndex,
        hasTTL,
        hasView
    };
};

// --- UTILITAIRES DOMAINES EMAIL ---
/**
 * Extrait le domaine parent d'un FQDN email dérivé
 * @param {string} fqdn - FQDN complet
 * @returns {string|null} - Domaine parent ou null si pas un dérivé
 */
const getEmailParentDomain = (fqdn) => {
    // _dmarc.example.com -> example.com
    if (fqdn.startsWith('_dmarc.')) {
        return fqdn.substring(7);
    }
    
    // selector._domainkey.example.com -> example.com
    if (fqdn.includes('._domainkey.')) {
        return fqdn.split('._domainkey.')[1];
    }
    
    // autodiscover.example.com -> example.com
    // autoconfig.example.com -> example.com
    if (fqdn.startsWith('autodiscover.') || fqdn.startsWith('autoconfig.')) {
        return fqdn.substring(fqdn.indexOf('.') + 1);
    }
    
    // _spf.example.com -> example.com (rare mais existe)
    if (fqdn.startsWith('_spf.')) {
        return fqdn.substring(5);
    }
    
    return null;
};

// --- VALIDATION DNS RFC ---
/**
 * Règles DNS validées avec 3 niveaux de sévérité:
 * 
 * 🚨 CRITICAL (Bloquant - Rouge) - Violations RFC qui empêchent le fonctionnement:
 * 1. CNAME + autre type : Un CNAME ne peut pas coexister avec d'autres types (RFC 1034)
 * 2. CNAME sur zone apex : Interdit sur domaine racine (RFC 1912)
 * 3. CNAME vers lui-même : Boucle DNS
 * 4. MX pointant vers CNAME : Interdit par RFC 2181
 * 5. NS pointant vers CNAME : Interdit par RFC 2181
 * 6. MX/NS sans glue records : Doit pointer vers A/AAAA
 * 7. SPF trop permissif : +all permet à tout le monde d'envoyer
 * 
 * ⚠️ WARNING (Important - Orange) - Problèmes à corriger rapidement:
 * 8. CNAME chaîné : Déconseillé (RFC 2181), impact performance
 * 9. TTL incohérents : Comportement imprévisible du cache
 * 10. TTL trop court : < 60s génère charge DNS élevée
 * 11. SPF neutre : ?all offre peu de protection
 * 12. Records orphelins : Pointe vers nom non résolu
 * 13. VIEW_SEGREGATION : IP publique en vue interne ou IP privée en vue externe
 * 
 * ℹ️ INFO (Bonne pratique - Jaune léger) - Recommandations non bloquantes:
 * 14. IPv6 manquant : A sans AAAA (bonne pratique moderne)
 * 15. TTL trop long : > 86400s rend changements lents
 * 16. Wildcard restrictions : Attention avec certains types
 * 17. Duplicatas : Enregistrements identiques
 * 18. TTL incohérents multi-vues : Même type/valeur avec TTL différents selon vue
 */

const validateDNSRules = (domains, _links) => {
    const violations = [];
    const cnameTargets = new Map();
    const domainViolations = new Map();
    const nsTargets = new Set();
    const mxTargets = new Set();

    // Construire une map complète des cibles CNAME (tous les records)
    for (const [fqdn, records] of Object.entries(domains)) {
        // Récupérer tous les CNAMEs (peut y avoir plusieurs avec TTL différents)
        const cnameRecs = records.filter(r => r.type === 'CNAME');
        cnameRecs.forEach(rec => {
            // Stocker toutes les cibles CNAME de ce domaine (peut avoir plusieurs avec TTL différents)
            if (!cnameTargets.has(fqdn)) {
                cnameTargets.set(fqdn, new Set());
            }
            cnameTargets.get(fqdn).add(rec.value);
        });
        
        records.forEach(r => {
            if (r.type === 'NS') nsTargets.add(r.value);
            if (r.type === 'MX') mxTargets.add(r.value.replace(/^\d+\s+/, ''));
        });
    }

    // Fonction helper pour ajouter une violation
    const addViolation = (fqdn, rule, severity, message, affectedRecords, reference) => {
        // Ignorer si la règle est dans la liste d'exclusion
        if (IGNORED_RULES.has(rule)) return;
        
        const violation = { fqdn, rule, severity, message, affectedRecords, reference };
        violations.push(violation);
        if (!domainViolations.has(fqdn)) domainViolations.set(fqdn, []);
        domainViolations.get(fqdn).push(violation);
    };

    // Fonction pour détecter si c'est un zone apex (pas de sous-domaine)
    const isApex = (fqdn) => {
        const parts = fqdn.split('.');
        return parts.length === 2 || (parts.length === 3 && parts[2] === ''); // example.com ou example.com.
    };

    for (const [fqdn, records] of Object.entries(domains)) {
        const types = records.map(r => r.type);
        const hasCNAME = types.includes('CNAME');
        const hasOthers = types.filter(t => t !== 'CNAME').length > 0;
        const hasA = types.includes('A');
        const hasAAAA = types.includes('AAAA');

        // RÈGLE 1: CNAME + autre type (CRITICAL)
        // CORRECTION: Accepter CNAME + autres types SI tous les enregistrements sont en vues différentes
        // (DNS multi-view/split-view : le CNAME est visible en ext, les A/AAAA en int, c'est valide)
        if (hasCNAME && hasOthers) {
            const cnameRecords = records.filter(r => r.type === 'CNAME');
            const otherRecords = records.filter(r => r.type !== 'CNAME');
            
            // Vérifier si CNAME et autres types coexistent dans la MÊME vue
            let hasConflictInSameView = false;
            
            cnameRecords.forEach(cnameRec => {
                const cnameViews = Array.from(cnameRec.views);
                otherRecords.forEach(otherRec => {
                    const otherViews = Array.from(otherRec.views);
                    
                    // Vérifier l'intersection entre les vues
                    const commonViews = cnameViews.filter(v => otherViews.includes(v));
                    if (commonViews.length > 0) {
                        hasConflictInSameView = true;
                    }
                });
            });
            
            // Signaler la violation seulement s'il y a vraiment un conflit dans la MÊME vue
            if (hasConflictInSameView) {
                addViolation(fqdn, 'CNAME_COEXISTENCE', 'CRITICAL',
                    `CNAME ne peut pas coexister avec d'autres types dans la même vue (${types.filter(t => t !== 'CNAME').join(', ')})`,
                    records.filter(r => r.type === 'CNAME' || types.filter(t => t !== 'CNAME').includes(r.type)),
                    'RFC 1034 Section 3.6.2'
                );
            }
        }

        // RÈGLE 2: CNAME sur zone apex (CRITICAL)
        if (hasCNAME && isApex(fqdn)) {
            const cnameRec = records.find(r => r.type === 'CNAME');
            addViolation(fqdn, 'CNAME_ON_APEX', 'CRITICAL',
                `CNAME interdit sur zone apex (domaine racine)`,
                [cnameRec],
                'RFC 1912 Section 2.4'
            );
        }

        // RÈGLE 8: CNAME chaîné (WARNING) - CORRECTION COMPLÈTE
        if (hasCNAME) {
            const cnameRecords = records.filter(r => r.type === 'CNAME');
            
            // Vérifier CHAQUE enregistrement CNAME individuellement
            cnameRecords.forEach(cnameRec => {
                // Vérifier si la cible est elle-même un CNAME
                if (cnameTargets.has(cnameRec.value)) {
                    const targetCnames = cnameTargets.get(cnameRec.value);
                    const chainTarget = Array.from(targetCnames)[0]; // Prendre le premier pour le message
                    
                    addViolation(fqdn, 'CNAME_CHAIN', 'WARNING',
                        `CNAME pointe vers un autre CNAME (${cnameRec.value} -> ${chainTarget})`,
                        [cnameRec],
                        'RFC 2181 Section 10.1 (Performance)'
                    );
                }

                // RÈGLE 3: CNAME LOOP - Détection de cycles (CRITICAL)
                // Détection de boucles directes et indirectes
                const visited = new Set();
                const path = [fqdn];
                let current = cnameRec.value;
                let loopDetected = false;
                
                // Suivre la chaîne CNAME pour détecter les cycles
                while (current && visited.size < 20) { // Max 20 sauts pour éviter boucle infinie
                    if (current === fqdn || visited.has(current)) {
                        loopDetected = true;
                        path.push(current);
                        break;
                    }
                    
                    visited.add(current);
                    path.push(current);
                    
                    // Trouver le prochain CNAME dans la chaîne en utilisant cnameTargets
                    if (cnameTargets.has(current)) {
                        // Prendre la première cible CNAME (devrait n'y en avoir qu'une normalement)
                        const targets = Array.from(cnameTargets.get(current));
                        if (targets.length > 0) {
                            current = targets[0];
                        } else {
                            break; // Pas de cible
                        }
                    } else {
                        break; // current n'est pas un CNAME, fin de chaîne
                    }
                }
                
                if (loopDetected) {
                    addViolation(fqdn, 'CNAME_LOOP', 'CRITICAL',
                        `CNAME crée une boucle DNS : ${path.join(' → ')}`,
                        [cnameRec],
                        'RFC 1034 Section 3.6.2'
                    );
                }
            });
        }

        // RÈGLE 13: Ségrégation des vues (WARNING - cohérence réseau)
        const ipRecords = records.filter(r => r.type === 'A' || r.type === 'AAAA');
        ipRecords.forEach(rec => {
            const viewsArray = Array.from(rec.views);
            const hasExternal = viewsArray.some(v => v.toLowerCase() === 'ext' || v.toLowerCase() === 'pub');
            const ipIsPrivate = isPrivateIP(rec.value);
            
            // RÈGLE SIMPLE : IP privée RFC 1918 exposée en vue externe = VIOLATION
            // IP publique peut être dans n'importe quelle vue (ext, int, ou les deux)
            if (ipIsPrivate && hasExternal) {
                addViolation(fqdn, 'VIEW_SEGREGATION_PRIVATE_EXTERNAL', 'WARNING',
                    `IP privée RFC 1918 (${rec.value}) exposée en vue externe - Fuite d'information réseau`,
                    [rec],
                    'RFC 1918 Section 3 + Bonne pratique sécurité'
                );
            }
        });

        // RÈGLE 14: IPv6 manquant (INFO - bonne pratique)
        if (hasA && !hasAAAA && !hasCNAME) {
            const aRecordsIPv6 = records.filter(r => r.type === 'A');
            addViolation(fqdn, 'MISSING_IPV6', 'INFO',
                `Enregistrement A sans AAAA correspondant (bonne pratique: supporter IPv6)`,
                aRecordsIPv6,
                'Bonne pratique : RFC 8200 (IPv6 Specification)'
            );
        }

        // RÈGLE 4 & 5 & 6: MX/NS/CNAME validation
        const mxRecords = records.filter(r => r.type === 'MX');
        const nsRecords = records.filter(r => r.type === 'NS');
        const cnameRecords = records.filter(r => r.type === 'CNAME');
        
        // Valider MX et NS
        [...mxRecords, ...nsRecords].forEach(rec => {
            const target = rec.type === 'MX' ? rec.value.replace(/^\d+\s+/, '') : rec.value;
            
            // Pointe vers CNAME (CRITICAL) - Vérifier intersection de vues
            // Vérifier si la cible (target) a des enregistrements CNAME
            const targetRecs = domains[target];
            if (targetRecs) {
                const targetCnames = targetRecs.filter(r => r.type === 'CNAME');
                if (targetCnames.length > 0) {
                    const recViews = Array.from(rec.views);
                    
                    const cnameInSameView = targetCnames.some(cname => {
                        const cnameViews = Array.from(cname.views);
                        // Intersection de vues : au moins une vue commune
                        return recViews.some(v => cnameViews.includes(v));
                    });
                    
                    if (cnameInSameView) {
                        addViolation(fqdn, `${rec.type}_TO_CNAME`, 'CRITICAL',
                            `${rec.type} pointe vers un CNAME (${target}) dans une vue commune`,
                            [rec],
                            'RFC 2181 Section 10.3'
                        );
                    }
                }
            }
            
            // Pointe vers nom sans A/AAAA (WARNING)
            // Exclure les zones DNS inverses (in-addr.arpa, ip6.arpa) car elles sont externes par nature
            const isReverseZone = target.endsWith('.in-addr.arpa') || target.endsWith('.ip6.arpa');
            
            if (!domains[target] && !isReverseZone) {
                addViolation(fqdn, `${rec.type}_ORPHAN`, 'WARNING',
                    `${rec.type} pointe vers un nom non résolu dans ce dataset (${target})`,
                    [rec],
                    'RFC 1035 Section 3.3.9 (Résolution)'
                );
            } else if (domains[target]) {
                const targetRecs = domains[target];
                const recViews = Array.from(rec.views);
                
                // Vérifier si le target a A/AAAA dans une vue commune avec ce MX/NS
                const targetHasAInSameView = targetRecs.some(targetRec => {
                    if (targetRec.type !== 'A' && targetRec.type !== 'AAAA') return false;
                    
                    const targetRecViews = Array.from(targetRec.views);
                    // Intersection : au moins une vue commune
                    return recViews.some(v => targetRecViews.includes(v));
                });
                
                if (!targetHasAInSameView) {
                    addViolation(fqdn, `${rec.type}_NO_GLUE`, 'CRITICAL',
                        `${rec.type} pointe vers ${target} qui n'a pas d'enregistrement A/AAAA dans les mêmes vues`,
                        [rec],
                        'RFC 1035 Section 3.3.9 (Glue Records)'
                    );
                }
            }
        });
        
        // Valider CNAME orphelins (INFO car moins critique)
        if (SHOW_ORPHANS) {
            cnameRecords.forEach(rec => {
                const target = rec.value;
                
                if (!domains[target]) {
                    addViolation(fqdn, 'CNAME_ORPHAN', 'INFO',
                        `CNAME pointe vers un nom non résolu dans ce dataset (${target}) - Peut être externe`,
                        [rec],
                        'Bonne pratique : Vérifier résolution externe'
                    );
                }
            });
        }

        // RÈGLE 9: TTL incohérents (WARNING)
        const aRecords = records.filter(r => r.type === 'A' || r.type === 'AAAA');
        if (aRecords.length > 1) {
            const ttls = new Set(aRecords.map(r => r.ttl));
            if (ttls.size > 1) {
                addViolation(fqdn, 'INCONSISTENT_TTL', 'WARNING',
                    `TTL incohérents pour les enregistrements A/AAAA (${Array.from(ttls).join(', ')})`,
                    aRecords,
                    'RFC 1035 Section 3.2.1 (Cache DNS)'
                );
            }
        }

        // RÈGLE 18: TTL incohérents entre vues (INFO - erreur de config potentielle)
        const recordsByTypeValue = new Map();
        records.forEach(rec => {
            const key = `${rec.type}|${rec.value}`;
            if (!recordsByTypeValue.has(key)) {
                recordsByTypeValue.set(key, []);
            }
            recordsByTypeValue.get(key).push(rec);
        });

        recordsByTypeValue.forEach((recs, key) => {
            if (recs.length > 1) {
                // Collecter toutes les vues uniques
                const allViews = new Set();
                recs.forEach(r => r.views.forEach(v => allViews.add(v.toLowerCase())));
                
                // Vérifier TTL différents
                const ttls = new Set(recs.map(r => r.ttl));
                
                // CORRECTION: Détecter si les VUES sont différentes (pas juste multiples)
                // Exemple: un record avec view 'ext' et un autre avec view 'int' = vues différentes
                const hasMultipleViewEntries = recs.some((r1, i) => 
                    recs.some((r2, j) => {
                        if (i >= j) return false;
                        // Vérifier si les sets de vues sont différents
                        const views1 = Array.from(r1.views).sort().join(',');
                        const views2 = Array.from(r2.views).sort().join(',');
                        return views1 !== views2;
                    })
                );
                
                if (hasMultipleViewEntries && ttls.size > 1) {
                    const [type, value] = key.split('|');
                    
                    // Construire un message détaillé avec les TTL par vue
                    const ttlByView = recs.map(r => {
                        const viewsStr = Array.from(r.views).join(',');
                        return `${viewsStr}:${r.ttl}s`;
                    }).join(', ');
                    
                    addViolation(fqdn, 'INCONSISTENT_TTL_MULTIVIEW', 'INFO',
                        `${type} ${value} a des TTL différents selon les vues (${ttlByView}) - Erreur de configuration possible`,
                        recs,
                        'Bonne pratique : TTL identiques pour même enregistrement dans toutes les vues'
                    );
                }
            }
        });

        // RÈGLE 10 & 15: TTL anormaux
        records.forEach(rec => {
            const ttlNum = parseInt(rec.ttl, 10);
            if (isNaN(ttlNum)) return;
            
            // TTL trop court (WARNING)
            if (ttlNum < 60 && !['SOA'].includes(rec.type)) {
                addViolation(fqdn, 'TTL_TOO_SHORT', 'WARNING',
                    `TTL très court (${ttlNum}s) pour ${rec.type} - Risque de charge DNS élevée`,
                    [rec],
                    'Bonne pratique : Minimum 300s (5min) recommandé'
                );
            }
            
            // TTL trop long (INFO - bonne pratique)
            if (ttlNum > 86400 && !['NS', 'SOA'].includes(rec.type)) {
                addViolation(fqdn, 'TTL_TOO_LONG', 'INFO',
                    `TTL très long (${ttlNum}s) pour ${rec.type}`,
                    [rec],
                    'Bonne pratique : Maximum 24h pour flexibilité'
                );
            }
        });

        // RÈGLE 7 & 11: SPF validation
        const txtRecords = records.filter(r => r.type === 'TXT');
        txtRecords.forEach(rec => {
            // SPF +all (CRITICAL) - Vérifier seulement dans les vues publiques
            if (rec.value.includes('v=spf1') && rec.value.includes('+all')) {
                const recViews = Array.from(rec.views);
                const isPublicView = recViews.some(v => {
                    const vLower = v.toLowerCase();
                    return vLower === 'ext' || vLower === 'pub' || vLower === 'public' || vLower === 'external';
                });
                
                // Alerter seulement si +all est dans une vue publique
                if (isPublicView) {
                    addViolation(fqdn, 'SPF_TOO_PERMISSIVE', 'CRITICAL',
                        `SPF trop permissif (+all) dans vue publique - Permet à n'importe qui d'envoyer des emails`,
                        [rec],
                        'RFC 7208 Section 5.1 (Mécanisme all)'
                    );
                }
            }
            // SPF ?all (WARNING)
            if (rec.value.includes('v=spf1') && rec.value.includes('?all')) {
                addViolation(fqdn, 'SPF_NEUTRAL', 'WARNING',
                    `SPF neutre (?all) - Peu de protection contre le spoofing`,
                    [rec],
                    'RFC 7208 Section 2.6.1 (Qualificateur neutral)'
                );
            }
        });

        // RÈGLE 17: Duplicatas exacts (INFO) - Vérifier par vue
        const seenPerView = new Map(); // vue -> Map de clés
        records.forEach(rec => {
            const recViews = Array.from(rec.views);
            
            recViews.forEach(view => {
                const key = `${rec.type}|${rec.value}|${rec.ttl}`;
                const viewKey = `${view}|${key}`;
                
                if (seenPerView.has(viewKey)) {
                    addViolation(fqdn, 'DUPLICATE_RECORD', 'INFO',
                        `Enregistrement dupliqué dans la vue '${view}': ${rec.type} ${rec.value} TTL:${rec.ttl}`,
                        [rec, seenPerView.get(viewKey)],
                        'Bonne pratique : Supprimer redondances'
                    );
                } else {
                    seenPerView.set(viewKey, rec);
                }
            });
        });

        // RÈGLE 16: Wildcard avec restrictions (INFO)
        if (fqdn.startsWith('*.')) {
            const restrictedTypes = ['NS', 'SOA', 'MX'];
            const hasRestricted = types.some(t => restrictedTypes.includes(t));
            if (hasRestricted) {
                addViolation(fqdn, 'WILDCARD_RESTRICTION', 'INFO',
                    `Wildcard avec types restreints (${types.filter(t => restrictedTypes.includes(t)).join(', ')})`,
                    records.filter(r => restrictedTypes.includes(r.type)),
                    'RFC 4592 Section 2.1.1 (Wildcard Synthesis)'
                );
            }
        }
    }

    return { violations, domainViolations };
};

// --- VALIDATION EMAIL (SPF/DKIM/DMARC/MX) ---
/**
 * Valide les enregistrements email (SPF, DKIM, DMARC, MX)
 * 10 règles avec 3 niveaux de sévérité:
 * 
 * 🚨 CRITICAL (2 règles):
 * 1. SPF_ALL_PERMISSIVE: +all (déjà dans validateDNSRules, mais doublé ici)
 * 2. DMARC_MISSING_WITH_PUBLIC_MX: Pas de DMARC avec MX publics
 * 
 * ⚠️ WARNING (5 règles):
 * 3. SPF_TOO_MANY_LOOKUPS: >10 lookups DNS (limite RFC 7208)
 * 4. MX_NOT_IN_SPF: Serveurs MX absents du SPF
 * 5. DKIM_INVALID_FORMAT: Format DKIM invalide
 * 6. DKIM_WEAK_KEY: Clé RSA <1024 bits
 * 7. DMARC_NO_REPORTING: Pas d'adresse rua/ruf
 * 
 * ℹ️ INFO (3 règles):
 * 8. DMARC_POLICY_NONE: p=none sans stratégie stricte
 * 9. DKIM_MISSING: Pas de DKIM détecté
 * 10. AUTODISCOVER_MISSING: Pas d'autodiscover/autoconfig
 */
const validateEmailRecords = (domains) => {
    const violations = [];
    const domainViolations = new Map();

    // Helper pour ajouter une violation
    const addViolation = (fqdn, rule, severity, message, affectedRecords, reference) => {
        // Ignorer si la règle est dans la liste d'exclusion
        if (IGNORED_RULES.has(rule)) return;
        
        const violation = { fqdn, rule, severity, message, affectedRecords, reference };
        violations.push(violation);
        if (!domainViolations.has(fqdn)) domainViolations.set(fqdn, []);
        domainViolations.get(fqdn).push(violation);
    };

    // Collecter les enregistrements pertinents
    const spfRecords = new Map(); // domain -> TXT records with SPF
    const dkimRecords = new Map(); // domain -> DKIM records
    const dmarcRecords = new Map(); // domain -> DMARC records
    const mxRecords = new Map(); // domain -> MX records
    const autodiscoverRecords = new Set();

    for (const [fqdn, records] of Object.entries(domains)) {
        records.forEach(rec => {
            if (rec.type === 'TXT') {
                if (rec.value.includes('v=spf1')) {
                    if (!spfRecords.has(fqdn)) spfRecords.set(fqdn, []);
                    spfRecords.get(fqdn).push(rec);
                }
            }
            if (rec.type === 'TXT' && fqdn.includes('._domainkey.')) {
                const baseDomain = fqdn.split('._domainkey.')[1];
                if (!dkimRecords.has(baseDomain)) dkimRecords.set(baseDomain, []);
                dkimRecords.get(baseDomain).push(rec);
            }
            if (rec.type === 'TXT' && fqdn.startsWith('_dmarc.')) {
                const baseDomain = fqdn.substring(7); // Retirer "_dmarc."
                if (!dmarcRecords.has(baseDomain)) dmarcRecords.set(baseDomain, []);
                dmarcRecords.get(baseDomain).push(rec);
            }
            if (rec.type === 'MX') {
                if (!mxRecords.has(fqdn)) mxRecords.set(fqdn, []);
                mxRecords.get(fqdn).push(rec);
            }
            if (fqdn.includes('autodiscover') || fqdn.includes('autoconfig')) {
                autodiscoverRecords.add(fqdn);
            }
        });
    }

    // Identifier les domaines avec MX publics (vues externes)
    const domainsWithPublicMX = new Set();
    for (const [fqdn, mxs] of mxRecords.entries()) {
        const hasPublicView = mxs.some(mx => {
            const views = Array.from(mx.views);
            return views.some(v => {
                const view = v.toLowerCase();
                return view === 'ext' || view === 'pub' || view === 'externe' || view === 'public';
            });
        });
        if (hasPublicView) domainsWithPublicMX.add(fqdn);
    }

    // RÈGLE 1: SPF +all (déjà dans validateDNSRules mais répété ici pour cohérence email)
    // Vérifier seulement dans les vues publiques
    for (const [fqdn, spfs] of spfRecords.entries()) {
        spfs.forEach(spf => {
            if (spf.value.includes('+all')) {
                const spfViews = Array.from(spf.views);
                const isPublicView = spfViews.some(v => {
                    const vLower = v.toLowerCase();
                    return vLower === 'ext' || vLower === 'pub' || vLower === 'public' || vLower === 'external';
                });
                
                // Alerter seulement si +all est dans une vue publique
                if (isPublicView) {
                    addViolation(fqdn, 'SPF_ALL_PERMISSIVE', 'CRITICAL',
                        `SPF avec +all en vue publique permet à n'importe qui d'envoyer des emails`,
                        [spf],
                        'RFC 7208 Section 5.1'
                    );
                }
            }
        });
    }

    // RÈGLE 2: DMARC manquant avec MX publics - Vérifier par vue
    for (const domain of domainsWithPublicMX) {
        // Vérifier si DMARC existe dans une vue publique
        const dmarcInPublicView = dmarcRecords.get(domain)?.some(dmarc => {
            const dmarcViews = Array.from(dmarc.views);
            return dmarcViews.some(v => {
                const vLower = v.toLowerCase();
                return vLower === 'ext' || vLower === 'pub' || vLower === 'public' || vLower === 'external';
            });
        });
        
        if (!dmarcInPublicView) {
            const mxs = mxRecords.get(domain);
            addViolation(domain, 'DMARC_MISSING_WITH_PUBLIC_MX', 'CRITICAL',
                `Domaine avec MX publics mais sans DMARC dans les vues publiques - Risque de phishing/spoofing`,
                mxs,
                'RFC 7489 Section 6.3'
            );
        }
    }

    // RÈGLE 3: SPF trop de lookups (>10)
    for (const [fqdn, spfs] of spfRecords.entries()) {
        spfs.forEach(spf => {
            const lookupMechanisms = ['include:', 'a:', 'mx:', 'ptr:', 'exists:', 'redirect='];
            let lookupCount = 0;
            
            lookupMechanisms.forEach(mechanism => {
                const matches = spf.value.match(new RegExp(mechanism, 'g'));
                if (matches) lookupCount += matches.length;
            });
            
            // Compter les "a" et "mx" sans domaine (lookups implicites)
            if (/\s+a\s+/.test(spf.value) || /\s+a$/.test(spf.value)) lookupCount++;
            if (/\s+mx\s+/.test(spf.value) || /\s+mx$/.test(spf.value)) lookupCount++;
            
            if (lookupCount > 10) {
                addViolation(fqdn, 'SPF_TOO_MANY_LOOKUPS', 'WARNING',
                    `SPF avec ${lookupCount} lookups DNS (limite RFC 7208: 10) - Risque PermError`,
                    [spf],
                    'RFC 7208 Section 4.6.4'
                );
            }
        });
    }

    // RÈGLE 4: MX non inclus dans SPF - Vérifier par vue
    for (const [fqdn, mxs] of mxRecords.entries()) {
        const spfs = spfRecords.get(fqdn);
        if (!spfs || spfs.length === 0) continue;
        
        // Grouper MX par vue
        const mxsByView = new Map();
        mxs.forEach(mx => {
            const mxViews = Array.from(mx.views);
            mxViews.forEach(view => {
                if (!mxsByView.has(view)) mxsByView.set(view, []);
                mxsByView.get(view).push(mx);
            });
        });
        
        // Vérifier SPF par vue
        for (const [view, viewMxs] of mxsByView.entries()) {
            // Trouver le SPF pour cette vue
            const viewSpf = spfs.find(s => Array.from(s.views).includes(view));
            
            if (!viewSpf) continue; // Pas de SPF pour cette vue
            
            const spfValue = viewSpf.value.toLowerCase();
            
            // Vérifier si le SPF inclut "mx" ou mentionne explicitement les serveurs MX
            const hasMxMechanism = /\s+mx\s+/.test(spfValue) || /\s+mx$/.test(spfValue) || spfValue.includes('mx:');
            
            if (!hasMxMechanism) {
                // Vérifier si les serveurs MX sont explicitement listés
                const mxServers = viewMxs.map(mx => mx.value.replace(/^\d+\s+/, '').toLowerCase());
                const allMxIncluded = mxServers.every(mxServer => 
                    spfValue.includes(mxServer) || spfValue.includes('a:' + mxServer)
                );
                
                if (!allMxIncluded) {
                    addViolation(fqdn, 'MX_NOT_IN_SPF', 'WARNING',
                        `Serveurs MX (${mxServers.join(', ')}) absents du SPF dans la vue '${view}' - Risque de rejet email`,
                        viewMxs,
                        'RFC 7208 Section 5.4 (mx mechanism)'
                    );
                }
            }
        }
    }

    // RÈGLE 5: Format DKIM invalide
    for (const [domain, dkims] of dkimRecords.entries()) {
        dkims.forEach(dkim => {
            const value = dkim.value;
            
            // Vérifier format de base
            if (!value.includes('v=DKIM1')) {
                addViolation(domain, 'DKIM_INVALID_FORMAT', 'WARNING',
                    `DKIM sans version (v=DKIM1) pour ${dkim.rrName}`,
                    [dkim],
                    'RFC 6376 Section 3.6.1'
                );
            }
            
            // Vérifier présence clé publique
            if (!value.includes('p=') || value.match(/p=\s*[;"]/) || value.includes('p=""')) {
                addViolation(domain, 'DKIM_INVALID_FORMAT', 'WARNING',
                    `DKIM sans clé publique (p=) pour ${dkim.rrName}`,
                    [dkim],
                    'RFC 6376 Section 3.6.1'
                );
            }
        });
    }

    // RÈGLE 6: Clé DKIM faible (<1024 bits)
    for (const [domain, dkims] of dkimRecords.entries()) {
        dkims.forEach(dkim => {
            const match = dkim.value.match(/p=([A-Za-z0-9+/=]+)/);
            if (match && match[1]) {
                const keyData = match[1].replace(/\s/g, '');
                // Estimation: Base64 1 char = 6 bits, clé RSA 1024 bits ≈ 172 chars
                const estimatedBits = (keyData.length * 6) / 8 * 8; // Approximation
                
                if (estimatedBits < 140) { // ~1024 bits
                    addViolation(domain, 'DKIM_WEAK_KEY', 'WARNING',
                        `Clé DKIM potentiellement faible (<1024 bits estimés) pour ${dkim.rrName}`,
                        [dkim],
                        'RFC 6376 Section 3.3.3 (Recommandation 1024-2048 bits)'
                    );
                }
            }
        });
    }

    // RÈGLE 7: DMARC sans reporting
    for (const [domain, dmarcs] of dmarcRecords.entries()) {
        dmarcs.forEach(dmarc => {
            const value = dmarc.value.toLowerCase();
            if (!value.includes('rua=') && !value.includes('ruf=')) {
                addViolation(domain, 'DMARC_NO_REPORTING', 'WARNING',
                    `DMARC sans adresses de reporting (rua/ruf) - Pas de visibilité sur les échecs`,
                    [dmarc],
                    'RFC 7489 Section 6.2 (Reporting)'
                );
            }
        });
    }

    // RÈGLE 8: DMARC policy none
    for (const [domain, dmarcs] of dmarcRecords.entries()) {
        dmarcs.forEach(dmarc => {
            const value = dmarc.value.toLowerCase();
            if (value.includes('p=none')) {
                addViolation(domain, 'DMARC_POLICY_NONE', 'INFO',
                    `DMARC en mode monitoring uniquement (p=none) - Considérer p=quarantine ou p=reject`,
                    [dmarc],
                    'RFC 7489 Section 6.3 (Policy)'
                );
            }
        });
    }

    // RÈGLE 9: DKIM manquant
    for (const domain of domainsWithPublicMX) {
        if (!dkimRecords.has(domain)) {
            const mxs = mxRecords.get(domain);
            addViolation(domain, 'DKIM_MISSING', 'INFO',
                `Pas de DKIM détecté - Recommandé pour l'authentification email`,
                mxs,
                'RFC 6376 (Bonne pratique)'
            );
        }
    }

    // RÈGLE 10: Autodiscover manquant
    for (const domain of domainsWithPublicMX) {
        const hasAutodiscover = Array.from(autodiscoverRecords).some(ad => {
            // Vérifier si ad est autodiscover.domain ou autoconfig.domain
            return ad === `autodiscover.${domain}` || 
                   ad === `autoconfig.${domain}` ||
                   ad.startsWith(`autodiscover.${domain}.`) ||
                   ad.startsWith(`autoconfig.${domain}.`);
        });
        
        if (!hasAutodiscover) {
            const mxs = mxRecords.get(domain);
            addViolation(domain, 'AUTODISCOVER_MISSING', 'INFO',
                `Pas d'autodiscover/autoconfig - Configuration manuelle requise pour clients email`,
                mxs,
                'Bonne pratique (Exchange/Office365/Thunderbird)'
            );
        }
    }

    return { violations, domainViolations };
};

// --- FONCTION DE VALIDATION SSL ---
/**
 * Vérifie le certificat SSL/TLS d'un domaine
 * @param {string} hostname - Nom de domaine à vérifier
 * @param {number} port - Port SSL (défaut: 443)
 * @returns {Promise<Object>} Informations sur le certificat
 */
const checkSSLCertificate = (hostname, port = 443) => {
    return new Promise((resolve) => {
        const options = {
            host: hostname,
            port: port,
            servername: hostname, // SNI (Server Name Indication)
            rejectUnauthorized: false, // Accepter les certificats auto-signés pour analyse
            timeout: 2000 // Timeout 5 secondes
        };

        const socket = tls.connect(options, () => {
            const cert = socket.getPeerCertificate();
            
            if (!cert || Object.keys(cert).length === 0) {
                socket.destroy();
                resolve({ 
                    hostname, 
                    error: 'Aucun certificat trouvé',
                    status: 'error'
                });
                return;
            }

            const validFrom = new Date(cert.valid_from);
            const validTo = new Date(cert.valid_to);
            const now = new Date();
            const daysUntilExpiry = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));

            let status = 'valid';
            let severity = 'OK';
            
            if (daysUntilExpiry < 0) {
                status = 'expired';
                severity = 'CRITICAL';
            } else if (daysUntilExpiry <= 7) {
                status = 'expiring_soon';
                severity = 'CRITICAL';
            } else if (daysUntilExpiry <= 21) {
                status = 'expiring_warning';
                severity = 'WARNING';
            }

            // Extraire le Common Name (CN)
            const commonName = cert.subject.CN || hostname;
            
            // Extraire les Subject Alternative Names (SAN)
            let altNames = [];
            if (cert.subjectaltname) {
                // Format: "DNS:example.com, DNS:www.example.com, DNS:*.example.com"
                altNames = cert.subjectaltname
                    .split(',')
                    .map(name => name.trim())
                    .filter(name => name.startsWith('DNS:'))
                    .map(name => name.substring(4)); // Retirer "DNS:"
            }
            
            // Créer un identifiant unique du certificat (fingerprint)
            const certId = cert.fingerprint || cert.serialNumber;

            socket.destroy();
            resolve({
                hostname,
                status,
                severity,
                issuer: cert.issuer.CN || cert.issuer.O || 'Unknown',
                subject: commonName,
                commonName: commonName,
                altNames: altNames,
                allNames: [commonName, ...altNames].filter((v, i, a) => a.indexOf(v) === i), // Unique
                validFrom: validFrom.toISOString().split('T')[0],
                validTo: validTo.toISOString().split('T')[0],
                daysUntilExpiry,
                serialNumber: cert.serialNumber,
                fingerprint: cert.fingerprint,
                certId: certId
            });
        });

        socket.on('error', (err) => {
            socket.destroy();
            resolve({
                hostname,
                error: err.message,
                status: 'error',
                severity: 'ERROR'
            });
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve({
                hostname,
                error: 'Timeout de connexion',
                status: 'timeout',
                severity: 'ERROR'
            });
        });

        socket.setTimeout(options.timeout);
    });
};

// --- FONCTION DE VALIDATION HTTP/HTTPS ---
/**
 * Résout un FQDN en suivant les CNAMEs et retourne l'IP finale
 * @param {string} fqdn - Nom de domaine à résoudre
 * @param {Object} domains - Map de tous les domaines du CSV
 * @param {Set} visited - Set pour détecter les boucles
 * @returns {Array} Liste des IPs finales avec leurs vues
 */
const resolveFQDNToIPs = (fqdn, domains, visited = new Set()) => {
    if (visited.has(fqdn)) return []; // Boucle détectée
    visited.add(fqdn);
    
    const records = domains[fqdn];
    if (!records) return []; // Domaine non trouvé
    
    const ips = [];
    
    records.forEach(rec => {
        if (rec.type === 'A' || rec.type === 'AAAA') {
            // IP trouvée
            ips.push({
                ip: rec.value,
                type: rec.type,
                views: Array.from(rec.views),
                fqdn: fqdn
            });
        } else if (rec.type === 'CNAME') {
            // Suivre le CNAME récursivement
            const targetIPs = resolveFQDNToIPs(rec.value, domains, visited);
            targetIPs.forEach(target => {
                ips.push({
                    ...target,
                    cnameChain: [fqdn, ...(target.cnameChain || [])],
                    originalFQDN: fqdn
                });
            });
        }
    });
    
    return ips;
};

/**
 * Teste la disponibilité HTTP/HTTPS d'un domaine avec résolution DNS forcée
 * Si enableSSL est true, récupère aussi le certificat SSL dans la même connexion HTTPS
 * @param {string} fqdn - Nom de domaine à tester
 * @param {string} ip - Adresse IP à utiliser (résolution forcée)
 * @param {string} view - Vue DNS (int/ext)
 * @param {number} timeout - Timeout en ms
 * @param {boolean} enableSSL - Récupérer aussi le certificat SSL
 * @returns {Promise<Object>} Résultats HTTP, HTTPS et optionnellement SSL
 */
const checkHTTPAvailability = (fqdn, ip, view, timeout = 5000, enableSSL = false) => {
    const http = require('http');
    const https = require('https');
    
    const makeRequest = (protocol, port) => {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const module = protocol === 'https' ? https : http;
            
            const options = {
                hostname: ip,  // RÉSOLUTION FORCÉE : on passe l'IP directement
                port: port,
                path: '/',
                method: 'HEAD',  // HEAD pour économiser la bande passante
                headers: {
                    'Host': fqdn,  // IMPORTANT: envoyer le bon Host header
                    'User-Agent': 'DNS2Mermaid-Validator/1.0',
                    'Connection': 'close'  // Fermer la connexion après la réponse
                },
                timeout: timeout,
                rejectUnauthorized: false,  // Accepter les certificats auto-signés
                servername: fqdn,  // SNI pour HTTPS
                agent: false  // Désactiver le keep-alive pour chaque connexion
            };
            
            const req = module.request(options, (res) => {
                const responseTime = Date.now() - startTime;
                let sslCert = null;
                
                // Si HTTPS et SSL activé, récupérer le certificat
                if (protocol === 'https' && enableSSL && res.socket && res.socket.getPeerCertificate) {
                    const cert = res.socket.getPeerCertificate();
                    if (cert && Object.keys(cert).length > 0) {
                        const validFrom = new Date(cert.valid_from);
                        const validTo = new Date(cert.valid_to);
                        const now = new Date();
                        const daysUntilExpiry = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));

                        let status = 'valid';
                        let severity = 'OK';
                        
                        if (daysUntilExpiry < 0) {
                            status = 'expired';
                            severity = 'CRITICAL';
                        } else if (daysUntilExpiry <= 7) {
                            status = 'expiring_soon';
                            severity = 'CRITICAL';
                        } else if (daysUntilExpiry <= 21) {
                            status = 'expiring_warning';
                            severity = 'WARNING';
                        }

                        const commonName = cert.subject.CN || fqdn;
                        let altNames = [];
                        if (cert.subjectaltname) {
                            altNames = cert.subjectaltname
                                .split(',')
                                .map(name => name.trim())
                                .filter(name => name.startsWith('DNS:'))
                                .map(name => name.substring(4));
                        }
                        
                        sslCert = {
                            hostname: fqdn,
                            status,
                            severity,
                            issuer: cert.issuer.CN || cert.issuer.O || 'Unknown',
                            subject: commonName,
                            commonName: commonName,
                            altNames: altNames,
                            allNames: [commonName, ...altNames].filter((v, i, a) => a.indexOf(v) === i),
                            validFrom: validFrom.toISOString().split('T')[0],
                            validTo: validTo.toISOString().split('T')[0],
                            daysUntilExpiry,
                            serialNumber: cert.serialNumber,
                            fingerprint: cert.fingerprint,
                            certId: cert.fingerprint || cert.serialNumber
                        };
                    }
                }
                
                resolve({
                    protocol,
                    statusCode: res.statusCode,
                    statusMessage: res.statusMessage,
                    responseTime,
                    headers: res.headers,
                    error: null,
                    sslCert: sslCert
                });
            });
            
            req.on('error', (err) => {
                req.destroy();
                resolve({
                    protocol,
                    statusCode: null,
                    statusMessage: null,
                    responseTime: Date.now() - startTime,
                    headers: null,
                    error: err.message,
                    sslCert: null
                });
            });
            
            req.on('timeout', () => {
                req.destroy();
                resolve({
                    protocol,
                    statusCode: null,
                    statusMessage: null,
                    responseTime: timeout,
                    headers: null,
                    error: 'Timeout',
                    sslCert: null
                });
            });
            
            req.end();
        });
    };
    
    // LOGIQUE HTTPS-FIRST:
    // 1. Tester HTTPS d'abord (priorité sécurité)
    // 2. Si HTTPS répond (statusCode existe) → utiliser ce résultat, ignorer HTTP
    // 3. Si HTTPS échoue (erreur/timeout) → fallback sur HTTP
    return makeRequest('https', 443).then(httpsResult => {
        // Si HTTPS a retourné un code HTTP (même erreur 4xx/5xx), c'est le résultat principal
        if (httpsResult.statusCode !== null) {
            return {
                fqdn,
                ip,
                view,
                http: { statusCode: null, error: 'Not tested (HTTPS available)', responseTime: 0 },
                https: httpsResult,
                sslCert: httpsResult.sslCert,
                protocol: 'https'  // Indique que HTTPS a répondu
            };
        }
        
        // HTTPS a échoué (timeout/erreur connexion) → tester HTTP en fallback
        return makeRequest('http', 80).then(httpResult => {
            return {
                fqdn,
                ip,
                view,
                http: httpResult,
                https: httpsResult,
                sslCert: null,
                protocol: httpResult.statusCode !== null ? 'http' : 'none'  // HTTP ou aucun
            };
        });
    });
};

// --- FONCTION POUR GÉNÉRER LE NOM DE DOSSIER AVEC TIMESTAMP ---
const generateOutputDirName = (inputPath) => {
    // Extraire le nom de base du fichier (sans extension)
    const baseName = path.basename(inputPath, path.extname(inputPath));
    
    // Générer le timestamp au format YYYYMMDD_HHMMSS
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
    
    // Retourner le nom avec timestamp
    return `${baseName}_${timestamp}`;
};

// --- FONCTION DE TRAITEMENT D'UN FICHIER CSV ---
const processCSVFile = async (inputPath, outputDir) => {
    // Créer le dossier de sortie si nécessaire
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Définir les chemins de sortie
    const outputMmd = path.join(outputDir, path.basename(OUTPUT_FILE));
    const legendMmd = path.join(outputDir, path.basename(LEGEND_FILE));
    const reportTxt = path.join(outputDir, path.basename(VALIDATION_FILE));
    const csvReportPath = path.join(outputDir, path.basename(CSV_REPORT_FILE));
    const outputSvg = path.join(outputDir, path.basename(SVG_FILE));
    const legendSvg = path.join(outputDir, path.basename(LEGEND_SVG_FILE));
    
    log(`\n${'='.repeat(60)}`);
    log(`📂 Traitement : ${path.basename(inputPath)}`);
    log(`📁 Sortie : ${outputDir}`);
    log(`${'='.repeat(60)}`);

    try {
        // Vérifier que le fichier d'entrée existe
        if (!fs.existsSync(inputPath)) {
            console.error(`❌ Erreur : Fichier "${inputPath}" introuvable.`);
            return { success: false, file: inputPath, error: 'File not found' };
        }

        log(`📂 Lecture du fichier : ${inputPath}`);
        const fileContent = fs.readFileSync(inputPath, 'utf8');
        const delimiter = detectDelimiter(fileContent);
        const lines = fileContent.split(/\r?\n/);

        // --- PARSING ---
        const { 
            domains, 
            links, 
            ipNodes,
            headerLineIndex,
            ttlIndex,
            nameIndex,
            typeIndex,
            valueIndex,
            viewIndex,
            hasTTL,
            hasView
        } = parseCSVData(lines, delimiter);

        log(`✅ ${Object.keys(domains).length} domaines analysés`);
        log(`🌐 ${Object.keys(ipNodes).length} adresses IP uniques détectées`);

        // --- VALIDATION SSL (si activée - maintenant par défaut) ---
        const sslCertificates = {};
        let sslValid = [];
        let sslWarning = [];
        let sslCritical = [];
        let sslErrors = [];
        
        // Si SSL ET HTTP sont activés, on fera SSL pendant les tests HTTPS
        const doSSLSeparately = ENABLE_SSL_CHECK && !ENABLE_HTTP_CHECK;
        
        if (doSSLSeparately) {
            log(`🔒 Vérification des certificats SSL/TLS...`);
            
            // Récupérer tous les domaines uniques (exclure wildcards, enregistrements techniques et zones inverses)
            const domainsToCheck = Object.keys(domains).filter(fqdn => 
                !fqdn.startsWith('*') &&
                !fqdn.startsWith('_dmarc') &&
                !fqdn.startsWith('_domainkey') &&
                !fqdn.includes('._domainkey.') &&
                !fqdn.startsWith('_') &&
                !fqdn.endsWith('.in-addr.arpa') &&  // Zones IPv4 inverses (PTR)
                !fqdn.endsWith('.ip6.arpa')         // Zones IPv6 inverses (PTR)
            );
            
            log(`   ${domainsToCheck.length} domaine(s) à vérifier sur le port ${SSL_PORT}`);
            
            // Vérifier les certificats en parallèle (max 40 simultanés)
            const batchSize = 20;
            for (let i = 0; i < domainsToCheck.length; i += batchSize) {
                const batch = domainsToCheck.slice(i, i + batchSize);
                const results = await Promise.all(
                    batch.map(fqdn => checkSSLCertificate(fqdn, SSL_PORT))
                );
                
                results.forEach(cert => {
                    sslCertificates[cert.hostname] = cert;
                });
                
                if (!QUIET_MODE && domainsToCheck.length > batchSize) {
                    const progress = Math.min(i + batchSize, domainsToCheck.length);
                    process.stdout.write(`\r   Progression: ${progress}/${domainsToCheck.length}`);
                }
            }
            
            if (!QUIET_MODE && domainsToCheck.length > batchSize) {
                process.stdout.write('\n');
            }
            
            // Regrouper les certificats identiques (même certId)
            const certGroups = new Map(); // certId -> { cert, domains: [] }
            
            for (const [hostname, cert] of Object.entries(sslCertificates)) {
                // Ignorer les timeouts si --ssl-no-timeout-errors est activé
                if (cert.status === 'timeout' && SSL_HIDE_TIMEOUT_ERRORS) {
                    continue;
                }
                if (cert.status === 'error' || cert.status === 'timeout') {
                    // Garder les erreurs séparées
                    if (!certGroups.has(`error_${hostname}`)) {
                        certGroups.set(`error_${hostname}`, { cert, domains: [hostname] });
                    }
                } else if (cert.certId) {
                    if (!certGroups.has(cert.certId)) {
                        certGroups.set(cert.certId, { cert, domains: [] });
                    }
                    certGroups.get(cert.certId).domains.push(hostname);
                }
            }
            
            // Calculer les compteurs
            sslValid = Array.from(certGroups.values()).filter(g => g.cert.status === 'valid');
            sslWarning = Array.from(certGroups.values()).filter(g => g.cert.severity === 'WARNING');
            sslCritical = Array.from(certGroups.values()).filter(g => g.cert.severity === 'CRITICAL');
            
            // Filtrer les timeouts si --ssl-no-timeout-errors est activé
            if (SSL_HIDE_TIMEOUT_ERRORS) {
                sslErrors = Array.from(certGroups.values()).filter(g => g.cert.status === 'error');
            } else {
                sslErrors = Array.from(certGroups.values()).filter(g => g.cert.status === 'error' || g.cert.status === 'timeout');
            }
            
            log(`   ✅ ${sslValid.length} OK | ⚠️  ${sslWarning.length} WARNING | 🚨 ${sslCritical.length} CRITICAL | ❌ ${sslErrors.length} ERREURS`);
            log(`   📋 ${certGroups.size} certificat(s) unique(s) détecté(s)`);
        }

        // --- VALIDATION HTTP/HTTPS (si activée) ---
        const httpResults = [];
        
        if (ENABLE_HTTP_CHECK) {
            if (ENABLE_SSL_CHECK) {
                log(`🌐🔒 Vérification HTTP/HTTPS + certificats SSL (optimisé)...`);
            } else {
                log(`🌐 Vérification de la disponibilité HTTP/HTTPS...`);
            }
            
            // Récupérer tous les domaines uniques (exclure wildcards, enregistrements techniques et zones inverses)
            const domainsToCheck = Object.keys(domains).filter(fqdn => 
                !fqdn.startsWith('*') &&
                !fqdn.startsWith('_dmarc') &&
                !fqdn.startsWith('_domainkey') &&
                !fqdn.includes('._domainkey.') &&
                !fqdn.startsWith('_') &&
                !fqdn.endsWith('.in-addr.arpa') &&
                !fqdn.endsWith('.ip6.arpa')
            );
            
            log(`   ${domainsToCheck.length} domaine(s) à vérifier`);
            
            // Compteur pour la progression
            let checkedCount = 0;
            let totalChecks = 0;
            
            // Calculer le nombre total de vérifications (domaine × IPs)
            for (const fqdn of domainsToCheck) {
                const resolvedIPs = resolveFQDNToIPs(fqdn, domains);
                totalChecks += resolvedIPs.length;
            }
            
            log(`   ${totalChecks} vérification(s) HTTP/HTTPS à effectuer`);
            
            // Préparer toutes les vérifications à effectuer
            const checksToPerform = [];
            for (const fqdn of domainsToCheck) {
                const resolvedIPs = resolveFQDNToIPs(fqdn, domains);
                
                if (resolvedIPs.length === 0) continue; // Pas d'IP (CNAME orphelin, etc.)
                
                // Préparer chaque vérification (domaine × IP)
                for (const ipInfo of resolvedIPs) {
                    // Optimisation : réutiliser le certificat SSL si disponible
                    const sslCert = (ENABLE_SSL_CHECK && sslCertificates[fqdn]) ? sslCertificates[fqdn] : null;
                    
                    checksToPerform.push({
                        fqdn,
                        ipInfo,
                        sslCert
                    });
                }
            }
            
            // Exécuter les vérifications HTTP/HTTPS en parallèle (max 10 simultanées)
            const httpBatchSize = 40;
            for (let i = 0; i < checksToPerform.length; i += httpBatchSize) {
                const batch = checksToPerform.slice(i, i + httpBatchSize);
                const batchResults = await Promise.all(
                    batch.map(check => checkHTTPAvailability(
                        check.fqdn,
                        check.ipInfo.ip,
                        check.ipInfo.views.join(','),
                        HTTP_TIMEOUT,
                        ENABLE_SSL_CHECK  // Récupérer le certificat SSL si activé
                    ).then(result => {
                        result.cnameChain = check.ipInfo.cnameChain || [];
                        result.originalFQDN = check.ipInfo.originalFQDN || check.fqdn;
                        
                        // Stocker le certificat SSL récupéré
                        if (result.sslCert && !sslCertificates[check.fqdn]) {
                            sslCertificates[check.fqdn] = result.sslCert;
                        }
                        
                        return result;
                    }))
                );
                
                httpResults.push(...batchResults);
                checkedCount += batchResults.length;
                
                // Afficher la progression
                if (!QUIET_MODE && totalChecks > 1) {
                    const progress = Math.min(checkedCount, totalChecks);
                    process.stdout.write(`\r   Progression: ${progress}/${totalChecks}`);
                }
            }
            
            if (!QUIET_MODE && totalChecks > 1) {
                process.stdout.write('\n');
            }
            
            // Si SSL activé et certificats récupérés via HTTPS, calculer les stats
            if (ENABLE_SSL_CHECK && Object.keys(sslCertificates).length > 0) {
                const certGroups = new Map();
                
                for (const hostname in sslCertificates) {
                    const cert = sslCertificates[hostname];
                    
                    // Ignorer les timeouts si --ssl-no-timeout-errors est activé
                    if (cert.status === 'timeout' && SSL_HIDE_TIMEOUT_ERRORS) {
                        continue;
                    }
                    if (cert.status === 'error' || cert.status === 'timeout') {
                        if (!certGroups.has(`error_${hostname}`)) {
                            certGroups.set(`error_${hostname}`, { cert, domains: [hostname] });
                        }
                    } else if (cert.certId) {
                        if (!certGroups.has(cert.certId)) {
                            certGroups.set(cert.certId, { cert, domains: [] });
                        }
                        certGroups.get(cert.certId).domains.push(hostname);
                    }
                }
                
                sslValid = Array.from(certGroups.values()).filter(g => g.cert.status === 'valid');
                sslWarning = Array.from(certGroups.values()).filter(g => g.cert.severity === 'WARNING');
                sslCritical = Array.from(certGroups.values()).filter(g => g.cert.severity === 'CRITICAL');
                
                if (SSL_HIDE_TIMEOUT_ERRORS) {
                    sslErrors = Array.from(certGroups.values()).filter(g => g.cert.status === 'error');
                } else {
                    sslErrors = Array.from(certGroups.values()).filter(g => g.cert.status === 'error' || g.cert.status === 'timeout');
                }
                
                log(`   🔒 SSL: ✅ ${sslValid.length} OK | ⚠️  ${sslWarning.length} WARNING | 🚨 ${sslCritical.length} CRITICAL | ❌ ${sslErrors.length} ERREURS`);
                log(`   📋 ${certGroups.size} certificat(s) unique(s) détecté(s)`);
            }
            
            // Compteurs
            const httpOK = httpResults.filter(r => r.http.statusCode >= 200 && r.http.statusCode < 300).length;
            const httpsOK = httpResults.filter(r => r.https.statusCode >= 200 && r.https.statusCode < 300).length;
            const httpErrors = httpResults.filter(r => r.protocol === 'none').length;
            
            log(`   ✅ HTTP 2xx: ${httpOK} | HTTPS 2xx: ${httpsOK} | ❌ Erreurs: ${httpErrors}`);
        }

        // --- VALIDATION DNS ---
        let violations = [];
        let domainViolations = new Map();
        
        if (ENABLE_VALIDATION) {
            log(`🔍 Validation RFC en cours...`);
            const validationResult = validateDNSRules(domains, links);
            violations = validationResult.violations;
            domainViolations = validationResult.domainViolations;
        }

        // --- VALIDATION EMAIL (si activée) ---
        let emailViolations = [];
        let emailDomainViolations = new Map();
        
        if (ENABLE_EMAIL_VALIDATION && ENABLE_VALIDATION) {
            log(`📧 Validation Email (SPF/DKIM/DMARC/MX) en cours...`);
            const emailValidationResult = validateEmailRecords(domains);
            emailViolations = emailValidationResult.violations;
            emailDomainViolations = emailValidationResult.domainViolations;
            
            // Fusionner avec les violations DNS
            violations = [...violations, ...emailViolations];
            for (const [fqdn, emailViols] of emailDomainViolations.entries()) {
                if (!domainViolations.has(fqdn)) {
                    domainViolations.set(fqdn, []);
                }
                domainViolations.get(fqdn).push(...emailViols);
            }
            
            log(`   📧 ${emailViolations.length} violation(s) email détectée(s)`);
        }

        // --- GÉNÉRATION MERMAID ---
        // CORRECTION: Conditionner toute la génération Mermaid
        if (ENABLE_DIAGRAM) {
            log(`📐 Génération du diagramme Mermaid...`);
            
            // HEADER YAML : Configuration avancée pour améliorer le layout
            let mmd = '---\n';
            mmd += 'config:\n';
            mmd += '  flowchart:\n';
            mmd += '    htmlLabels: true\n';
            mmd += '    curve: basis\n'; // Courbes plus fluides
            mmd += '    padding: 25\n'; // Espacement interne des subgraphs
            mmd += '    diagramPadding: 8\n'; // Marge globale
            mmd += '    wrappingWidth: 200\n'; // Largeur avant retour à la ligne (évite débordements)
            // Layout compact pour réduire l'étalement (surtout pour gros subgraphs)
            mmd += `    rankSpacing: ${COMPACT_LAYOUT ? '20' : '50'}\n`; 
            mmd += `    nodeSpacing: ${COMPACT_LAYOUT ? '30' : '50'}\n`;
            mmd += '    useMaxWidth: false\n'; // Évite l'étalement horizontal excessif
            mmd += '---\n';
            
            mmd += `flowchart ${FLOWCHART_DIRECTION}\n`;
            
            // Styles
            mmd += '    classDef internal fill:#b3d9ff,stroke:#0066cc,stroke-width:2px,color:black;\n';
            mmd += '    classDef external fill:#b3ffb3,stroke:#006600,stroke-width:1px,color:black;\n';
            mmd += '    classDef both fill:#d9b3ff,stroke:#8800cc,stroke-width:2px,color:black;\n';
            mmd += '    classDef target fill:#f9f9f9,stroke:#999,stroke-dasharray: 5 5;\n';
            mmd += '    classDef legendBox fill:#fafafa,stroke:#333,stroke-width:1px,color:black;\n';
            mmd += '    classDef critical fill:#ffe0e0,stroke:#ff0000,stroke-width:5px,color:black,stroke-dasharray: 10 5;\n';
            mmd += '    classDef internalWarning fill:#b3d9ff,stroke:#ff8800,stroke-width:4px,color:black;\n';
            mmd += '    classDef externalWarning fill:#b3ffb3,stroke:#ff8800,stroke-width:4px,color:black;\n';
            mmd += '    classDef bothWarning fill:#d9b3ff,stroke:#ff8800,stroke-width:4px,color:black;\n';
            mmd += '    classDef internalInfo fill:#b3d9ff,stroke:#ccaa00,stroke-width:3px,color:black,stroke-dasharray: 5 5;\n';
            mmd += '    classDef externalInfo fill:#b3ffb3,stroke:#ccaa00,stroke-width:3px,color:black,stroke-dasharray: 5 5;\n';
            mmd += '    classDef bothInfo fill:#d9b3ff,stroke:#ccaa00,stroke-width:3px,color:black,stroke-dasharray: 5 5;\n';
            mmd += '    classDef ipNode fill:#e8e8e8,stroke:#666,stroke-width:2px,color:black;\n';
            mmd += '    classDef ipPrivate fill:#b3d9ff,stroke:#0066cc,stroke-width:2px,color:black;\n';
            mmd += '    classDef ipPublic fill:#b3ffb3,stroke:#006600,stroke-width:2px,color:black;\n';
            mmd += '    classDef sslValid fill:#d4edda,stroke:#28a745,stroke-width:2px,color:black;\n';
            mmd += '    classDef sslWarning fill:#fff3cd,stroke:#ffc107,stroke-width:3px,color:black;\n';
            mmd += '    classDef sslCritical fill:#f8d7da,stroke:#dc3545,stroke-width:4px,color:black;\n';
            mmd += '    classDef sslError fill:#e2e3e5,stroke:#6c757d,stroke-width:2px,color:black,stroke-dasharray: 5 5;\n';
            mmd += '    classDef leakedExternal fill:#ffebee,stroke:#e91e63,stroke-width:4px,color:black;\n';
            
            // Styles pour les statuts HTTP/HTTPS (petits nœuds compacts)
            mmd += '    classDef httpStatusOk fill:#c8e6c9,stroke:#2e7d32,stroke-width:1px,color:#000,font-size:9px;\n';
            mmd += '    classDef httpStatusRedirect fill:#fff9c4,stroke:#f57c00,stroke-width:1px,color:#000,font-size:9px;\n';
            mmd += '    classDef httpStatusError fill:#ffccbc,stroke:#d84315,stroke-width:1px,color:#000,font-size:9px;\n';
            mmd += '    classDef httpStatusKo fill:#ffebee,stroke:#c62828,stroke-width:1px,color:#000,font-size:9px;\n';
            mmd += '    classDef emailDerived fill:#fff9e6,stroke:#ff9800,stroke-width:1px,color:black,stroke-dasharray: 3 3;\n\n';

            // Regrouper les domaines : parents + leurs dérivés email
            const processedDomains = new Set();
            const domainGroups = {}; // parentDomain -> [childDomains]
            
            // Identifier les domaines parents et leurs enfants
            for (const fqdn of Object.keys(domains)) {
                const parentDomain = getEmailParentDomain(fqdn);
                if (parentDomain && domains[parentDomain]) {
                    // C'est un domaine dérivé avec parent existant
                    if (!domainGroups[parentDomain]) {
                        domainGroups[parentDomain] = [];
                    }
                    domainGroups[parentDomain].push(fqdn);
                } else if (!parentDomain) {
                    // C'est un domaine racine potentiel
                    if (!domainGroups[fqdn]) {
                        domainGroups[fqdn] = [];
                    }
                }
            }

            // Générer les subgraphs groupés
            
            // Préparer les résultats HTTP par FQDN pour affichage dans les subgraphs
            const httpResultsByFqdn = new Map();
            if (ENABLE_HTTP_CHECK && httpResults.length > 0) {
                httpResults.forEach(result => {
                    const fqdn = result.fqdn;
                    if (!httpResultsByFqdn.has(fqdn)) {
                        httpResultsByFqdn.set(fqdn, []);
                    }
                    httpResultsByFqdn.get(fqdn).push(result);
                });
            }
            
            for (const [parentFqdn, childFqdns] of Object.entries(domainGroups)) {
                if (processedDomains.has(parentFqdn)) continue;
                
                const allFqdns = [parentFqdn, ...childFqdns];
                const hasAnyViolations = allFqdns.some(f => domainViolations.has(f));
                
                // Générer le domaine parent
                const graphId = sanitizeGraphId(parentFqdn);
                const safeTitle = escapeForTitle(parentFqdn);
                const hasViolations = domainViolations.has(parentFqdn);
                
                // Titre avec alerte si violations
                const titlePrefix = hasAnyViolations ? '⚠️&nbsp;' : '';
                mmd += `    subgraph ${graphId} ["${titlePrefix}**${safeTitle}**"]\n`;
                // Si le domaine a des sous-domaines email, utiliser LR pour les placer côte à côte
                // Sinon, direction orthogonale au flowchart principal
                const hasEmailChildren = childFqdns.length > 0;
                let subgraphDir;
                if (hasEmailChildren && COMPACT_LAYOUT) {
                    // En mode compact avec enfants: toujours LR pour placement horizontal
                    subgraphDir = 'LR';
                } else {
                    // Direction orthogonale classique
                    subgraphDir = FLOWCHART_DIRECTION === 'LR' || FLOWCHART_DIRECTION === 'RL' ? 'TB' : 'LR';
                }
                mmd += `        direction ${subgraphDir}\n`;
                
                // Générer les enregistrements du domaine parent
                const records = domains[parentFqdn];
                
                // Ordre de priorité pour la lisibilité visuelle :
                // 1. A/AAAA (résolution) → 2. CNAME (alias) → 3. MX (mail)
                // 4. SOA (autorité) → 5. NS (délégation) → 6. SRV → 7. TXT → 8. autres
                const typeOrder = {
                    'A': 1, 'AAAA': 1, 'CNAME': 2, 'MX': 3,
                    'SOA': 4, 'NS': 5, 'SRV': 6, 'TXT': 7, 'PTR': 8
                };
                
                records.sort((a, b) => {
                    const orderA = typeOrder[a.type] || 99;
                    const orderB = typeOrder[b.type] || 99;
                    if (orderA !== orderB) return orderA - orderB;
                    // Sous-tri : MX par priorité, autres par ordre alphabétique de valeur
                    if (a.type === 'MX' && b.type === 'MX') return a.priority - b.priority;
                    return a.value.localeCompare(b.value);
                });

                records.forEach(rec => {
                    let classType = getFinalViewClass(rec.views);
                    let extraLabel = '';
                    let violationIcon = '';
                    
                    // Vérifier si ce record est impliqué dans une violation
                    const recordViolations = domainViolations.has(parentFqdn) 
                        ? domainViolations.get(parentFqdn).filter(v => v.affectedRecords.some(r => r.id === rec.id))
                        : [];
                    
                    if (recordViolations.length > 0) {
                        // CORRECTION: Compter TOUS les types de violations séparément
                        const criticalCount = recordViolations.filter(v => v.severity === 'CRITICAL').length;
                        const warningCount = recordViolations.filter(v => v.severity === 'WARNING').length;
                        const infoCount = recordViolations.filter(v => v.severity === 'INFO').length;
                        
                        // Vérifier violation de ségrégation spécifique
                        const hasPrivateExternal = recordViolations.some(v => v.rule === 'VIEW_SEGREGATION_PRIVATE_EXTERNAL');
                        
                        // NOUVELLE LOGIQUE: Afficher la sévérité la plus haute + compteur de TOUTES les violations
                        if (criticalCount > 0) {
                            classType = 'critical';
                            violationIcon = '🚨';
                            extraLabel = `&nbsp;${criticalCount}×CRITICAL`;
                            
                            // Ajouter les autres sévérités si présentes
                            if (warningCount > 0) extraLabel += `&nbsp;+&nbsp;${warningCount}×WARN`;
                            if (infoCount > 0) extraLabel += `&nbsp;+&nbsp;${infoCount}×INFO`;
                            
                        } else if (hasPrivateExternal) {
                            // IP privée exposée publiquement - style dédié
                            classType = 'leakedExternal';
                            violationIcon = '🌍⚠️';
                            extraLabel = `&nbsp;IP&nbsp;PRIVÉE&nbsp;EXPOSÉE`;
                            
                            // Ajouter les infos si présentes
                            if (infoCount > 0) extraLabel += `&nbsp;+&nbsp;${infoCount}×INFO`;
                            
                        } else if (warningCount > 0) {
                            classType = classType + 'Warning';
                            violationIcon = '⚠️';
                            extraLabel = `&nbsp;${warningCount}×WARN`;
                            
                            // Ajouter les infos si présentes
                            if (infoCount > 0) extraLabel += `&nbsp;+&nbsp;${infoCount}×INFO`;
                            
                        } else if (infoCount > 0) {
                            classType = classType + 'Info';
                            violationIcon = 'ℹ️';
                            extraLabel = `&nbsp;${infoCount}×INFO`;
                        }
                    }
                    
                    // Ajouter le statut HTTP si disponible pour ce record
                    let httpStatusIcon = '';
                    if (httpResultsByFqdn.has(parentFqdn) && (rec.type === 'A' || rec.type === 'AAAA' || rec.type === 'CNAME')) {
                        const httpTests = httpResultsByFqdn.get(parentFqdn);
                        
                        // Trouver le résultat HTTP correspondant à ce record
                        let matchingResult = null;
                        for (const test of httpTests) {
                            // Pour A/AAAA, matcher par IP
                            if ((rec.type === 'A' || rec.type === 'AAAA') && test.ip === rec.value) {
                                matchingResult = test;
                                break;
                            }
                            // Pour CNAME, prendre le premier résultat
                            if (rec.type === 'CNAME' && !matchingResult) {
                                matchingResult = test;
                            }
                        }
                        
                        if (matchingResult) {
                            // Déterminer le protocole et le statut à afficher
                            let statusLabel = '';
                            let statusSquare = '';
                            
                            // Priorité au HTTPS, sinon HTTP
                            const httpsCode = matchingResult.https.statusCode;
                            const httpCode = matchingResult.http.statusCode;
                            const httpsError = matchingResult.https.error;
                            const httpError = matchingResult.http.error;
                            
                            // Priorité 1: HTTPS avec code de statut
                            if (httpsCode >= 200 && httpsCode < 300) {
                                statusLabel = `HTTPS:${httpsCode}`;
                                statusSquare = '🟩';
                            } else if (httpsCode >= 300) {
                                statusLabel = `HTTPS:${httpsCode}`;
                                statusSquare = '🟨';
                            }
                            // Priorité 2: HTTP avec code de statut
                            else if (httpCode >= 200 && httpCode < 300) {
                                statusLabel = `HTTP:${httpCode}`;
                                statusSquare = '🟩';
                            } else if (httpCode >= 300) {
                                statusLabel = `HTTP:${httpCode}`;
                                statusSquare = '🟨';
                            }
                            // Priorité 3: Erreur de connexion
                            else if (httpsError || httpError) {
                                statusLabel = 'HTTP(S):KO';
                                statusSquare = '🟥';
                            }
                            
                            if (statusLabel) {
                                httpStatusIcon = `&nbsp;${statusSquare}&nbsp;${statusLabel}`;
                            }
                        }
                    }

                    const safeType = escapeContent(rec.type);
                    const safeValue = escapeContent(rec.value);
                    const safeTtl = escapeContent(rec.ttl);

                    // Construction du label: Type + HttpStatusIcon + ViolationIcon + ExtraLabel
                    const rawLabel = `<b>${safeType}</b>${httpStatusIcon}${violationIcon ? '&nbsp;' + violationIcon : ''}${extraLabel}&nbsp;|&nbsp;${safeValue}&nbsp;|&nbsp;TTL:${safeTtl}`;
                    const oneLineLabel = forceOneLine(rawLabel);

                    mmd += `        ${rec.id}["${oneLineLabel}"]:::${classType}\n`;
                });
                
                processedDomains.add(parentFqdn);
                
                // Générer les sous-domaines email dérivés (sous-subgraphs)
                childFqdns.forEach(childFqdn => {
                    if (processedDomains.has(childFqdn)) return;
                    
                    const childRecords = domains[childFqdn];
                    const childGraphId = sanitizeGraphId(childFqdn);
                    const childSafeTitle = escapeForTitle(childFqdn);
                    const childHasViolations = domainViolations.has(childFqdn);
                    const childTitlePrefix = childHasViolations ? '⚠️&nbsp;' : '';
                    
                    // Détecter le type de sous-domaine pour l'icône
                    let icon = '📧';
                    if (childFqdn.startsWith('_dmarc.')) icon = '🛡️';
                    else if (childFqdn.includes('._domainkey.')) icon = '🔑';
                    else if (childFqdn.startsWith('autodiscover.') || childFqdn.startsWith('autoconfig.')) icon = '🔍';
                    
                    mmd += `        subgraph ${childGraphId} ["${icon}&nbsp;${childTitlePrefix}${childSafeTitle}"]\n`;
                    // Toujours TB pour les sous-domaines email (compacité verticale)
                    mmd += `            direction TB\n`;
                    
                    // Même ordre de priorité pour les sous-domaines email
                    const typeOrder = {
                        'A': 1, 'AAAA': 1, 'CNAME': 2, 'MX': 3,
                        'SOA': 4, 'NS': 5, 'SRV': 6, 'TXT': 7, 'PTR': 8
                    };
                    
                    childRecords.sort((a, b) => {
                        const orderA = typeOrder[a.type] || 99;
                        const orderB = typeOrder[b.type] || 99;
                        if (orderA !== orderB) return orderA - orderB;
                        if (a.type === 'MX' && b.type === 'MX') return a.priority - b.priority;
                        return a.value.localeCompare(b.value);
                    });
                    
                    childRecords.forEach(rec => {
                        let classType = getFinalViewClass(rec.views);
                        let extraLabel = '';
                        let violationIcon = '';
                        
                        const recordViolations = domainViolations.has(childFqdn) 
                            ? domainViolations.get(childFqdn).filter(v => v.affectedRecords.some(r => r.id === rec.id))
                            : [];
                        
                        if (recordViolations.length > 0) {
                            const criticalCount = recordViolations.filter(v => v.severity === 'CRITICAL').length;
                            const warningCount = recordViolations.filter(v => v.severity === 'WARNING').length;
                            const infoCount = recordViolations.filter(v => v.severity === 'INFO').length;
                            const hasPrivateExternal = recordViolations.some(v => v.rule === 'VIEW_SEGREGATION_PRIVATE_EXTERNAL');
                            
                            if (criticalCount > 0) {
                                classType = 'critical';
                                violationIcon = '🚨';
                                extraLabel = `&nbsp;${criticalCount}×CRITICAL`;
                                if (warningCount > 0) extraLabel += `&nbsp;+&nbsp;${warningCount}×WARN`;
                                if (infoCount > 0) extraLabel += `&nbsp;+&nbsp;${infoCount}×INFO`;
                            } else if (hasPrivateExternal) {
                                classType = 'leakedExternal';
                                violationIcon = '🌍⚠️';
                                extraLabel = `&nbsp;IP&nbsp;PRIVÉE&nbsp;EXPOSÉE`;
                                if (infoCount > 0) extraLabel += `&nbsp;+&nbsp;${infoCount}×INFO`;
                            } else if (warningCount > 0) {
                                classType = classType + 'Warning';
                                violationIcon = '⚠️';
                                extraLabel = `&nbsp;${warningCount}×WARN`;
                                if (infoCount > 0) extraLabel += `&nbsp;+&nbsp;${infoCount}×INFO`;
                            } else if (infoCount > 0) {
                                classType = classType + 'Info';
                                violationIcon = 'ℹ️';
                                extraLabel = `&nbsp;${infoCount}×INFO`;
                            }
                        }

                        const safeType = escapeContent(rec.type);
                        const safeValue = escapeContent(rec.value);
                        const safeTtl = escapeContent(rec.ttl);
                        const rawLabel = `<b>${safeType}</b>${violationIcon ? '&nbsp;' + violationIcon : ''}${extraLabel}&nbsp;|&nbsp;${safeValue}&nbsp;|&nbsp;TTL:${safeTtl}`;
                        const oneLineLabel = forceOneLine(rawLabel);

                        mmd += `            ${rec.id}["${oneLineLabel}"]:::${classType}\n`;
                    });
                    
                    mmd += `        end\n`;
                    
                    // Style pour le sous-subgraph email
                    if (childHasViolations) {
                        const criticalViolations = domainViolations.get(childFqdn).filter(v => v.severity === 'CRITICAL');
                        const warningViolations = domainViolations.get(childFqdn).filter(v => v.severity === 'WARNING');
                        
                        if (criticalViolations.length > 0) {
                            mmd += `        style ${childGraphId} fill:#fff5f5,stroke:#ff0000,stroke-width:2px,color:#000\n`;
                        } else if (warningViolations.length > 0) {
                            mmd += `        style ${childGraphId} fill:#fffef5,stroke:#ff8800,stroke-width:1px,color:#000\n`;
                        } else {
                            mmd += `        style ${childGraphId} fill:#fffffa,stroke:#ccaa00,stroke-width:1px,color:#000\n`;
                        }
                    } else {
                        mmd += `        style ${childGraphId} fill:#fff9e6,stroke:#ff9800,stroke-width:1px,color:#000,stroke-dasharray: 3 3\n`;
                    }
                    
                    processedDomains.add(childFqdn);
                });
                
                mmd += `    end\n`;
                
                // Style spécial pour les subgraphs avec violations
                if (hasViolations) {
                    const criticalViolations = domainViolations.get(parentFqdn).filter(v => v.severity === 'CRITICAL');
                    const warningViolations = domainViolations.get(parentFqdn).filter(v => v.severity === 'WARNING');
                    
                    if (criticalViolations.length > 0) {
                        mmd += `    style ${graphId} fill:#fff5f5,stroke:#ff0000,stroke-width:3px,color:#000\n`;
                    } else if (warningViolations.length > 0) {
                        mmd += `    style ${graphId} fill:#fffef5,stroke:#ff8800,stroke-width:2px,color:#000\n`;
                    } else {
                        mmd += `    style ${graphId} fill:#fffffa,stroke:#ccaa00,stroke-width:1px,color:#000\n`;
                    }
                } else {
                    mmd += `    style ${graphId} fill:#ffffff,stroke:#999,stroke-width:1px,color:#000\n`;
                }
            }

            // --- Relations CNAME/MX/NS ---
            // ASTUCE: Créer les liens externes APRÈS tous les subgraphs pour minimiser perturbations
            mmd += '\n    %% --- Relations CNAME/MX/NS ---\n';
            links.forEach(link => {
                const targetDomain = domains[link.targetRR];
                if (targetDomain) {
                    // CORRECTION RFC: CNAME pointe vers le NOM (subgraph), pas vers un enregistrement spécifique
                    // MX/NS pointent vers les enregistrements car ils ciblent des serveurs précis
                    if (link.label === 'CNAME') {
                        const targetGraphId = sanitizeGraphId(link.targetRR);
                        mmd += `    ${link.from} -->|${link.label}| ${targetGraphId}\n`;
                    } else {
                        // MX et NS pointent vers les enregistrements (serveurs)
                        targetDomain.forEach(targetRec => {
                            mmd += `    ${link.from} -->|${link.label}| ${targetRec.id}\n`;
                        });
                    }
                } else if (SHOW_ORPHANS) {
                    // Cible externe : utiliser un nœud invisible comme "ancre" pour réduire impact layout
                    // (uniquement si --show-orphans est activé)
                    const extId = sanitizeId(`EXT_${link.targetRR}`);
                    const safeTargetLabel = escapeContent(link.targetRR);
                    
                    // Nœud externe compact
                    mmd += `    ${extId}["${safeTargetLabel}"]:::target\n`;
                    mmd += `    ${link.from} -.->|${link.label}| ${extId}\n`;
                }
                // Sinon : ne rien afficher (orphelin masqué) mais validation RFC toujours active
            });

            // --- NŒUDS IP ---
            mmd += '\n    %% --- Nœuds IP ---\n';
            
            // Regrouper dans un subgraph dédié pour meilleur layout
            if (Object.keys(ipNodes).length > 0) {
                mmd += '    subgraph ip_cluster ["🌐 Adresses IP"]\n';
                mmd += '        direction LR\n';
                
                for (const [ip, ipNode] of Object.entries(ipNodes)) {
                    const usageCount = ipNode.usedBy.length;
                    const ipType = ip.includes(':') ? 'IPv6' : 'IPv4';
                    const ipIcon = getIPIcon(ip);
                    const ipVisibility = ipNode.isPrivate ? 'Privée' : 'Publique';
                    const safeIp = escapeContent(ip);
                    
                    // NOUVEAU: Afficher IPv4/IPv6 + Public/Privé + Compteur
                    const ipLabel = forceOneLine(`${ipIcon}&nbsp;<b>${ipType}</b>&nbsp;${ipVisibility}&nbsp;|&nbsp;${safeIp}&nbsp;|&nbsp;${usageCount}×utilisé`);
                    
                    // Style selon type (privée/publique)
                    const ipClass = ipNode.isPrivate ? 'ipPrivate' : 'ipPublic';
                    
                    mmd += `        ${ipNode.id}[["${ipLabel}"]]:::${ipClass}\n`;
                }
                
                mmd += '    end\n';
                mmd += '    style ip_cluster fill:#f9f9f9,stroke:#999,stroke-width:1px,stroke-dasharray: 3 3,color:#000\n';
                
                // Créer les liens APRÈS le subgraph
                for (const [_ip, ipNode] of Object.entries(ipNodes)) {
                    ipNode.usedBy.forEach(usage => {
                        mmd += `    ${usage.recordId} -->|resolves| ${ipNode.id}\n`;
                    });
                }
            }

            // --- CERTIFICATS SSL/TLS (section globale) ---
            if (ENABLE_SSL_CHECK && Object.keys(sslCertificates).length > 0) {
                mmd += '\n    %% --- Certificats SSL/TLS ---\n';
                
                // Regrouper par certificat unique
                const certGroups = new Map();
                
                for (const [hostname, cert] of Object.entries(sslCertificates)) {
                    // Ignorer les timeouts si --ssl-no-timeout-errors est activé
                    if (cert.status === 'timeout' && SSL_HIDE_TIMEOUT_ERRORS) {
                        continue;
                    }
                    if (cert.status === 'error' || cert.status === 'timeout') {
                        certGroups.set(`error_${hostname}`, { cert, domains: [hostname] });
                    } else if (cert.certId) {
                        if (!certGroups.has(cert.certId)) {
                            certGroups.set(cert.certId, { cert, domains: [] });
                        }
                        certGroups.get(cert.certId).domains.push(hostname);
                    }
                }
                
                for (const [certId, group] of certGroups.entries()) {
                    const cert = group.cert;
                    const coveredDomains = group.domains;
                    
                    const sslId = sanitizeId(`SSL_${certId}`);
                    
                    let sslClass = 'sslValid';
                    let icon = '🔒';
                    let statusLabel = 'OK';
                    
                    if (cert.status === 'error' || cert.status === 'timeout') {
                        sslClass = 'sslError';
                        icon = '❌';
                        statusLabel = cert.error || 'Erreur';
                    } else if (cert.severity === 'CRITICAL') {
                        sslClass = 'sslCritical';
                        icon = '🚨';
                        statusLabel = cert.status === 'expired' ? 'EXPIRÉ' : `${cert.daysUntilExpiry}j`;
                    } else if (cert.severity === 'WARNING') {
                        sslClass = 'sslWarning';
                        icon = '⚠️';
                        statusLabel = `${cert.daysUntilExpiry}j`;
                    } else {
                        statusLabel = `${cert.daysUntilExpiry}j`;
                    }
                    
                    // Label avec CN, SAN (max 5) et émetteur
                    let sslLabel = '';
                    if (cert.error) {
                        sslLabel = forceOneLine(`${icon}&nbsp;<b>SSL</b>&nbsp;|&nbsp;${escapeContent(cert.hostname)}&nbsp;|&nbsp;${escapeContent(statusLabel)}`);
                    } else {
                        const issuerShort = cert.issuer.length > 20 ? cert.issuer.substring(0, 20) + '...' : cert.issuer;
                        const cnDisplay = cert.commonName.length > 30 ? cert.commonName.substring(0, 30) + '...' : cert.commonName;
                        
                        // Construire la liste des SAN (max 5)
                        let sanDisplay = '';
                        if (cert.allNames && cert.allNames.length > 0) {
                            const displayNames = cert.allNames.slice(0, 5).map(name => {
                                // Tronquer les noms trop longs
                                return name.length > 25 ? name.substring(0, 25) + '...' : name;
                            });
                            const hasMore = cert.allNames.length > 5;
                            sanDisplay = displayNames.join(',&nbsp;') + (hasMore ? ',&nbsp;...' : '');
                        } else {
                            sanDisplay = cnDisplay;
                        }
                        
                        const totalDomains = cert.allNames ? cert.allNames.length : coveredDomains.length;
                        sslLabel = forceOneLine(`${icon}&nbsp;<b>SSL</b>&nbsp;|&nbsp;CN:${escapeContent(cnDisplay)}&nbsp;|&nbsp;SAN:${sanDisplay}&nbsp;|&nbsp;${totalDomains}×dom&nbsp;|&nbsp;${statusLabel}&nbsp;|&nbsp;${escapeContent(issuerShort)}`);
                    }
                    
                    mmd += `    ${sslId}{{"${sslLabel}"}}:::${sslClass}\n`;
                    
                    // CORRECTION: Lier le certificat au SUBGRAPH du domaine (pas au premier record)
                    for (const hostname of coveredDomains) {
                        if (domains[hostname]) {
                            // Utiliser l'ID du subgraph (pas un record individuel)
                            const domainGraphId = sanitizeGraphId(hostname);
                            mmd += `    ${domainGraphId} -.->|🔐| ${sslId}\n`;
                        }
                    }
                }
            }

            fs.writeFileSync(outputMmd, mmd);
            log(`✅ Diagramme généré : ${outputMmd}`);
        } else {
            log(`⏭️  Génération du diagramme désactivée (--no-diagram)`);
        }
        
        if (ENABLE_VALIDATION && violations.length > 0) {
            log(`⚠️  ${violations.length} violation(s) DNS détectée(s)`);
        }

        // --- GÉNÉRATION DE LA LÉGENDE (AVANT EXPORT) ---
        if (ENABLE_LEGEND && ENABLE_DIAGRAM) {
            log(`📖 Génération de la légende...`);
            
            // Forcer direction horizontale pour compacité
            let legend = 'flowchart LR\n';
            
            // Styles (identiques au diagramme principal)
            legend += '    classDef internal fill:#b3d9ff,stroke:#0066cc,stroke-width:2px,color:black;\n';
            legend += '    classDef external fill:#b3ffb3,stroke:#006600,stroke-width:1px,color:black;\n';
            legend += '    classDef both fill:#d9b3ff,stroke:#8800cc,stroke-width:2px,color:black;\n';
            legend += '    classDef target fill:#f9f9f9,stroke:#999,stroke-dasharray: 5 5;\n';
            legend += '    classDef legendBox fill:#fafafa,stroke:#333,stroke-width:1px,color:black;\n';
            legend += '    classDef critical fill:#ffe0e0,stroke:#ff0000,stroke-width:5px,color:black,stroke-dasharray: 10 5;\n';
            legend += '    classDef internalWarning fill:#b3d9ff,stroke:#ff8800,stroke-width:4px,color:black;\n';
            legend += '    classDef externalWarning fill:#b3ffb3,stroke:#ff8800,stroke-width:4px,color:black;\n';
            legend += '    classDef bothWarning fill:#d9b3ff,stroke:#ff8800,stroke-width:4px,color:black;\n';
            legend += '    classDef internalInfo fill:#b3d9ff,stroke:#ccaa00,stroke-width:3px,color:black,stroke-dasharray: 5 5;\n';
            legend += '    classDef externalInfo fill:#b3ffb3,stroke:#ccaa00,stroke-width:3px,color:black,stroke-dasharray: 5 5;\n';
            legend += '    classDef bothInfo fill:#d9b3ff,stroke:#ccaa00,stroke-width:3px,color:black,stroke-dasharray: 5 5;\n';
            legend += '    classDef ipPrivate fill:#b3d9ff,stroke:#0066cc,stroke-width:2px,color:black;\n';
            legend += '    classDef ipPublic fill:#b3ffb3,stroke:#006600,stroke-width:2px,color:black;\n';
            legend += '    classDef leakedExternal fill:#ffebee,stroke:#e91e63,stroke-width:4px,color:black;\n';
            
            if (ENABLE_SSL_CHECK) {
                legend += '    classDef sslValid fill:#d4edda,stroke:#28a745,stroke-width:2px,color:black;\n';
                legend += '    classDef sslWarning fill:#fff3cd,stroke:#ffc107,stroke-width:3px,color:black;\n';
                legend += '    classDef sslCritical fill:#f8d7da,stroke:#dc3545,stroke-width:4px,color:black;\n';
                legend += '    classDef sslError fill:#e2e3e5,stroke:#6c757d,stroke-width:2px,color:black,stroke-dasharray: 5 5;\n';
            }
            
            legend += '\n';
            
            // Sous-graphes organisés par catégorie
            legend += '    subgraph views ["🌐&nbsp;VUES&nbsp;DNS"]\n';
            legend += '        direction TB\n';
            legend += '        v1["🔵&nbsp;Interne"]:::internal\n';
            legend += '        v2["🟢&nbsp;Externe"]:::external\n';
            legend += '        v3["🟣&nbsp;Interne&nbsp;&&nbsp;Externe"]:::both\n';
            legend += '        v1 ~~~ v2 ~~~ v3\n';
            legend += '    end\n\n';
            
            legend += '    subgraph violations ["⚠️&nbsp;VIOLATIONS&nbsp;RFC&nbsp;&&nbsp;BEST&nbsp;PRACTICES"]\n';
            legend += '        direction TB\n';
            legend += '        r1["🚨&nbsp;CRITICAL"]:::critical\n';
            legend += '        r2["⚠️&nbsp;WARNING"]:::internalWarning\n';
            legend += '        r3["ℹ️&nbsp;INFO"]:::externalInfo\n';
            legend += '        r1 ~~~ r2 ~~~ r3\n';
            legend += '    end\n\n';
            
            legend += '    subgraph nodes ["🔷&nbsp;NŒUDS"]\n';
            legend += '        direction TB\n';
            legend += '        n1[["🔒&nbsp;IP&nbsp;Privée<br/>RFC&nbsp;1918"]]:::ipPrivate\n';
            legend += '        n2[["🌐&nbsp;IP&nbsp;Publique<br/>Internet"]]:::ipPublic\n';
            legend += '        n3["Cible&nbsp;externe"]:::target\n';
            legend += '        n1 ~~~ n2 ~~~ n3\n';
            legend += '    end\n\n';
            
            if (ENABLE_SSL_CHECK) {
                legend += '    subgraph ssl ["🔐&nbsp;CERTIFICATS&nbsp;SSL"]\n';
                legend += '        direction TB\n';
                legend += '        c1{{"🔒&nbsp;OK&nbsp;>21j"}}:::sslValid\n';
                legend += '        c2{{"⚠️&nbsp;7-21j"}}:::sslWarning\n';
                legend += '        c3{{"🚨&nbsp;<7j"}}:::sslCritical\n';
                legend += '        c4{{"❌&nbsp;Erreur"}}:::sslError\n';
                legend += '        c1 ~~~ c2 ~~~ c3 ~~~ c4\n';
                legend += '    end\n\n';
            }
            
            // Organisation horizontale compacte
            if (ENABLE_SSL_CHECK) {
                legend += '    views ~~~ violations ~~~ nodes ~~~ ssl\n';
            } else {
                legend += '    views ~~~ violations ~~~ nodes\n';
            }
            
            // Styles des subgraphs
            legend += '    style views fill:#f8f9fa,stroke:#495057,stroke-width:2px\n';
            legend += '    style violations fill:#fff3cd,stroke:#856404,stroke-width:2px\n';
            legend += '    style nodes fill:#e7f5ff,stroke:#004085,stroke-width:2px\n';
            if (ENABLE_SSL_CHECK) {
                legend += '    style ssl fill:#d4edda,stroke:#155724,stroke-width:2px\n';
            }

            fs.writeFileSync(legendMmd, legend);
            log(`✅ Légende générée : ${legendMmd}`);
        } else if (!ENABLE_DIAGRAM) {
            log(`⏭️  Génération de la légende désactivée (--no-diagram)`);
        }

        // --- EXPORT SVG (si activé) ---
        if (ENABLE_IMG_EXPORT && ENABLE_DIAGRAM) {
            try {
                log('🖼️  Génération des images SVG...');
                
                // Vérifier si mermaid-cli est installé
                try {
                    execSync('mmdc --version', { stdio: 'ignore' });
                } catch {
                    log('⚠️  mermaid-cli (mmdc) n\'est pas installé.');
                    log('   Installation : npm install -g @mermaid-js/mermaid-cli');
                    log('   Ou avec Chocolatey : choco install mermaid-cli');
                    throw new Error('mmdc non trouvé');
                }

                // Générer le SVG principal
                const scaleParam = SVG_SCALE !== '2' ? ` -s ${SVG_SCALE}` : '';
                execSync(`mmdc -i "${outputMmd}" -o "${outputSvg}" -b ${SVG_BACKGROUND}${scaleParam}`, {
                    stdio: QUIET_MODE ? 'ignore' : 'inherit'
                });
                log(`✅ Image SVG générée : ${outputSvg}`);

                // Générer le SVG de la légende (si activé)
                if (ENABLE_LEGEND) {
                    execSync(`mmdc -i "${legendMmd}" -o "${legendSvg}" -b ${SVG_BACKGROUND}${scaleParam}`, {
                        stdio: QUIET_MODE ? 'ignore' : 'inherit'
                    });
                    log(`✅ Légende SVG générée : ${legendSvg}`);
                }

            } catch (err) {
                log(`⚠️  Export SVG échoué : ${err.message}`);
                log('   Le diagramme .mmd est disponible, vous pouvez l\'ouvrir avec un éditeur compatible Mermaid.');
            }
        } else if (!ENABLE_DIAGRAM) {
            log(`⏭️  Export SVG désactivé (--no-diagram)`);
        }

        // --- RAPPORT DE VALIDATION ---
        if (ENABLE_VALIDATION) {
            log(`📋 Generating validation report...`);
            let report = '═══════════════════════════════════════════════════════════\n';
            if (ENABLE_SSL_CHECK) {
                report += '           ' + t('report_title_with_ssl') + '\n';
            } else {
                report += '           ' + t('report_title') + '\n';
            }
            report += '═══════════════════════════════════════════════════════════\n\n';
            report += t('date') + new Date().toISOString() + '\n';
            report += t('source_file') + inputPath + '\n';
            report += t('domains_analyzed') + Object.keys(domains).length + '\n';
            report += t('violations_detected') + violations.length + '\n';
            
            if (IGNORED_RULES.size > 0) {
                report += '\n⚠️  ' + t('ignored_rules') + Array.from(IGNORED_RULES).join(', ') + '\n';
            }
            
            if (ENABLE_SSL_CHECK) {
                report += '\n' + t('ssl_certificates_verified') + Object.keys(sslCertificates).length + '\n';
                report += t('ssl_ok') + sslValid.length + '\n';
                report += t('ssl_warning') + sslWarning.length + '\n';
                report += t('ssl_critical') + sslCritical.length + '\n';
                report += t('ssl_errors') + sslErrors.length + '\n';
            }
            
            if (ENABLE_HTTP_CHECK && httpResults.length > 0) {
                // Grouper par domaine pour compter une fois par FQDN (HTTPS-FIRST)
                const domainStatus = new Map();
                
                httpResults.forEach(r => {
                    const key = r.fqdn;
                    if (!domainStatus.has(key)) {
                        // Initialiser avec le premier résultat
                        const statusCode = r.protocol === 'https' ? r.https.statusCode : 
                                          r.protocol === 'http' ? r.http.statusCode : null;
                        domainStatus.set(key, { protocol: r.protocol, statusCode: statusCode });
                    } else {
                        const current = domainStatus.get(key);
                        
                        // Garder le meilleur résultat (HTTPS > HTTP > none)
                        if (r.protocol === 'https' && current.protocol !== 'https') {
                            current.protocol = 'https';
                            current.statusCode = r.https.statusCode;
                        } else if (r.protocol === 'http' && current.protocol === 'none') {
                            current.protocol = 'http';
                            current.statusCode = r.http.statusCode;
                        } else if (r.protocol === 'https' && current.protocol === 'https' && r.https.statusCode) {
                            // Si deux résultats HTTPS, garder le meilleur code (plus petit = meilleur)
                            if (!current.statusCode || r.https.statusCode < current.statusCode) {
                                current.statusCode = r.https.statusCode;
                            }
                        } else if (r.protocol === 'http' && current.protocol === 'http' && r.http.statusCode) {
                            // Si deux résultats HTTP, garder le meilleur code
                            if (!current.statusCode || r.http.statusCode < current.statusCode) {
                                current.statusCode = r.http.statusCode;
                            }
                        }
                    }
                });
                
                // Compter par catégorie (un domaine = un compteur)
                let httpOK = 0;
                let httpRedirects = 0;
                let httpClientErrors = 0;
                let httpServerErrors = 0;
                let httpErrors = 0;
                
                domainStatus.forEach((status) => {
                    if (!status.statusCode) {
                        httpErrors++;
                        return;
                    }
                    
                    const code = status.statusCode;
                    if (code >= 200 && code < 300) {
                        httpOK++;
                    } else if (code >= 300 && code < 400) {
                        httpRedirects++;
                    } else if (code >= 400 && code < 500) {
                        httpClientErrors++;
                    } else if (code >= 500 && code < 600) {
                        httpServerErrors++;
                    }
                });
                
                const domainsTestedCount = domainStatus.size;
                report += '\n' + t('http_availability') + domainsTestedCount + ' ' + t('http_strategy') + '\n';
                report += t('http_ok') + httpOK + '\n';
                report += t('http_redirects') + httpRedirects + '\n';
                report += t('http_client_errors') + httpClientErrors + '\n';
                report += t('http_server_errors') + httpServerErrors + '\n';
                report += t('http_connection_errors') + httpErrors + '\n';
            }
            
            report += '\n';
            
            if (violations.length === 0) {
                report += t('no_violations') + '\n';
            } else {
                const critical = violations.filter(v => v.severity === 'CRITICAL').length;
                const warnings = violations.filter(v => v.severity === 'WARNING').length;
                const infos = violations.filter(v => v.severity === 'INFO').length;
                
                report += t('violations_critical') + critical + '\n';
                report += t('violations_warning') + warnings + '\n';
                report += t('violations_info') + infos + '\n\n';
                
                // Bilan par règle
                const ruleCount = new Map();
                violations.forEach(v => {
                    ruleCount.set(v.rule, (ruleCount.get(v.rule) || 0) + 1);
                });
                
                if (ruleCount.size > 0) {
                    report += t('rule_summary') + '\n\n';
                    
                    // Trier par nombre de violations décroissant
                    const sortedRules = Array.from(ruleCount.entries())
                        .sort((a, b) => b[1] - a[1]);
                    
                    sortedRules.forEach(([rule, count]) => {
                        // Déterminer la sévérité de cette règle
                        const violationExample = violations.find(v => v.rule === rule);
                        const severityIcon = violationExample.severity === 'CRITICAL' ? '🚨' :
                                            violationExample.severity === 'WARNING' ? '⚠️' : 'ℹ️';
                        
                        report += `   ${severityIcon} ${rule}: ${count} violation(s)\n`;
                    });
                    
                    report += '\n';
                }
                
                report += '───────────────────────────────────────────────────────────\n\n';
                
                // CRITICAL
                if (critical > 0) {
                    report += t('violations_header_critical') + '\n\n';
                    violations.filter(v => v.severity === 'CRITICAL').forEach((v, i) => {
                        report += `${i + 1}. [${v.rule}] ${v.fqdn}\n`;
                        report += `   ${v.message}\n`;
                        report += `   Reference: ${v.reference}\n`;
                        report += `   Affected records: ${v.affectedRecords.map(r => `${r.type} ${r.value}`).join(', ')}\n\n`;
                    });
                }
                
                // WARNING
                if (warnings > 0) {
                    report += '\n' + t('violations_header_warning') + '\n\n';
                    violations.filter(v => v.severity === 'WARNING').forEach((v, i) => {
                        report += `${i + 1}. [${v.rule}] ${v.fqdn}\n`;
                        report += `   ${v.message}\n`;
                        report += `   Reference: ${v.reference}\n`;
                        report += `   Affected records: ${v.affectedRecords.map(r => `${r.type} ${r.value}`).join(', ')}\n\n`;
                    });
                }
                
                // INFO
                if (infos > 0) {
                    report += '\n' + t('violations_header_info') + '\n\n';
                    violations.filter(v => v.severity === 'INFO').forEach((v, i) => {
                        report += `${i + 1}. [${v.rule}] ${v.fqdn}\n`;
                        report += `   ${v.message}\n`;
                        report += `   Reference: ${v.reference}\n`;
                        report += `   Affected records: ${v.affectedRecords.map(r => `${r.type} ${r.value}`).join(', ')}\n\n`;
                    });
                }
                
                report += '\n───────────────────────────────────────────────────────────\n';
                
                // Compter les règles selon l'activation de --email-validation
                const totalRules = ENABLE_EMAIL_VALIDATION ? 27 : 19;
                const emailRulesText = ENABLE_EMAIL_VALIDATION ? ' (' + t('rules_dns') + ' + ' + t('rules_email') + ')' : '';
                
                report += t('rules_validated') + totalRules + t('rules_count') + emailRulesText + ', 3 levels):\n\n';
                report += t('blocking_violations') + '\n';
                report += '1. ' + t('cname_coexistence') + '\n';
                report += '2. ' + t('cname_on_apex') + '\n';
                report += '3. ' + t('cname_loop') + '\n';
                report += '4. ' + t('mx_to_cname') + '\n';
                report += '5. ' + t('ns_to_cname') + '\n';
                report += '6. ' + t('mx_no_glue') + '\n';
                report += '7. ' + t('spf_too_permissive') + '\n';
                
                if (ENABLE_EMAIL_VALIDATION) {
                    report += '8. ' + t('spf_all_permissive') + '\n';
                    report += '9. ' + t('dmarc_missing') + '\n';
                }
                
                report += '\n' + t('important_warnings') + '\n';
                const warningStart = ENABLE_EMAIL_VALIDATION ? 10 : 8;
                report += `${warningStart}. ` + t('cname_chain') + '\n';
                report += `${warningStart + 1}. ` + t('inconsistent_ttl') + '\n';
                report += `${warningStart + 2}. ` + t('ttl_too_short') + '\n';
                report += `${warningStart + 3}. ` + t('spf_neutral') + '\n';
                report += `${warningStart + 4}. ` + t('mx_orphan') + '\n';
                report += `${warningStart + 5}. ` + t('view_segregation') + '\n';
                
                if (ENABLE_EMAIL_VALIDATION) {
                    report += `${warningStart + 6}. ` + t('spf_many_lookups') + '\n';
                    report += `${warningStart + 7}. ` + t('mx_not_in_spf') + '\n';
                    report += `${warningStart + 8}. ` + t('dkim_invalid') + '\n';
                    report += `${warningStart + 9}. ` + t('dkim_weak') + '\n';
                    report += `${warningStart + 10}. ` + t('dmarc_no_reporting') + '\n';
                }
                
                report += '\n' + t('recommendations') + '\n';
                const infoStart = ENABLE_EMAIL_VALIDATION ? 25 : 14;
                report += `${infoStart}. ` + t('missing_ipv6') + '\n';
                report += `${infoStart + 1}. ` + t('ttl_too_long') + '\n';
                report += `${infoStart + 2}. ` + t('wildcard_restriction') + '\n';
                report += `${infoStart + 3}. ` + t('duplicate_record') + '\n';
                report += `${infoStart + 4}. ` + t('cname_orphan') + '\n';
                report += `${infoStart + 5}. ` + t('inconsistent_ttl_multiview') + '\n';
                
                if (ENABLE_EMAIL_VALIDATION) {
                    report += `${infoStart + 6}. ` + t('dmarc_policy_none') + '\n';
                    report += `${infoStart + 7}. ` + t('dkim_missing') + '\n';
                    report += `${infoStart + 8}. ` + t('autodiscover_missing') + '\n';
                }
                
                // Ajouter section SSL
                if (ENABLE_SSL_CHECK && (sslCritical.length > 0 || sslWarning.length > 0 || sslErrors.length > 0)) {
                    report += '\n═══════════════════════════════════════════════════════════\n';
                    report += '            ' + t('ssl_section') + '\n';
                    report += '═══════════════════════════════════════════════════════════\n\n';
                    
                    if (sslCritical.length > 0) {
                        report += t('ssl_critical_header') + '\n\n';
                        sslCritical.forEach((group, i) => {
                            const cert = group.cert;
                            report += `${i + 1}. ${cert.commonName}\n`;
                            if (cert.daysUntilExpiry < 0) {
                                report += `   ` + t('ssl_expired') + Math.abs(cert.daysUntilExpiry) + t('ssl_days') + '\n';
                            } else {
                                report += `   ` + t('ssl_expires') + cert.daysUntilExpiry + t('ssl_days') + '\n';
                            }
                            report += `   ` + t('ssl_issuer') + cert.issuer + '\n';
                            report += `   ` + t('ssl_valid_until') + cert.validTo + '\n';
                            report += `   ` + t('ssl_verified_from') + group.domains.join(', ') + '\n';
                            report += `   ` + t('ssl_domains_covered') + (cert.allNames ? cert.allNames.length : group.domains.length) + '):\n';
                            if (cert.allNames) {
                                cert.allNames.forEach(name => report += `     - ${name}\n`);
                            } else {
                                group.domains.forEach(name => report += `     - ${name}\n`);
                            }
                            report += '\n';
                        });
                    }
                    
                    if (sslWarning.length > 0) {
                        report += '\n' + t('ssl_warning_header') + '\n\n';
                        sslWarning.forEach((group, i) => {
                            const cert = group.cert;
                            report += `${i + 1}. ${cert.commonName}\n`;
                            report += `   ` + t('ssl_expires_in') + cert.daysUntilExpiry + t('ssl_days') + '\n';
                            report += `   ` + t('ssl_issuer') + cert.issuer + '\n';
                            report += `   ` + t('ssl_valid_until') + cert.validTo + '\n';
                            report += `   ` + t('ssl_verified_from') + group.domains.join(', ') + '\n';
                            report += `   ` + t('ssl_domains_covered') + (cert.allNames ? cert.allNames.length : group.domains.length) + '):\n';
                            if (cert.allNames) {
                                cert.allNames.forEach(name => report += `     - ${name}\n`);
                            } else {
                                group.domains.forEach(name => report += `     - ${name}\n`);
                            }
                            report += '\n';
                        });
                    }
                    
                    if (sslErrors.length > 0) {
                        // Filtrer les timeouts si --ssl-no-timeout-errors est activé
                        const errorsToShow = SSL_HIDE_TIMEOUT_ERRORS 
                            ? sslErrors.filter(g => g.cert.status !== 'timeout')
                            : sslErrors;
                        
                        if (errorsToShow.length > 0) {
                            report += '\n' + t('ssl_connection_errors') + '\n\n';
                            errorsToShow.forEach((group, i) => {
                                const cert = group.cert;
                                report += `${i + 1}. ${cert.hostname}\n`;
                                report += `   ` + t('ssl_error') + cert.error + '\n';
                                report += `   ` + t('ssl_verified_from') + group.domains.join(', ') + '\n\n';
                            });
                        }
                    }
                }
                
                // Ajouter section HTTP/HTTPS
                if (ENABLE_HTTP_CHECK && httpResults.length > 0) {
                    report += '\n═══════════════════════════════════════════════════════════\n';
                    report += '          ' + t('http_section') + '\n';
                    report += '═══════════════════════════════════════════════════════════\n\n';
                    report += t('http_strategy_note') + '\n';
                    report += t('http_dns_resolution') + '\n\n';
                    
                    // Grouper par FQDN pour éviter les doublons (un domaine peut avoir plusieurs IPs/vues)
                    const domainResults = new Map();
                    httpResults.forEach(r => {
                        const key = r.fqdn;
                        if (!domainResults.has(key)) {
                            domainResults.set(key, []);
                        }
                        domainResults.get(key).push(r);
                    });
                    
                    // Pour chaque domaine, garder le meilleur résultat (HTTPS > HTTP, meilleur code)
                    const bestResults = [];
                    domainResults.forEach((results, fqdn) => {
                        let best = results[0];
                        for (const r of results) {
                            // Priorité: HTTPS > HTTP > none
                            if (r.protocol === 'https' && best.protocol !== 'https') {
                                best = r;
                            } else if (r.protocol === 'http' && best.protocol === 'none') {
                                best = r;
                            } else if (r.protocol === best.protocol) {
                                // Même protocole: prendre le meilleur code (2xx > 3xx > 4xx > 5xx)
                                const rCode = r.protocol === 'https' ? r.https.statusCode : r.http.statusCode;
                                const bestCode = best.protocol === 'https' ? best.https.statusCode : best.http.statusCode;
                                if (rCode && bestCode && rCode < bestCode) {
                                    best = r;
                                }
                            }
                        }
                        bestResults.push(best);
                    });
                    
                    // Grouper par statut en utilisant le protocole principal (HTTPS prioritaire)
                    const httpOK = bestResults.filter(r => {
                        const status = r.protocol === 'https' ? r.https.statusCode : r.http.statusCode;
                        return status >= 200 && status < 300;
                    });
                    const httpRedirects = bestResults.filter(r => {
                        const status = r.protocol === 'https' ? r.https.statusCode : r.http.statusCode;
                        return status >= 300 && status < 400;
                    });
                    const httpClientErrors = bestResults.filter(r => {
                        const status = r.protocol === 'https' ? r.https.statusCode : r.http.statusCode;
                        return status >= 400 && status < 500;
                    });
                    const httpServerErrors = bestResults.filter(r => {
                        const status = r.protocol === 'https' ? r.https.statusCode : r.http.statusCode;
                        return status >= 500 && status < 600;
                    });
                    const httpErrors = bestResults.filter(r => r.protocol === 'none');
                    
                    if (httpOK.length > 0) {
                        report += '✅ DOMAINES ACCESSIBLES (2xx):\n\n';
                        httpOK.forEach((result, i) => {
                            report += `${i + 1}. ${result.fqdn}\n`;
                            if (result.cnameChain && result.cnameChain.length > 0) {
                                report += `   Résolution: ${result.cnameChain.join(' → ')} → ${result.ip}\n`;
                            } else {
                                report += `   IP: ${result.ip}\n`;
                            }
                            report += `   Vue(s): ${result.view}\n`;
                            // Afficher le protocole qui a répondu
                            if (result.protocol === 'https') {
                                report += `   ✅ HTTPS: ${result.https.statusCode} ${result.https.statusMessage} (${result.https.responseTime}ms)\n`;
                            } else if (result.protocol === 'http') {
                                report += `   ⚠️  HTTP: ${result.http.statusCode} ${result.http.statusMessage} (${result.http.responseTime}ms)\n`;
                                report += `   Note: HTTPS non disponible, fallback sur HTTP\n`;
                            }
                            report += '\n';
                        });
                    }
                    
                    if (httpRedirects.length > 0) {
                        report += '\n🔀 REDIRECTIONS (3xx):\n\n';
                        httpRedirects.forEach((result, i) => {
                            report += `${i + 1}. ${result.fqdn}\n`;
                            report += `   IP: ${result.ip} | Vue(s): ${result.view}\n`;
                            if (result.protocol === 'https') {
                                report += `   HTTPS: ${result.https.statusCode} ${result.https.statusMessage}\n`;
                                if (result.https.headers && result.https.headers.location) {
                                    report += `   → Redirige vers: ${result.https.headers.location}\n`;
                                }
                            } else if (result.protocol === 'http') {
                                report += `   HTTP: ${result.http.statusCode} ${result.http.statusMessage}\n`;
                                if (result.http.headers && result.http.headers.location) {
                                    report += `   → Redirige vers: ${result.http.headers.location}\n`;
                                }
                                report += `   Note: HTTPS non disponible, fallback sur HTTP\n`;
                            }
                            report += '\n';
                        });
                    }
                    
                    if (httpClientErrors.length > 0) {
                        report += '\n⚠️  ERREURS CLIENT (4xx):\n\n';
                        httpClientErrors.forEach((result, i) => {
                            report += `${i + 1}. ${result.fqdn}\n`;
                            report += `   IP: ${result.ip} | Vue(s): ${result.view}\n`;
                            if (result.protocol === 'https') {
                                report += `   HTTPS: ${result.https.statusCode} ${result.https.statusMessage}\n`;
                            } else if (result.protocol === 'http') {
                                report += `   HTTP: ${result.http.statusCode} ${result.http.statusMessage}\n`;
                                report += `   Note: HTTPS non disponible, fallback sur HTTP\n`;
                            }
                            report += '\n';
                        });
                    }
                    
                    if (httpServerErrors.length > 0) {
                        report += '\n🚨 ERREURS SERVEUR (5xx):\n\n';
                        httpServerErrors.forEach((result, i) => {
                            report += `${i + 1}. ${result.fqdn}\n`;
                            report += `   IP: ${result.ip} | Vue(s): ${result.view}\n`;
                            if (result.protocol === 'https') {
                                report += `   HTTPS: ${result.https.statusCode} ${result.https.statusMessage}\n`;
                            } else if (result.protocol === 'http') {
                                report += `   HTTP: ${result.http.statusCode} ${result.http.statusMessage}\n`;
                                report += `   Note: HTTPS non disponible, fallback sur HTTP\n`;
                            }
                            report += '\n';
                        });
                    }
                    
                    if (httpErrors.length > 0) {
                        report += '\n❌ ERREURS DE CONNEXION:\n\n';
                        httpErrors.forEach((result, i) => {
                            report += `${i + 1}. ${result.fqdn}\n`;
                            report += `   IP: ${result.ip} | Vue(s): ${result.view}\n`;
                            report += `   HTTPS: ${result.https.error}\n`;
                            report += `   HTTP: ${result.http.error}\n`;
                            report += `   Note: Aucun protocole n'a répondu\n`;
                            report += '\n';
                        });
                    }
                }
                
                // Section finale : Domaines à vérifier (HTTPS-FIRST: un seul protocole affiché)
                if (ENABLE_HTTP_CHECK && httpResults.length > 0) {
                    const httpErrors = httpResults.filter(r => r.protocol === 'none');
                    const httpClientErrors = httpResults.filter(r => {
                        const status = r.protocol === 'https' ? r.https.statusCode : r.http.statusCode;
                        return status >= 400 && status < 500;
                    });
                    const httpServerErrors = httpResults.filter(r => {
                        const status = r.protocol === 'https' ? r.https.statusCode : r.http.statusCode;
                        return status >= 500 && status < 600;
                    });
                    
                    if (httpErrors.length > 0 || httpClientErrors.length > 0 || httpServerErrors.length > 0) {
                        report += '\n\n═══════════════════════════════════════════════════════════════\n';
                        report += '       DOMAINES HTTP/HTTPS NÉCESSITANT ATTENTION\n';
                        report += '═══════════════════════════════════════════════════════════════\n\n';
                        
                        if (httpErrors.length > 0) {
                            report += '❌ DOMAINES INACCESSIBLES (Erreurs de connexion):\n\n';
                            httpErrors.forEach((result, i) => {
                                report += `${i + 1}. ${result.fqdn}\n`;
                                report += `   IP: ${result.ip} | Vue(s): ${result.view}\n`;
                                report += `   HTTPS: ${result.https.error}\n`;
                                report += `   HTTP: ${result.http.error}\n`;
                                report += `   Note: Aucun protocole n'a répondu\n`;
                                report += '\n';
                            });
                        }
                        
                        if (httpClientErrors.length > 0 || httpServerErrors.length > 0) {
                            report += '\n⚠️  DOMAINES POTENTIELLEMENT DYSFONCTIONNELS:\n\n';
                            
                            if (httpServerErrors.length > 0) {
                                report += '🚨 Erreurs serveur (5xx) - Problèmes backend :\n\n';
                                httpServerErrors.forEach((result, i) => {
                                    report += `${i + 1}. ${result.fqdn}\n`;
                                    report += `   IP: ${result.ip} | Vue(s): ${result.view}\n`;
                                    if (result.protocol === 'https') {
                                        report += `   HTTPS: ${result.https.statusCode} ${result.https.statusMessage}\n`;
                                    } else if (result.protocol === 'http') {
                                        report += `   HTTP: ${result.http.statusCode} ${result.http.statusMessage}\n`;
                                        report += `   Note: HTTPS non disponible, fallback sur HTTP\n`;
                                    }
                                    report += '\n';
                                });
                            }
                            
                            if (httpClientErrors.length > 0) {
                                report += '\n⚠️  Erreurs client (4xx) - Pages introuvables ou accès refusé :\n\n';
                                httpClientErrors.forEach((result, i) => {
                                    report += `${i + 1}. ${result.fqdn}\n`;
                                    report += `   IP: ${result.ip} | Vue(s): ${result.view}\n`;
                                    if (result.protocol === 'https') {
                                        report += `   HTTPS: ${result.https.statusCode} ${result.https.statusMessage}\n`;
                                    } else if (result.protocol === 'http') {
                                        report += `   HTTP: ${result.http.statusCode} ${result.http.statusMessage}\n`;
                                        report += `   Note: HTTPS non disponible, fallback sur HTTP\n`;
                                    }
                                    report += '\n';
                                });
                            }
                        }
                    }
                }
            }
            
			
            fs.writeFileSync(reportTxt, report);
            log(`✅ Rapport de validation : ${reportTxt}`);
        }
        
        // Génération du rapport CSV enrichi
        if (ENABLE_CSV_REPORT) {
            log(`📊 Génération du rapport CSV enrichi...`);
            
            // Préparer les données enrichies - PARCOURIR TOUTES LES LIGNES DU CSV
            const enrichedData = [];
            
            // Réutiliser les index de colonnes détectés lors du parsing principal
            // Parser à nouveau le CSV pour avoir TOUTES les lignes (y compris celles sans domaine)
            for (let i = headerLineIndex + 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line || line.startsWith('#')) continue;
                
                const fields = parseCSVLine(line, delimiter);
                if (!fields || fields.length <= Math.max(nameIndex, typeIndex, valueIndex)) continue;
                
                const rec = {
                    ttl: hasTTL && ttlIndex < fields.length ? fields[ttlIndex].trim() : '3600',
                    name: nameIndex < fields.length ? fields[nameIndex].toLowerCase().trim().replace(/\.$/, '') : '',
                    type: typeIndex < fields.length ? fields[typeIndex].toUpperCase().trim() : '',
                    value: valueIndex < fields.length ? fields[valueIndex].toLowerCase().trim().replace(/\.$/, '') : '',
                    view: hasView && viewIndex < fields.length ? fields[viewIndex].trim() : 'default'
                };
                
                // Vérifier que les champs essentiels ne sont pas vides
                if (!rec.name || !rec.type || !rec.value) continue;
                
                const fqdn = rec.name;
                    const row = {
                        // Colonnes originales
                        'TTL': rec.ttl,
                        'Name': rec.name,
                        'Type': rec.type,
                        'Value': rec.value,
                        'View': rec.view || 'default',
                        
                        // Colonnes d'analyse DNS
                        'Alertes techniques DNS Urgente': '',
                        'Alertes techniques DNS Importante': '',
                        'Alertes techniques DNS Mineure': '',
                        
                        // Autres colonnes d'analyse
                        'SSL_Status': '',
                        'SSL_Expiry_Days': '',
                        'SSL_Issuer': '',
                        'HTTP_Status': '',
                        'HTTPS_Status': '',
                        'HTTP_Response_Time': '',
                        'HTTPS_Response_Time': '',
                        'IP_Type': '',
                        'IP_Count': 0,
                        'View_Type': '',
                        'Is_Orphan': 'No',
                        'Points_To': '',
                        'Resolved_IPs': ''
                    };
                    
                    // Violations pour ce record (séparées par sévérité)
                    const recordViolations = violations.filter(v => 
                        v.fqdn === fqdn && v.affectedRecords.some(r => r.type === rec.type && r.value === rec.value)
                    );
                    
                    if (recordViolations.length > 0) {
                        const criticalViolations = recordViolations.filter(v => v.severity === 'CRITICAL').map(v => v.rule);
                        const warningViolations = recordViolations.filter(v => v.severity === 'WARNING').map(v => v.rule);
                        const infoViolations = recordViolations.filter(v => v.severity === 'INFO').map(v => v.rule);
                        
                        row['Alertes techniques DNS Urgente'] = criticalViolations.join('; ');
                        row['Alertes techniques DNS Importante'] = warningViolations.join('; ');
                        row['Alertes techniques DNS Mineure'] = infoViolations.join('; ');
                    }
                    
                    // SSL Status
                    if (ENABLE_SSL_CHECK && sslCertificates[fqdn]) {
                        const cert = sslCertificates[fqdn];
                        if (cert.status === 'valid' || cert.status === 'expiring_soon' || cert.status === 'expiring_warning') {
                            row['SSL_Status'] = cert.status === 'valid' ? 'Valid' : (cert.status === 'expiring_soon' ? 'Expiring Soon' : 'Expiring Warning');
                            row['SSL_Expiry_Days'] = cert.daysUntilExpiry;
                            row['SSL_Issuer'] = cert.issuer;
                        } else if (cert.status === 'expired') {
                            row['SSL_Status'] = 'Expired';
                            row['SSL_Expiry_Days'] = cert.daysUntilExpiry;
                        } else if (cert.error) {
                            row['SSL_Status'] = 'Error';
                        }
                    }
                    
                    // HTTP/HTTPS Status (HTTPS-FIRST logic)
                    if (ENABLE_HTTP_CHECK && httpResults.length > 0) {
                        const httpTest = httpResults.find(r => 
                            r.fqdn === fqdn && (rec.type === 'A' || rec.type === 'AAAA' ? r.ip === rec.value : true)
                        );
                        
                        if (httpTest) {
                            // HTTPS-FIRST: si HTTPS a répondu, afficher seulement HTTPS
                            if (httpTest.protocol === 'https') {
                                row['HTTPS_Status'] = httpTest.https.statusCode || ('Error: ' + httpTest.https.error);
                                row['HTTPS_Response_Time'] = httpTest.https.responseTime + 'ms';
                                row['HTTP_Status'] = 'Not tested (HTTPS available)';
                            } else if (httpTest.protocol === 'http') {
                                // Fallback HTTP (HTTPS a échoué)
                                row['HTTP_Status'] = httpTest.http.statusCode || ('Error: ' + httpTest.http.error);
                                row['HTTP_Response_Time'] = httpTest.http.responseTime + 'ms';
                                row['HTTPS_Status'] = 'Error: ' + httpTest.https.error;
                            } else {
                                // Aucun protocole n'a répondu
                                row['HTTP_Status'] = 'Error: ' + httpTest.http.error;
                                row['HTTPS_Status'] = 'Error: ' + httpTest.https.error;
                            }
                        }
                    }
                    
                    // Analyse des IPs
                    if (rec.type === 'A' || rec.type === 'AAAA') {
                        row['IP_Type'] = rec.type === 'A' ? 'IPv4' : 'IPv6';
                        const ipNode = ipNodes[rec.value];
                        if (ipNode) {
                            row['IP_Count'] = ipNode.usedBy.length;
                        }
                        
                        // Détecter IP privée RFC 1918
                        if (rec.type === 'A') {
                            const parts = rec.value.split('.');
                            if (parts[0] === '10' || 
                                (parts[0] === '172' && parseInt(parts[1]) >= 16 && parseInt(parts[1]) <= 31) ||
                                (parts[0] === '192' && parts[1] === '168')) {
                                row['IP_Type'] = 'IPv4 (Private RFC1918)';
                            }
                        }
                    }
                    
                    // Type de vue
                    const viewLower = rec.view ? rec.view.toLowerCase() : '';
                    if (viewLower.includes('int') || viewLower.includes('priv')) {
                        row['View_Type'] = 'Internal';
                    } else if (viewLower.includes('extern') || viewLower.includes('pub')) {
                        row['View_Type'] = 'External';
                    } else {
                        row['View_Type'] = 'Default';
                    }
                    
                    // CNAME/MX/NS - Points To
                    if (rec.type === 'CNAME' || rec.type === 'MX' || rec.type === 'NS') {
                        const target = rec.type === 'MX' ? rec.value.split(' ').slice(1).join(' ') : rec.value;
                        row['Points_To'] = target;
                        
                        // Vérifier si orphelin
                        if (!domains[target]) {
                            row['Is_Orphan'] = 'Yes';
                        }
                        
                        // Résoudre les IPs finales pour CNAME
                        if (rec.type === 'CNAME') {
                            const resolvedIPs = resolveFQDNToIPs(fqdn, domains);
                            if (resolvedIPs.length > 0) {
                                row['Resolved_IPs'] = resolvedIPs.map(r => r.ip).join('; ');
                            }
                        }
                    }
                    
                    enrichedData.push(row);
            }
            
            // Générer le CSV avec séparateur point-virgule (standard français)
            if (enrichedData.length > 0) {
                const headers = Object.keys(enrichedData[0]);
                const outputDelimiter = ';'; // Toujours utiliser ; en sortie
                let csvContent = headers.join(outputDelimiter) + '\n';
                
                enrichedData.forEach(row => {
                    const values = headers.map(header => {
                        let value = (row[header] === null || row[header] === undefined) ? '' : row[header].toString();
                        // Échapper les virgules, point-virgules, guillemets, retours à la ligne et caractères spéciaux
                        if (value.includes(',') || value.includes(';') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
                            // Remplacer les retours à la ligne par des espaces
                            value = value.replace(/[\r\n]+/g, ' ');
                            // Échapper les guillemets en les doublant
                            value = value.replace(/"/g, '""');
                            return `"${value}"`;
                        }
                        return value;
                    });
                    csvContent += values.join(outputDelimiter) + '\n';
                });
                
                fs.writeFileSync(csvReportPath, csvContent);
                log(`✅ Rapport CSV enrichi : ${csvReportPath}`);
            }
        }

        // Résumé final
        if (!QUIET_MODE) {
            console.log('\n┌─────────────────────────────────────────┐');
            console.log('│         Génération terminée ✅          │');
            console.log('└─────────────────────────────────────────┘');
            console.log(`📊 Fichiers générés :`);
            if (ENABLE_DIAGRAM) {
                console.log(`   - ${OUTPUT_FILE}`);
                if (ENABLE_LEGEND) console.log(`   - ${LEGEND_FILE}`);
            }
            if (ENABLE_VALIDATION) console.log(`   - ${VALIDATION_FILE}`);
            if (ENABLE_CSV_REPORT) console.log(`   - ${CSV_REPORT_FILE}`);
            if (ENABLE_IMG_EXPORT && ENABLE_DIAGRAM) {
                console.log(`   - ${SVG_FILE}`);
                if (ENABLE_LEGEND) console.log(`   - ${LEGEND_SVG_FILE}`);
            }
            if (ENABLE_VALIDATION && violations.length > 0) {
                const critical = violations.filter(v => v.severity === 'CRITICAL').length;
                const warnings = violations.filter(v => v.severity === 'WARNING').length;
                const infos = violations.filter(v => v.severity === 'INFO').length;
                console.log(`\n⚠️  Violations détectées :`);
                if (critical > 0) console.log(`   🚨 ${critical} CRITICAL`);
                if (warnings > 0) console.log(`   ⚠️  ${warnings} WARNING`);
                if (infos > 0) console.log(`   ℹ️  ${infos} INFO`);
            }
        }
        
        return { success: true, file: inputPath };
    } catch (err) {
        console.error(`❌ Erreur : ${err.message}`);
        return { success: false, file: inputPath, error: err.message };
    }
};

// --- FONCTION PRINCIPALE ---
(async () => {
    try {
        if (BATCH_FOLDER) {
            // Mode batch : traiter tous les CSV du dossier
            if (!fs.existsSync(BATCH_FOLDER)) {
                console.error(`❌ Erreur : Dossier "${BATCH_FOLDER}" introuvable.`);
                process.exit(1);
            }
            
            const files = fs.readdirSync(BATCH_FOLDER).filter(f => f.endsWith('.csv'));
            
            if (files.length === 0) {
                console.error(`❌ Aucun fichier CSV trouvé dans "${BATCH_FOLDER}".`);
                process.exit(1);
            }
            
            log(`\n🗂️  Mode BATCH : ${files.length} fichier(s) CSV détecté(s)`);
            log(`📁 Dossier source : ${BATCH_FOLDER}\n`);
            
            const results = [];
            
            for (const file of files) {
                const inputPath = path.join(BATCH_FOLDER, file);
                const baseName = path.basename(file, '.csv');
                
                // Générer le nom de dossier avec ou sans timestamp
                let folderName = baseName;
                if (!NO_TIMESTAMP) {
                    folderName = generateOutputDirName(inputPath);
                }
                
                const outputDir = path.join(BATCH_FOLDER, 'output', folderName);
                
                const result = await processCSVFile(inputPath, outputDir);
                results.push(result);
            }
            
            // Résumé global
            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;
            
            console.log(`\n${'='.repeat(60)}`);
            console.log(`📊 RÉSUMÉ BATCH`);
            console.log(`${'='.repeat(60)}`);
            console.log(`✅ Réussis : ${successCount}/${files.length}`);
            if (failCount > 0) {
                console.log(`❌ Échecs : ${failCount}`);
                results.filter(r => !r.success).forEach(r => {
                    console.log(`   - ${path.basename(r.file)} : ${r.error}`);
                });
            }
            console.log(`${'='.repeat(60)}\n`);
            
        } else {
            // Mode fichier unique
            let outputDir;
            
            if (CUSTOM_OUTPUT_DIR) {
                // Utiliser le dossier personnalisé spécifié par --output-dir
                outputDir = path.resolve(CUSTOM_OUTPUT_DIR);
            } else {
                // Déterminer si l'utilisateur a fourni un chemin de sortie explicite
                const hasExplicitOutput = args.includes('-o') || args.includes('--output');
                
                if (hasExplicitOutput) {
                    // Si -o est fourni, utiliser le répertoire spécifié (comportement original)
                    outputDir = path.dirname(path.resolve(OUTPUT_FILE));
                } else {
                    // Sinon, utiliser le comportement par défaut avec/sans timestamp
                    const inputDir = path.dirname(path.resolve(INPUT_FILE));
                    
                    if (!NO_TIMESTAMP) {
                        // Créer un dossier avec timestamp dans le même répertoire que l'input
                        const folderName = generateOutputDirName(INPUT_FILE);
                        outputDir = path.join(inputDir, folderName);
                    } else {
                        // Comportement original : utiliser le répertoire courant
                        outputDir = path.dirname(path.resolve(OUTPUT_FILE));
                    }
                }
            }
            
            await processCSVFile(INPUT_FILE, outputDir);
        }
        
    } catch (err) {
        console.error(`❌ Erreur fatale : ${err.message}`);
        console.error(err.stack);
        process.exit(1);
    }
})();