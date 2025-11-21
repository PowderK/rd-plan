# RD-Plan Migration Guide: SQLite → PostgreSQL

## 📋 Übersicht

Dieser Guide führt Sie Schritt für Schritt durch die Migration Ihrer RD-Plan Installation von **SQLite** auf **PostgreSQL**.

**Zeitaufwand:** 30-60 Minuten  
**Risiko:** Niedrig (mit vollständigem Backup)  
**Downtime:** 5-15 Minuten

---

## 🎯 Wann migrieren?

### ✅ **Migration empfohlen wenn:**
- ✅ Mehr als 3 Benutzer gleichzeitig arbeiten
- ✅ Netzwerk-Zugriff von mehreren Standorten gewünscht
- ✅ Zentrale Datenverwaltung erforderlich
- ✅ Höhere Datensicherheit durch ACID-Transaktionen
- ✅ Bessere Performance bei großen Datenmengen (10.000+ Einträge)

### ⚠️ **Migration NICHT nötig wenn:**
- ⚠️ Nur 1-2 Benutzer (Einzelarbeitsplatz)
- ⚠️ Keine Netzwerk-Anforderungen
- ⚠️ Datenbank klein (<1.000 Einträge)
- ⚠️ Portable Installation auf USB-Stick gewünscht

---

## 🔄 Migrations-Prozess

### **Phase 1: Vorbereitung (10 min)**

#### 1.1 Backup erstellen

**KRITISCH:** Erstellen Sie ein vollständiges Backup!

```bash
# Windows (PowerShell)
Copy-Item "$env:APPDATA\rd-plan" "$env:USERPROFILE\Desktop\rd-plan-backup-$(Get-Date -Format 'yyyyMMdd')" -Recurse

# macOS/Linux
cp -r ~/Library/Application\ Support/rd-plan ~/Desktop/rd-plan-backup-$(date +%Y%m%d)
```

**Backup-Inhalt prüfen:**
- ✅ `database.db` (Hauptdatenbank)
- ✅ `settings.json` (Einstellungen)
- ✅ `backups/` (Automatische Backups)

#### 1.2 Export erstellen

1. **RD-Plan starten** (aktuelle SQLite-Version)
2. **Einstellungen** öffnen
3. **Import/Export** → **"Datenbank exportieren"**
4. Speichern als: `rdplan-migration-export.json`
5. **Speicherort merken!** (z.B. Desktop)

**Export-Datei prüfen:**
```json
{
  "version": "1.0",
  "exportDate": "2025-01-26T...",
  "data": {
    "personnel": [...],
    "duty_roster": [...],
    "azubis": [...],
    "vehicles": [...]
  }
}
```

#### 1.3 Datenkonsistenz prüfen

**Öffnen Sie diese Bereiche und notieren Sie:**
- Anzahl Personen: ______
- Anzahl Azubis: ______
- Anzahl Dienstplan-Einträge (aktueller Monat): ______
- Anzahl Fahrzeuge: ______

**Diese Zahlen nach Migration vergleichen!**

---

### **Phase 2: PostgreSQL Installation (15 min)**

Wählen Sie **eine** der folgenden Methoden:

#### **Option A: Docker (Empfohlen für Test)**

```bash
# PostgreSQL Container starten
docker run --name rdplan-postgres \
  -e POSTGRES_USER=rdplan \
  -e POSTGRES_PASSWORD=rdplan2024 \
  -e POSTGRES_DB=rdplan \
  -p 5432:5432 \
  -v rdplan-data:/var/lib/postgresql/data \
  -d postgres:16-alpine

# Warten bis bereit
docker logs -f rdplan-postgres
# Warte auf: "database system is ready to accept connections"
```

**Connection String:**
```
postgresql://rdplan:rdplan2024@localhost:5432/rdplan
```

**➡️ Weiter zu Phase 3**

---

#### **Option B: Windows Server**

1. **Download:** https://www.postgresql.org/download/windows/
2. **Installer ausführen** (PostgreSQL 16.x)
3. **Konfiguration:**
   - Port: `5432` ✓
   - Passwort: `<IhrSicheresPasswort>` (merken!)
   - Locale: German, Germany (optional)

4. **pgAdmin 4 öffnen**
5. **Neue Datenbank erstellen:**
   - Rechtsklick auf "Databases" → "Create" → "Database"
   - Name: `rdplan`
   - Owner: `postgres` (oder neuer Benutzer)

6. **Benutzer erstellen (optional aber empfohlen):**

```sql
CREATE USER rdplan WITH PASSWORD 'IhrSicheresPasswort';
GRANT ALL PRIVILEGES ON DATABASE rdplan TO rdplan;
```

**Connection String:**
```
postgresql://rdplan:IhrSicheresPasswort@localhost:5432/rdplan
```

**➡️ Weiter zu Phase 3**

---

#### **Option C: Linux Server (Ubuntu/Debian)**

```bash
# PostgreSQL installieren
sudo apt update
sudo apt install postgresql postgresql-contrib

# Service starten
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Datenbank und Benutzer erstellen
sudo -u postgres psql << EOF
CREATE DATABASE rdplan;
CREATE USER rdplan WITH PASSWORD 'rdplan2024';
GRANT ALL PRIVILEGES ON DATABASE rdplan TO rdplan;
\q
EOF
```

**Netzwerk-Zugriff aktivieren (nur bei Server-Installation):**

**`/etc/postgresql/16/main/postgresql.conf`:**
```ini
listen_addresses = '*'  # Oder spezifische IP
```

**`/etc/postgresql/16/main/pg_hba.conf`:**
```
# Erlaube Zugriff aus lokalem Netzwerk
host    rdplan    rdplan    192.168.0.0/16    md5
```

```bash
# PostgreSQL neu starten
sudo systemctl restart postgresql
```

**Connection String (Netzwerk):**
```
postgresql://rdplan:rdplan2024@<SERVER-IP>:5432/rdplan
```

**➡️ Weiter zu Phase 3**

---

### **Phase 3: RD-Plan Konfiguration (5 min)**

#### 3.1 RD-Plan beenden

**WICHTIG:** Schließen Sie alle laufenden RD-Plan-Instanzen!

```bash
# Windows (PowerShell)
Get-Process | Where-Object {$_.Name -like "*rd-plan*"} | Stop-Process

# macOS/Linux
pkill -f "rd-plan"
```

#### 3.2 PostgreSQL-Konfiguration erstellen

**Methode 1: Umgebungsvariable (Temporär für Test)**

**Windows (PowerShell):**
```powershell
$env:RD_PLAN_PG_CONNECTION = "postgresql://rdplan:rdplan2024@localhost:5432/rdplan"
```

**Linux/macOS:**
```bash
export RD_PLAN_PG_CONNECTION="postgresql://rdplan:rdplan2024@localhost:5432/rdplan"
```

**Methode 2: Konfigurationsdatei (Permanent)**

**Erstelle:** `db-config.json` im userData-Verzeichnis

**Pfad:**
- **Windows:** `%APPDATA%\rd-plan\db-config.json`
- **macOS:** `~/Library/Application Support/rd-plan/db-config.json`
- **Linux:** `~/.config/rd-plan/db-config.json`

**Inhalt:**
```json
{
  "mode": "postgresql",
  "postgresConfig": {
    "connectionString": "postgresql://rdplan:IhrPasswort@localhost:5432/rdplan",
    "max": 20,
    "idleTimeoutMillis": 30000,
    "connectionTimeoutMillis": 5000
  }
}
```

**Für Netzwerk-Server:**
```json
{
  "mode": "postgresql",
  "postgresConfig": {
    "host": "192.168.1.100",
    "port": 5432,
    "database": "rdplan",
    "user": "rdplan",
    "password": "IhrPasswort",
    "ssl": false,
    "max": 20
  }
}
```

#### 3.3 Verbindung testen

**Vor RD-Plan-Start:**

```bash
# psql (wenn installiert)
psql "postgresql://rdplan:rdplan2024@localhost:5432/rdplan" -c "\dt"

# Sollte zeigen: "Did not find any relations."
# (Leere Datenbank ist OK - Schema wird automatisch erstellt)
```

---

### **Phase 4: Erste Migration (10 min)**

#### 4.1 RD-Plan starten

**Mit Umgebungsvariable:**
```bash
# Windows
$env:RD_PLAN_PG_CONNECTION = "postgresql://..."; .\RD-Plan.exe

# Linux/macOS
RD_PLAN_PG_CONNECTION="postgresql://..." ./RD-Plan
```

**Mit Konfigurationsdatei:**
```bash
# Einfach normal starten
./RD-Plan
```

#### 4.2 Schema-Initialisierung

**Beim ersten Start:**
1. RD-Plan erkennt PostgreSQL-Konfiguration
2. Schema wird automatisch erstellt (15+ Tabellen)
3. Indexe werden angelegt
4. Logs prüfen:

```
[Database] PostgreSQL connection established
[Database] Initializing PostgreSQL schema...
[Database] Creating table: personnel
[Database] Creating table: duty_roster
...
[Database] Schema initialization complete
```

**Falls Fehler:**
- ❌ "Connection refused" → PostgreSQL läuft nicht (`systemctl start postgresql`)
- ❌ "Authentication failed" → Passwort falsch (prüfen Sie Connection String)
- ❌ "Database does not exist" → `CREATE DATABASE rdplan;` ausführen

#### 4.3 Daten importieren

1. **Einstellungen** öffnen
2. **Import/Export** → **"Datenbank importieren"**
3. **Datei wählen:** `rdplan-migration-export.json` (aus Phase 1.2)
4. **Import starten**
5. **Fortschritt beobachten:**

```
Importiere Personnel: 45/45
Importiere Azubis: 12/12
Importiere Dienstplan: 234/234
Importiere Fahrzeuge: 8/8
...
Import abgeschlossen!
```

**Import-Fehler:**
- ❌ "Duplicate key" → Datenbank nicht leer → `DROP DATABASE rdplan; CREATE DATABASE rdplan;`
- ❌ "Foreign key violation" → Import-Reihenfolge falsch → Melden Sie Bug

---

### **Phase 5: Verifikation (10 min)**

#### 5.1 Datenkonsistenz prüfen

**Vergleichen Sie mit Notizen aus Phase 1.3:**

| Bereich | Vorher | Nachher | ✓/✗ |
|---------|--------|---------|-----|
| Personen | _____ | _____ | |
| Azubis | _____ | _____ | |
| Dienstplan-Einträge | _____ | _____ | |
| Fahrzeuge | _____ | _____ | |

**Zahlen prüfen in RD-Plan:**
- **Personal** → Anzahl anzeigen
- **Azubis** → Anzahl anzeigen
- **Dienstplan** → Aktueller Monat filtern → Anzahl zählen
- **Fahrzeuge** → Anzahl anzeigen

**Wenn Zahlen nicht übereinstimmen:**
1. Export erneut durchführen (Phase 1.2)
2. PostgreSQL-Datenbank leeren: `DROP DATABASE rdplan; CREATE DATABASE rdplan;`
3. Import wiederholen (Phase 4.3)

#### 5.2 Funktionstest

**Manuell testen:**

✅ **Person erstellen:**
- Personal → "Neue Person"
- Name: "Test Migration"
- Speichern
- Prüfen: Erscheint in Liste?

✅ **Dienstplan-Eintrag:**
- Dienstplan → Heutiges Datum
- Person zuweisen
- Speichern
- Neu laden (F5) → Eintrag noch da?

✅ **Azubi bearbeiten:**
- Azubis → Einen auswählen
- Ausbildungsstand ändern
- Speichern
- Prüfen: Änderung gespeichert?

✅ **Fahrzeug bearbeiten:**
- Fahrzeuge → RTW 1 auswählen
- Kennzeichen ändern
- Speichern
- Prüfen: Änderung gespeichert?

**Alle Tests erfolgreich? → Weiter zu 5.3**  
**Tests fehlgeschlagen? → Siehe Troubleshooting**

#### 5.3 Multi-User-Test (optional)

**Nur bei Netzwerk-Installation:**

1. **PC 1:** RD-Plan mit PostgreSQL starten
2. **PC 2:** RD-Plan mit gleicher PostgreSQL-Verbindung starten
3. **PC 1:** Person erstellen → Speichern
4. **PC 2:** Personal-Liste neu laden (F5)
5. **Prüfen:** Neue Person auf PC 2 sichtbar?

**Wenn NEIN:**
- Prüfen: Beide PCs nutzen gleiche Connection String?
- Prüfen: Firewall erlaubt Port 5432?
- Prüfen: `postgresql.conf` hat `listen_addresses = '*'`?

---

### **Phase 6: Cleanup & Finalisierung (5 min)**

#### 6.1 Alte SQLite-Datenbank archivieren

**NICHT löschen! Aufbewahren als Backup.**

```bash
# Windows
Move-Item "$env:APPDATA\rd-plan\database.db" "$env:APPDATA\rd-plan\database.db.old"

# macOS/Linux
mv ~/Library/Application\ Support/rd-plan/database.db \
   ~/Library/Application\ Support/rd-plan/database.db.old
```

#### 6.2 Automatische Backups einrichten

**Linux Cron-Job:**
```bash
# Erstelle Backup-Script
sudo tee /opt/rdplan/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/rdplan"
mkdir -p $BACKUP_DIR

pg_dump -h localhost -U rdplan rdplan | gzip > $BACKUP_DIR/rdplan_$DATE.sql.gz

# Nur letzte 30 Tage behalten
find $BACKUP_DIR -name "rdplan_*.sql.gz" -mtime +30 -delete
EOF

sudo chmod +x /opt/rdplan/backup.sh

# Täglich um 2 Uhr nachts
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/rdplan/backup.sh") | crontab -
```

**Windows Task Scheduler:**
1. **Aufgabenplanung** öffnen
2. **Aufgabe erstellen**
3. **Trigger:** Täglich um 02:00 Uhr
4. **Aktion:** Programm starten
   - Programm: `C:\Program Files\PostgreSQL\16\bin\pg_dump.exe`
   - Argumente: `-h localhost -U rdplan rdplan`
   - Ausgabe umleiten: `> C:\Backup\rdplan_%date%.sql`

#### 6.3 Dokumentation aktualisieren

**Erstellen Sie ein Migrations-Dokument:**

```markdown
# RD-Plan PostgreSQL Migration

**Datum:** 2025-01-26
**Durchgeführt von:** Ihr Name
**Dauer:** XX Minuten

## Konfiguration
- **Host:** localhost (oder IP)
- **Port:** 5432
- **Database:** rdplan
- **User:** rdplan

## Migration
- **Exportiert:** rdplan-migration-export.json (2,3 MB)
- **Importiert:** 45 Personen, 12 Azubis, 234 Dienstplan-Einträge

## Tests
- ✅ Datenkonsistenz: OK
- ✅ Funktionstest: OK
- ✅ Multi-User: OK

## Backup
- **SQLite-Backup:** ~/Desktop/rd-plan-backup-20250126/
- **PostgreSQL-Backup:** Täglich 02:00 Uhr → /backup/rdplan/

## Notizen
- Connection String: postgresql://rdplan:***@localhost:5432/rdplan
- Config-Datei: ~/.config/rd-plan/db-config.json
```

---

## 🚨 Troubleshooting

### **Problem: Import schlägt fehl mit "Duplicate key"**

**Ursache:** Datenbank nicht leer (z.B. nach fehlgeschlagenem Import)

**Lösung:**
```sql
-- Alle Daten löschen
DROP DATABASE rdplan;
CREATE DATABASE rdplan;
GRANT ALL PRIVILEGES ON DATABASE rdplan TO rdplan;

-- RD-Plan neu starten (Schema wird neu erstellt)
-- Import erneut durchführen
```

---

### **Problem: "Connection refused"**

**Ursache:** PostgreSQL läuft nicht

**Lösung:**
```bash
# Linux
sudo systemctl start postgresql
sudo systemctl status postgresql

# Windows
net start postgresql-x64-16

# Docker
docker start rdplan-postgres
docker logs rdplan-postgres
```

---

### **Problem: Daten fehlen nach Import**

**Ursache:** Export unvollständig oder Import-Fehler

**Lösung:**
1. **Export-Datei prüfen:**
```bash
# Größe prüfen (sollte > 1 MB sein bei normalem Datenbestand)
ls -lh rdplan-migration-export.json

# JSON-Struktur prüfen
head -n 50 rdplan-migration-export.json
```

2. **Neuer Export aus SQLite:**
   - RD-Plan mit SQLite starten (alte `database.db` wiederherstellen)
   - Export erneut durchführen
   - Datei-Größe vergleichen

3. **Import-Logs prüfen:**
   - RD-Plan-Console öffnen (Entwicklertools)
   - Fehler suchen

---

### **Problem: Multi-User funktioniert nicht**

**Ursache:** Firewall, falsche `listen_addresses`, oder Connection-Pool erschöpft

**Lösung:**

**1. PostgreSQL Netzwerk-Konfiguration:**
```ini
# /etc/postgresql/16/main/postgresql.conf
listen_addresses = '*'
max_connections = 100
```

**2. Firewall:**
```bash
# Ubuntu
sudo ufw allow 5432/tcp

# Windows
netsh advfirewall firewall add rule name="PostgreSQL" dir=in action=allow protocol=TCP localport=5432
```

**3. Connection-String prüfen:**
```bash
# Von Client-PC testen
psql -h <SERVER-IP> -U rdplan -d rdplan -c "\dt"
```

**4. Connection-Pool:**
```json
{
  "postgresConfig": {
    "max": 20  // Erhöhen wenn viele Benutzer
  }
}
```

---

### **Problem: Performance schlechter als SQLite**

**Ursache:** Fehlende Indexe oder falsche PostgreSQL-Konfiguration

**Lösung:**

**1. Indexe prüfen:**
```sql
SELECT tablename, indexname FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Sollte mindestens diese Indexe haben:
-- idx_duty_roster_person
-- idx_duty_roster_date
-- idx_qualification_periods_person
```

**2. PostgreSQL-Tuning (für Server):**
```ini
# postgresql.conf
shared_buffers = 256MB      # 25% vom RAM
effective_cache_size = 1GB  # 50% vom RAM
work_mem = 16MB
maintenance_work_mem = 128MB
```

```bash
sudo systemctl restart postgresql
```

**3. VACUUM ANALYZE:**
```sql
VACUUM ANALYZE;
```

---

## ↩️ Rollback-Plan

**Falls Migration fehlschlägt oder Probleme auftreten:**

### **Schritt 1: RD-Plan beenden**
```bash
pkill -f "rd-plan"
```

### **Schritt 2: PostgreSQL-Konfiguration entfernen**
```bash
# Umgebungsvariable löschen
unset RD_PLAN_PG_CONNECTION

# ODER Konfigurationsdatei löschen/umbenennen
mv ~/.config/rd-plan/db-config.json ~/.config/rd-plan/db-config.json.disabled
```

### **Schritt 3: SQLite-Datenbank wiederherstellen**
```bash
# Aus Backup
cp ~/Desktop/rd-plan-backup-20250126/database.db \
   ~/Library/Application\ Support/rd-plan/database.db

# Oder alte Datei umbenennen
mv ~/Library/Application\ Support/rd-plan/database.db.old \
   ~/Library/Application\ Support/rd-plan/database.db
```

### **Schritt 4: RD-Plan neu starten**
```bash
./RD-Plan
# Sollte jetzt wieder mit SQLite laufen
```

### **Schritt 5: Datenkonsistenz prüfen**
- Öffnen Sie alle Bereiche (Personal, Dienstplan, etc.)
- Vergleichen Sie Anzahlen mit Notizen aus Phase 1.3
- Funktionstest durchführen

---

## ✅ Post-Migration Checkliste

Nach erfolgreicher Migration:

- [ ] Datenkonsistenz geprüft (Anzahlen stimmen überein)
- [ ] Funktionstest erfolgreich (Erstellen/Bearbeiten/Löschen)
- [ ] Multi-User getestet (bei Netzwerk-Installation)
- [ ] Alte SQLite-Datenbank archiviert (NICHT gelöscht!)
- [ ] PostgreSQL-Backups eingerichtet (täglich)
- [ ] Dokumentation erstellt (Connection String, Config-Pfade)
- [ ] Team informiert (neue Connection-Daten verteilt)
- [ ] Firewall-Regeln konfiguriert (bei Server-Installation)
- [ ] SSL/TLS aktiviert (bei Production-Umgebung)
- [ ] Monitoring eingerichtet (optional)

---

## 📈 Performance-Tipps nach Migration

### **1. Index-Optimierung (nach 1 Woche Betrieb)**

```sql
-- Fehlende Indexe identifizieren
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public' AND n_distinct > 100
ORDER BY abs(correlation) DESC;

-- Beispiel: Index für häufige Queries
CREATE INDEX idx_duty_roster_station ON duty_roster(rtw_id, ktw_id, nef_id, itw_id);
```

### **2. Query-Optimierung**

```sql
-- Langsame Queries finden (pg_stat_statements aktivieren)
SELECT query, calls, total_time, mean_time, rows
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 20;
```

### **3. Regelmäßige Wartung**

```bash
# Wöchentlich: Statistiken aktualisieren
psql -h localhost -U rdplan rdplan -c "VACUUM ANALYZE;"

# Monatlich: Festplatten-Platz freigeben
psql -h localhost -U rdplan rdplan -c "VACUUM FULL;"
```

---

## 🎓 Weiterführende Ressourcen

**PostgreSQL:**
- [Offizielle Dokumentation](https://www.postgresql.org/docs/16/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [pg_dump Backup Guide](https://www.postgresql.org/docs/16/backup-dump.html)

**RD-Plan:**
- [README-POSTGRESQL.md](./README-POSTGRESQL.md) - Detaillierte PostgreSQL-Setup-Anleitung
- [GitHub Issues](https://github.com/powderk/rd-plan/issues) - Support & Bug-Reports

---

## 💬 Support

**Bei Problemen:**
1. Prüfen Sie Troubleshooting-Abschnitt oben
2. Logs analysieren (RD-Plan Console + PostgreSQL Logs)
3. GitHub Issue erstellen mit:
   - Fehlermeldung (vollständig)
   - PostgreSQL-Version (`SELECT version();`)
   - RD-Plan-Version
   - Migrations-Schritt wo Fehler auftrat

**Viel Erfolg bei der Migration! 🚀**
