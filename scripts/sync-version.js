const fs = require('fs');

// Lese version.json
const versionData = JSON.parse(fs.readFileSync('version.json', 'utf-8'));
const version = versionData.version;

// Extrahiere nur die Versionsnummer (ohne "RC" etc.) für package.json
// "1.0.3 RC" -> "1.0.3"
const semver = version.split(' ')[0];

console.log('[sync-version] Reading version from version.json:', version);
console.log('[sync-version] Using semver:', semver);

// Lese package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

// Setze die Version
packageJson.version = semver;

// Schreibe package.json
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');

console.log('[sync-version] Updated package.json version to:', semver);
