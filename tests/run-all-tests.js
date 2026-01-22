#!/usr/bin/env node

/**
 * Script de test consolidé qui génère automatiquement un rapport
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const reportPath = path.join(__dirname, 'test-report-latest.txt');

console.log('🧪 Lancement de la suite de tests complète...\n');

try {
    // Exécuter les tests et capturer la sortie
    const output = execSync('npm run test:columns && npm run test:dns && npm run test:email && npm run test:http', {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8',
        stdio: ['inherit', 'pipe', 'pipe']
    });
    
    // Écrire le rapport
    const timestamp = new Date().toISOString();
    const report = `═══════════════════════════════════════════════════════════
           RAPPORT DE TESTS CONSOLIDÉ - DNS2MERMAID
═══════════════════════════════════════════════════════════

Date de génération : ${timestamp}
Fichier : tests/test-report-latest.txt

${output}

═══════════════════════════════════════════════════════════
Fin du rapport - Tous les tests terminés ✅
═══════════════════════════════════════════════════════════
`;

    fs.writeFileSync(reportPath, report, 'utf8');
    
    console.log(`\n✅ Rapport consolidé généré : ${reportPath}`);
    process.exit(0);
    
} catch (error) {
    // En cas d'erreur, capturer quand même la sortie
    const output = error.stdout ? error.stdout.toString() : '';
    const errorOutput = error.stderr ? error.stderr.toString() : '';
    
    const timestamp = new Date().toISOString();
    const report = `═══════════════════════════════════════════════════════════
           RAPPORT DE TESTS CONSOLIDÉ - DNS2MERMAID
═══════════════════════════════════════════════════════════

Date de génération : ${timestamp}
Fichier : tests/test-report-latest.txt

⚠️  CERTAINS TESTS ONT ÉCHOUÉ

${output}

${errorOutput ? '═══ ERREURS ═══\n' + errorOutput : ''}

═══════════════════════════════════════════════════════════
Fin du rapport - Des tests ont échoué ❌
═══════════════════════════════════════════════════════════
`;

    fs.writeFileSync(reportPath, report, 'utf8');
    
    console.error(`\n❌ Rapport consolidé généré avec erreurs : ${reportPath}`);
    process.exit(1);
}
