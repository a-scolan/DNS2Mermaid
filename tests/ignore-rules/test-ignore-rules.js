#!/usr/bin/env node

/**
 * Test du flag --ignore-rules
 * Valide que les règles peuvent être ignorées individuellement ou en groupe
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n🧪 Test du flag --ignore-rules\n');

let testsPassedCount = 0;
let testsFailedCount = 0;

const testIgnoreRule = (testNum, csvFile, ruleToIgnore, description) => {
    console.log(`📋 Test #${testNum}: ${description}`);
    
    const csvPath = path.join(__dirname, '..', 'dns-validation', csvFile);
    const outputDir = path.join(__dirname, 'output', `ignore-test-${testNum}`);
    
    // Nettoyer l'ancien output
    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
    
    try {
        // Exécuter avec la règle ignorée
        const command = `node dns2mermaid.js -i "${csvPath}" --no-ssl-check --no-export --quiet --ignore-rules ${ruleToIgnore}`;
        console.log(`   Commande : ${command}`);
        
        execSync(command, {
            cwd: path.join(__dirname, '..', '..'),
            encoding: 'utf8',
            stdio: 'pipe'
        });
        
        // Lire le rapport
        const reportPath = path.join(__dirname, '..', '..', 'validation_report.txt');
        const report = fs.readFileSync(reportPath, 'utf8');
        
        // Vérifier que la règle est bien ignorée
        if (report.includes(`Règles ignorées (--ignore-rules): ${ruleToIgnore}`)) {
            console.log(`   ✅ Règle ${ruleToIgnore} bien marquée comme ignorée`);
        } else {
            throw new Error(`La règle ${ruleToIgnore} n'apparaît pas comme ignorée`);
        }
        
        // Vérifier que la règle n'apparaît PAS dans les violations
        if (report.includes(`[${ruleToIgnore}]`)) {
            throw new Error(`La règle ${ruleToIgnore} apparaît encore dans les violations !`);
        }
        
        console.log(`   ✅ Règle ${ruleToIgnore} absente des violations\n`);
        testsPassedCount++;
        
    } catch (error) {
        console.error(`   ❌ Échec: ${error.message}\n`);
        testsFailedCount++;
    }
};

const testIgnoreMultipleRules = (testNum, csvFile, rulesToIgnore, description) => {
    console.log(`📋 Test #${testNum}: ${description}`);
    
    const csvPath = path.join(__dirname, '..', 'dns-validation', csvFile);
    const rulesString = rulesToIgnore.join(',');
    
    try {
        // Exécuter avec plusieurs règles ignorées
        const command = `node dns2mermaid.js -i "${csvPath}" --no-ssl-check --no-export --quiet --ignore-rules ${rulesString}`;
        console.log(`   Commande : ${command}`);
        
        execSync(command, {
            cwd: path.join(__dirname, '..', '..'),
            encoding: 'utf8',
            stdio: 'pipe'
        });
        
        // Lire le rapport
        const reportPath = path.join(__dirname, '..', '..', 'validation_report.txt');
        const report = fs.readFileSync(reportPath, 'utf8');
        
        // Vérifier que toutes les règles sont marquées comme ignorées
        rulesToIgnore.forEach(rule => {
            if (!report.includes(rule)) {
                throw new Error(`La règle ${rule} n'apparaît pas comme ignorée`);
            }
            
            // Vérifier que la règle n'apparaît PAS dans les violations
            const violationPattern = new RegExp(`\\[${rule}\\](?!.*ignorées)`, 'g');
            if (violationPattern.test(report.replace(/Règles ignorées.*$/m, ''))) {
                throw new Error(`La règle ${rule} apparaît encore dans les violations !`);
            }
        });
        
        console.log(`   ✅ Toutes les règles (${rulesToIgnore.join(', ')}) correctement ignorées\n`);
        testsPassedCount++;
        
    } catch (error) {
        console.error(`   ❌ Échec: ${error.message}\n`);
        testsFailedCount++;
    }
};

// --- TESTS ---

testIgnoreRule(1, '05_warning_cname_chain.csv', 'CNAME_CHAIN', 
    'Ignorer CNAME_CHAIN');

testIgnoreRule(2, '07_warning_ttl_too_short.csv', 'TTL_TOO_SHORT', 
    'Ignorer TTL_TOO_SHORT');

testIgnoreMultipleRules(3, '06_warning_inconsistent_ttl.csv', ['INCONSISTENT_TTL', 'MISSING_IPV6'], 
    'Ignorer plusieurs règles simultanément');

// --- RÉSUMÉ ---

console.log('\n' + '='.repeat(60));
console.log('RÉSUMÉ DES TESTS --ignore-rules');
console.log('='.repeat(60));
console.log(`\nTotal de tests   : ${testsPassedCount + testsFailedCount}`);
console.log(`\x1b[32mTests réussis    : ${testsPassedCount}\x1b[0m`);
console.log(`\x1b[31mTests échoués    : ${testsFailedCount}\x1b[0m`);

if (testsFailedCount === 0) {
    console.log('\n\x1b[32m✅ Tous les tests sont passés !\x1b[0m\n');
    console.log('🎉 Le flag --ignore-rules fonctionne correctement.\n');
    process.exit(0);
} else {
    console.log('\n\x1b[31m❌ Certains tests ont échoué.\x1b[0m\n');
    process.exit(1);
}
