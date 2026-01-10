/**
 * Vergleicht Performance-Reports zwischen verschiedenen Versionen/Konfigurationen
 * 
 * Verwendung:
 *   node compare-performance.js performance-report-1.json performance-report-2.json
 * 
 * Vergleicht zwei Performance-Reports und zeigt Unterschiede übersichtlich an.
 */

const fs = require('fs');
const path = require('path');

function loadReport(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Report nicht gefunden: ${filePath}`);
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
}

function formatDiff(diff) {
    const prefix = diff > 0 ? '+' : '';
    return `${prefix}${diff.toFixed(1)}%`;
}

function getPerformanceIndicator(diff) {
    if (diff < -20) return '🟢🟢';  // Sehr viel schneller
    if (diff < -10) return '🟢';    // Schneller
    if (diff > 20) return '🔴🔴';   // Sehr viel langsamer
    if (diff > 10) return '🔴';     // Langsamer
    return '🟡';                     // Ähnlich
}

function compareReports(report1, report2, label1 = 'Report 1', label2 = 'Report 2') {
    console.log('\n📊 Performance-Vergleich');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log(`Baseline: ${label1}`);
    console.log(`  Datum: ${new Date(report1.timestamp).toLocaleString('de-DE')}`);
    console.log(`  DB-Typ: ${report1.dbType || 'unbekannt'}`);
    console.log(`  System: ${report1.system?.platform || 'unbekannt'} (${report1.system?.arch || 'unbekannt'})`);
    console.log(`\nVergleich: ${label2}`);
    console.log(`  Datum: ${new Date(report2.timestamp).toLocaleString('de-DE')}`);
    console.log(`  DB-Typ: ${report2.dbType || 'unbekannt'}`);
    console.log(`  System: ${report2.system?.platform || 'unbekannt'} (${report2.system?.arch || 'unbekannt'})`);
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
    
    // Erstelle Map für schnellen Zugriff
    const results1 = new Map(report1.results.map(r => [r.name, r]));
    const results2 = new Map(report2.results.map(r => [r.name, r]));
    
    console.log('Operation                           Baseline     Vergleich    Differenz  Status');
    console.log('───────────────────────────────────────────────────────────────────────────────');
    
    const allOperations = new Set([...results1.keys(), ...results2.keys()]);
    const diffs = [];
    
    for (const operation of allOperations) {
        const r1 = results1.get(operation);
        const r2 = results2.get(operation);
        
        if (r1 && r2) {
            const diff = ((r2.avg - r1.avg) / r1.avg * 100);
            diffs.push({ operation, r1, r2, diff });
            
            const diffStr = formatDiff(diff);
            const indicator = getPerformanceIndicator(diff);
            
            console.log(
                `${operation.padEnd(35)} ` +
                `${r1.avg.toFixed(2).padStart(8)}ms  ` +
                `${r2.avg.toFixed(2).padStart(8)}ms  ` +
                `${diffStr.padStart(9)}  ${indicator}`
            );
        } else if (r1 && !r2) {
            console.log(`${operation.padEnd(35)} ${r1.avg.toFixed(2).padStart(8)}ms     ---       ---     ⚠️`);
        } else if (!r1 && r2) {
            console.log(`${operation.padEnd(35)}    ---       ${r2.avg.toFixed(2).padStart(8)}ms     ---     ℹ️`);
        }
    }
    
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    
    // Gesamt-Performance
    const totalDiff = ((report2.total - report1.total) / report1.total * 100);
    const totalIndicator = getPerformanceIndicator(totalDiff);
    
    console.log(`${'Gesamt'.padEnd(35)} ` +
                `${report1.total.toFixed(2).padStart(8)}ms  ` +
                `${report2.total.toFixed(2).padStart(8)}ms  ` +
                `${formatDiff(totalDiff).padStart(9)}  ${totalIndicator}`);
    
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
    
    // Legende
    console.log('📊 Legende:');
    console.log('  🟢🟢 = >20% schneller  |  🟢 = >10% schneller  |  🟡 = ±10%');
    console.log('  🔴 = >10% langsamer    |  🔴🔴 = >20% langsamer');
    console.log('  ⚠️  = Nur in Baseline  |  ℹ️  = Nur in Vergleich\n');
    
    // Top-Verbesserungen und Verschlechterungen
    if (diffs.length > 0) {
        const sorted = [...diffs].sort((a, b) => a.diff - b.diff);
        
        console.log('🏆 Top 3 Verbesserungen:');
        sorted.slice(0, 3).forEach((d, i) => {
            console.log(`  ${i + 1}. ${d.operation}: ${formatDiff(d.diff)} (${d.r1.avg.toFixed(2)}ms → ${d.r2.avg.toFixed(2)}ms)`);
        });
        
        console.log('\n⚠️  Top 3 Verschlechterungen:');
        sorted.slice(-3).reverse().forEach((d, i) => {
            console.log(`  ${i + 1}. ${d.operation}: ${formatDiff(d.diff)} (${d.r1.avg.toFixed(2)}ms → ${d.r2.avg.toFixed(2)}ms)`);
        });
    }
    
    console.log('');
    
    return {
        totalDiff,
        diffs,
        improvements: diffs.filter(d => d.diff < -10).length,
        regressions: diffs.filter(d => d.diff > 10).length
    };
}

function generateComparisonHTML(report1, report2, label1, label2, outputPath) {
    const results1 = new Map(report1.results.map(r => [r.name, r]));
    const results2 = new Map(report2.results.map(r => [r.name, r]));
    const allOperations = new Set([...results1.keys(), ...results2.keys()]);
    
    let rows = '';
    for (const operation of allOperations) {
        const r1 = results1.get(operation);
        const r2 = results2.get(operation);
        
        if (r1 && r2) {
            const diff = ((r2.avg - r1.avg) / r1.avg * 100);
            const color = diff < -10 ? '#4ade80' : diff > 10 ? '#f87171' : '#fbbf24';
            
            rows += `
                <tr>
                    <td>${operation}</td>
                    <td>${r1.avg.toFixed(2)}ms</td>
                    <td>${r2.avg.toFixed(2)}ms</td>
                    <td style="color: ${color}; font-weight: bold;">${formatDiff(diff)}</td>
                </tr>
            `;
        }
    }
    
    const html = `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance-Vergleich: ${label1} vs ${label2}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1e293b;
            color: #e2e8f0;
            padding: 2rem;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #60a5fa; margin-bottom: 2rem; }
        .info { 
            background: #334155; 
            padding: 1rem; 
            border-radius: 8px; 
            margin-bottom: 2rem;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
        }
        .info-box h3 { color: #94a3b8; margin-bottom: 0.5rem; font-size: 0.875rem; }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            background: #334155;
            border-radius: 8px;
            overflow: hidden;
        }
        th { 
            background: #475569; 
            padding: 1rem; 
            text-align: left;
            font-weight: 600;
            color: #cbd5e1;
        }
        td { padding: 0.75rem 1rem; border-top: 1px solid #475569; }
        tr:hover { background: #3d4f66; }
        .summary {
            margin-top: 2rem;
            padding: 1.5rem;
            background: #334155;
            border-radius: 8px;
        }
        .summary h2 { color: #60a5fa; margin-bottom: 1rem; }
        .summary .metric { 
            display: inline-block;
            margin-right: 2rem;
            padding: 0.5rem 1rem;
            background: #475569;
            border-radius: 4px;
        }
        .metric .value { 
            font-size: 1.5rem; 
            font-weight: bold;
            display: block;
        }
        .metric .label { 
            font-size: 0.875rem; 
            color: #94a3b8;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Performance-Vergleich</h1>
        
        <div class="info">
            <div class="info-box">
                <h3>Baseline: ${label1}</h3>
                <p>Datum: ${new Date(report1.timestamp).toLocaleString('de-DE')}</p>
                <p>DB-Typ: ${report1.dbType || 'unbekannt'}</p>
                <p>System: ${report1.system?.platform || 'unbekannt'}</p>
            </div>
            <div class="info-box">
                <h3>Vergleich: ${label2}</h3>
                <p>Datum: ${new Date(report2.timestamp).toLocaleString('de-DE')}</p>
                <p>DB-Typ: ${report2.dbType || 'unbekannt'}</p>
                <p>System: ${report2.system?.platform || 'unbekannt'}</p>
            </div>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Operation</th>
                    <th>${label1}</th>
                    <th>${label2}</th>
                    <th>Differenz</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
        
        <div class="summary">
            <h2>Zusammenfassung</h2>
            <div class="metric">
                <span class="value">${report1.total.toFixed(2)}ms</span>
                <span class="label">Baseline Gesamt</span>
            </div>
            <div class="metric">
                <span class="value">${report2.total.toFixed(2)}ms</span>
                <span class="label">Vergleich Gesamt</span>
            </div>
            <div class="metric">
                <span class="value" style="color: ${((report2.total - report1.total) / report1.total * 100) < 0 ? '#4ade80' : '#f87171'}">
                    ${formatDiff(((report2.total - report1.total) / report1.total * 100))}
                </span>
                <span class="label">Differenz</span>
            </div>
        </div>
    </div>
</body>
</html>
    `;
    
    fs.writeFileSync(outputPath, html);
    console.log(`📄 HTML-Report erstellt: ${outputPath}\n`);
}

// Hauptfunktion
function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.error('❌ Fehler: Nicht genug Argumente');
        console.log('\nVerwendung:');
        console.log('  node compare-performance.js <report1.json> <report2.json> [--html]\n');
        console.log('Optionen:');
        console.log('  --html          Erstellt zusätzlich einen HTML-Report\n');
        console.log('Beispiel:');
        console.log('  node compare-performance.js performance-report-123.json performance-report-456.json');
        process.exit(1);
    }
    
    const file1 = args[0];
    const file2 = args[1];
    const generateHTML = args.includes('--html');
    
    try {
        const report1 = loadReport(file1);
        const report2 = loadReport(file2);
        
        const label1 = path.basename(file1, '.json');
        const label2 = path.basename(file2, '.json');
        
        const result = compareReports(report1, report2, label1, label2);
        
        if (generateHTML) {
            const htmlPath = path.join(
                path.dirname(file2),
                `comparison-${Date.now()}.html`
            );
            generateComparisonHTML(report1, report2, label1, label2, htmlPath);
        }
        
        // Exit-Code basierend auf Ergebnis
        if (result.regressions > 0) {
            console.log(`⚠️  Es wurden ${result.regressions} Performance-Verschlechterungen festgestellt!\n`);
            process.exit(1);
        } else if (result.improvements > 0) {
            console.log(`✅ Es wurden ${result.improvements} Performance-Verbesserungen festgestellt!\n`);
            process.exit(0);
        } else {
            console.log('ℹ️  Keine signifikanten Performance-Änderungen festgestellt.\n');
            process.exit(0);
        }
        
    } catch (error) {
        console.error('❌ Fehler:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { compareReports, loadReport, generateComparisonHTML };
