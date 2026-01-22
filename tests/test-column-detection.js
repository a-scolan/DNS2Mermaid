const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Trouver le chemin du script principal (depuis tests/ vers racine)
const scriptPath = path.resolve(__dirname, '..', 'dns2mermaid.js');
const testDir = __dirname;

console.log('Test de parsing CSV avec différents ordres de colonnes\n');

// Test 1: Ordre classique TTL,Name,Type,Value,View
const test1 = `TTL,Name,Type,Value,View
3600,example.com,A,203.0.113.1,ext`;

const test1Path = path.join(testDir, 'test1.csv');
fs.writeFileSync(test1Path, test1);
console.log('Test 1 - Ordre classique (TTL,Name,Type,Value,View)');
try {
    execSync(`node "${scriptPath}" --input "${test1Path}" --output test1-out --no-export --no-ssl-check --quiet`, { cwd: testDir, encoding: 'utf8' });
    console.log('✅ PASS\n');
} catch (e) {
    console.log('❌ FAIL:', e.message, '\n');
}

// Test 2: Ordre inversé Type,Value,Name,View,TTL
const test2 = `Type,Value,Name,View,TTL
A,203.0.113.1,example.com,ext,3600`;

const test2Path = path.join(testDir, 'test2.csv');
fs.writeFileSync(test2Path, test2);
console.log('Test 2 - Ordre inversé (Type,Value,Name,View,TTL)');
try {
    execSync(`node "${scriptPath}" --input "${test2Path}" --output test2-out --no-export --no-ssl-check --quiet`, { cwd: testDir, encoding: 'utf8' });
    console.log('✅ PASS\n');
} catch (e) {
    console.log('❌ FAIL:', e.message, '\n');
}

// Test 3: Noms alternatifs hostname,record_type,data
const test3 = `hostname,record_type,data
example.com,A,203.0.113.1`;

const test3Path = path.join(testDir, 'test3.csv');
fs.writeFileSync(test3Path, test3);
console.log('Test 3 - Noms alternatifs (hostname,record_type,data) sans View ni TTL');
try {
    execSync(`node "${scriptPath}" --input "${test3Path}" --output test3-out --no-export --no-ssl-check --quiet`, { cwd: testDir, encoding: 'utf8' });
    console.log('✅ PASS\n');
} catch (e) {
    console.log('❌ FAIL:', e.message, '\n');
}

// Test 4: Colonnes manquantes
const test4 = `TTL,Name
3600,example.com`;

const test4Path = path.join(testDir, 'test4.csv');
fs.writeFileSync(test4Path, test4);
console.log('Test 4 - Colonnes manquantes (doit échouer proprement)');
try {
    const output = execSync(`node "${scriptPath}" --input "${test4Path}" --output test4-out --no-export --no-ssl-check 2>&1`, { cwd: testDir, encoding: 'utf8' });
    if (output.includes('Colonnes manquantes')) {
        console.log('✅ PASS - Erreur détectée correctement\n');
    } else {
        console.log('❌ FAIL - Erreur non détectée\n');
    }
} catch (e) {
    if (e.stdout && e.stdout.includes('Colonnes manquantes')) {
        console.log('✅ PASS - Erreur détectée correctement\n');
    } else {
        console.log('❌ FAIL:', e.message, '\n');
    }
}

// Nettoyage
['test1.csv', 'test2.csv', 'test3.csv', 'test4.csv', 
 'test1-out', 'test2-out', 'test3-out', 'test4-out',
 'legend.mmd', 'validation_report.txt'].forEach(f => {
    try { fs.unlinkSync(path.join(testDir, f)); } catch (_e) { /* Ignorer les erreurs de nettoyage */ }
});

console.log('Tests terminés!');
