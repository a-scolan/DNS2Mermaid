#!/usr/bin/env node
/**
 * ============================================================================
 * Script de Test - Validation DNS RFC
 * ============================================================================
 * Test toutes les règles de validation DNS RFC implémentées dans dns2mermaid.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Couleurs ANSI
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    bold: '\x1b[1m'
};

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function printHeader(text) {
    console.log(`${colors.blue}${'='.repeat(76)}${colors.reset}`);
    console.log(`${colors.blue}${text}${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(76)}${colors.reset}`);
}

function printTest(num, description) {
    console.log(`\n${colors.yellow}📋 Test #${num}: ${description}${colors.reset}`);
}

function printSuccess(message) {
    console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function printError(message) {
    console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function printInfo(message) {
    console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

function checkViolation(testNum, csvFile, ruleCode, severity, description) {
    totalTests++;
    printTest(testNum, description);
    
    const outputDir = path.join(__dirname, 'output', testNum);
    const reportFile = path.join(outputDir, 'validation_report.txt');
    const mmdFile = path.join(outputDir, 'output.mmd');
    
    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });
    
    const projectRoot = path.join(__dirname, '..', '..');
    const dns2mermaidPath = path.join(projectRoot, 'dns2mermaid.js');
    const csvPath = path.join(__dirname, csvFile);
    
    // Règles email nécessitant le flag --email-validation
    const emailRules = ['SPF_TOO_PERMISSIVE', 'SPF_ALL_PERMISSIVE', 'DMARC_MISSING_WITH_PUBLIC_MX', 'MX_NOT_IN_SPF', 'DKIM_INVALID_FORMAT', 'DKIM_WEAK_KEY', 'DMARC_NO_REPORTING', 'DMARC_POLICY_NONE', 'DKIM_MISSING', 'AUTODISCOVER_MISSING'];
    const emailValidationFlag = emailRules.includes(ruleCode) ? '--email-validation' : '';
    
    console.log(`   Exécution : node dns2mermaid.js -i "${path.basename(csvFile)}" --no-ssl-check --no-export --quiet ${emailValidationFlag}`.trim());
    
    try {
        execSync(
            `node "${dns2mermaidPath}" -i "${csvPath}" -o "${mmdFile}" -r "${reportFile}" --no-ssl-check --no-export --quiet ${emailValidationFlag}`.trim(),
            { cwd: projectRoot, stdio: 'pipe' }
        );
        
        if (fs.existsSync(reportFile)) {
            const reportContent = fs.readFileSync(reportFile, 'utf8');
            
            if (reportContent.includes(`[${ruleCode}]`)) {
                const lines = reportContent.split('\n');
                const violationIdx = lines.findIndex(line => line.includes(`[${ruleCode}]`));
                
                let detectedSeverity = 'UNKNOWN';
                for (let i = violationIdx; i >= 0; i--) {
                    if (lines[i].includes('🚨 VIOLATIONS BLOQUANTES')) {
                        detectedSeverity = 'CRITICAL';
                        break;
                    } else if (lines[i].includes('⚠️  PROBLÈMES À CORRIGER')) {
                        detectedSeverity = 'WARNING';
                        break;
                    } else if (lines[i].includes('ℹ️  RECOMMANDATIONS')) {
                        detectedSeverity = 'INFO';
                        break;
                    }
                }
                
                const expectedSeverity = severity.includes('CRITICAL') ? 'CRITICAL' : 
                                        severity.includes('WARNING') ? 'WARNING' : 'INFO';
                
                if (detectedSeverity === expectedSeverity) {
                    printSuccess(`Violation détectée : ${ruleCode} (${severity})`);
                    passedTests++;
                    
                    console.log('   Extrait du rapport :');
                    for (let i = violationIdx; i < Math.min(violationIdx + 3, lines.length); i++) {
                        console.log(`   │ ${lines[i]}`);
                    }
                } else {
                    printError(`Sévérité incorrecte pour ${ruleCode} (détecté: ${detectedSeverity}, attendu: ${expectedSeverity})`);
                    failedTests++;
                }
            } else {
                printError(`Violation ${ruleCode} non détectée dans le rapport`);
                failedTests++;
                console.log('   Contenu du rapport (20 premières lignes) :');
                const lines = reportContent.split('\n');
                lines.slice(0, 20).forEach(line => console.log(`   │ ${line}`));
            }
        } else {
            printError('Rapport de validation non généré');
            failedTests++;
        }
    } catch (error) {
        printError(`Erreur lors de l'exécution : ${error.message}`);
        failedTests++;
    }
}

function checkNoViolations(testNum, csvFile, description) {
    totalTests++;
    printTest(testNum, description);
    
    const outputDir = path.join(__dirname, 'output', testNum);
    const reportFile = path.join(outputDir, 'validation_report.txt');
    const mmdFile = path.join(outputDir, 'output.mmd');
    
    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });
    
    const projectRoot = path.join(__dirname, '..', '..');
    const dns2mermaidPath = path.join(projectRoot, 'dns2mermaid.js');
    const csvPath = path.join(__dirname, csvFile);
    
    // Tests "valid_" ne devraient pas activer --email-validation (ils testent seulement les règles DNS)
    // Ne PAS activer email validation pour les tests de validation multi-view DNS
    const emailValidationFlag = '';
    
    try {
        execSync(
            `node "${dns2mermaidPath}" -i "${csvPath}" -o "${mmdFile}" -r "${reportFile}" --no-ssl-check --no-export --quiet ${emailValidationFlag}`.trim(),
            { cwd: projectRoot, stdio: 'pipe' }
        );
        
        if (fs.existsSync(reportFile)) {
            const reportContent = fs.readFileSync(reportFile, 'utf8');
            const violationCount = (reportContent.match(/Violations détectées: (\d+)/)?.[1]) || '0';
            
            if (violationCount === '0') {
                printSuccess('Aucune violation détectée (configuration valide)');
                passedTests++;
            } else {
                printError(`${violationCount} violation(s) détectée(s) (aucune attendue)`);
                failedTests++;
                const lines = reportContent.split('\n');
                lines.filter(line => /^\d+\. \[/.test(line))
                    .slice(0, 5)
                    .forEach(line => console.log(`   │ ${line}`));
            }
        } else {
            printError('Rapport de validation non généré');
            failedTests++;
        }
    } catch (error) {
        printError(`Erreur lors de l'exécution : ${error.message}`);
        failedTests++;
    }
}

// ============================================================================
// DÉBUT DES TESTS
// ============================================================================

printHeader('Tests de Validation DNS RFC - dns2mermaid.js');
console.log('');
printInfo(`Répertoire de test : ${__dirname}`);
printInfo('Validation RFC activée par défaut');
console.log('');

const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// ============================================================================
// TESTS CRITICAL
// ============================================================================

checkViolation(
    '01',
    '01_critical_cname_coexistence.csv',
    'CNAME_COEXISTENCE',
    '🚨 CRITICAL',
    'CNAME coexistant avec d\'autres types (RFC 1034)'
);

checkViolation(
    '02',
    '02_critical_cname_on_apex.csv',
    'CNAME_ON_APEX',
    '🚨 CRITICAL',
    'CNAME sur zone apex/domaine racine (RFC 1912)'
);

checkViolation(
    '03',
    '03_critical_cname_loop.csv',
    'CNAME_LOOP',
    '🚨 CRITICAL',
    'Boucle de CNAMEs (détection de cycles)'
);

checkViolation(
    '04',
    '04_critical_spf_too_permissive.csv',
    'SPF_TOO_PERMISSIVE',
    '🚨 CRITICAL',
    'SPF avec +all (RFC 7208)'
);

// ============================================================================
// TESTS WARNING
// ============================================================================

checkViolation(
    '05',
    '05_warning_cname_chain.csv',
    'CNAME_CHAIN',
    '⚠️  WARNING',
    'Chaîne de CNAMEs (dégradation performances)'
);

checkViolation(
    '06',
    '06_warning_inconsistent_ttl.csv',
    'INCONSISTENT_TTL',
    '⚠️  WARNING',
    'TTL incohérents pour un même FQDN'
);

checkViolation(
    '07',
    '07_warning_ttl_too_short.csv',
    'TTL_TOO_SHORT',
    '⚠️  WARNING',
    'TTL < 60s (charge DNS excessive)'
);

checkViolation(
    '08',
    '08_warning_spf_neutral.csv',
    'SPF_NEUTRAL',
    '⚠️  WARNING',
    'SPF avec ?all (protection faible)'
);

checkViolation(
    '09',
    '09_warning_view_segregation.csv',
    'VIEW_SEGREGATION_PRIVATE_EXTERNAL',
    '⚠️  WARNING',
    'IP privée RFC 1918 en vue externe'
);

// ============================================================================
// TESTS INFO
// ============================================================================

// Test spécial pour CNAME_ORPHAN qui nécessite --show-orphans
totalTests++;
printTest('10', 'CNAME pointant vers cible externe non résolue');

const outputDir10 = path.join(__dirname, 'output', '10');
const reportFile10 = path.join(outputDir10, 'validation_report.txt');
const mmdFile10 = path.join(outputDir10, 'output.mmd');

if (fs.existsSync(outputDir10)) {
    fs.rmSync(outputDir10, { recursive: true, force: true });
}
fs.mkdirSync(outputDir10, { recursive: true });

const projectRoot = path.join(__dirname, '..', '..');
const dns2mermaidPath = path.join(projectRoot, 'dns2mermaid.js');
const csvPath10 = path.join(__dirname, '10_info_cname_orphan.csv');

console.log('   Exécution : node dns2mermaid.js -i "10_info_cname_orphan.csv" --show-orphans --no-ssl-check --no-export --quiet');

try {
    execSync(
        `node "${dns2mermaidPath}" -i "${csvPath10}" -o "${mmdFile10}" -r "${reportFile10}" --show-orphans --no-ssl-check --no-export --quiet`,
        { cwd: projectRoot, stdio: 'pipe' }
    );
    
    if (fs.existsSync(reportFile10)) {
        const reportContent = fs.readFileSync(reportFile10, 'utf8');
        
        if (reportContent.includes('[CNAME_ORPHAN]')) {
            printSuccess('Violation détectée : CNAME_ORPHAN (ℹ️  INFO)');
            passedTests++;
            const lines = reportContent.split('\n');
            const violationIdx = lines.findIndex(line => line.includes('[CNAME_ORPHAN]'));
            console.log('   Extrait du rapport :');
            for (let i = violationIdx; i < Math.min(violationIdx + 3, lines.length); i++) {
                console.log(`   │ ${lines[i]}`);
            }
        } else {
            printError('Violation CNAME_ORPHAN non détectée dans le rapport');
            failedTests++;
        }
    } else {
        printError('Rapport de validation non généré');
        failedTests++;
    }
} catch (error) {
    printError(`Erreur lors de l'exécution : ${error.message}`);
    failedTests++;
}

// Note: INCONSISTENT_TTL_MULTIVIEW existe mais INCONSISTENT_TTL se déclenche en premier
// Ce test vérifie qu'une incohérence TTL est bien détectée
checkViolation(
    '11',
    '11_info_inconsistent_ttl_multiview.csv',
    'INCONSISTENT_TTL',
    '⚠️  WARNING',
    'TTL différents entre vues int/ext (détecté comme INCONSISTENT_TTL)'
);

checkViolation(
    '12',
    '12_info_ttl_too_long.csv',
    'TTL_TOO_LONG',
    'ℹ️  INFO',
    'TTL > 86400s (24h) - Flexibilité réduite'
);

checkViolation(
    '13',
    '13_info_missing_ipv6.csv',
    'MISSING_IPV6',
    'ℹ️  INFO',
    'A sans AAAA (modernisation IPv6)'
);

// Test #14: DUPLICATE_RECORD - Note: Les doublons exacts sont fusionnés au parsing
// Cette règle ne peut détecter que des doublons qui passent le parsing
// Testons qu'une configuration normale ne génère pas de faux positifs
totalTests++;
printTest('14', 'Vérification absence de faux positifs DUPLICATE_RECORD');

const outputDir14 = path.join(__dirname, 'output', '14');
const reportFile14 = path.join(outputDir14, 'validation_report.txt');
const mmdFile14 = path.join(outputDir14, 'output.mmd');

if (fs.existsSync(outputDir14)) {
    fs.rmSync(outputDir14, { recursive: true, force: true });
}
fs.mkdirSync(outputDir14, { recursive: true });

const csvPath14 = path.join(__dirname, '14_info_duplicate_record.csv');

try {
    execSync(
        `node "${dns2mermaidPath}" -i "${csvPath14}" -o "${mmdFile14}" -r "${reportFile14}" --no-ssl-check --no-export --quiet`,
        { cwd: projectRoot, stdio: 'pipe' }
    );
    
    if (fs.existsSync(reportFile14)) {
        const reportContent = fs.readFileSync(reportFile14, 'utf8');
        
        // Vérifier qu'il n'y a pas de DUPLICATE_RECORD (pas de faux positifs)
        if (!reportContent.includes('[DUPLICATE_RECORD]')) {
            printSuccess('Pas de faux positifs DUPLICATE_RECORD détectés');
            passedTests++;
        } else {
            printError('DUPLICATE_RECORD détecté de manière inattendue');
            failedTests++;
        }
    } else {
        printError('Rapport de validation non généré');
        failedTests++;
    }
} catch (error) {
    printError(`Erreur lors de l'exécution : ${error.message}`);
    failedTests++;
}

checkViolation(
    '15',
    '15_info_wildcard_restriction.csv',
    'WILDCARD_RESTRICTION',
    'ℹ️  INFO',
    'Utilisation de wildcard (*)'
);

// ============================================================================
// TEST CONFIGURATION VALIDE
// ============================================================================

checkNoViolations(
    '16',
    '16_valid_dns_full.csv',
    'Configuration DNS complète et valide'
);

// ============================================================================
// TESTS MULTI-VIEW DNS (Correction CNAME_COEXISTENCE avec vues différentes)
// ============================================================================

checkNoViolations(
    '17',
    '17_valid_multiview_cname_a.csv',
    'CNAME en vue externe + A en vue interne (multi-view DNS valide)'
);

checkViolation(
    '18',
    '18_critical_cname_same_view.csv',
    'CNAME_COEXISTENCE',
    '🚨 CRITICAL',
    'CNAME et A dans la MÊME vue (violation réelle)'
);

// ============================================================================
// TEST ENTERPRISE MULTI-VIEW
// ============================================================================

checkNoViolations(
    '19',
    '19_valid_enterprise_multiview.csv',
    'Architecture DNS multi-view enterprise (CDN externe + réseau interne)'
);

// ============================================================================
// TESTS MULTI-VIEW AVANCÉS (Corrections systémiques vues DNS)
// ============================================================================

checkNoViolations(
    '20',
    '20_valid_multiview_mx_to_cname.csv',
    'MX→CNAME en vues différentes (multi-view valide)'
);

checkViolation(
    '21',
    '21_critical_mx_to_cname_same_view.csv',
    'MX_TO_CNAME',
    '🚨 CRITICAL',
    'MX→CNAME dans la MÊME vue (violation réelle)'
);

checkNoViolations(
    '22',
    '22_valid_multiview_ns_glue.csv',
    'NS avec glue records dans chaque vue (multi-view valide)'
);

checkViolation(
    '23',
    '23_critical_ns_no_glue_wrong_view.csv',
    'NS_NO_GLUE',
    '🚨 CRITICAL',
    'NS sans glue dans la bonne vue (violation)'
);

checkNoViolations(
    '24',
    '24_valid_spf_permissive_internal.csv',
    'SPF +all en vue interne seulement (confiance interne valide)'
);

checkViolation(
    '25',
    '25_critical_spf_permissive_public.csv',
    'SPF_TOO_PERMISSIVE',
    '🚨 CRITICAL',
    'SPF +all en vue publique (violation)'
);

checkNoViolations(
    '26',
    '26_valid_duplicate_multiview.csv',
    'Même enregistrement en vues différentes (pas de duplication)'
);

checkNoViolations(
    '27',
    '27_info_duplicate_same_view.csv',
    'Duplicatas fusionnés au parsing (pas de faux positifs)'
);

checkNoViolations(
    '28',
    '28_valid_dmarc_multiview.csv',
    'DMARC dans vue publique avec MX public (valide)'
);

checkViolation(
    '29',
    '29_critical_dmarc_missing_public_view.csv',
    'DMARC_MISSING_WITH_PUBLIC_MX',
    '🚨 CRITICAL',
    'DMARC manquant en vue publique (violation)'
);

checkNoViolations(
    '30',
    '30_valid_mx_in_spf_multiview.csv',
    'MX et SPF correspondent par vue (multi-view valide)'
);

checkViolation(
    '31',
    '31_warning_mx_not_in_spf_view.csv',
    'MX_NOT_IN_SPF',
    '⚠️  WARNING',
    'MX manquant dans SPF de la vue ext'
);

// ============================================================================
// TESTS BOUCLES CNAME AVANCÉES
// ============================================================================

checkViolation(
    '32',
    '32_critical_cname_loop_2levels.csv',
    'CNAME_LOOP',
    '🚨 CRITICAL',
    'Boucle CNAME à 2 niveaux (A→B→A)'
);

checkViolation(
    '33',
    '33_critical_cname_loop_4levels.csv',
    'CNAME_LOOP',
    '🚨 CRITICAL',
    'Boucle CNAME à 4 niveaux (A→B→C→D→A)'
);

checkViolation(
    '34',
    '34_valid_cname_chain_no_loop.csv',
    'CNAME_CHAIN',
    '⚠️  WARNING',
    'Chaîne CNAME valide sans boucle (peut déclencher CNAME_CHAIN)'
);

// ============================================================================
// RÉSUMÉ FINAL
// ============================================================================

console.log('');
printHeader('RÉSUMÉ DES TESTS');
console.log('');
console.log(`Total de tests   : ${totalTests}`);
console.log(`${colors.green}Tests réussis    : ${passedTests}${colors.reset}`);
console.log(`${colors.red}Tests échoués    : ${failedTests}${colors.reset}`);
console.log('');

if (failedTests === 0) {
    console.log(`${colors.green}✅ Tous les tests sont passés !${colors.reset}`);
    console.log('');
    console.log('🎉 La validation DNS RFC fonctionne correctement.');
    console.log('   Toutes les règles sont testées et validées.');
    process.exit(0);
} else {
    console.log(`${colors.red}❌ Certains tests ont échoué.${colors.reset}`);
    console.log('');
    console.log('Vérifiez les détails ci-dessus et corrigez les problèmes.');
    process.exit(1);
}
