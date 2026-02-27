#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function syncVersionGlobal(version) {
  const projectRoot = path.join(__dirname, '..');
  const semver = String(version || '').split(' ')[0] || '0.0.0';

  // 1) package.json (relevant für electron-builder Produktversion)
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (packageJson.version !== semver) {
      packageJson.version = semver;
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
      console.log(`[copy-assets] package.json version updated -> ${semver}`);
    }
  }

  // 2) package-lock.json (Konsistenz im Repo)
  const packageLockPath = path.join(projectRoot, 'package-lock.json');
  if (fs.existsSync(packageLockPath)) {
    const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
    let changed = false;

    if (packageLock.version !== semver) {
      packageLock.version = semver;
      changed = true;
    }

    if (packageLock.packages && packageLock.packages[''] && packageLock.packages[''].version !== semver) {
      packageLock.packages[''].version = semver;
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(packageLockPath, JSON.stringify(packageLock, null, 2) + '\n', 'utf8');
      console.log(`[copy-assets] package-lock.json version updated -> ${semver}`);
    }
  }

  // 3) Starter Splash Version (separater Launcher)
  const starterVersionPath = path.join(projectRoot, 'starter', 'splash-screen', 'version.json');
  if (fs.existsSync(starterVersionPath)) {
    const starterVersion = { Version: version };
    fs.writeFileSync(starterVersionPath, JSON.stringify(starterVersion, null, 2) + '\n', 'utf8');
    console.log(`[copy-assets] starter/splash-screen/version.json updated -> ${version}`);
  }
}

try {
  // Erstelle dist/media Verzeichnis
  fs.mkdirSync(path.join(__dirname, '..', 'dist', 'media'), { recursive: true });

  // Kopiere splash.html
  fs.copyFileSync(
    path.join(__dirname, '..', 'splash.html'),
    path.join(__dirname, '..', 'dist', 'splash.html')
  );

  // Kopiere Media-Dateien
  const mediaFiles = [
    'media/RD-Plan Logo.gif',
    'media/Timeline 1_01_00_05_29.png',
    'media/Icon.icns',
    'media/Icon.ico'
  ];

  mediaFiles.forEach(file => {
    const src = path.join(__dirname, '..', file);
    const dst = path.join(__dirname, '..', 'dist', file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
    }
  });

  // Lese version.json und ersetze Version im splash.html
  let versionPath = path.join(__dirname, '..', 'version.json');
  if (!fs.existsSync(versionPath)) {
    // Fallback für verschiedene Verzeichnisstrukturen
    versionPath = path.join(__dirname, '../../version.json');
  }
  
  if (fs.existsSync(versionPath)) {
    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    const version = versionData.version || 'unknown';

    // Globale Versionssynchronisation aus zentraler version.json
    syncVersionGlobal(version);
    
    let splashContent = fs.readFileSync(
      path.join(__dirname, '..', 'dist', 'splash.html'),
      'utf8'
    );
    
    // Ersetze Version Placeholder
    splashContent = splashContent.replace(
      /<div class="version" id="version">.*?<\/div>/,
      `<div class="version" id="version">Version ${version}</div>`
    );
    
    fs.writeFileSync(
      path.join(__dirname, '..', 'dist', 'splash.html'),
      splashContent,
      'utf8'
    );
    
    console.log('[copy-assets] ✓ Assets copied successfully');
    console.log(`[copy-assets] Version injected: ${version}`);
  } else {
    console.log('[copy-assets] ✓ Assets copied successfully');
    console.log('[copy-assets] version.json not found, skipping version injection');
  }
} catch (error) {
  console.error('[copy-assets] Error:', error.message);
  process.exit(1);
}
