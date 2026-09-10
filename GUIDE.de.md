# Anleitung

Schritt für Schritt durch das Laufbursche NAVEE Firmware-Werkzeug. Die Seite baut aus der Original-Firmware deines NAVEE-Scooters eine getunte Version und schreibt sie per Web Bluetooth zurück - alles auf deinem Gerät. Es werden keine Daten an einen Server gesendet.

## Was du brauchst

- Einen NAVEE-Scooter. Einschalten und in wenigen Metern Reichweite halten.
- Ein iPhone oder iPad mit dem Browser **Bluefy** (Safari kann kein Web Bluetooth). Android-Nutzer nehmen den Patcher in der [nv-lb-edition](https://github.com/Laufbursche42/nv-lb-edition) Android-App statt dieser Seite.
- Bluetooth eingeschaltet.

## Für welche Modelle

Die Seite ist für alle NAVEE-Modelle gedacht. Aktuell ist der **NT5 Max** das Modell im Test. Nach und nach kommen Patches für weitere Modelle dazu. Verbinden und Herunterladen funktionieren schon über die ganze Linie. Der Patch-Schritt erkennt derzeit die Meter- und Controller-Abbilder des NT5 Max.

## Schritt für Schritt

### 1. Verbinden

Auf *Scooter verbinden* tippen und deinen Scooter im Dialog auswählen. Er erscheint unter seinem Namen (NAVEE...), genau wie in der offiziellen App. Die Seite authentifiziert sich direkt nach dem Verbinden und liest die Seriennummer, um daraus das Modell zu erkennen. Eine Konto-Eingabe ist nicht nötig - die Authentifizierung nutzt wie die native App einen Zufallsschlüssel beim ersten Verbinden.

### 2. Original-Firmware herunterladen

Für das erkannte Modell listet die Seite die passenden Original-Abbilder: Display (Meter), Controller (BLDC) und der Akku (BMS), sofern vorhanden. Auf *Herunterladen* tippen - der Download öffnet in einem neuen Tab, weil die Seite die Datei aus CORS-Gründen nicht selbst laden darf. Speichere die `.bin`, die du patchen willst (Meter für Kickstart und Tempomat, Controller für die Entdrosselung).

Gibt es für dein Modell zwei Firmware-Stände, wähle zuerst die Variante nach der Controller-Firmware-Version, die dein Scooter anzeigt.

### 3. Laden und patchen

Die gespeicherte `.bin` unten im Bereich *Firmware laden und patchen* auswählen. Die Seite erkennt die Variante selbst und wendet nur die passenden Patches an. Eine falsche oder schon gepatchte Datei wird abgelehnt, nicht beschädigt. Danach zeigt sie die erkannte Variante und die gesetzten Patches.

### 4. Speichern oder flashen

Entweder *Gepatchte Firmware speichern* für ein eigenes Backup oder direkt weiter zum Flashen.

### 5. Auf den Scooter flashen

Der Flash-Bereich zeigt die gepatchte Datei. Setze den Haken, dass du dein eigenes Gerät auf eigenes Risiko flashst, dann wird *Flashen* frei. Während der Übertragung: Display an, Browser im Vordergrund, Scooter eingeschaltet und nah am Telefon. Der Fortschrittsbalken und das Log zeigen den Verlauf.

Ein Abbruch mitten in der Übertragung ist unkritisch - der Scooter übernimmt ein Abbild erst nach vollständiger Prüfung und verwirft ein unfertiges.

## Fehlersuche

- **Der Scooter fehlt im Dialog.** Sicherstellen, dass er an und nah ist und Bluetooth aktiv ist.
- **Fehler 255 beim Verbinden oder Flashen.** Der Scooter ist an ein Konto gebunden und lehnt den Zufallsschlüssel ab. Ein ungebundener Scooter wird ohne Weiteres angenommen.
- **Die Datei wird abgelehnt.** Dann ist es keine passende Original-.bin oder sie ist schon gepatcht. Lade das frische Original für dein Modell erneut herunter.
- **Der Flash bricht ab.** Verbindung stabil halten (Display an, Browser vorn, nah am Telefon) und erneut versuchen. Der Scooter bleibt lauffähig, solange kein vollständig geprüftes Abbild übernommen wurde.

## Datenschutz und Recht

Alles läuft lokal über Bluetooth. Siehe [Datenschutz](PRIVACY.de.md). Das Flashen einer veränderten Firmware und das Anheben der Geschwindigkeit heben die ABE auf, der Betrieb auf öffentlichen Wegen ist dann nicht erlaubt. Nutzung nur am eigenen Fahrzeug auf privatem Gelände. Siehe den [Haftungsausschluss](#) im Fuß der Seite.
