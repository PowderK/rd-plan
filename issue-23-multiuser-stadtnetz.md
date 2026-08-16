# Issue 023: Multiuser-Fähigkeit im Stadtnetz (Netzlaufwerk & App-Level Locking)

## Beschreibung & Zielstellung

Ermöglichung der **Multiuser-Nutzung (parallele Dienstplanung)** in Umgebungen mit strikten Gruppenrichtlinien (GPOs, Stadtnetz, Firewall-Sperren, AppLocker, keine Admin-Rechte).

Da in Behörden/Stadtnetzen eigene Serverdienste oder offene Webserver-Ports auf lokalen PCs per GPO blockiert werden, erfolgt der Betrieb über ein gemeinsames Netzlaufwerk (`\\stadt-server\freigabe\RD-Plan\`).

## Vorgeschlagene Architektur (GPO-konform)

### Phase 1: Zentrale SQLite auf Netzlaufwerk mit Abteilungs-Locking
- Die `rd-plan.db` wird auf einer freigegebenen Netzwerkressource hinterlegt.
- Konfiguration des SQLite-Treibers mit `busy_timeout` (z. B. 10.000 ms).
- **App-Level Locking**: Beim Bearbeiten einer Abteilung im Dienstplan wird eine temporäre Sperre gesetzt (z. B. `Abteilung 1 gesperrt von Herr Müller (PC-04) bis 12:30 Uhr`), um zeitgleiche Schreibkonflikte zu verhindern. Andere Nutzer können währenddessen lesen.

### Phase 2 (Optional): Delta-Sync über Netzlaufwerk-Change-Logs
- Lokale SQLite-Datenbank auf jedem Client für maximale Performance und Offline-Fähigkeit.
- Änderungen werden als kleine JSON-Transaktionsdateien in einen `\sync\`-Ordner auf dem Netzlaufwerk geschrieben und periodisch von den Clients angewendet.

## Anforderungen

- [ ] Einstellungen-Erweiterung: Auswahl des Datenbankpfads (Lokal vs. Netzlaufwerk)
- [ ] Implementierung von `busy_timeout` & Verbindungs-Resilienz für SMB-Netzlaufwerke
- [ ] Implementierung der Abteilungs-Sperrlogik (Sperre setzen, verlängern, freigeben)
- [ ] Visueller Hinweis im Header/Statusleiste bei aktiver Sperre anderer Nutzer
