const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Tests de validation HTTP/HTTPS
 * Objectif : Vérifier que le script peut résoudre les DNS et tester la disponibilité HTTP/HTTPS
 */

const SCRIPT_PATH = path.resolve(__dirname, '..', '..', 'dns2mermaid.js');
const TEST_DIR = __dirname;

/**
 * Exécute un test et vérifie les résultats
 */
function runTest(testName, csvFile, expectations) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Test: ${testName}`);
    console.log(`${'='.repeat(60)}`);
    
    const testPath = path.join(TEST_DIR, csvFile);
    // Le rapport est généré dans le répertoire du workspace, pas dans TEST_DIR
    const reportPath = path.join(path.dirname(SCRIPT_PATH), 'validation_report.txt');
    
    try {
        // Exécuter le script avec --http-check
        const cmd = `node "${SCRIPT_PATH}" --input "${testPath}" --http-check --no-ssl-check --no-diagram --no-export --quiet`;
        console.log(`Commande: ${cmd}`);
        
        execSync(cmd, { 
            stdio: 'pipe',
            encoding: 'utf-8',
            timeout: 30000 // 30s timeout
        });
        
        // Lire le rapport
        if (!fs.existsSync(reportPath)) {
            console.error(`❌ ÉCHEC: Rapport non généré à ${reportPath}`);
            return false;
        }
        
        const report = fs.readFileSync(reportPath, 'utf-8');
        
        // Vérifier les expectations
        let allPassed = true;
        
        expectations.forEach(expect => {
            const found = report.includes(expect.text);
            const status = found === expect.shouldExist;
            
            if (status) {
                console.log(`✅ ${expect.description}`);
            } else {
                console.log(`❌ ${expect.description}`);
                console.log(`   Attendu: ${expect.shouldExist ? 'présent' : 'absent'}`);
                console.log(`   Texte recherché: "${expect.text}"`);
                allPassed = false;
            }
        });
        
        return allPassed;
        
    } catch (err) {
        console.error(`❌ ÉCHEC: ${err.message}`);
        if (err.stdout) console.log('STDOUT:', err.stdout);
        if (err.stderr) console.log('STDERR:', err.stderr);
        return false;
    }
}

// --- TESTS ---

const tests = [
    {
        name: "Test 1: Résolution HTTP/HTTPS basique (200 OK)",
        file: "01_valid_http_https.csv",
        expectations: [
            { text: "DISPONIBILITÉ HTTP/HTTPS", shouldExist: true, description: "Section HTTP présente" },
            { text: "google.com", shouldExist: true, description: "Domaine testé" },
            { text: "142.250.74.206", shouldExist: true, description: "IP testée" }
        ]
    },
    {
        name: "Test 2: Résolution CNAME vers IP finale",
        file: "02_cname_resolution.csv",
        expectations: [
            { text: "alias-test.com", shouldExist: true, description: "CNAME testé" },
            { text: "google.com", shouldExist: true, description: "Résolution CNAME affichée" },
            { text: "142.250.74.206", shouldExist: true, description: "IP finale affichée" }
        ]
    },
    {
        name: "Test 3: Erreur de connexion (IP privée)",
        file: "03_connection_error.csv",
        expectations: [
            { text: "internal-only.test", shouldExist: true, description: "Domaine testé" },
            { text: "192.168.1.100", shouldExist: true, description: "IP privée affichée" },
            { text: "ERREURS DE CONNEXION", shouldExist: true, description: "Section erreurs présente" }
        ]
    },
    {
        name: "Test 4: Redirections HTTP (301/302)",
        file: "04_http_redirect.csv",
        expectations: [
            { text: "redirect-test.com", shouldExist: true, description: "Domaine testé" },
            { text: "github.com", shouldExist: true, description: "Cible CNAME affichée" }
        ]
    },
    {
        name: "Test 5: Multi-view (2 IPs différentes)",
        file: "05_multiview_test.csv",
        expectations: [
            { text: "multiview.test", shouldExist: true, description: "Domaine testé" },
            { text: "10.0.0.50", shouldExist: true, description: "IP interne testée" },
            { text: "142.250.74.206", shouldExist: true, description: "IP externe testée" },
            { text: "int", shouldExist: true, description: "Vue interne mentionnée" },
            { text: "ext", shouldExist: true, description: "Vue externe mentionnée" }
        ]
    }
];

// Exécuter tous les tests
console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║     TESTS DE VALIDATION HTTP/HTTPS - DNS2MERMAID         ║');
console.log('╚════════════════════════════════════════════════════════════╝');

let passed = 0;
let failed = 0;

tests.forEach(test => {
    const result = runTest(test.name, test.file, test.expectations);
    if (result) {
        passed++;
        console.log(`\n✅ ${test.name} - SUCCÈS`);
    } else {
        failed++;
        console.log(`\n❌ ${test.name} - ÉCHEC`);
    }
});

// Résumé
console.log('\n' + '='.repeat(60));
console.log('RÉSUMÉ DES TESTS HTTP/HTTPS');
console.log('='.repeat(60));
console.log(`Total: ${tests.length} tests`);
console.log(`✅ Réussis: ${passed}`);
console.log(`❌ Échoués: ${failed}`);
console.log('='.repeat(60));

if (failed === 0) {
    console.log('\n🎉 TOUS LES TESTS HTTP/HTTPS SONT PASSÉS ! 🎉\n');
    process.exit(0);
} else {
    console.log(`\n⚠️  ${failed} test(s) en échec\n`);
    process.exit(1);
}
