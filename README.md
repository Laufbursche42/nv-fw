> 🚨 **This tool is moving.** This repository is **no longer maintained** - please switch to the new tool: **[lb-webpatcher.laufbursche.workers.dev](https://lb-webpatcher.laufbursche.workers.dev/)**. It patches and flashes the same NAVEE models (and more). Trouble switching? Open an [issue on GitHub](https://github.com/Laufbursche42/Laufbursche42/issues/new) or send a [PM on the eScooter-Stammtisch forum](https://www.escooter-stammtisch.de/index.php?user/6497-laufbursche/).

# Laufbursche NAVEE Firmware

A static web page that builds a tuned firmware for a NAVEE scooter and flashes it over Web Bluetooth. It downloads the stock firmware for your model, patches it in the browser (speed unlock, kickstart and cruise) and writes it back to the scooter over Bluetooth. Nothing to install: no app store, no signing, no developer account. The page is bilingual (German/English, switch in the header) and German is the default.

> **For iPhone and iPad.** This tool runs in the **Bluefy** browser, because Safari has no Web Bluetooth. **Android users should use the patcher built into the [nv-lb-edition](https://github.com/Laufbursche42/nv-lb-edition) Android app instead** - it patches and flashes directly, with no browser detour.

> **This is a feasibility study.** It exists to show what a NAVEE scooter's firmware makes possible, not to be a finished product. Error-free operation is not promised and there is no warranty of any kind. Whatever you build and flash, you do at your own risk.

**Open the web app: [laufbursche42.github.io/nv-fw](https://laufbursche42.github.io/nv-fw/)**

The download and connect steps work across the line, so any NAVEE model can be read. Confirmed on real hardware: the **NT5 family** and the **XT5**. The **ST3/GT3 family** (ST3 Pro, ST3, GT3, GT3 Pro, GT3 Max) is now patchable too, but it is **experimental and not yet confirmed on hardware** - only flash it if you can recover the controller (SWD or a spare controller). Every other model stays read-only while its patch is re-checked.

## What it does

- **Connect and detect the model.** The scooter shows up by its advertised name (NAVEE...), the page authenticates and reads the serial, and detects the model from it.
- **Download the matching stock firmware.** For the detected model the page lists the stock meter, controller (BLDC) and battery (BMS) images and opens the download in a new tab.
- **Patch in the browser.** Load the stock `.bin`, the page recognizes the variant and applies only the matching patches, then reseals the image with a fresh CRC. A wrong or already-patched file is refused, not damaged.
- **Save or flash.** Save the patched image, or flash it straight to the scooter over Web Bluetooth (XMODEM transfer with a device-side integrity check).

## Model support matrix

Confirmed on real hardware: the **NT5 family** and the **XT5**. The **ST3/GT3 family is experimental** - patchable but not yet confirmed on hardware; only flash it with a controller recovery route (SWD or a spare) at hand. Every other model can still connect, download its stock firmware and be read, but patching stays **disabled** while its patch is re-checked.

| Model | Speed | Kick-start | Cruise | Warning beeps |
| --- | --- | --- | --- | --- |
| NT5 Max, Max+, Turbo, Ultra | patcher | patcher | patcher | patcher |
| NT5 Ultra X | patcher | stock | stock | patcher |
| XT5 Pro, Ultra, Max | flash-free | patcher | stock | patcher |
| ST3 Pro, ST3, GT3, GT3 Pro, GT3 Max (experimental, untested) | patcher | patcher | patcher | patcher |

Legend: `patcher` a switchable lock/unlock patch (boots throttled to ~22 km/h, opens the top gear per ride, re-locks on restart); `flash-free` lifted live over Bluetooth per ride, no flash; `stock` already works in every region with no patch. The XT5 speed release writes nothing and reverts on restart; the NT5 patch is confirmed on hardware and is reversible by flashing the stock firmware back. The **ST3/GT3 family is experimental**: its patch is built and statically verified but **not yet confirmed on real hardware**, and a failed flash on these controllers is not recoverable over the air (it needs SWD or a controller swap) - so only flash them if you can recover the unit.

## Step by step

1. **Connect** the scooter. The page reads the serial and detects the model.
2. **Download** the stock firmware for that model (meter and/or controller), save the `.bin`.
3. **Upload** the saved `.bin` into the patch card.
4. **Patch** - the page detects the variant and applies the matching patches, then lets you save or flash.
5. **Flash** - tick the consent box and press Flash. Keep the link stable until it finishes.

## Lock and unlock after flashing

This page only patches and flashes; it does not control the scooter. The switchable speed firmware boots throttled (about 22 km/h) and opens the top gear only when it receives the unlock command. To send that lock/unlock command live, per ride, use the companion control tool:

- **iPhone / iPad or desktop:** [navee-unlock](https://laufbursche42.github.io/navee-unlock/) - in Bluefy on iOS, in Chrome on desktop.
- **Android:** the [app](https://github.com/Laufbursche42/nv-lb-edition), which patches, flashes and controls in one.

Cruise, zero-start and the other live functions are set the same way, in navee-unlock or the app, not on this page.

## Restore the original firmware

Undoing a patch is just flashing the manufacturer's own firmware back. There is nothing special to keep around beyond the stock `.bin`:

1. Get the stock `.bin` for your model again - either the copy the tool saved next to the patched one, or re-download it from the download step (it is the manufacturer's unmodified image).
2. Load that stock `.bin` into the patch step and leave **every feature checkbox unticked**. With nothing selected the tool applies no changes and only re-seals the image, so the output is **byte-identical to the manufacturer image**.
3. Flash it. The scooter is now exactly as it shipped - the factory speed limit is back and the operating permit (ABE) applies again.

You can flash a component (meter or controller) back to stock on its own; flash whichever one you had patched. If you are unsure, re-flash both stock images.

## Browser support

- **iPhone or iPad:** the **Bluefy** browser. Safari has no Web Bluetooth and cannot flash.
- **Android:** use the patcher in the [nv-lb-edition](https://github.com/Laufbursche42/nv-lb-edition) Android app instead of this page - it patches and flashes directly.

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
