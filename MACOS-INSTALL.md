# RD-Plan auf macOS installieren

## Problem: "App ist beschädigt und kann nicht geöffnet werden"

Da die App nicht mit einem Apple Developer-Zertifikat signiert ist, zeigt macOS diese Fehlermeldung an.

## Lösung

### Option 1: Quarantäne-Attribut entfernen (Empfohlen)

Öffne das Terminal und führe folgenden Befehl aus:

```bash
xattr -cr /Applications/RD-Plan.app
```

Oder falls die App noch im Downloads-Ordner ist:

```bash
xattr -cr ~/Downloads/RD-Plan.app
```

### Option 2: Systemeinstellungen

1. Versuche die App zu öffnen (es erscheint die Fehlermeldung)
2. Gehe zu **Systemeinstellungen** → **Datenschutz & Sicherheit**
3. Scrolle nach unten zu "Sicherheit"
4. Klicke auf **"Trotzdem öffnen"** neben der RD-Plan-Nachricht
5. Bestätige mit **"Öffnen"**

### Option 3: Terminal-Befehl beim ersten Start

```bash
open /Applications/RD-Plan.app
```

Dann Option 2 befolgen.

## Installation

1. Lade die `.dmg` Datei herunter
2. Öffne die `.dmg` Datei
3. Ziehe "RD-Plan.app" in den Programme-Ordner
4. Führe **Option 1** aus (Quarantäne entfernen)
5. Starte RD-Plan aus dem Programme-Ordner

## Hinweis für Entwickler

Um eine signierte App zu erstellen, wird ein Apple Developer Account benötigt ($99/Jahr).
