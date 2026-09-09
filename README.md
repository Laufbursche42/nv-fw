# Laufbursche NAVEE Firmware

A static web page that builds a tuned firmware for a NAVEE scooter and flashes it over Web Bluetooth. It downloads the stock firmware for your model, patches it in the browser (speed unlock, kickstart and cruise) and writes it back to the scooter over Bluetooth. Nothing to install: no app store, no signing, no developer account. The page is bilingual (German/English, switch in the header) and German is the default.

> **For iPhone and iPad.** This tool runs in the **Bluefy** browser, because Safari has no Web Bluetooth. **Android users should use the app instead** - it patches and flashes directly, with no browser detour.

> **This is a feasibility study.** It exists to show what a NAVEE scooter's firmware makes possible, not to be a finished product. Error-free operation is not promised and there is no warranty of any kind. Whatever you build and flash, you do at your own risk.

**Open the web app: [laufbursche42.github.io/nv-fw](https://laufbursche42.github.io/nv-fw/)**

The page is meant for **all NAVEE scooter models**. The download and connect steps work across the line, and the patch step now recognizes most of the fleet: the performance line (NT5, NT3 Pro/Max, GT3/Max/Pro, ST3/ST3 Pro, GT5 Pro/Max), the G5 line, the city and commuter models (S40, S60, S2, V25/V25i, V50i Pro, V45i, N65i, E20 Lite/E25 Go, UT3 Max) and the UT5 Max - each with a checkbox per feature (speed, cruise, zero start, individual beeps). A few models get meter features only (ST5 Pro/Max, UT5 Ultra X, K100 Max). Where a controller cannot be switched safely (some E and V variants, the K100 and Birdie lines) the patcher recognizes the image as stock and does not offer speed. The first flash of any model belongs on a unit you can recover.

## What it does

- **Connect and detect the model.** The scooter shows up by its advertised name (NAVEE...), the page authenticates and reads the serial, and detects the model from it.
- **Download the matching stock firmware.** For the detected model the page lists the stock meter, controller (BLDC) and battery (BMS) images and opens the download in a new tab.
- **Patch in the browser.** Load the stock `.bin`, the page recognizes the variant and applies only the matching patches, then reseals the image with a fresh CRC. A wrong or already-patched file is refused, not damaged.
- **Save or flash.** Save the patched image, or flash it straight to the scooter over Web Bluetooth (XMODEM transfer with a device-side integrity check).

## Model support matrix

Two tables: models where all four features are available, and models where at least one is not (yet). Each cell is byte-traced in the firmware, not inferred.

- **Speed** - `patcher` a switchable lock/unlock controller patch (boots throttled to ~22 km/h, opens the top gear per ride, re-locks on restart); `flash-free` lifted over Bluetooth per ride, no flash; `no` no switchable cap on the controller; `no image` the manufacturer publishes no controller firmware for this model.
- **Kick-start** / **Cruise** / **Warning beeps** - `patcher` region-gated on stock, our patch unlocks/silences it in every region; `stock` already works in every region with no patch; `no` not present in this firmware, or the meter body is external-ROM / compressed and cannot be reached.

### Fully supported

| Model | Speed | Kick-start | Cruise | Warning beeps |
| --- | --- | --- | --- | --- |
| NT5 Max, Max+, Turbo, Ultra | patcher | patcher | patcher | patcher |
| NT3 Pro, Max | patcher | patcher | patcher | patcher |
| GT3, GT3 Max, GT3 Pro | patcher | patcher | patcher | patcher |
| ST3, ST3 Pro | patcher | patcher | patcher | patcher |
| GT5 Pro, Max | patcher | stock | stock | patcher |
| UT3 Max | patcher | stock | stock | patcher |
| UT5 Max | patcher | patcher | patcher | patcher |
| UT5 Ultra X | patcher | patcher | patcher | patcher |
| S2 | patcher | patcher | patcher | patcher |
| E20 Lite, E25 Go | patcher | patcher | patcher | patcher |
| XT5 Pro, Ultra, Max | flash-free | patcher | stock | patcher |
| ST5 Pro, ST5 Max | patcher | patcher | patcher | patcher |

### Not fully supported

| Model | Speed | Kick-start | Cruise | Warning beeps |
| --- | --- | --- | --- | --- |
| G5, G5 Pro, G5 Max | patcher | stock | stock | no |
| S40, S60 | patcher | no | stock | no |
| V25 / V25i | patcher | no | no | no |
| V50i Pro | patcher | no | no | no |
| V45i | patcher | no | no | no |
| N65i | patcher | no | no | no |
| NT5 Ultra X | no image | stock | stock | patcher |
| E45 / E60 Pro | no | patcher | patcher | patcher |
| E20, E25 | no | no | patcher | patcher |
| K100 Max | no | patcher | stock | patcher |
| K100, K100 Pro | no | no | no | no |
| Birdie 3, Birdie 3x | no | no | no | no |
| V40i, V40i Pro | no | no | no | no |
| V40i Pro II | no | no | stock | patcher |
| V3 Pro | no | no | no | no |
| N65i II (6001) | no | stock | stock | patcher |
| N65i II (10701) | no | patcher | patcher | patcher |

First flash of any model belongs on a unit you can recover; every patch is byte-verified and re-seals deterministically, the on-vehicle confirmation ride is still owed. Why the `no` speed cells cannot be flashed: E20 / E25 have a feasible controller latch but no fwBldc version marker in the image (the version lives in external parameter flash), so the app cannot recognise the patch - deferred. E45 / E60 Pro (top speed is a hard-wired flash constant), the K100 controllers (Cortex-M0, encrypted meter) and Birdie 3 / 3x (display bridge, no throttle) have no switchable cap. V40i / V40i Pro II / V3 Pro / N65i II are infeasible on the controller side (V3 Pro's mechanism is present but its motor constants cannot be finalised safely from static analysis). NT5 Ultra X ships no controller image at all, so its top speed cannot be raised; kick-start and cruise are already ungated in its meter (they work in every region without a patch) and its warning beeps are silenceable. ST5 Pro / Max hold their speed cap in the METER region gate, so speed is patched there directly - no controller image needed. A `no` in the kick-start / cruise / beep columns for the V-series and the K100 pair means those meter bodies are external-ROM-dispatched or compressed, not that the tool skipped them.

## Step by step

1. **Connect** the scooter. The page reads the serial and detects the model.
2. **Download** the stock firmware for that model (meter and/or controller), save the `.bin`.
3. **Upload** the saved `.bin` into the patch card.
4. **Patch** - the page detects the variant and applies the matching patches, then lets you save or flash.
5. **Flash** - tick the consent box and press Flash. Keep the link stable until it finishes.

## Restore the original firmware

Undoing a patch is just flashing the manufacturer's own firmware back. There is nothing special to keep around beyond the stock `.bin`:

1. Get the stock `.bin` for your model again - either the copy the tool saved next to the patched one, or re-download it from the download step (it is the manufacturer's unmodified image).
2. Load that stock `.bin` into the patch step and leave **every feature checkbox unticked**. With nothing selected the tool applies no changes and only re-seals the image, so the output is **byte-identical to the manufacturer image**.
3. Flash it. The scooter is now exactly as it shipped - the factory speed limit is back and the operating permit (ABE) applies again.

You can flash a component (meter or controller) back to stock on its own; flash whichever one you had patched. If you are unsure, re-flash both stock images.

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
