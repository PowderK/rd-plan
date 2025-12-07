## Plan: Rechte, Rollen, Verschlüsselung & Multi-Instanz für RD-Plan

Ziel: Sichere, rollenbasierte Nutzerverwaltung, verschlüsselte Datenhaltung und flexible Multi-Instanz-Fähigkeit – kompatibel mit portabler SQLite-Architektur und späteren Server-Optionen.

---

### 1. Rollenmodell & Rechte

- **admin**: Vollzugriff (alle Einstellungen, Nutzerverwaltung, Dienstplan, Passwort-Reset)
- **planer**: Schreibrechte für Dienstplan/Einteilung, keine Systemverwaltung
- **user**: Nur Leserechte (Dienstplan/Einteilung)

---

### 2. Nutzerverwaltung

- Tabelle `users` (id, username, password_hash, role, created_at, last_login)
- Passwort-Hashing (z.B. bcrypt)
- Login-Dialog, Session-Handling
- Default-Admin anlegen, bestehende Nutzer als `user` importieren
- Optional: Gast-Anmeldung (nur Leserechte)

---

### 3. Rechteprüfung & UI

- Utility-Funktionen für Rollenabfrage und Rechteprüfung (`hasRole`, `canEditDutyRoster`, ...)
- UI/UX: Buttons und Editierfunktionen rollenbasiert ein-/ausblenden

---

### 4. Passwort-Reset-Mechanismus (nur Admin)

- Admin kann für jeden User ein neues Passwort setzen (UI + DB-Update)
- Optional: Zwangs-Reset beim nächsten Login
- Logging/Audit für Passwort-Resets

---

### 5. Datenbank-Verschlüsselung

- Evaluierung: `better-sqlite3` mit `sqlcipher`-Support (z.B. via `better-sqlite3-with-crypto`)
- Setup: Passwortabfrage beim Start, Key-Management
- Integration mit OS Keychain (z.B. `keytar` für Windows/macOS/Linux)
- Fallback: Passwort-Eingabe beim Start, temporär im Speicher
- Option: Passwort-Änderung durch Admin
- Migration: Option zur Verschlüsselung bestehender Datenbanken

---

### 6. Multi-Instanz-Fähigkeit

- Tabelle `departments` (id, name, ...)
- User-zu-Instanz-Zuordnung (z.B. `user_departments`)
- User kann mehreren Abteilungen zugeordnet werden
- UI: Instanz-Auswahl beim Login, Filterung der Daten pro Instanz
- Migrationspfad für bestehende Datenbanken (Single- → Multi-Instanz)

---

### 7. Lock-File-System (Schreibzugriffsschutz)

- Lock-Datei beim Start, User-Info speichern (Name, PC, Zeitstempel)
- Lock-Prüfung bei Start mit Dialog (wer hält den Lock, wie lange, Option „Warten“/„Trotzdem öffnen“/„Abbrechen“)
- Stale-Lock-Erkennung (z.B. nach Absturz)
- Auto-Cleanup beim Beenden
- Heartbeat zur Aktualisierung des Locks

---

### 8. Dokumentation & Sicherheitshinweise

- Hinweise zu Verschlüsselung, Passwort-Backup, Keychain-Nutzung
- Admin-Guide für Passwort-Reset und Instanzverwaltung
- Empfehlungen für sichere Passwörter und Backup-Strategien
- Recovery-Optionen bei verlorenem Verschlüsselungs-Passwort (Warnhinweise!)

---

### Weitere Überlegungen

- Logging/Audit für sicherheitsrelevante Aktionen (Passwort-Reset, Instanzwechsel)
- Optionale Gast-Anmeldung (nur Leserechte)
- Spätere Erweiterung für Serverbetrieb/PostgreSQL möglich

---
