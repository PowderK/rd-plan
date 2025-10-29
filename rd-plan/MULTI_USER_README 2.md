# RD-Plan Multi-User Database Architecture

## Übersicht

RD-Plan unterstützt jetzt zwei Datenbank-Modi für verschiedene Einsatzszenarien:

### 1. Einzelbenutzer-Modus (SQLite)
- **Standard-Modus** für lokale Einzelplatz-Installationen
- Verwendet lokale SQLite-Datenbank im Benutzerverzeichnis
- Optimal für Desktop-Anwendungen ohne Netzwerkfreigabe

### 2. Multi-User-Modus (Zentrale SQLite)
- **Netzwerk-Modus** für mehrere Benutzer
- Verwendet zentrale SQLite-Datenbank auf geteiltem Netzwerk-Pfad
- Ermöglicht gleichzeitigen Zugriff mehrerer RD-Plan Instanzen

## Automatische Erkennung

Das System erkennt automatisch den geeigneten Modus:

```typescript
// Auto-Erkennung basiert auf Umgebung
if (userDataPath.includes('network') || userDataPath.includes('shared')) {
    mode = 'central-sqlite';
    multiUser = true;
}
```

## Manuelle Konfiguration

### Über Umgebungsvariablen:
```bash
# Multi-User Modus aktivieren
export RD_PLAN_MULTI_USER=true
export RD_PLAN_DB_MODE=central-sqlite
export RD_PLAN_CENTRAL_DB_PATH=/shared/network/rd-plan.db

# Anwendung starten
npm start
```

### Über Code-Konfiguration:
```typescript
import { initializeDatabaseManager } from './database-manager';

const adapter = await initializeDatabaseManager({
    mode: 'central-sqlite',
    multiUser: true,
    centralPath: '/path/to/shared/database.db'
});
```

## Database Adapter Pattern

Das System verwendet ein Adapter-Pattern für konsistente API:

```typescript
interface DatabaseAdapter {
    // Personnel Management
    getPersonnel(): Promise<any[]>;
    addPersonnel(person: any): Promise<void>;
    updatePersonnel(person: any): Promise<void>;
    deletePersonnel(id: number): Promise<void>;
    
    // Duty Roster
    getDutyRoster(year: number): Promise<any[]>;
    setDutyRosterEntry(entry: any): Promise<void>;
    bulkSetDutyRosterEntries(entries: any[]): Promise<number>;
    
    // Azubi Management
    getAzubiList(): Promise<any[]>;
    addAzubi(azubi: any): Promise<void>;
    
    // ... weitere Methoden
}
```

## Deployment-Szenarien

### Szenario 1: Einzelarbeitsplatz
```
Benutzer-Desktop
├── RD-Plan.exe
└── %APPDATA%/rd-plan/
    └── rd-plan.db (lokale SQLite)
```

### Szenario 2: Netzwerk-Installation
```
Netzlaufwerk (Z:/)
├── RD-Plan-Shared/
│   └── rd-plan.db (zentrale SQLite)
└── RD-Plan.exe (auf jedem Client)

Client 1, 2, 3, ... n
└── RD-Plan.exe → verbindet zu Z:/RD-Plan-Shared/rd-plan.db
```

## Vorteile der Architektur

1. **Transparenz**: Gleiche API für beide Modi
2. **Portabilität**: Weiterhin portable durch SQLite
3. **Performance**: Keine Server-Installation erforderlich
4. **Einfachheit**: Automatische Modus-Erkennung
5. **Flexibilität**: Manuelle Konfiguration möglich

## Migration bestehender Daten

Bei der ersten Ausführung im Multi-User-Modus:

1. System erkennt bestehende lokale Datenbank
2. Migriert automatisch in zentrale Datenbank
3. Alle Clients nutzen automatisch zentrale Datenbank

## Concurrent Access Handling

SQLite mit WAL-Mode ermöglicht:
- Multiple Reader gleichzeitig
- Ein Writer zur Zeit
- Automatische Lock-Verwaltung
- Transaktions-Sicherheit

## Technische Details

### Database Manager
- `DatabaseManager` Klasse orchestriert Modus-Auswahl
- `SQLiteAdapter` implementiert einheitliche Schnittstelle
- Automatisches Fallback bei Fehlern

### Schema Synchronisation
- Identisches Schema in beiden Modi
- Automatische Migrations-Logik
- Kompatibilität zwischen Versionen

## Troubleshooting

### Netzwerk-Verbindungsfehler
```
[DatabaseManager] Failed to access central database
[DatabaseManager] Falling back to local SQLite
```

### Berechtigungsprobleme
```bash
# Berechtigung für Netzwerk-Pfad prüfen
ls -la /shared/network/
chmod 664 /shared/network/rd-plan.db
```

### Performance-Optimierung
```sql
-- SQLite Optimierungen für Netzwerk-Zugriff
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA cache_size=10000;
PRAGMA temp_store=memory;
```

## Zukünftige Erweiterungen

Das Adapter-Pattern ermöglicht zukünftige Database-Backends:
- PostgreSQL für Enterprise-Umgebungen
- MySQL für Cloud-Deployments
- MongoDB für NoSQL-Anforderungen

Die Multi-User-Architektur ist bereit für Skalierung auf echte Client-Server-Lösungen.