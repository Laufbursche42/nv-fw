# Datenschutz

Diese Web-App ist so gebaut, dass deine Daten auf deinem Gerät bleiben. Dieser Text erklärt genau, was sie mit deinen Daten tut und was nicht.

## Kurzfassung

Die App sammelt nichts. Es gibt keine Konten, keine Analyse, keine Telemetrie, kein Tracking, keine Werbung, keine Cookies und keine Skripte von Dritten. Nichts wird jemals an den Entwickler gesendet.

## Welche Daten die App verarbeitet und wo sie bleiben

Alles Folgende bleibt auf deinem Gerät und wird nicht an dieses Projekt hochgeladen:

- Die Firmware-`.bin`, die du lädst. Sie wird komplett im Browser gelesen, gepatcht und neu versiegelt und nie hochgeladen.
- Live-Scooter-Daten, die über Bluetooth LE gelesen werden (die Seriennummer und das daraus abgeleitete Modell).
- Das Flash-Log auf dem Bildschirm. Es existiert nur in der offenen Seite während deiner Sitzung, wird nie gespeichert und nie hochgeladen.

## Netzwerkverbindungen

Die App stellt in zwei Fällen eine Netzwerkverbindung her:

- **Laden der Seite.** Beim Öffnen oder Neuladen holt dein Browser die statischen Dateien (`index.html`, `page.js`, `styles.css` und weitere) vom Host (zum Beispiel GitHub Pages). Der Host sieht nur deine **IP-Adresse** und welche Datei du angefragt hast, also die normalen Web-Server-Logs, die jede Website hat.
- **Herunterladen der Original-Firmware.** Wenn du auf Herunterladen tippst, öffnet die Seite die Firmware-URL des Herstellers in einem neuen Browser-Tab. Dieser Download ist eine normale Browser-Anfrage an den Datei-Host des Herstellers, der sie wie jeden anderen Download sieht. Die Seite selbst lädt oder leitet die Datei nicht weiter und schickt auch keine Scooter-Daten mit.

In keinem der Fälle werden Scooter-Daten, die Seriennummer oder dein gepatchtes Abbild an dieses Projekt gesendet.

## Bluetooth LE zum Scooter

Eine lokale Funkverbindung zu deinem Scooter über Web Bluetooth. Das ist keine Internetverbindung, dafür verlassen keine Daten dein Telefon über das Netz. Der Seriennummern-Lesevorgang, der Auth-Handshake und die Firmware-Übertragung laufen nur zwischen deinem Browser und dem Scooter.

## Kein Entwickler-Backend

Nichts wird jemals an den Entwickler gesendet. Es gibt kein Cloud-Konto und keinen von diesem Projekt betriebenen Server, der deine Daten empfängt. Die Firmware-Abbilder liegen beim Hersteller und nicht bei diesem Projekt. Du holst sie selbst, wenn du auf Herunterladen tippst.

## Kontakt

Bei Datenschutzfragen den Autor (Laufbursche) auf GitHub kontaktieren: https://github.com/Laufbursche42
