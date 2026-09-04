# Privacy Policy

This web app is built to keep your data on your device. This policy explains exactly what it does and does not do with your data.

## The short version

The app collects nothing. There are no accounts, no analytics, no telemetry, no tracking, no ads, no cookies and no third-party scripts. Nothing is ever sent to the developer.

## What data the app handles - and where it stays

All of the following stays on your device and is never uploaded to this project:

- The firmware `.bin` you load. It is read, patched and resealed entirely in the browser and is never uploaded.
- Live scooter data read over Bluetooth LE (the serial number and the model derived from it).
- The on-screen flash log. It exists only in the open page during your session, is never stored and is never uploaded.

## Network connections

The app makes a network connection in two cases:

- **Loading the page.** When you open or reload it, your browser fetches the static files (`index.html`, `page.js`, `styles.css` and the rest) from the host (for example GitHub Pages). The host sees only your **IP address** and which file you requested - the normal web-server logs every website has.
- **Downloading stock firmware.** When you press Download, the page opens the manufacturer's own firmware URL in a new browser tab. That download is a normal browser request to the manufacturer's file host, which sees it like any other download. The page itself never fetches or forwards the file, and it never sends your scooter data along with it.

Neither case sends any scooter data, the serial or your patched image to this project.

## Bluetooth LE to your scooter

A local radio link to your scooter over Web Bluetooth. This is not an internet connection - no data leaves your phone over the network for this. The serial read, the authentication handshake and the firmware transfer travel only between your browser and the scooter.

## No developer backend

Nothing is ever sent to the developer. There is no cloud account and no server operated by this project that receives your data. The firmware images are hosted by the manufacturer, not by this project, and you fetch them yourself when you press Download.

## Contact

For privacy questions, contact the author (Laufbursche) on GitHub: https://github.com/Laufbursche42
