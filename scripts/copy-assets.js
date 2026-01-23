#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

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
