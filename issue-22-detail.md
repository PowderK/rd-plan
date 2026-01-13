## Detaillierte Beschreibung

### Übersicht

Implementierung eines Kommentar-Systems für den Dienstplan mit zwei Ebenen:
1. **Persönliche Kommentare**: Kollegen können Notizen zu ihren eigenen Diensten hinterlegen
2. **Globale Kommentare**: Allgemeine Hinweise für alle Kollegen an einem bestimmten Tag

### Anwendungsfälle

**Persönliche Kommentare:**
- "Keine Nachtschicht heute" (bei gesundheitlichen Einschränkungen)
- "Früher Feierabend benötigt" (private Termine)
- "Bereitschaft für Überstunden" (flexible Verfügbarkeit)
- "Fahrzeugführer-Qualifikation läuft ab" (Erinnerung)

**Globale Kommentare:**
- "Betriebsversammlung 14:00 Uhr" (alle betroffen)
- "Wartung RTW 1 - nicht verfügbar" (Fahrzeugausfall)
- "Neujahr - reduzierte Besetzung" (Feiertags-Hinweise)
- "Großveranstaltung in der Stadt" (erhöhtes Einsatzaufkommen)

## Anforderungen

### Datenmodell

**Tabelle 1: Persönliche Kommentare** (`roster_comments_personal`)

```sql
CREATE TABLE roster_comments_personal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  date TEXT NOT NULL, -- ISO format: YYYY-MM-DD
  comment TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT, -- Personalnummer des Erstellers
  updated_at TEXT,
  FOREIGN KEY(person_id) REFERENCES personnel(id) ON DELETE CASCADE,
  UNIQUE(person_id, date) -- Pro Person/Tag nur ein Kommentar
);

CREATE INDEX idx_roster_comments_personal_date ON roster_comments_personal(date);
CREATE INDEX idx_roster_comments_personal_person ON roster_comments_personal(person_id);
```

**Tabelle 2: Globale Kommentare** (`roster_comments_global`)

```sql
CREATE TABLE roster_comments_global (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL, -- ISO format: YYYY-MM-DD
  comment TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT, -- Personalnummer des Erstellers
  updated_at TEXT,
  UNIQUE(date) -- Pro Tag nur ein globaler Kommentar
);

CREATE INDEX idx_roster_comments_global_date ON roster_comments_global(date);
```

## UI-Implementierung

### 1. Kontextmenü (Rechtsklick)

**Im Dienstplan-Grid:**

#### Rechtsklick auf Datum-Zelle (Spaltenheader):
```
┌─────────────────────────────────┐
│ ✏️  Globaler Kommentar...       │
│ 📝 Globalen Kommentar bearbeiten│ (nur wenn vorhanden)
│ 🗑️  Globalen Kommentar löschen  │ (nur wenn vorhanden)
└─────────────────────────────────┘
```

#### Rechtsklick auf Personen-Zeile (bei einem Tag):
```
┌─────────────────────────────────┐
│ 💬 Kommentar hinzufügen...      │
│ ✏️  Kommentar bearbeiten         │ (nur wenn vorhanden)
│ 🗑️  Kommentar löschen            │ (nur wenn vorhanden)
│ ───────────────────────────────  │
│ 📅 Dienst ändern...              │ (bestehende Funktionen)
│ ...                              │
└─────────────────────────────────┘
```

### 2. Kommentar-Dialog

**Dialog für persönlichen Kommentar:**
```
┌──────────────────────────────────────────┐
│ Kommentar für Müller am 15.01.2026      │
├──────────────────────────────────────────┤
│                                          │
│ Kommentar:                               │
│ ┌──────────────────────────────────────┐│
│ │Keine Nachtschicht - Arzttermin       ││
│ │morgens                               ││
│ │                                      ││
│ └──────────────────────────────────────┘│
│                                          │
│ Max. 200 Zeichen: 32/200                │
│                                          │
│         [Abbrechen]  [Speichern]        │
└──────────────────────────────────────────┘
```

**Dialog für globalen Kommentar:**
```
┌──────────────────────────────────────────┐
│ Globaler Kommentar für 15.01.2026       │
├──────────────────────────────────────────┤
│                                          │
│ Dieser Kommentar ist für alle sichtbar  │
│                                          │
│ Kommentar:                               │
│ ┌──────────────────────────────────────┐│
│ │Betriebsversammlung 14:00 Uhr         ││
│ │Alle Schichten enden spätestens 13:30││
│ │                                      ││
│ └──────────────────────────────────────┘│
│                                          │
│ Max. 300 Zeichen: 67/300                │
│                                          │
│         [Abbrechen]  [Speichern]        │
└──────────────────────────────────────────┘
```

### 3. Anzeige im Dienstplan

**Visuelle Indikatoren:**

#### Datums-Spalte (Header) mit globalem Kommentar:
```
┌─────────────┐
│ 15.01  🌐   │  ← Globaler Kommentar vorhanden (Weltkugel-Symbol)
│ Mo          │
└─────────────┘
```

#### Zeilen-Zelle mit persönlichem Kommentar:
```
┌─────────────┐
│ FD   💬     │  ← Persönlicher Kommentar (Sprechblase)
└─────────────┘
```

#### Beide Kommentare gleichzeitig:
```
┌─────────────┐
│ 15.01  🌐   │  ← Globaler Kommentar im Header
│ Mo          │
└─────────────┘
  ↓
┌─────────────┐
│ FD   💬     │  ← Persönlicher Kommentar in der Zeile
└─────────────┘
```

### 4. Tooltip (Hover)

**Bei globalem Kommentar (Datum-Header):**
```
┌────────────────────────────────────┐
│ 🌐 Globaler Hinweis für 15.01.26  │
│────────────────────────────────────│
│ Betriebsversammlung 14:00 Uhr     │
│ Alle Schichten enden spätestens   │
│ 13:30                              │
│                                    │
│ Erstellt: 10.01.26 von Admin      │
└────────────────────────────────────┘
```

**Bei persönlichem Kommentar:**
```
┌────────────────────────────────────┐
│ 💬 Kommentar von Müller            │
│────────────────────────────────────│
│ Keine Nachtschicht - Arzttermin   │
│ morgens                            │
│                                    │
│ Erstellt: 10.01.26                │
└────────────────────────────────────┘
```

**Bei beiden Kommentaren:**
```
┌────────────────────────────────────┐
│ 🌐 Globaler Hinweis                │
│────────────────────────────────────│
│ Betriebsversammlung 14:00 Uhr     │
│                                    │
│ 💬 Kommentar von Müller            │
│────────────────────────────────────│
│ Keine Nachtschicht - Arzttermin   │
│                                    │
│ Erstellt: 10.01.26                │
└────────────────────────────────────┘
```

## Berechtigungen

### Persönliche Kommentare
- **Schreibrecht "Dienstplan"**: Kann Kommentare für alle Personen erstellen/bearbeiten/löschen
- **Leserecht "Dienstplan"**: Kann nur eigene Kommentare erstellen/bearbeiten/löschen
- **Sichtbarkeit**: Alle können alle persönlichen Kommentare sehen (wichtig für Koordination)

### Globale Kommentare
- **Schreibrecht "Dienstplan"**: Kann globale Kommentare erstellen/bearbeiten/löschen
- **Leserecht "Dienstplan"**: Kann globale Kommentare nur lesen
- **Sichtbarkeit**: Für alle sichtbar

### Freigabe-Status Prüfung

**Wichtig**: Bevor ein Kommentar hinzugefügt/bearbeitet werden kann, muss geprüft werden, ob die Einteilung für den betroffenen Monat bereits freigegeben wurde.

**Verhalten bei freigegebener Einteilung:**

```
┌─────────────────────────────────────────┐
│ ⚠️  Einteilung bereits freigegeben      │
├─────────────────────────────────────────┤
│                                         │
│ Die Einteilung für Januar 2026 wurde   │
│ bereits freigegeben.                    │
│                                         │
│ Änderungen an Kommentaren sind nicht   │
│ mehr möglich.                           │
│                                         │
│ Bitte wenden Sie sich an den Einteiler,│
│ wenn Änderungen erforderlich sind.      │
│                                         │
│              [OK]                       │
└─────────────────────────────────────────┘
```

**Implementierung:**

```typescript
// Vor dem Öffnen des Kommentar-Dialogs prüfen
const canAddComment = async (date: string) => {
  const year = new Date(date).getFullYear();
  const month = new Date(date).getMonth();
  
  // Lade Freigabe-Status
  const isReleased = await window.api.getSetting(`roster_released_${year}_${month}`);
  
  if (isReleased === '1') {
    // Zeige Warnung
    showDialog({
      type: 'warning',
      title: 'Einteilung bereits freigegeben',
      message: `Die Einteilung für ${monthNames[month]} ${year} wurde bereits freigegeben.\n\n` +
               'Änderungen an Kommentaren sind nicht mehr möglich.\n\n' +
               'Bitte wenden Sie sich an den Einteiler, wenn Änderungen erforderlich sind.',
      buttons: ['OK']
    });
    return false;
  }
  
  return true;
};

// Verwendung im Kontextmenü
const handleAddComment = async (personId, date) => {
  if (!await canAddComment(date)) {
    return; // Abbrechen wenn freigegeben
  }
  
  // Dialog öffnen...
};
```

**Ausnahmen:**
- **Administrator/Schreibrecht "Einteilung"**: Können auch nach Freigabe Kommentare bearbeiten (für Notfall-Korrekturen)
- **Leserecht**: Sperre gilt für alle Benutzer ohne Schreibrecht "Einteilung"

## Technische Implementierung

### Backend (main/)

**database.ts - Neue Funktionen:**
```typescript
// Persönliche Kommentare
async addPersonalComment(personId: number, date: string, comment: string, createdBy: string)
async updatePersonalComment(id: number, comment: string)
async deletePersonalComment(id: number)
async getPersonalCommentsForMonth(year: number, month: number): Promise<Comment[]>
async getPersonalCommentForPersonDate(personId: number, date: string): Promise<Comment | null>

// Globale Kommentare
async addGlobalComment(date: string, comment: string, createdBy: string)
async updateGlobalComment(id: number, comment: string)
async deleteGlobalComment(id: number)
async getGlobalCommentsForMonth(year: number, month: number): Promise<Comment[]>
async getGlobalCommentForDate(date: string): Promise<Comment | null>
```

**main.ts - IPC-Handler:**
```typescript
ipcMain.handle('roster-comment-personal-add', async (_, personId, date, comment) => {...})
ipcMain.handle('roster-comment-personal-update', async (_, id, comment) => {...})
ipcMain.handle('roster-comment-personal-delete', async (_, id) => {...})
ipcMain.handle('roster-comment-personal-get-month', async (_, year, month) => {...})

ipcMain.handle('roster-comment-global-add', async (_, date, comment) => {...})
ipcMain.handle('roster-comment-global-update', async (_, id, comment) => {...})
ipcMain.handle('roster-comment-global-delete', async (_, id) => {...})
ipcMain.handle('roster-comment-global-get-month', async (_, year, month) => {...})
```

### Frontend (renderer/)

**components/DutyRoster.tsx:**
```typescript
// State für Kommentare
const [personalComments, setPersonalComments] = useState<Map<string, Comment>>(new Map());
const [globalComments, setGlobalComments] = useState<Map<string, Comment>>(new Map());

// Laden der Kommentare
useEffect(() => {
  loadCommentsForMonth(year, currentMonth);
}, [year, currentMonth]);

// Kontextmenü-Handler
const handleRightClickDate = (e: MouseEvent, date: string) => {
  showContextMenu(e, 'date', date);
};

const handleRightClickCell = (e: MouseEvent, personId: number, date: string) => {
  showContextMenu(e, 'cell', { personId, date });
};

// Kommentar-Icons rendern
const renderCommentIndicator = (personId: number, date: string) => {
  const key = `${personId}_${date}`;
  const hasComment = personalComments.has(key);
  return hasComment ? <span className="comment-icon">💬</span> : null;
};

const renderGlobalCommentIndicator = (date: string) => {
  const hasComment = globalComments.has(date);
  return hasComment ? <span className="global-comment-icon">🌐</span> : null;
};
```

**Neue Komponente: CommentDialog.tsx**
```tsx
interface CommentDialogProps {
  type: 'personal' | 'global';
  personName?: string;
  date: string;
  existingComment?: string;
  onSave: (comment: string) => void;
  onClose: () => void;
}

const CommentDialog: React.FC<CommentDialogProps> = ({...}) => {
  const [comment, setComment] = useState(existingComment || '');
  const maxLength = type === 'global' ? 300 : 200;
  
  return (
    <div className="comment-dialog">
      <h3>{type === 'global' ? 'Globaler Kommentar' : `Kommentar für ${personName}`}</h3>
      <textarea 
        value={comment}
        onChange={e => setComment(e.target.value)}
        maxLength={maxLength}
        rows={4}
      />
      <div>{comment.length}/{maxLength} Zeichen</div>
      <button onClick={() => onSave(comment)}>Speichern</button>
      <button onClick={onClose}>Abbrechen</button>
    </div>
  );
};
```

**Neue Komponente: CommentTooltip.tsx**
```tsx
interface CommentTooltipProps {
  personalComment?: Comment;
  globalComment?: Comment;
}

const CommentTooltip: React.FC<CommentTooltipProps> = ({...}) => {
  return (
    <div className="comment-tooltip">
      {globalComment && (
        <div className="global-comment-section">
          <div className="header">🌐 Globaler Hinweis</div>
          <div className="content">{globalComment.comment}</div>
          <div className="meta">Erstellt: {formatDate(globalComment.created_at)} von {globalComment.created_by}</div>
        </div>
      )}
      {personalComment && (
        <div className="personal-comment-section">
          <div className="header">💬 Kommentar von {personalComment.personName}</div>
          <div className="content">{personalComment.comment}</div>
          <div className="meta">Erstellt: {formatDate(personalComment.created_at)}</div>
        </div>
      )}
    </div>
  );
};
```

## CSS-Styling

```css
.comment-icon {
  font-size: 12px;
  margin-left: 4px;
  opacity: 0.7;
  cursor: help;
}

.global-comment-icon {
  font-size: 14px;
  margin-left: 4px;
  opacity: 0.8;
  cursor: help;
}

.comment-tooltip {
  max-width: 350px;
  padding: 12px;
  background: white;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  font-size: 13px;
}

.comment-tooltip .header {
  font-weight: 600;
  margin-bottom: 6px;
  color: #374151;
}

.comment-tooltip .content {
  margin-bottom: 8px;
  line-height: 1.4;
  white-space: pre-wrap;
}

.comment-tooltip .meta {
  font-size: 11px;
  color: #6b7280;
  font-style: italic;
}

.global-comment-section {
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.comment-dialog {
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 8px 16px rgba(0,0,0,0.15);
  min-width: 400px;
}

.comment-dialog textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
}
```

## Betroffene Komponenten

- **main/database.ts** - Neue Tabellen und CRUD-Funktionen
- **main/database-manager.ts** - Implementierung der Kommentar-Operationen
- **main/main.ts** - 8 neue IPC-Handler
- **renderer/components/DutyRoster.tsx** - Kontextmenü, Icons, Tooltips
- **Neue Komponente**: CommentDialog.tsx
- **Neue Komponente**: CommentTooltip.tsx
- **renderer/styles/** - CSS für Kommentar-UI

## Migration

```sql
-- Ausführen beim Update
CREATE TABLE IF NOT EXISTS roster_comments_personal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  updated_at TEXT,
  FOREIGN KEY(person_id) REFERENCES personnel(id) ON DELETE CASCADE,
  UNIQUE(person_id, date)
);

CREATE TABLE IF NOT EXISTS roster_comments_global (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  updated_at TEXT,
  UNIQUE(date)
);

CREATE INDEX IF NOT EXISTS idx_roster_comments_personal_date ON roster_comments_personal(date);
CREATE INDEX IF NOT EXISTS idx_roster_comments_personal_person ON roster_comments_personal(person_id);
CREATE INDEX IF NOT EXISTS idx_roster_comments_global_date ON roster_comments_global(date);
```

## Vorteile

✅ **Bessere Kommunikation**: Wichtige Hinweise direkt im Dienstplan sichtbar
✅ **Transparenz**: Alle sehen relevante Informationen auf einen Blick
✅ **Flexibilität**: Persönliche und globale Kommentare für verschiedene Szenarien
✅ **Einfache Bedienung**: Rechtsklick-Kontextmenü ist intuitiv
✅ **Historie**: Kommentare werden mit Ersteller und Zeitstempel gespeichert
✅ **Platzsparend**: Icons statt großer Textfelder im Grid

## Offene Fragen

1. **Benachrichtigungen**: Sollen Benutzer über neue globale Kommentare benachrichtigt werden?
2. **Historie**: Soll es eine Übersicht aller Kommentare geben (Archiv)?
3. **Export**: Sollen Kommentare im Excel-Export mit aufgenommen werden?
4. **Mehrsprachigkeit**: Icons sind universell, aber Tooltips könnten übersetzt werden
5. **Mobile**: Wie werden Kommentare auf Touch-Geräten angezeigt (kein Hover)?
