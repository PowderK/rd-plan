import csv
import sys

# CSV-Datei öffnen
with open('/Users/benni/RD-Plan/Mappe5.csv', 'r', encoding='cp1252') as file:
    reader = csv.reader(file, delimiter=';')
    rows = list(reader)

# Zeilen mit Namen finden (die mit Buchstaben in Spalte 1 beginnen)
names = []
for i, row in enumerate(rows):
    if len(row) > 1 and row[1] and any(char.isalpha() for char in row[1]) and row[1] not in ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember', 'Sa', 'Fr', 'So', 'Mo', 'Di', 'Mi', 'Do', '01.', '02.', '03.', '04.', '05.', '06.', '07.', '08.', '09.', '10.', '11.', '12.', '13.', '14.', '15.', '16.', '17.', '18.', '19.', '20.', '21.', '22.', '23.', '24.', '25.', '26.', '27.', '28.', '29.', '30.', '31.', 'SOLL', 'GES', 'T', 'N', 'NEF', 'Ka', '3', '2', '1', 'LFZ', 'K', 'RNS', 'RTS', 'RT!', 'RN!', 'US', '4W', '4T', '7T', '4N', '7N', 'NEF', 'A2', 'A3']:
        names.append((i, row[1]))

# Tage-Header finden (Zeile mit Tagen)
days_row = None
for i, row in enumerate(rows):
    if row and len(row) > 10 and '01.' in row:
        days_row = i
        break

if not days_row:
    sys.exit("Tage-Zeile nicht gefunden")

days = rows[days_row]

# Monate-Header finden
months_row = None
for i, row in enumerate(rows):
    if row and 'Januar' in row:
        months_row = i
        break

if not months_row:
    sys.exit("Monate-Zeile nicht gefunden")

months = rows[months_row]

# Kombiniere Monate und Tage zu Datums
dates = []
current_month = ''
for m, d in zip(months, days):
    if m:
        current_month = m
    if d and d != ';;;;;;;;;':
        dates.append(f"{current_month} {d}")

# Jetzt für jeden Tag die Zuweisungen sammeln
assignments = {date: {'RTW4': {'Tag': {'Fahrer': [], 'Maschinist': []}, 'Nacht': {'Fahrer': [], 'Maschinist': []}}, 'RTW7': {'Tag': {'Fahrer': [], 'Maschinist': []}, 'Nacht': {'Fahrer': [], 'Maschinist': []}}, 'NEF': {'Fahrer': []}} for date in dates}

for name_row, name in names:
    name_clean = name.replace('(Azubi)', '').strip()
    is_azubi = '(Azubi)' in name
    row = rows[name_row]
    for col, cell in enumerate(row[1:], 1):  # Spalten ab 1
        if col < len(dates) + 1:
            date = dates[col - 1] if col - 1 < len(dates) else None
            if date and cell:
                shift = cell.strip()
                if shift == '4T':
                    if is_azubi:
                        assignments[date]['RTW4']['Tag']['Maschinist'].append(name_clean)
                    else:
                        assignments[date]['RTW4']['Tag']['Fahrer'].append(name_clean)
                elif shift == '4N':
                    if is_azubi:
                        assignments[date]['RTW4']['Nacht']['Maschinist'].append(name_clean)
                    else:
                        assignments[date]['RTW4']['Nacht']['Fahrer'].append(name_clean)
                elif shift == '7T':
                    if is_azubi:
                        assignments[date]['RTW7']['Tag']['Maschinist'].append(name_clean)
                    else:
                        assignments[date]['RTW7']['Tag']['Fahrer'].append(name_clean)
                elif shift == '7N':
                    if is_azubi:
                        assignments[date]['RTW7']['Nacht']['Maschinist'].append(name_clean)
                    else:
                        assignments[date]['RTW7']['Nacht']['Fahrer'].append(name_clean)
                elif shift == 'NEF':
                    assignments[date]['NEF']['Fahrer'].append(name_clean)

# Ausgabe im gewünschten Format
for date in dates:
    if any(assignments[date][veh][shift][role] for veh in ['RTW4', 'RTW7', 'NEF'] for shift in ['Tag', 'Nacht'] if shift in assignments[date][veh] for role in assignments[date][veh][shift]):
        print(f"Datum: {date}")
        print("RTW 4")
        print(f"Fahrzeugführer Tag / Fahrzeugführer Nacht: {' / '.join(assignments[date]['RTW4']['Tag']['Fahrer'])} / {' / '.join(assignments[date]['RTW4']['Nacht']['Fahrer'])}")
        print(f"Maschinist Tag / Maschinist Nacht: {' / '.join(assignments[date]['RTW4']['Tag']['Maschinist'])} / {' / '.join(assignments[date]['RTW4']['Nacht']['Maschinist'])}")
        print("RTW 7")
        print(f"Fahrzeugführer Tag / Fahrzeugführer Nacht: {' / '.join(assignments[date]['RTW7']['Tag']['Fahrer'])} / {' / '.join(assignments[date]['RTW7']['Nacht']['Fahrer'])}")
        print(f"Maschinist Tag / Maschinist Nacht: {' / '.join(assignments[date]['RTW7']['Tag']['Maschinist'])} / {' / '.join(assignments[date]['RTW7']['Nacht']['Maschinist'])}")
        print("NEF")
        print(f"Fahrzeugführer: {' / '.join(assignments[date]['NEF']['Fahrer'])}")
        print()