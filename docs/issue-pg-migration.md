# Migration der Datenbank auf PostgreSQL für besseren Multiuser-Betrieb

## Hintergrund
Der aktuelle Storage erschwert gleichzeitige Zugriffe mehrerer Nutzer. Für belastbare Multiuser-Fähigkeit (gleichzeitiges Planen, Konfliktauflösung, Performance) soll auf PostgreSQL migriert werden.

## Ziele
- PostgreSQL als zentrale DB für Stammdaten, Dienstpläne und Metadaten
- Gleichzeitige Bearbeitung ohne Datenverlust, robuste Konfliktbehandlung
- Saubere Migrations- und Rollback-Strategie
- Docker/Docker-Compose Bereitstellung und .env-basierte Konfiguration

## Nicht-Ziele
- Umfassende Benutzer-/Rollenverwaltung (separates Feature)
- UI/UX-Umbauten jenseits technischer Anpassungen

## Vorgehen (Proposed Approach)
- DB: PostgreSQL 15+ (Docker-Compose, persistentes Volume)
- Access Layer: Prisma (Alternative: pg/Drizzle) – Migrations-Tooling inklusive
- Migrations: Prisma Migrate, Seed-Skripte für Basisdaten
- Schema (Skizze):
  - personnel(id, name, vorname, teilzeit, fahrzeugfuehrer_hlfb, …)
  - azubis(id, name, vorname, lehrjahr, …)
  - doctors(id, name, …)
  - vehicles_rtw(id, name), vehicles_nef(id, name, occupancy_mode)
  - vehicle_activations(vehicle_id, month, year, enabled, type=[rtw|nef])
  - shift_types(id, code, description, auswertung)
  - dept_patterns(id, start_date, pattern_csv, department)
  - itw_patterns(id, start_date, pattern_csv)
  - holidays(date, name)
  - settings(key, value)
  - duty_roster(
      id, person_type enum('person','azubi','doctor'),
      person_id, date, value, type, updated_at, version int,
      unique(person_type, person_id, date)
    )
- Concurrency & Transaktionen
  - Optimistic Locking über version/updated_at im duty_roster
  - assignSlot: Transaktion + Konflikterkennung (SELECT … FOR UPDATE oder Optimistic-Check)
  - Eindeutigkeit: unique(person_type, person_id, date)
- Indexierung
  - duty_roster(date), duty_roster(person_type, person_id, date), duty_roster(type)
  - vehicle_activations(vehicle_id, year, month)
- App-Integration
  - Data-Access-Layer in main/database*.ts auf Prisma/PG umstellen
  - IPC-Contracts beibehalten, Implementierung auf PG heben
  - Feature-Flag: wenn DATABASE_URL gesetzt → PG; sonst Fallback (sanfter Rollout)
- Datenmigration
  - Export aus aktuellem Storage; One-shot Importer zum Befüllen von PG
  - Integritätschecks nach Import (Counts, Stichproben)
- Deployment & Ops
  - docker-compose.yml (postgres, Volume, optional pgAdmin)
  - .env: DATABASE_URL, PG*
  - Backups: tägliches Dump-Skript + Restore-Anleitung
- Tests
  - Integrationstests (assignSlot, Parallelzugriffe, Konfliktfall)
  - Smoke-Tests: Migrationslauf, Start/Stop DB
- Rollout
  - Stufe 1: PG parallel, Import, Read-Only Preview
  - Stufe 2: Feature-Flag auf PG Write, Monitoring
  - Backout: Flag zurücksetzen

## Akzeptanzkriterien
- Gleichzeitiges Planen (2+ User) ohne Datenverlust; Konflikte werden sauber gemeldet
- Fachliche Ergebnisse (Soll/Ist/Rest) bleiben konsistent zu vorher
- assignSlot p95 < 150 ms lokal
- Migration-Skript importiert Bestandsdaten fehlerfrei (Stichproben + Counts)
- `docker-compose up` startet App mit PG (Migration/Seed läuft durch)

## ToDo
- [ ] ORM auswählen und einrichten (Prisma + prisma/schema.prisma)
- [ ] Schema modellieren, Migrations anlegen
- [ ] Data-Access-Layer in main/database*.ts auf PG umstellen
- [ ] IPC-Handler beibehalten, Implementierung anpassen
- [ ] assignSlot: Transaktionen + Locking/Optimistic Locking
- [ ] Indexe und Constraints ergänzen
- [ ] Datenimporter schreiben (Export → PG)
- [ ] docker-compose + .env anlegen, README aktualisieren
- [ ] Integrationstests (Konfliktfall, Parallelzugriff, Performance)
- [ ] Rollout-Plan und Backout-Doku ergänzen

## Risiken & Mitigation
- Datenkonsistenz beim Import → Validierung, Trockenlauf, Backups
- Performance-Regression → Indizes, Explain-Analyse, ggf. Pooling
- Parallel-Konflikte → Optimistic Locking + klare Client-Fehler
- Betriebsaufwand → Docker-Compose, Skripte für Backup/Restore

## Aufwand (grob)
- 3–5 Tage Implementierung + 1–2 Tage Test/Rollout (abhängig von Datenlage)