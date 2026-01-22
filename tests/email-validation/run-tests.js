#!/usr/bin/env node
/**
 * ============================================================================
 * Script de Test - Validation Email (SPF/DKIM/DMARC/MX)
 * ============================================================================
 * Test toutes les règles de validation email implémentées
 * dans dns2mermaid.js avec le flag --email-validation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Couleurs ANSI pour l'affichage
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    bold: '\x1b[1m'
};

// Compteurs
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// Fonctions d'affichage
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

// Fonction de validation
function checkViolation(testNum, csvFile, ruleCode, severity, description) {
    totalTests++;
    printTest(testNum, description);
    
    const outputDir = path.join(__dirname, 'output', testNum);
    const reportFile = path.join(outputDir, 'validation_report.txt');
    const mmdFile = path.join(outputDir, 'output.mmd');
    
    // Nettoyer les anciens résultats
    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Exécuter dns2mermaid avec validation email
    const projectRoot = path.join(__dirname, '..', '..');
    const dns2mermaidPath = path.join(projectRoot, 'dns2mermaid.js');
    const csvPath = path.join(__dirname, csvFile);
    
    console.log(`   Exécution : node dns2mermaid.js -i "${path.basename(csvFile)}" --email-validation --no-ssl-check --no-export --quiet`);
    
    try {
        execSync(
            `node "${dns2mermaidPath}" -i "${csvPath}" -o "${mmdFile}" -r "${reportFile}" --email-validation --no-ssl-check --no-export --quiet`,
            { cwd: projectRoot, stdio: 'pipe' }
        );
        
        if (fs.existsSync(reportFile)) {
            const reportContent = fs.readFileSync(reportFile, 'utf8');
            
            // Vérifier si la règle attendue est présente
            if (reportContent.includes(`[${ruleCode}]`)) {
                // Déterminer dans quelle section se trouve la violation
                const lines = reportContent.split('\n');
                const violationIdx = lines.findIndex(line => line.includes(`[${ruleCode}]`));
                
                // Chercher la section au-dessus de la violation
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
                
                // Vérifier la sévérité
                const expectedSeverity = severity.includes('CRITICAL') ? 'CRITICAL' : 
                                        severity.includes('WARNING') ? 'WARNING' : 'INFO';
                
                if (detectedSeverity === expectedSeverity) {
                    printSuccess(`Violation détectée : ${ruleCode} (${severity})`);
                    passedTests++;
                    
                    // Afficher l'extrait du rapport
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

// Fonction de validation négative (pas de violation attendue)
function checkNoViolations(testNum, csvFile, description) {
    totalTests++;
    printTest(testNum, description);
    
    const outputDir = path.join(__dirname, 'output', testNum);
    const reportFile = path.join(outputDir, 'validation_report.txt');
    const mmdFile = path.join(outputDir, 'output.mmd');
    
    // Nettoyer les anciens résultats
    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Exécuter dns2mermaid avec validation email
    const projectRoot = path.join(__dirname, '..', '..');
    const dns2mermaidPath = path.join(projectRoot, 'dns2mermaid.js');
    const csvPath = path.join(__dirname, csvFile);
    
    try {
        execSync(
            `node "${dns2mermaidPath}" -i "${csvPath}" -o "${mmdFile}" -r "${reportFile}" --email-validation --no-ssl-check --no-export --quiet`,
            { cwd: projectRoot, stdio: 'pipe' }
        );
        
        if (fs.existsSync(reportFile)) {
            const reportContent = fs.readFileSync(reportFile, 'utf8');
            
            // Compter les violations email
            const emailViolations = (reportContent.match(/\[(SPF_|DKIM_|DMARC_|MX_NOT_IN_SPF|AUTODISCOVER_)/g) || []).length;
            
            if (emailViolations === 0) {
                printSuccess('Aucune violation email détectée (configuration valide)');
                passedTests++;
            } else {
                printError(`${emailViolations} violation(s) email détectée(s) (aucune attendue)`);
                failedTests++;
                const lines = reportContent.split('\n');
                lines.filter(line => /\[(SPF_|DKIM_|DMARC_|MX_NOT_IN_SPF|AUTODISCOVER_)/.test(line))
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

printHeader('Tests de Validation Email - dns2mermaid.js');
console.log('');
printInfo(`Répertoire de test : ${__dirname}`);
printInfo('Flag testé : --email-validation');
console.log('');

// Créer le dossier de sortie
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// ============================================================================
// TEST 1: Configuration Email Complète et Valide (PAS DE VIOLATIONS)
// ============================================================================
checkNoViolations(
    '01',
    '01_valid_email_full.csv',
    'Configuration email complète valide (SPF + DKIM + DMARC + Autodiscover)'
);

// ============================================================================
// TEST 2: CRITICAL - SPF Trop Permissif (+all)
// ============================================================================
checkViolation(
    '02',
    '02_critical_spf_permissive.csv',
    'SPF_ALL_PERMISSIVE',
    '🚨 CRITICAL',
    'SPF avec +all (permet à tout le monde d\'envoyer)'
);

// ============================================================================
// TEST 3: CRITICAL - DMARC Manquant avec MX Publics
// ============================================================================
checkViolation(
    '03',
    '03_critical_dmarc_missing.csv',
    'DMARC_MISSING_WITH_PUBLIC_MX',
    '🚨 CRITICAL',
    'DMARC manquant alors que MX publics existent'
);

// ============================================================================
// TEST 4: WARNING - SPF Trop de Lookups (>10)
// ============================================================================
checkViolation(
    '04',
    '04_warning_spf_too_many_lookups.csv',
    'SPF_TOO_MANY_LOOKUPS',
    '⚠️  WARNING',
    'SPF avec plus de 10 lookups DNS (limite RFC 7208)'
);

// ============================================================================
// TEST 5: WARNING - MX Non Inclus dans SPF
// ============================================================================
checkViolation(
    '05',
    '05_warning_mx_not_in_spf.csv',
    'MX_NOT_IN_SPF',
    '⚠️  WARNING',
    'Serveurs MX absents du SPF'
);

// ============================================================================
// TEST 6: WARNING - DKIM Format Invalide
// ============================================================================
checkViolation(
    '06',
    '06_warning_dkim_invalid.csv',
    'DKIM_INVALID_FORMAT',
    '⚠️  WARNING',
    'DKIM sans clé publique ou format invalide'
);

// ============================================================================
// TEST 7: INFO - DMARC Policy None
// ============================================================================
checkViolation(
    '07',
    '07_info_dmarc_policy_none.csv',
    'DMARC_POLICY_NONE',
    'ℹ️  INFO',
    'DMARC en mode monitoring (p=none)'
);

// ============================================================================
// TEST 8: INFO - DKIM Manquant
// ============================================================================
checkViolation(
    '08',
    '08_info_dkim_missing.csv',
    'DKIM_MISSING',
    'ℹ️  INFO',
    'Pas de DKIM détecté'
);

// ============================================================================
// TEST 9: INFO - Autodiscover Manquant
// ============================================================================
checkViolation(
    '09',
    '09_info_autodiscover_missing.csv',
    'AUTODISCOVER_MISSING',
    'ℹ️  INFO',
    'Pas d\'autodiscover/autoconfig'
);

// ============================================================================
// TEST 11: WARNING - DKIM Weak Key (RSA < 1024 bits)
// ============================================================================
checkViolation(
    '11',
    '11_warning_dkim_weak_key.csv',
    'DKIM_WEAK_KEY',
    '⚠️  WARNING',
    'DKIM avec clé RSA faible (< 1024 bits)'
);

// ============================================================================
// TEST 12: WARNING - DMARC No Reporting
// ============================================================================
checkViolation(
    '12',
    '12_warning_dmarc_no_reporting.csv',
    'DMARC_NO_REPORTING',
    '⚠️  WARNING',
    'DMARC sans adresses de reporting (rua/ruf)'
);

// ============================================================================
// TEST 13: Multiple Violations (CRITICAL + WARNING + INFO)
// ============================================================================
totalTests++;
printTest('13', 'Configuration avec multiples violations');

const outputDir13 = path.join(__dirname, 'output', '13');
const reportFile13 = path.join(outputDir13, 'validation_report.txt');
const mmdFile13 = path.join(outputDir13, 'output.mmd');

if (fs.existsSync(outputDir13)) {
    fs.rmSync(outputDir13, { recursive: true, force: true });
}
fs.mkdirSync(outputDir13, { recursive: true });

const projectRoot = path.join(__dirname, '..', '..');
const dns2mermaidPath = path.join(projectRoot, 'dns2mermaid.js');
const csvPath13 = path.join(__dirname, '10_multiple_violations.csv');

try {
    execSync(
        `node "${dns2mermaidPath}" -i "${csvPath13}" -o "${mmdFile13}" -r "${reportFile13}" --email-validation --no-ssl-check --no-export --quiet`,
        { cwd: projectRoot, stdio: 'pipe' }
    );
    
    if (fs.existsSync(reportFile13)) {
        const reportContent = fs.readFileSync(reportFile13, 'utf8');
        const lines = reportContent.split('\n');
        
        // Compter les violations email dans chaque section
        let criticalCount = 0;
        let warningCount = 0;
        let currentSection = '';
        
        for (const line of lines) {
            if (line.includes('🚨 VIOLATIONS BLOQUANTES')) {
                currentSection = 'CRITICAL';
            } else if (line.includes('⚠️  PROBLÈMES À CORRIGER')) {
                currentSection = 'WARNING';
            } else if (line.includes('ℹ️  RECOMMANDATIONS')) {
                currentSection = 'INFO';
            }
            
            // Compter uniquement les violations email
            if (/\[(SPF_ALL_PERMISSIVE|DMARC_MISSING_WITH_PUBLIC_MX)\]/.test(line)) {
                if (currentSection === 'CRITICAL') criticalCount++;
            }
            if (/\[(SPF_TOO_MANY_LOOKUPS|MX_NOT_IN_SPF|DKIM_INVALID_FORMAT)\]/.test(line)) {
                if (currentSection === 'WARNING') warningCount++;
            }
        }
        
        if (criticalCount >= 2 && warningCount >= 2) {
            printSuccess(`Multiples violations détectées (${criticalCount} CRITICAL, ${warningCount} WARNING)`);
            passedTests++;
            console.log('   Violations détectées :');
            lines.filter(line => /\[(SPF_|DKIM_|DMARC_)/.test(line))
                .slice(0, 5)
                .forEach(line => console.log(`   │ ${line}`));
        } else {
            printError(`Nombre de violations incorrect (CRITICAL: ${criticalCount}, WARNING: ${warningCount})`);
            failedTests++;
        }
    } else {
        printError('Rapport non généré');
        failedTests++;
    }
} catch (error) {
    printError(`Erreur d'exécution : ${error.message}`);
    failedTests++;
}

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
    console.log('🎉 La validation email fonctionne correctement.');
    process.exit(0);
} else {
    console.log(`${colors.red}❌ Certains tests ont échoué.${colors.reset}`);
    console.log('');
    console.log('Vérifiez les détails ci-dessus et corrigez les problèmes.');
    process.exit(1);
}
