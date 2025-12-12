# RD-Plan PostgreSQL Setup & Konfiguration

## Übersicht

RD-Plan unterstützt neben SQLite auch **PostgreSQL** als Datenbank-Backend. PostgreSQL ermöglicht **echten Multi-User-Betrieb** über Netzwerk mit ACID-Garantien und professioneller Transaktionsverwaltung.

---

## 🎯 Wann PostgreSQL verwenden?

### ✅ **PostgreSQL ist ideal für:**
- **Multi-User-Umgebungen**: 5-50+ gleichzeitige Benutzer
- **Netzwerk-Betrieb**: Zentrale Datenbank auf Server
- **Hohe Datensicherheit**: ACID-Transaktionen, Point-in-Time Recovery
- **Professioneller Einsatz**: Produktionsumgebung mit zentraler Verwaltung
- **Skalierbarkeit**: Große Datenmengen (10.000+ Dienstplan-Einträge)

### ⚠️ **SQLite ist besser für:**
- **Einzelbenutzer**: Nur 1 Person nutzt die App
- **Offline-Betrieb**: Kein Netzwerk erforderlich
- **Portable Installation**: App auf USB-Stick
- **Einfache Installation**: Keine Server-Konfiguration nötig

---

## 🚀 Installation & Setup

### **Option 1: Docker (Empfohlen für Entwicklung)**

Schnellste Methode zum Testen von PostgreSQL:

```bash
# PostgreSQL Container starten
docker run --name rdplan-postgres \
  -e POSTGRES_USER=rdplan \
  -e POSTGRES_PASSWORD=rdplan2024 \
  -e POSTGRES_DB=rdplan \
  -p 5432:5432 \
  -v rdplan-data:/var/lib/postgresql/data \
  -d postgres:16-alpine

# Warte bis PostgreSQL bereit ist
docker logs -f rdplan-postgres
# Wenn "database system is ready to accept connections" erscheint → fertig!
```

**Connection String:**
```
postgresql://rdplan:rdplan2024@localhost:5432/rdplan
```

---

### **Option 2: Windows Installation (Production)**

#### Schritt 1: PostgreSQL herunterladen
- Download: https://www.postgresql.org/download/windows/
- Installer: PostgreSQL 16.x (Windows x86-64)
- Ausführen als Administrator

#### Schritt 2: Installation
- **Port:** `5432` (Standard)
- **Password:** Sicheres Passwort wählen und merken!
- **Locale:** German, Germany (optional)

#### Schritt 3: Datenbank erstellen
```sql
-- Öffne pgAdmin 4 oder psql
CREATE DATABASE rdplan;
CREATE USER rdplan WITH PASSWORD 'IhrSicheresPasswort';
GRANT ALL PRIVILEGES ON DATABASE rdplan TO rdplan;
```

**Connection String:**
```
postgresql://rdplan:IhrSicheresPasswort@localhost:5432/rdplan
```

---

### **Option 3: Linux Installation (Ubuntu/Debian)**

```bash
# PostgreSQL installieren
sudo apt update
sudo apt install postgresql postgresql-contrib

# Service starten
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Benutzer und Datenbank erstellen
sudo -u postgres psql
```

```sql
CREATE DATABASE rdplan;
CREATE USER rdplan WITH PASSWORD 'rdplan2024';
GRANT ALL PRIVILEGES ON DATABASE rdplan TO rdplan;
\q
```

#### PostgreSQL für Netzwerk-Zugriff konfigurieren

**`/etc/postgresql/16/main/postgresql.conf`:**
```ini
listen_addresses = '*'  # Alle IP-Adressen
```

**`/etc/postgresql/16/main/pg_hba.conf`:**
```
# Erlaube Zugriff aus lokalem Netzwerk (192.168.x.x)
host    rdplan    rdplan    192.168.0.0/16    md5
```

```bash
# PostgreSQL neu starten
sudo systemctl restart postgresql
```

**Connection String (Netzwerk):**
```
postgresql://rdplan:rdplan2024@192.168.1.100:5432/rdplan
```

---

## 🔧 RD-Plan Konfiguration

### **Methode 1: Umgebungsvariable (empfohlen)**

Setze die Umgebungsvariable `RD_PLAN_PG_CONNECTION`:

**Windows (PowerShell):**
```powershell
$env:RD_PLAN_PG_CONNECTION = "postgresql://rdplan:rdplan2024@localhost:5432/rdplan"
.\RD-Plan.exe
```

**Windows (CMD):**
```cmd
set RD_PLAN_PG_CONNECTION=postgresql://rdplan:rdplan2024@localhost:5432/rdplan
RD-Plan.exe
```

**Linux/macOS:**
```bash
export RD_PLAN_PG_CONNECTION="postgresql://rdplan:rdplan2024@localhost:5432/rdplan"
./RD-Plan
```

---

### **Methode 2: Konfigurationsdatei**

Erstelle `db-config.json` im userData-Verzeichnis:

**Pfad:**
- **Windows:** `%APPDATA%\rd-plan\db-config.json`
- **macOS:** `~/Library/Application Support/rd-plan/db-config.json`
- **Linux:** `~/.config/rd-plan/db-config.json`

**Inhalt:**
```json
{
  "mode": "postgresql",
  "postgresConfig": {
    "host": "localhost",
    "port": 5432,
    "database": "rdplan",
    "user": "rdplan",
    "password": "rdplan2024",
    "ssl": false,
    "max": 20
  }
}
```

**Oder mit Connection String:**
```json
{
  "mode": "postgresql",
  "postgresConfig": {
    "connectionString": "postgresql://rdplan:rdplan2024@localhost:5432/rdplan",
    "max": 20
  }
}
```

---

### **Methode 3: Setup-Wizard (GUI)**

1. App starten (ohne Konfiguration)
2. Setup-Wizard öffnet sich automatisch
3. Wähle **"Netzwerk (PostgreSQL)"**
4. Gib Connection-Daten ein:
   - Host: `localhost` (oder IP-Adresse)
   - Port: `5432`
   - Database: `rdplan`
   - User: `rdplan`
   - Password: `***`
5. Klicke **"Verbindung testen"**
6. Bei Erfolg: **"Speichern & Starten"**

---

## 📊 Schema-Setup

Das Datenbank-Schema wird **automatisch** bei erstem Start erstellt!

### Manuelle Schema-Erstellung (optional):

```bash
# Schema-SQL exportieren
cat > schema.sql << 'EOF'
-- Führe initializePostgreSQLDatabase() aus
-- Siehe main/database-postgres.ts für vollständiges Schema
EOF

# In PostgreSQL importieren
psql -h localhost -U rdplan -d rdplan -f schema.sql
```

---

## 🔒 Sicherheit & Best Practices

### **1. Sichere Passwörter**

❌ **NICHT verwenden:**
```
postgresql://rdplan:rdplan@localhost:5432/rdplan  # Zu einfach!
```

✅ **Empfohlen:**
```
postgresql://rdplan:K9#mP2$xL8@qR5!nW3@localhost:5432/rdplan
```

### **2. SSL/TLS aktivieren (Production)**

**PostgreSQL-Server:**
```ini
# postgresql.conf
ssl = on
ssl_cert_file = '/path/to/server.crt'
ssl_key_file = '/path/to/server.key'
```

**RD-Plan Client:**
```json
{
  "postgresConfig": {
    "connectionString": "postgresql://rdplan:password@server:5432/rdplan?sslmode=require",
    "ssl": true
  }
}
```

### **3. Benutzer-Rollen**

```sql
-- Read-Only Benutzer für Reports
CREATE USER rdplan_readonly WITH PASSWORD 'readonly2024';
GRANT CONNECT ON DATABASE rdplan TO rdplan_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO rdplan_readonly;

-- Admin-Benutzer für Schema-Änderungen
CREATE USER rdplan_admin WITH PASSWORD 'admin2024' CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE rdplan TO rdplan_admin;
```

### **4. IP-Whitelisting**

**`pg_hba.conf`:**
```
# Nur bestimmte IPs erlauben
host    rdplan    rdplan    192.168.1.10/32    md5  # Admin-PC
host    rdplan    rdplan    192.168.1.20/32    md5  # User-PC 1
host    rdplan    rdplan    192.168.1.21/32    md5  # User-PC 2
```

### **5. Connection-Pool-Konfiguration**

```json
{
  "postgresConfig": {
    "max": 20,                      // Max connections
    "idleTimeoutMillis": 30000,    // 30 Sekunden
    "connectionTimeoutMillis": 5000 // 5 Sekunden
  }
}
```

**Faustregel:**
- **Kleine Teams (5-10 User):** `max: 10`
- **Mittel (10-30 User):** `max: 20`
- **Groß (30-50 User):** `max: 40`

---

## 🔄 Daten-Migration von SQLite

### **Export aus SQLite**

1. **RD-Plan mit SQLite starten**
2. **Export über Settings:**
   - Einstellungen → Import/Export
   - "Datenbank exportieren"
   - Speichern als: `rdplan-export.json`

### **Import in PostgreSQL**

1. **PostgreSQL-Datenbank vorbereiten** (siehe oben)
2. **RD-Plan mit PostgreSQL starten**
3. **Import über Settings:**
   - Einstellungen → Import/Export
   - "Datenbank importieren"
   - Wähle: `rdplan-export.json`

---

## 📈 Performance-Optimierung

### **1. Indexe prüfen**

```sql
-- Zeige alle Indexe
SELECT tablename, indexname FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

-- Wichtige Indexe (automatisch erstellt):
-- idx_duty_roster_person (personId, personType)
-- idx_duty_roster_date (date)
-- idx_qualification_periods_person (personId)
```

### **2. Wartung**

```sql
-- Statistiken aktualisieren (wöchentlich)
ANALYZE;

-- Tote Zeilen entfernen (monatlich)
VACUUM;

-- Beides zusammen
VACUUM ANALYZE;
```

### **3. Query-Performance**

```sql
-- Langsame Queries finden
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

---

## 💾 Backup-Strategie

### **Automatische Backups (empfohlen)**

**Linux Cron-Job:**
```bash
# Erstelle Backup-Script
cat > /opt/rdplan/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/rdplan"
mkdir -p $BACKUP_DIR

pg_dump -h localhost -U rdplan rdplan | gzip > $BACKUP_DIR/rdplan_$DATE.sql.gz

# Nur letzte 30 Tage behalten
find $BACKUP_DIR -name "rdplan_*.sql.gz" -mtime +30 -delete
EOF

chmod +x /opt/rdplan/backup.sh

# Täglich um 2 Uhr nachts
crontab -e
0 2 * * * /opt/rdplan/backup.sh
```

**Windows Task Scheduler:**
```batch
@echo off
set BACKUP_DIR=C:\Backup\RDPlan
set DATE=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%

"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -h localhost -U rdplan rdplan > %BACKUP_DIR%\rdplan_%DATE%.sql

# Alte Backups löschen (PowerShell)
forfiles /P %BACKUP_DIR% /M rdplan_*.sql /D -30 /C "cmd /c del @path"
```

### **Manuelles Backup**

```bash
# Backup erstellen
pg_dump -h localhost -U rdplan rdplan > rdplan_backup.sql

# Komprimiert
pg_dump -h localhost -U rdplan rdplan | gzip > rdplan_backup.sql.gz

# Restore
psql -h localhost -U rdplan rdplan < rdplan_backup.sql
```

### **Point-in-Time Recovery (PITR)**

Für maximale Datensicherheit:

**`postgresql.conf`:**
```ini
wal_level = replica
archive_mode = on
archive_command = 'cp %p /backup/rdplan/wal/%f'
```

```bash
# Base-Backup erstellen
pg_basebackup -h localhost -U rdplan -D /backup/rdplan/base -Fp -Xs -P

# Recovery bis zu bestimmter Zeit
# Siehe PostgreSQL-Dokumentation
```

---

## 🧪 Testen der Installation

### **1. Connection-Test**

```bash
psql -h localhost -U rdplan -d rdplan -c "SELECT version();"
```

**Erwartete Ausgabe:**
```
                                           version                                            
----------------------------------------------------------------------------------------------
 PostgreSQL 16.x on x86_64-pc-linux-gnu, compiled by gcc (Debian 12.2.0-14) 12.2.0, 64-bit
```

### **2. Schema-Test**

```sql
-- Tabellen zählen
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';
-- Sollte ~20 Tabellen sein

-- Testdaten einfügen
INSERT INTO personnel (name, vorname, teilzeit, fahrzeugfuehrer, fahrzeugfuehrerHLFB)
VALUES ('Test', 'User', 100, 1, 0)
RETURNING id;

-- Wieder löschen
DELETE FROM personnel WHERE name = 'Test';
```

### **3. RD-Plan App-Test**

1. App mit PostgreSQL starten
2. Einstellungen öffnen → "Über"
3. Prüfe:
   - ✅ "Datenbank: PostgreSQL"
   - ✅ "Multi-User: Aktiv"
4. Erstelle Testperson
5. Öffne zweite App-Instanz auf anderem PC
6. Prüfe ob Testperson sichtbar ist

---

## 🐛 Troubleshooting

### **Problem: "Connection refused"**

**Ursachen:**
- PostgreSQL-Service läuft nicht
- Firewall blockiert Port 5432
- `listen_addresses` nicht konfiguriert

**Lösung:**
```bash
# Service prüfen
sudo systemctl status postgresql

# Service starten
sudo systemctl start postgresql

# Port prüfen
netstat -an | grep 5432

# Firewall (Ubuntu)
sudo ufw allow 5432/tcp
```

### **Problem: "password authentication failed"**

**Ursachen:**
- Falsches Passwort
- Benutzer existiert nicht
- `pg_hba.conf` verweigert Zugriff

**Lösung:**
```sql
-- Passwort zurücksetzen
ALTER USER rdplan WITH PASSWORD 'neues_passwort';
```

### **Problem: "too many connections"**

**Ursachen:**
- Connection-Pool zu groß konfiguriert
- PostgreSQL `max_connections` zu klein

**Lösung:**
```ini
# postgresql.conf
max_connections = 100  # Erhöhen

# RD-Plan db-config.json
{ "postgresConfig": { "max": 10 } }  # Verringern
```

### **Problem: Langsame Queries**

**Lösung:**
```sql
-- Query-Plan anzeigen
EXPLAIN ANALYZE SELECT * FROM duty_roster WHERE date = '2025-01-01';

-- Fehlende Indexe identifizieren
-- Siehe Performance-Optimierung oben
```

---

## 📞 Support & Weitere Hilfe

**PostgreSQL-Dokumentation:**
- https://www.postgresql.org/docs/16/

**RD-Plan GitHub:**
- https://github.com/powderk/rd-plan

**Docker PostgreSQL:**
- https://hub.docker.com/_/postgres

---

## ✅ Checkliste: Production-Ready

- [ ] PostgreSQL-Server installiert und läuft
- [ ] Sichere Passwörter gesetzt
- [ ] SSL/TLS aktiviert (bei Netzwerk-Betrieb)
- [ ] IP-Whitelisting konfiguriert
- [ ] Backup-Strategie implementiert (täglich)
- [ ] PITR konfiguriert (optional)
- [ ] Connection-Pool getestet
- [ ] Multi-User-Szenario getestet (2+ Benutzer gleichzeitig)
- [ ] Performance-Tests durchgeführt
- [ ] Monitoring eingerichtet (optional)

**Viel Erfolg mit RD-Plan + PostgreSQL! 🚀**
