# Guide

A step-by-step walkthrough of the Laufbursche NAVEE firmware tool. The page builds a tuned firmware from your NAVEE scooter's stock image and writes it back over Web Bluetooth, entirely on your device. Nothing is sent to any server.

## What you need

- A NAVEE scooter. Turn it on and keep it within a few meters.
- A browser with Web Bluetooth: **Chrome** or **Edge** on Android or desktop. Safari and Firefox do not support Web Bluetooth and cannot flash.
- Bluetooth switched on. On Android, location permission has to be granted to the browser for a Bluetooth scan.

## Which models

The page is meant for all NAVEE models. Right now the **NT5 Max** is the model under test; step by step, patches for more models are added. Connect and download already work across the line; the patch step currently recognizes the NT5 Max meter and controller images.

## Step by step

### 1. Connect

Press *Connect scooter* and pick your scooter from the chooser. It appears by its name (NAVEE...), exactly as in the official app. The page authenticates right after connecting and reads the serial number to detect the model. No account entry is needed - authentication uses a random key on first connect, like the native app.

### 2. Download the stock firmware

For the detected model the page lists the matching stock images: display (meter), controller (BLDC) and, where present, battery (BMS). Press *Download* - it opens in a new tab, because the page may not load the file itself for CORS reasons. Save the `.bin` you want to patch (meter for kickstart and cruise, controller for the speed unlock).

If there are two firmware builds for your model, first pick the variant by the controller firmware version your scooter shows.

### 3. Load and patch

Select the saved `.bin` in the *Load and patch firmware* card. The page detects the variant itself and applies only the matching patches. A wrong or already-patched file is refused, not damaged. It then shows the detected variant and the patches it applied.

### 4. Save or flash

Either *Save patched firmware* for your own backup, or go straight on to flashing.

### 5. Flash to the scooter

The flash card shows the patched file. Tick the box confirming you flash your own device at your own risk, then *Flash* becomes available. During the transfer: screen on, browser in the foreground, scooter powered on and close to the phone. The progress bar and the log show how it goes.

An interruption mid-transfer is harmless - the scooter only commits an image after a full check and discards an incomplete one.

## Troubleshooting

- **The scooter is not in the chooser.** Make sure it is on and close, Bluetooth is on, and on Android the browser has location permission.
- **Error 255 while connecting or flashing.** The scooter is bound to an account and rejects the random key. An unbound scooter is accepted right away.
- **The file is refused.** Then it is not a matching stock .bin, or it is already patched. Download the fresh stock image for your model again.
- **The flash aborts.** Keep the link stable (screen on, browser in front, close to the phone) and try again. The scooter stays operable as long as no fully checked image has been committed.

## Privacy and legal

Everything runs locally over Bluetooth. See [Privacy](PRIVACY.md). Flashing a modified firmware and raising the speed void the road approval, so public-road use is not allowed. Use only on your own vehicle on private ground. See the [Disclaimer](#) in the footer.
