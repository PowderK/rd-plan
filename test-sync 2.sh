#!/bin/bash

# Test Script für RD-Plan Sync
# Prüft die Voraussetzungen und Konfiguration

echo "🧪 RD-Plan Sync Test"
echo "====================="

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Prüfungsergebnisse
PASSED=0
FAILED=0

test_pass() {
    echo -e "${GREEN}✅ PASS:${NC} $1"
    ((PASSED++))
}

test_fail() {
    echo -e "${RED}❌ FAIL:${NC} $1"
    ((FAILED++))
}

test_warn() {
    echo -e "${YELLOW}⚠️  WARN:${NC} $1"
}

echo ""

# Test 1: Verzeichnisse
echo "1. Verzeichnisstruktur prüfen..."
if [ -d "rd-plan" ]; then
    test_pass "Entwicklungsverzeichnis 'rd-plan' gefunden"
else
    test_fail "Entwicklungsverzeichnis 'rd-plan' fehlt"
fi

if [ -d "rd-plan-beta" ]; then
    test_pass "Beta-Verzeichnis 'rd-plan-beta' gefunden"
else
    test_fail "Beta-Verzeichnis 'rd-plan-beta' fehlt"
fi

# Test 2: Package.json
echo ""
echo "2. Package.json prüfen..."
if [ -f "rd-plan/package.json" ]; then
    test_pass "rd-plan/package.json gefunden"
    
    # Prüfe Scripts
    if grep -q '"build"' rd-plan/package.json; then
        test_pass "Build-Script vorhanden"
    else
        test_fail "Build-Script fehlt in package.json"
    fi
    
    if grep -q '"start"' rd-plan/package.json; then
        test_pass "Start-Script vorhanden"
    else
        test_warn "Start-Script fehlt in package.json"
    fi
else
    test_fail "rd-plan/package.json fehlt"
fi

# Test 3: Git
echo ""
echo "3. Git-Konfiguration prüfen..."
if [ -d "rd-plan-beta/.git" ]; then
    test_pass "Git-Repository in Beta-Verzeichnis gefunden"
    
    cd rd-plan-beta
    REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
    if [[ "$REMOTE" == *"rd-plan"* ]]; then
        test_pass "Git-Remote konfiguriert: $REMOTE"
    else
        test_warn "Git-Remote nicht konfiguriert oder ungewöhnlich: $REMOTE"
    fi
    cd ..
else
    test_fail "Kein Git-Repository in Beta-Verzeichnis"
fi

# Test 4: Node.js/NPM
echo ""
echo "4. Node.js/NPM prüfen..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    test_pass "Node.js gefunden: $NODE_VERSION"
else
    test_fail "Node.js nicht gefunden"
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    test_pass "NPM gefunden: $NPM_VERSION"
else
    test_fail "NPM nicht gefunden"
fi

# Test 5: Script-Dateien
echo ""
echo "5. Script-Dateien prüfen..."
if [ -f "sync-to-beta.sh" ]; then
    test_pass "sync-to-beta.sh gefunden"
    if [ -x "sync-to-beta.sh" ]; then
        test_pass "sync-to-beta.sh ist ausführbar"
    else
        test_warn "sync-to-beta.sh ist nicht ausführbar (chmod +x sync-to-beta.sh)"
    fi
else
    test_fail "sync-to-beta.sh fehlt"
fi

if [ -f "quick-sync.sh" ]; then
    test_pass "quick-sync.sh gefunden"
    if [ -x "quick-sync.sh" ]; then
        test_pass "quick-sync.sh ist ausführbar"
    else
        test_warn "quick-sync.sh ist nicht ausführbar (chmod +x quick-sync.sh)"
    fi
else
    test_fail "quick-sync.sh fehlt"
fi

if [ -f "Makefile" ]; then
    test_pass "Makefile gefunden"
else
    test_fail "Makefile fehlt"
fi

# Test 6: Dependencies
echo ""
echo "6. Dependencies prüfen..."
if [ -d "rd-plan/node_modules" ]; then
    test_pass "Dependencies in rd-plan installiert"
else
    test_warn "Dependencies in rd-plan nicht installiert (npm install)"
fi

# Test 7: Rsync (für quick-sync)
echo ""
echo "7. System-Tools prüfen..."
if command -v rsync &> /dev/null; then
    test_pass "rsync gefunden (für quick-sync)"
else
    test_fail "rsync nicht gefunden (brew install rsync)"
fi

if command -v make &> /dev/null; then
    test_pass "make gefunden"
else
    test_warn "make nicht gefunden"
fi

# Zusammenfassung
echo ""
echo "🏁 Test-Zusammenfassung"
echo "======================="
echo -e "${GREEN}Bestanden: $PASSED${NC}"
echo -e "${RED}Fehlgeschlagen: $FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 Alle Tests bestanden! Sync-System ist bereit.${NC}"
    echo ""
    echo "Nächste Schritte:"
    echo "• make help          - Zeige verfügbare Commands"
    echo "• ./sync-to-beta.sh  - Vollständiger Sync"
    echo "• make quick-sync    - Schneller Sync"
else
    echo ""
    echo -e "${RED}⚠️  Einige Tests fehlgeschlagen. Bitte Probleme beheben.${NC}"
    echo ""
    echo "Häufige Fixes:"
    echo "• chmod +x *.sh      - Scripts ausführbar machen"
    echo "• npm install        - Dependencies installieren"
    echo "• git remote add origin <url>  - Git-Remote setzen"
fi

echo ""