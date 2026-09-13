'use strict';
// NAVEE firmware flash over Web Bluetooth: connection auth, DFU-enter handshake, XMODEM-128 transfer.

// GATT: single control service, write b002 (write-without-response), notify b003.
const SERVICE = '0000d0ff-3c17-d293-8e48-14fe2e4da212';
const WRITE   = '0000b002-0000-1000-8000-00805f9b34fb';
const NOTIFY  = '0000b003-0000-1000-8000-00805f9b34fb';

// XMODEM control bytes
const SOH = 0x01, EOT = 0x04, ACK = 0x06, NAK = 0x15, CAN = 0x18, CRCREQ = 0x43;
const BLOCK = 128, PAD = 0x1A;
const CR = 0x0d;

// 16-byte control-frame auth keys (index selects the key used by the DFU crypto gate).
const KEYS = [
  [0xA0,0xA1,0xA2,0xA3,0xA4,0xA5,0xA6,0xA7,0xA8,0xA9,0xAA,0xAB,0xAC,0xAD,0xAE,0xAF],
  [0x44,0x6D,0x10,0x72,0x6D,0xBE,0x05,0xF6,0x62,0xDF,0xAA,0xF0,0x13,0x27,0x30,0x3F],
  [0xA2,0x85,0xCC,0xEC,0x81,0x4F,0xE9,0x61,0x74,0x29,0x95,0xE8,0xEB,0xA9,0x22,0x47],
  [0x3F,0xEE,0x80,0xFF,0x96,0xDF,0x5C,0xF5,0x42,0xEA,0xAC,0x93,0x28,0x1F,0xE5,0x29],
  [0x4E,0xB4,0xD4,0x64,0xD6,0xEF,0x53,0xED,0x6C,0xE9,0x45,0x58,0xDE,0x9A,0x5E,0xE3],
].map(a => new Uint8Array(a));

function secRandInt(max) {
  const a = new Uint32Array(1);
  (self.crypto || self.msCrypto).getRandomValues(a);
  return a[0] % max;
}

function crc16(bytes) {
  if (typeof window !== 'undefined' && window.NVFW && window.NVFW.crc16Xmodem)
    return window.NVFW.crc16Xmodem(bytes, 0, bytes.length);
  let c = 0;
  for (let i = 0; i < bytes.length; i++) {
    c ^= (bytes[i] & 0xFF) << 8;
    for (let n = 0; n < 8; n++) c = (c & 0x8000) ? (((c << 1) ^ 0x1021) & 0xFFFF) : ((c << 1) & 0xFFFF);
  }
  return c & 0xFFFF;
}

function ckSum(arr) { let s = 0; for (const b of arr) s = (s + b) & 0xFF; return s; }
// control WRITE frame: 55 AA 00 <cmd> <len> <payload...> <ck> FE FD
function writeFrame(cmd, payload) {
  payload = payload || [];
  const body = [0x55, 0xAA, 0x00, cmd, payload.length, ...payload];
  return new Uint8Array([...body, ckSum(body), 0xFE, 0xFD]);
}
// control READ frame: 55 AA 00 <cmd> <ck> FE FD (no length, no payload)
function readFrame(cmd) {
  const body = [0x55, 0xAA, 0x00, cmd];
  return new Uint8Array([...body, ckSum(body), 0xFE, 0xFD]);
}
// 6-byte packed account userId; top byte forced to 0x88 when zero or high-bit set.
function s6(userId) {
  let v = BigInt(Math.trunc(Number(userId))) & 0xffffffffffffn;
  const b = new Uint8Array(6);
  for (let i = 5; i >= 0; i--) { b[i] = Number(v & 0xffn); v >>= 8n; }
  if (b[0] === 0 || b[0] >= 0x80) b[0] = 0x88;
  return b;
}
function authInitFrame(userId, keyIdx, shareFlag) { return writeFrame(0x30, [keyIdx, shareFlag ? 1 : 0, ...s6(userId), 0x00]); }
async function aesEcb16(key16, block16) {
  const k = await crypto.subtle.importKey('raw', key16, { name: 'AES-CBC' }, false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: new Uint8Array(16) }, k, block16));
  return ct.slice(0, 16);
}
function xor16(block16, key16) { const o = new Uint8Array(16); for (let i = 0; i < 16; i++) o[i] = (block16[i] ^ key16[i]) & 0xff; return o; }
async function authRespFrame(resp16) { return writeFrame(0x31, [...resp16]); }
// OEM 0x6F sub-command 6: clock sync, local epoch seconds (UTC + tz offset), 4 bytes big-endian.
function timeSyncFrame() {
  const local = Math.floor(Date.now() / 1000) - (new Date().getTimezoneOffset() * 60);
  return writeFrame(0x6F, [0x06, (local >>> 24) & 0xff, (local >>> 16) & 0xff, (local >>> 8) & 0xff, local & 0xff]);
}

function ascii(s) { return Uint8Array.from(Array.from(s).map(c => c.charCodeAt(0))); }

const NVFlash = {
  device: null, server: null, writeCh: null, notifyCh: null,
  rx: [],
  _pending: null,
  cancelled: false,
  keyIdx: 1,        // >=1; key 0 is the placeholder key
  userId: null,     // null -> random (works only on an unbound scooter)
  wire: null,       // optional (dir, bytes) hook for logging raw TX/RX; never affects the flow

  get connected() { return !!(this.device && this.device.gatt && this.device.gatt.connected); },

  onNotify(ev) {
    const dv = ev.target.value;
    const v = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
    if (this.wire) { try { this.wire('rx', v); } catch (e) {} }
    for (let i = 0; i < v.length; i++) this.rx.push(v[i]);
    this._deliver();
  },

  // Run the single pending matcher against the rx buffer; a matcher may consume junk and keep waiting.
  _deliver() {
    while (this._pending) {
      const r = this._pending.test(this.rx);
      if (!r) break;
      if (r.consume) this.rx.splice(0, r.consume);
      if (r.skip) continue;
      const p = this._pending; this._pending = null;
      clearTimeout(p.timer); p.resolve(r.value);
    }
  },

  _await(test, timeoutMs, errKey) {
    return new Promise((resolve, reject) => {
      const w = { test, resolve, reject, timer: null };
      w.timer = setTimeout(() => {
        // drop stale buffered bytes so a late reply cannot match the next step
        if (this._pending === w) { this._pending = null; this.rx.length = 0; }
        reject(new Error(errKey || 'flErrTimeout'));
      }, timeoutMs);
      this._pending = w;
      this._deliver();
    });
  },

  // Resend frame every tickMs until test resolves or windowMs elapses, mirroring the OEM enter timers.
  async _writeAwaitRetry(frame, test, windowMs, tickMs, errKey) {
    const deadline = Date.now() + windowMs;
    do {
      if (this.cancelled) throw new Error('flErrCancelled');
      await this._write(frame);
      const remain = deadline - Date.now();
      const wait = Math.min(tickMs, remain > 0 ? remain : tickMs);
      try { return await this._await(test, wait, errKey); }
      catch (e) { /* tick expired: resend */ }
    } while (Date.now() < deadline);
    throw new Error(errKey);
  },

  // --- matchers: each returns null (wait), {consume,skip} (drop junk), or {consume,value} (resolve) ---
  _mFrame(wantCmd) {
    return (rx) => {
      let i = -1;
      for (let k = 0; k + 1 < rx.length; k++) if (rx[k] === 0x55 && rx[k + 1] === 0xAA) { i = k; break; }
      if (i < 0) return rx.length > 1 ? { consume: rx.length - 1, skip: true } : null;
      if (i > 0) return { consume: i, skip: true };
      if (rx.length < 5) return null;
      const total = rx[4] + 8;
      if (rx.length < total) return null;
      if (rx[total - 2] !== 0xFE || rx[total - 1] !== 0xFD) return { consume: 2, skip: true };
      const frame = new Uint8Array(rx.slice(0, total));
      if (frame[3] === wantCmd) return { consume: total, value: frame };
      return { consume: total, skip: true };
    };
  },
  _mAscii(str) {
    const want = ascii(str);
    return (rx) => {
      for (let i = 0; i + want.length <= rx.length; i++) {
        let ok = true;
        for (let j = 0; j < want.length; j++) if (rx[i + j] !== want[j]) { ok = false; break; }
        if (ok) return { consume: i + want.length, value: str };
      }
      return null;
    };
  },
  _mByte(pred) {
    return (rx) => {
      for (let i = 0; i < rx.length; i++) if (pred(rx[i])) return { consume: i + 1, value: rx[i] };
      return null;
    };
  },
  // challenge frame: 6f 6b 20 <mode> <16 rand> 0d  (21 bytes)
  _mRand() {
    return (rx) => {
      for (let i = 0; i + 21 <= rx.length; i++) {
        if (rx[i] === 0x6f && rx[i + 1] === 0x6b && rx[i + 2] === 0x20 && rx[i + 20] === CR)
          return { consume: i + 21, value: { mode: rx[i + 3], rand: new Uint8Array(rx.slice(i + 4, i + 20)) } };
      }
      return null;
    };
  },
  // block reply: [06 <blk>] ACK, 15 NAK, 18 CAN
  _mAck() {
    return (rx) => {
      for (let i = 0; i < rx.length; i++) {
        const b = rx[i];
        if (b === NAK) return { consume: i + 1, value: { type: 'nak' } };
        if (b === CAN) return { consume: i + 1, value: { type: 'can' } };
        if (b === ACK) {
          if (i + 1 >= rx.length) return i > 0 ? { consume: i, skip: true } : null;
          return { consume: i + 2, value: { type: 'ack', blk: rx[i + 1] } };
        }
      }
      return null;
    };
  },
  _mFinish() {
    const okW = ascii('rsq dfu_ok'), erW = ascii('rsq dfu_error');
    const find = (rx, want) => {
      for (let i = 0; i + want.length <= rx.length; i++) {
        let ok = true;
        for (let j = 0; j < want.length; j++) if (rx[i + j] !== want[j]) { ok = false; break; }
        if (ok) return i + want.length;
      }
      return -1;
    };
    return (rx) => {
      const e = find(rx, erW); if (e >= 0) return { consume: e, value: 'error' };
      const o = find(rx, okW); if (o >= 0) return { consume: o, value: 'ok' };
      return null;
    };
  },
  // finish phase: the rsq result token takes priority, else a lone EOT-ACK (0x06).
  _mFinishOrAck() {
    const fin = this._mFinish();
    return (rx) => {
      const f = fin(rx);
      if (f) return f;
      for (let i = 0; i < rx.length; i++) if (rx[i] === ACK) return { consume: i + 1, value: 'ack' };
      return null;
    };
  },

  async _write(bytes) {
    const buf = (bytes instanceof Uint8Array) ? bytes : Uint8Array.from(bytes);
    if (this.wire) { try { this.wire('tx', buf); } catch (e) {} }
    if (this.writeCh.writeValueWithoutResponse) {
      try { await this.writeCh.writeValueWithoutResponse(buf); return; } catch (e) {}
    }
    if (this.writeCh.writeValueWithResponse) await this.writeCh.writeValueWithResponse(buf);
    else await this.writeCh.writeValue(buf);
  },

  _buildBlock(seq, data128) {
    const f = new Uint8Array(3 + BLOCK + 2);
    f[0] = SOH; f[1] = seq & 0xFF; f[2] = (~seq) & 0xFF;
    f.set(data128, 3);
    const c = crc16(data128);
    f[3 + BLOCK] = (c >> 8) & 0xFF;
    f[3 + BLOCK + 1] = c & 0xFF;
    return f;
  },

  async connect() {
    if (!(navigator.bluetooth && navigator.bluetooth.requestDevice)) throw new Error('flErrNoBluetooth');
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'NAVEE' }], optionalServices: [SERVICE],
    });
    this.device.addEventListener('gattserverdisconnected', () => { this._pending = null; this.rx.length = 0; });
    this.server = await this.device.gatt.connect();
    const svc = await this.server.getPrimaryService(SERVICE);
    this.writeCh = await svc.getCharacteristic(WRITE);
    this.notifyCh = await svc.getCharacteristic(NOTIFY);
    await this.notifyCh.startNotifications();
    this.notifyCh.addEventListener('characteristicvaluechanged', (e) => this.onNotify(e));
    this.rx.length = 0; this._pending = null;
    return this.device.name || 'NAVEE';
  },

  disconnect() {
    try { if (this.connected) this.device.gatt.disconnect(); } catch (e) {}
  },

  // Read the car serial (control 0x74). Pre-auth read; returns the printable serial string.
  // RX: 55 AA <flag> 74 <len> <errcode> <data...> <ck> FE FD; data starts at byte 6, len counts errcode+data.
  async readSerial() {
    if (!this.connected || !this.writeCh) throw new Error('flErrNotConnected');
    this.rx.length = 0; this._pending = null;
    await this._write(readFrame(0x74));
    const f = await this._await(this._mFrame(0x74), 4000, 'flErrNoReply');
    if (f[5] !== 0) throw new Error('flErrSn');
    const data = f.slice(6, 5 + f[4]);
    let sn = '';
    for (const c of data) if (c >= 0x20 && c < 0x7f) sn += String.fromCharCode(c);
    return sn.trim();
  },

  cancel() {
    this.cancelled = true;
    try { this._write([CAN, CAN, CAN, CAN, CAN, CAN, CAN, CAN, CAN, CAN]); } catch (e) {}
  },

  // 0x30/0x31 sets the keyIdx the DFU crypto gate uses. The real DFU gate is the ble_key challenge,
  // so a bound scooter that rejects the random id (0xFF) - or any auth hiccup - is logged, not fatal:
  // the flash continues to dfu_start and works without a userId on any scooter.
  async _authenticate(userId, keyIdx, log) {
    const uid = (userId != null && userId > 0) ? userId : (secRandInt(1000000000) + 1);
    const shareFlag = (userId != null && userId > 0) ? 1 : 0;
    this.rx.length = 0; this._pending = null;
    log('auth init key=' + keyIdx);
    await this._write(authInitFrame(uid, keyIdx, shareFlag));
    // Full OEM handshake: two 0x30/0x31 rounds, the challenge answered in the scooter's mode (0 = XOR,
    // else AES), then clock + 0x7B on the final no-challenge 0x30 so a bound scooter keeps the link.
    for (let round = 0; round < 4; round++) {
      let f;
      try { f = await this._await(this._mFrame(0x30), 4000, 'flErrAuth'); }
      catch (e) { log('no 0x30 reply - continuing to DFU'); return; }
      if (f[5] !== 0) { log('0x30 rejected (' + f[5] + ') - continuing to DFU'); return; }
      const data = f.slice(6, 5 + f[4]);
      if (data.length < 16) {
        try { await this._write(timeSyncFrame()); await this._write(readFrame(0x7B)); } catch (e) {}
        log('auth ok (session armed)');
        return;
      }
      let block, useXor;
      if (data.length > 16) { useXor = (data[0] === 0); block = data.slice(1, 17); }
      else { useXor = false; block = data.slice(0, 16); }
      const resp = useXor ? xor16(block, KEYS[keyIdx]) : await aesEcb16(KEYS[keyIdx], block);
      await this._write(await authRespFrame(resp));
      let r;
      try { r = await this._await(this._mFrame(0x31), 4000, 'flErrAuth'); }
      catch (e) { log('auth handshake incomplete - continuing to DFU'); return; }
      if (r[5] !== 0) { log('0x31 rejected (' + r[5] + ') - continuing to DFU'); return; }
      await this._write(authInitFrame(uid, keyIdx, shareFlag));
    }
    log('auth ok');
  },

  // Flash a patched image. cb: {log, phase, progress, n, keyIdx, userId}. n = DFU target (meter 1, bldc 2).
  async flash(bytes, cb) {
    cb = cb || {};
    const log = (m) => cb.log && cb.log(m);
    const phase = (p) => cb.phase && cb.phase(p);
    const prog = (p) => cb.progress && cb.progress(p);
    if (!this.connected || !this.writeCh) throw new Error('flErrNotConnected');

    this.cancelled = false; this.rx.length = 0; this._pending = null;
    const N = (cb.n != null) ? cb.n : 1;
    const keyIdx = (cb.keyIdx != null) ? cb.keyIdx : this.keyIdx;
    const userId = (cb.userId != null) ? cb.userId : this.userId;

    phase('flPhAuth');
    await this._authenticate(userId, keyIdx, log);

    phase('flPhEnter');
    log('TX dfu_start ' + N);
    await this._writeAwaitRetry(ascii('down dfu_start ' + N + '\r'), this._mAscii('ok\r'), 33000, 3000, 'flErrNoReply');

    log('TX ble_rand');
    const ch = await this._writeAwaitRetry(ascii('down ble_rand\r'), this._mRand(), 18000, 3000, 'flErrNoReply');
    log('RX challenge mode=' + ch.mode);

    const key16 = KEYS[keyIdx];
    let resp16;
    if (ch.mode === 0) { resp16 = new Uint8Array(16); for (let i = 0; i < 16; i++) resp16[i] = ch.rand[i] ^ key16[i]; }
    else resp16 = await aesEcb16(key16, ch.rand);

    log('TX ble_key');
    const keyFrame = new Uint8Array(13 + 16 + 1);
    keyFrame.set(ascii('down ble_key '), 0);
    keyFrame.set(resp16, 13);
    keyFrame[29] = CR;
    // resend ble_key until the device acks with 'ok\r' (OEM stops resending here), then wait for 'C'
    // without resending ble_key (OEM waits effectively unbounded).
    await this._writeAwaitRetry(keyFrame, this._mAscii('ok\r'), 18000, 3000, 'flErrNoReply');
    await this._await(this._mByte(b => b === CRCREQ), 120000, 'flErrNoC');
    log('RX C - device ready');

    phase('flPhTransfer');
    const total = Math.ceil(bytes.length / BLOCK);
    let seq = 1;
    for (let i = 0; i < total; i++) {
      if (this.cancelled) throw new Error('flErrCancelled');
      const chunk = new Uint8Array(BLOCK).fill(PAD);
      chunk.set(bytes.subarray(i * BLOCK, Math.min((i + 1) * BLOCK, bytes.length)));
      const frame = this._buildBlock(seq, chunk);

      await this._write(frame);
      let nak = 0, ok = false;
      while (!ok) {
        if (this.cancelled) throw new Error('flErrCancelled');
        let r;
        // block-ACK timeout: the OEM aborts the whole DFU here, no auto-resend
        try { r = await this._await(this._mAck(), 3000, 'ack'); }
        catch (e) { throw new Error('flErrTimeout'); }
        if (r.type === 'ack' && r.blk === seq) ok = true;
        else if (r.type === 'nak') {
          if (++nak >= 10) throw new Error('flErrBlock');
          log('block ' + seq + ' NAK, retry ' + nak);
          await this._write(frame);            // resend only on NAK, like the OEM
        }
        else if (r.type === 'can') throw new Error('flErrDeviceAbort');
        else throw new Error('flErrTimeout');  // wrong-block ack: the OEM never resends
      }
      prog(Math.round(((i + 1) / total) * 100));
      if (((i + 1) & 0x3f) === 0 || i + 1 === total) log('block ' + (i + 1) + '/' + total);
      seq = (seq + 1) & 0xFF; if (seq === 0) seq = 1;
    }

    phase('flPhFinish');
    log('TX EOT');
    let res = null, eotAcked = false;
    for (let i = 0; i < 5; i++) {
      await this._write([EOT]);
      let got;
      try { got = await this._await(this._mFinishOrAck(), 3000, 'eot'); }
      catch (e) { log('EOT no reply, retry ' + (i + 1)); continue; }
      if (got === 'ack') { eotAcked = true; break; }
      res = got; break;   // device sent the rsq token directly, without a separate 0x06
    }
    if (res === null && eotAcked) {
      // OEM watchdog: after the EOT-ACK a missing rsq token is a FAILURE, not success.
      try { res = await this._await(this._mFinish(), 3000, 'finish'); }
      catch (e) { throw new Error('flErrNoConfirm'); }
    }
    if (res === null) throw new Error('flErrNoConfirm');
    if (res === 'error') throw new Error('flErrDeviceReject');
    prog(100); phase('flPhDone'); log('rsq dfu_ok');
    return true;
  },
};

if (typeof window !== 'undefined') window.NVFlash = NVFlash;
