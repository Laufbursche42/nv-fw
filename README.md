# Laufbursche NAVEE Firmware

A static web page that builds a tuned firmware for a NAVEE scooter and flashes it over Web Bluetooth. It downloads the stock firmware for your model, patches it in the browser (speed unlock, kickstart and cruise) and writes it back to the scooter over Bluetooth. Nothing to install: no app store, no signing, no developer account. The page is bilingual (German/English, switch in the header) and German is the default.

> **For iPhone and iPad.** This tool runs in the **Bluefy** browser, because Safari has no Web Bluetooth. **Android users should use the app instead** - it patches and flashes directly, with no browser detour.

> **This is a feasibility study.** It exists to show what a NAVEE scooter's firmware makes possible, not to be a finished product. Error-free operation is not promised and there is no warranty of any kind. Whatever you build and flash, you do at your own risk.

**Open the web app: [laufbursche42.github.io/nv-fw](https://laufbursche42.github.io/nv-fw/)**

The page is meant for **all NAVEE scooter models**. Right now the **NT5 Max** is the model under test; step by step, patches for more models are added. The download and connect steps already work across the line; the patch step currently recognizes the NT5 Max meter and controller images.

## What it does

- **Connect and detect the model.** The scooter shows up by its advertised name (NAVEE...), the page authenticates and reads the serial, and detects the model from it.
- **Download the matching stock firmware.** For the detected model the page lists the stock meter, controller (BLDC) and battery (BMS) images and opens the download in a new tab.
- **Patch in the browser.** Load the stock `.bin`, the page recognizes the variant and applies only the matching patches, then reseals the image with a fresh CRC. A wrong or already-patched file is refused, not damaged.
- **Save or flash.** Save the patched image, or flash it straight to the scooter over Web Bluetooth (XMODEM transfer with a device-side integrity check).

## Step by step

1. **Connect** the scooter. The page reads the serial and detects the model.
2. **Download** the stock firmware for that model (meter and/or controller), save the `.bin`.
3. **Upload** the saved `.bin` into the patch card.
4. **Patch** - the page detects the variant and applies the matching patches, then lets you save or flash.
5. **Flash** - tick the consent box and press Flash. Keep the link stable until it finishes.

## Browser support

- **iPhone or iPad:** the **Bluefy** browser. Safari has no Web Bluetooth and cannot flash.
- **Android:** use the app instead of this page - it patches and flashes directly.

## Authentication

The session and the DFU handshake use the same challenge-response the app uses (AES-128, built-in keys). No account id is entered: the page authenticates with a random id on first connect, like the native app. An unbound scooter is accepted; a scooter bound to an account may reject the random id with error 255.

## Run it yourself

No build step, no dependencies. Clone the repo and serve the folder over a local HTTP server. Opening `index.html` directly as a `file://` URL will not work, because the page fetches its own documents and browsers block that over `file://`.

```
git clone https://github.com/Laufbursche42/nv-fw.git
cd nv-fw
python -m http.server 8000
```

Then open the printed address in a browser that supports Web Bluetooth.

## Legal

Flashing a modified firmware and raising the speed lift the factory limit. The operating permit (Betriebserlaubnis, ABE) is then void and riding the scooter in public traffic is no longer allowed, with the corresponding insurance and registration consequences. Use it on your own vehicle only, on private ground. Everything you do with this page is at your own risk.

## License

Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 (CC BY-NC-ND 4.0), in full in [LICENSE.md](LICENSE.md).

## Privacy

Nothing leaves your device but the page load and the firmware download you start yourself. The details are in [PRIVACY.md](PRIVACY.md).

## Trademarks

An independent, unofficial project, not affiliated with NAVEE. "NAVEE" and other product names are trademarks of their respective owners and are used here only to say which scooters this page works with. See [TRADEMARKS.md](TRADEMARKS.md).
