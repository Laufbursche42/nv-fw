'use strict';
// UI flow for the NAVEE firmware tool: connect and detect the model, download the matching stock
// firmware, load a stock .bin, patch it, save it, then flash it over Web Bluetooth. Everything is
// client-side; nothing leaves the browser.

const BUILD = 'v3';
const $ = (id) => document.getElementById(id);
let lang = 'de';
let patchedResult = null;   // { image, label, kind, applied, bytes, srcName }
let loadedBuf = null;       // last loaded stock .bin (ArrayBuffer), kept so feature toggles re-patch
let loadedName = '';        // its file name
let connected = false;
let flashing = false;
let flashDone = false;      // set once a flash finishes, so the last step shows as done
let detectedModel = null;   // model name from the serial, or null
let detectedPid = null;     // 4-digit pid from the serial, or null
let dlSelectedId = null;    // chosen manifest model id for the download card

// pid -> model name. The pid is the 4 digits after the family letter of the serial.
const MODELS = {
  '2213': 'N65i', '2314': 'V25/V25i', '2322': 'S40', '2326': 'V3 Pro', '2327': 'V25 Pro/V25i Pro',
  '2328': 'V40i/V40i Pro', '2329': 'V50i Pro', '2334': 'S60', '2345': 'ST3 Pro', '2353': 'P50',
  '2401': 'ST3', '2402': 'GT3', '2403': 'GT3 Pro', '2416': 'XT5 Pro', '2417': 'E20', '2418': 'GT3 Max',
  '2422': 'E25', '2435': 'Birdie 3', '2436': 'V25i Pro II', '2437': 'V40i Pro II', '2438': 'V50i Pro II',
  '2441': 'ST5 Pro', '2442': 'G5', '2443': 'XT5 Ultra', '2449': 'NT5 Ultra X', '2504': 'K100',
  '2505': 'K100 Pro', '2506': 'K100 Max', '2509': 'N65i II', '2515': 'Birdie 3x', '2517': 'ST5 Max',
  '2518': 'G5 pro', '2519': 'G5 Max', '2529': 'XT5 Max', '2536': 'S2', '2538': 'UT5 Max', '2543': 'NT5 Max',
  '2545': 'GT5 Pro', '2546': 'GT5 Max', '2547': 'UT5 Ultra', '2573': 'E25 Go', '2585': 'UT5 Ultra X',
  '2611': 'E45 Pro', '2612': 'E60 Pro', '2614': 'S2', '2619': 'UT3 Pro', '2620': 'UT3 Max', '2623': 'V45i',
  '2634': 'E20 Lite', '2643': 'E60 Pro', '2646': 'UT3', '2657': 'NT5 Max+', '2658': 'NT5 Ultra',
  '2701': 'NT3 Pro', '2704': 'GT3 Pro', '2707': 'NT5 Turbo', '2714': 'ST3 Pro', '2736': 'KG05',
  '2739': 'WOLF X', '2745': 'NT3 Max', '2753': 'E45 Pro', '2754': 'E60 Pro', '2768': 'EXO S Pro',
};
// Pull the 4-digit pid out of a serial: skip a leading family letter, take the next 4 digits.
function pidOf(sn) { const m = String(sn || '').match(/[A-Za-z]?(\d{4})/); return m ? m[1] : null; }

function t(key) {
  const d = (window.I18N && window.I18N[lang]) || {};
  return (key in d) ? d[key] : key;
}
// translate a thrown flasher key; fall back to the raw message
function te(msg) { const v = t(msg); return v === msg ? msg : v; }

function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-t]').forEach(n => {
    const v = t(n.getAttribute('data-t'));
    if (/[<&]/.test(v)) n.innerHTML = v; else n.textContent = v;
  });
  document.querySelectorAll('[data-t-ph]').forEach(n => n.setAttribute('placeholder', t(n.getAttribute('data-t-ph'))));
  document.querySelectorAll('#langs button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  const g = $('link-guide'); if (g) g.href = docFile('GUIDE');
  const li = $('link-license'); if (li) li.href = docFile('LICENSE');
  const pr = $('link-privacy'); if (pr) pr.href = docFile('PRIVACY');
  const tm = $('link-trademarks'); if (tm) tm.href = docFile('TRADEMARKS');
  const ls = $('langs'); if (ls) ls.setAttribute('aria-label', t('langGroup'));
  const bv = $('build-ver'); if (bv) bv.textContent = t('buildLabel') + ' ' + BUILD;
  const th = $('btn-theme'); if (th) { const dark = document.documentElement.getAttribute('data-theme') !== 'light'; th.setAttribute('aria-label', t(dark ? 'themeToLight' : 'themeToDark')); th.title = th.getAttribute('aria-label'); }
  const st = $('status'); if (st) setStatus(st.dataset.state || 'disconnected');
  if (patchedResult) renderResult(patchedResult);
  const btn = $('btn-save'); if (btn && !patchedResult) btn.textContent = t('btnSave');
  renderModel();
  refreshFlashUI();
}

function setStatus(s) {
  const el = $('status');
  if (!el) return;
  el.dataset.state = s;
  const k = 'st' + s.charAt(0).toUpperCase() + s.slice(1);
  el.textContent = t(k) || s;
}

function setError(msg) {
  const el = $('err');
  if (!msg) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false; el.textContent = msg;
  $('result').hidden = true;
  patchedResult = null;
  refreshFlashUI();
}

function patchedName(srcName) {
  const dot = srcName.lastIndexOf('.');
  const stem = dot > 0 ? srcName.slice(0, dot) : srcName;
  const ext = dot > 0 ? srcName.slice(dot) : '.bin';
  return stem + '-patched' + ext;
}

function renderResult(r) {
  $('result').hidden = false;
  $('res-model').textContent = r.label;
  $('res-patches').textContent = r.applied.length ? r.applied.join(', ') : t('patchNone');
  const note = $('res-note');
  if (r.speedPending) { note.hidden = false; note.textContent = t('note9301'); }
  else { note.hidden = true; note.textContent = ''; }
  // Bilingual disclaimer (private ground only, ABE voided, not for public roads) before the save button.
  const disc = $('patch-disclaimer');
  if (disc) {
    const de = (window.I18N.de && window.I18N.de.ownDevice) || '';
    const en = (window.I18N.en && window.I18N.en.ownDevice) || '';
    disc.textContent = de + (de && en ? '  ' : '') + en;
  }
  $('btn-save').textContent = t('btnSave');
  refreshFlashUI();
}

// user-facing label for a feature key (feat.<key>); falls back to the raw key
function featureLabel(f) { const k = 'feat.' + f; const v = t(k); return v === k ? f : v; }
// performance features default on; beep-* silences default off so all tones stay by default
function featureDefault(f) { return f.indexOf('beep') !== 0; }
function selectedFeatures() {
  return Array.from(document.querySelectorAll('#feature-checks input[type=checkbox]:checked')).map(c => c.value);
}
function renderFeatureChecks(features) {
  const box = $('feature-checks');
  if (!box) return;
  box.innerHTML = '';
  if (!features || !features.length) { box.hidden = true; return; }
  box.hidden = false;
  const head = document.createElement('div');
  head.className = 'res-k'; head.textContent = t('featTitle');
  box.appendChild(head);
  for (const f of features) {
    const lab = document.createElement('label');
    lab.className = 'feature-row';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.value = f; cb.checked = featureDefault(f);
    cb.addEventListener('change', repatch);
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(' ' + featureLabel(f)));
    box.appendChild(lab);
  }
}
// re-run the patch with the currently checked features (called on load and on every checkbox toggle)
function repatch() {
  if (!loadedBuf) return;
  let r;
  try { r = window.NVFW.patchFirmware(loadedBuf, selectedFeatures()); }
  catch (e) { setError(t('errPrefix') + ' ' + e.message); $('result').hidden = true; return; }
  setError(null);
  r.srcName = loadedName;
  patchedResult = r;
  renderResult(r);
}

function onFile(file) {
  setError(null);
  $('result').hidden = true;
  const reader = new FileReader();
  reader.onload = () => {
    loadedBuf = reader.result; loadedName = file.name; flashDone = false;
    let info = null;
    try { info = window.NVFW.imageFeatures(new Uint8Array(loadedBuf)); } catch (e) {}
    renderFeatureChecks(info ? info.features : []);
    repatch();
  };
  reader.onerror = () => setError(t('errRead'));
  reader.readAsArrayBuffer(file);
}

function savePatched() {
  if (!patchedResult) return;
  const blob = new Blob([patchedResult.bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = patchedName(patchedResult.srcName);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- protocol log ----------
function hexs(b) { return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' '); }
// Append one line to the protocol log. cls colors TX/RX wire frames; status lines pass no class.
function log(msg, cls) {
  const el = $('log');
  if (!el) return;
  const span = document.createElement('span');
  if (cls) span.className = cls;
  span.textContent = msg + '\n';
  el.appendChild(span);
  el.scrollTop = el.scrollHeight;
}
// Status/flow messages share the same log as the wire frames.
function flashLog(msg) { log(msg); }
function osNewline() {
  const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || '';
  return /win/i.test(p) ? '\r\n' : '\n';
}
function copyLog() {
  const el = $('log'); if (!el) return;
  const text = (el.textContent || '').replace(/\r?\n/g, osNewline());
  const done = () => { const b = $('btn-copy-log'); if (b) { const o = b.textContent; b.textContent = t('btnCopied'); setTimeout(() => { b.textContent = o; }, 1200); } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    if (done) done();
  } catch (e) {}
}
function clearLog() { const el = $('log'); if (el) el.textContent = ''; }

// ---------- flash card ----------
function setPhase(txt) { $('flash-phase').textContent = txt; }
function setProgress(pct) { $('flash-bar').style.width = pct + '%'; $('flash-pct').textContent = pct + '%'; }

// ---------- connect + model ----------
function setConMsg(msg) {
  const el = $('con-msg');
  if (!el) return;
  if (!msg) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false; el.textContent = msg;
}

// Resolve the model from the serial and refresh the model display + gating.
function detectModel(sn) {
  detectedPid = pidOf(sn);
  detectedModel = detectedPid ? (MODELS[detectedPid] || null) : null;
  renderModel();
}
// Show the detected model in the connect card and the download card.
function renderModel() {
  let txt;
  if (!connected) txt = t('conModelWait');
  else if (detectedModel) txt = detectedModel;
  else if (detectedPid) txt = t('conModelUnknown').replace('%s', detectedPid);
  else txt = t('conModelNone');
  const a = $('con-model'); if (a) a.textContent = txt;
  const b = $('dl-model'); if (b) b.textContent = txt;
  renderDownload();
}

// ---------- download card ----------
function fmtSize(n) {
  return (Number.isFinite(n) && n >= 1024) ? Math.round(n / 1024) + ' KB' : (n || 0) + ' B';
}
function fileName(url) {
  const s = String(url).split('?')[0].split('/').pop();
  return s || String(url);
}
const DL_ORDER = ['meter', 'bldc', 'bms'];
const DL_LABEL = { meter: 'dlCompMeter', bldc: 'dlCompBldc', bms: 'dlCompBms' };

// Manifest model ids matching the detected pid, or null when nothing matches.
function dlCandidates() {
  if (!connected || !detectedPid) return null;
  const idx = (window.FW_MANIFEST && window.FW_MANIFEST.pidIndex) || {};
  const c = idx[detectedPid];
  return (c && c.length) ? c : null;
}
// One download row per component of the chosen manifest model.
function renderDownloadFiles(modelId) {
  const wrap = $('dl-files');
  wrap.textContent = '';
  const m = ((window.FW_MANIFEST && window.FW_MANIFEST.models) || {})[modelId];
  if (!m || !m.comps) return;
  for (const comp of DL_ORDER) {
    const c = m.comps[comp];
    if (!c) continue;
    const row = document.createElement('div'); row.className = 'dl-file';
    const info = document.createElement('div'); info.className = 'dl-file-info';
    const label = document.createElement('div'); label.className = 'dl-file-label';
    label.textContent = t(DL_LABEL[comp]);
    const meta = document.createElement('div'); meta.className = 'dl-file-meta mono';
    meta.textContent = fileName(c.url) + ' - ' + fmtSize(c.size) + ' - v' + c.vn;
    info.appendChild(label); info.appendChild(meta);
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = t('dlGet');
    // CORS-safe browser download: open the S3 URL in a new tab, never fetch it here.
    btn.addEventListener('click', () => window.open(c.url, '_blank', 'noopener'));
    row.appendChild(info); row.appendChild(btn);
    wrap.appendChild(row);
  }
}
// Drive the download card from the connection state and the detected model.
function renderDownload() {
  const variantsBox = $('dl-variants');
  const variantBtns = $('dl-variant-btns');
  const files = $('dl-files');
  const msg = $('dl-msg');
  if (!variantsBox || !variantBtns || !files || !msg) return;
  variantsBox.hidden = true; variantBtns.textContent = ''; files.textContent = '';
  const setMsg = (key) => {
    if (key) { msg.hidden = false; msg.textContent = t(key); }
    else { msg.hidden = true; msg.textContent = ''; }
  };
  if (!connected) { setMsg('dlConnectFirst'); return; }
  const cands = dlCandidates();
  if (!cands) { setMsg('dlNoFw'); return; }
  setMsg(null);
  if (cands.length === 1) { dlSelectedId = cands[0]; renderDownloadFiles(dlSelectedId); return; }

  // pid collision: let the user pick the build by its controller (bldc) version
  const models = (window.FW_MANIFEST && window.FW_MANIFEST.models) || {};
  if (dlSelectedId && cands.indexOf(dlSelectedId) < 0) dlSelectedId = null;
  variantsBox.hidden = false;
  cands.forEach((id) => {
    const m = models[id]; if (!m) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = (id === dlSelectedId) ? 'sel' : '';
    const v = (m.comps && m.comps.bldc) ? 'BLDC ' + m.comps.bldc.vn
      : ((m.comps && m.comps.meter) ? 'Meter ' + m.comps.meter.vn : '');
    btn.textContent = m.name + (v ? ' - ' + v : '');
    btn.addEventListener('click', () => { dlSelectedId = id; renderDownload(); });
    variantBtns.appendChild(btn);
  });
  if (dlSelectedId) renderDownloadFiles(dlSelectedId);
}

// Drive the numbered step cards: active = do this now, done = finished, pending = not yet reachable.
// Loading a stock .bin without connecting is still allowed (desktop), so the patch step opens as soon
// as either a device is connected or a file is loaded.
function updateSteps() {
  const set = (id, state) => { const el = $(id); if (el) el.setAttribute('data-state', state); };
  set('connect-card', connected ? 'done' : 'active');
  set('dl-card', !connected ? 'pending' : (loadedBuf ? 'done' : 'active'));
  set('patch-card', patchedResult ? 'done' : ((connected || loadedBuf) ? 'active' : 'pending'));
  set('flash-card', (patchedResult && connected) ? (flashDone ? 'done' : 'active') : 'pending');
}

// enable Flash only with a patched image, consent ticked, connected, and not already flashing
function refreshFlashUI() {
  const fileEl = $('flash-file');
  if (fileEl) fileEl.textContent = patchedResult ? patchedName(patchedResult.srcName) : t('flashNoFile');
  const consent = $('flash-consent') && $('flash-consent').checked;
  const flashBtn = $('btn-flash');
  if (flashBtn) {
    flashBtn.disabled = flashing || !connected || !consent || !patchedResult;
    flashBtn.textContent = flashing ? t('btnFlashing') : t('btnFlash');
  }
  const conBtn = $('btn-connect');
  if (conBtn) {
    conBtn.disabled = flashing || connected;
    conBtn.textContent = connected ? t('btnConnected') : t('btnConnect');
  }
  updateSteps();
}

// Reflect a dropped BLE link in the UI and the log.
function onDisconnect() {
  if (!connected) return;
  connected = false;
  flashDone = false;
  setStatus('disconnected');
  log('disconnected');
  refreshFlashUI();
}

async function onConnect() {
  const conBtn = $('btn-connect');
  conBtn.disabled = true; conBtn.textContent = t('btnConnecting');
  setConMsg(null);
  setStatus('connecting');
  try {
    const name = await window.NVFlash.connect();
    connected = true;
    setStatus('connected');
    if (window.NVFlash.device) window.NVFlash.device.addEventListener('gattserverdisconnected', onDisconnect, { once: true });
    flashLog('connected to ' + name);
    try {
      const sn = await window.NVFlash.readSerial();
      detectModel(sn);
      flashLog('serial ' + sn + ' -> ' + (detectedModel || ('pid ' + (detectedPid || '?'))));
    } catch (e) {
      detectModel('');
      flashLog('serial read failed: ' + te(e.message || String(e)));
      setConMsg(t('conNoModel'));
    }
  } catch (e) {
    connected = false;
    setStatus('disconnected');
    const m = te(e.message || String(e));
    if (e && e.name === 'NotFoundError') { /* user dismissed the chooser */ }
    else { flashLog('connect failed: ' + m); setConMsg(m); }
  }
  renderModel();
  refreshFlashUI();
}

async function onFlash() {
  if (!patchedResult || !connected || flashing) return;
  flashing = true;
  refreshFlashUI();
  $('flash-progress').hidden = false;
  setProgress(0); setPhase('');
  const cb = {
    n: patchedResult.kind === 'meter' ? 1 : 2,
    log: flashLog,
    phase: (k) => setPhase(t(k)),
    progress: setProgress,
  };
  try {
    await window.NVFlash.flash(patchedResult.bytes, cb);
    flashDone = true;
    setPhase(t('flPhDone'));
    flashLog(t('flOk'));
  } catch (e) {
    const m = te(e.message || String(e));
    setPhase(t('flPhError') + ': ' + m);
    flashLog('error: ' + m);
  }
  flashing = false;
  refreshFlashUI();
}

function onCancel() {
  try { window.NVFlash.cancel(); } catch (e) {}
  flashLog('cancel requested');
}

// ---------- language ----------
function initLang() {
  let saved = null; try { saved = localStorage.getItem('nvfw.lang'); } catch (e) {}
  if (saved === 'de' || saved === 'en') lang = saved;
  document.querySelectorAll('#langs button').forEach(b =>
    b.addEventListener('click', () => { lang = b.dataset.lang; try { localStorage.setItem('nvfw.lang', lang); } catch (e) {} applyLang(); }));
}

// ---------- theme ----------
function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const b = $('btn-theme');
  if (b) { b.textContent = dark ? '☀' : '☾'; b.setAttribute('aria-label', t(dark ? 'themeToLight' : 'themeToDark')); b.title = b.getAttribute('aria-label'); }
  try { localStorage.setItem('nvfw.theme', dark ? 'dark' : 'light'); } catch (e) {}
}
function initTheme() {
  let saved = null; try { saved = localStorage.getItem('nvfw.theme'); } catch (e) {}
  applyTheme(saved !== 'light');
  const b = $('btn-theme'); if (b) b.addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') === 'light'));
}

// ---------- document viewer ----------
const DOC_TITLES = {
  'GUIDE.de.md': 'footGuide', 'GUIDE.en.md': 'footGuide',
  'PRIVACY.de.md': 'footPrivacy', 'PRIVACY.md': 'footPrivacy',
  'LICENSE.de.md': 'footLicense', 'LICENSE.md': 'footLicense',
  'TRADEMARKS.de.md': 'footTrademarks', 'TRADEMARKS.md': 'footTrademarks',
  'README.md': 'footReadme',
};
const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const slug = s => s.toLowerCase().trim().replace(/[^\w\sÀ-ɏ-]/g, '').replace(/ /g, '-');
function mdToHtml(src) {
  const inline = s => escHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, text, href) => {
      if (DOC_TITLES[href]) return `<a href="${href}" data-docfile="${href}">${text}</a>`;
      if (href.startsWith('#')) return `<a href="${href}" data-anchor="${href.slice(1)}">${text}</a>`;
      return `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
    });
  const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
  const out = []; let listKind = null, li = null, para = [], inFence = false;
  const sink = () => (li ? li.parts : out);
  const flushPara = () => { if (para.length) { sink().push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
  const closeNested = () => { if (li && li.nested) { li.parts.push('</ul>'); li.nested = false; } };
  const closeLi = () => { if (!li) return; flushPara(); closeNested(); out.push('<li>' + li.parts.join('\n') + '</li>'); li = null; };
  const closeList = () => { closeLi(); if (listKind) { out.push('</' + listKind + '>'); listKind = null; } };
  const block = () => { flushPara(); closeList(); };
  const openList = kind => { flushPara(); if (listKind !== kind) { closeList(); out.push('<' + kind + '>'); listKind = kind; } else closeLi(); };
  const cells = l => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], body = l.trim(), indented = /^ {2,}\S/.test(l);
    if (inFence) { if (body.startsWith('```')) { sink().push('</code></pre>'); inFence = false; } else sink().push(escHtml(l)); continue; }
    if (body.startsWith('```')) { if (li) { flushPara(); closeNested(); } else block(); sink().push('<pre><code>'); inFence = true; continue; }
    if (body === '') { if (li && /^ {2,}\S/.test(lines[i + 1] || '')) flushPara(); else block(); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(body)) { block(); out.push('<hr>'); continue; }
    if (body.startsWith('|') && /^\|[\s:|-]+\|?\s*$/.test((lines[i + 1] || '').trim())) {
      if (li) { flushPara(); closeNested(); } else block();
      sink().push('<div class="doc-table"><table><thead><tr>' + cells(body).map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>');
      i++;
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) sink().push('<tr>' + cells(lines[++i].trim()).map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>');
      sink().push('</tbody></table></div>'); continue;
    }
    let m;
    if ((m = body.match(/^(#{1,4})\s+(.*)$/))) { block(); const n = m[1].length; out.push(`<h${n} id="${slug(m[2])}">${inline(m[2])}</h${n}>`); continue; }
    if ((m = body.match(/^>\s?(.*)$/))) { if (li) { flushPara(); closeNested(); } else block(); sink().push('<blockquote>' + inline(m[1]) + '</blockquote>'); continue; }
    if (indented && li && (m = body.match(/^[-*]\s+(.*)$/))) { flushPara(); if (!li.nested) { li.parts.push('<ul class="nested">'); li.nested = true; } li.parts.push('<li>' + inline(m[1]) + '</li>'); continue; }
    if ((m = body.match(/^[-*]\s+(.*)$/)) && !indented) { openList('ul'); li = { parts: [inline(m[1])], nested: false }; continue; }
    if ((m = body.match(/^\d+\.\s+(.*)$/)) && !indented) { openList('ol'); li = { parts: [inline(m[1])], nested: false }; continue; }
    if (li && !indented) closeList();
    if (li) closeNested();
    para.push(body);
  }
  if (inFence) sink().push('</code></pre>');
  block();
  return out.join('\n').replace(/<pre><code>\n/g, '<pre><code>');
}
const docCache = {};
const docFile = name => name === 'GUIDE' ? `GUIDE.${lang}.md` : name === 'README' ? 'README.md' : (lang === 'de' ? `${name}.de.md` : `${name}.md`);
function openDoc(name, anchor, titleKey) { openDocFile(docFile(name), anchor, titleKey); }
function openDocFile(file, anchor, titleKey) {
  const dlg = $('doc'), body = $('doc-body'); if (!dlg || !body) return;
  const mark = (lang === 'de' && !file.includes('.de.') && file !== 'README.md') ? ' ' + t('docEnglish') : '';
  $('doc-title').textContent = (t(titleKey || DOC_TITLES[file] || '') || file) + mark;
  if (typeof dlg.showModal === 'function') dlg.showModal();
  const show = html => {
    body.innerHTML = html;
    const h1 = body.querySelector('h1'); if (h1) { $('doc-title').textContent = h1.textContent.trim() + mark; h1.remove(); }
    body.scrollTop = 0;
    if (anchor) { const tgt = body.querySelector('#' + (window.CSS && CSS.escape ? CSS.escape(anchor) : anchor)); if (tgt) body.scrollTop = tgt.offsetTop - body.offsetTop; }
  };
  if (docCache[file]) { show(docCache[file]); return; }
  body.innerHTML = '<p>' + escHtml(t('docLoading')) + '</p>';
  fetch(file + '?v=' + BUILD).then(r => { if (!r.ok) throw new Error(r.status + ' ' + r.statusText); return r.text(); })
    .then(txt => { docCache[file] = mdToHtml(txt); show(docCache[file]); })
    .catch(e => { body.innerHTML = '<p>' + escHtml(t('docFail')) + '</p><pre>' + escHtml(file + ': ' + (e && e.message ? e.message : e)) + '</pre>'; });
}
function wireDocViewer() {
  document.addEventListener('click', e => {
    if (!e.target.closest) return;
    const jump = e.target.closest('[data-anchor]');
    if (jump) { e.preventDefault(); const body = $('doc-body'); const tgt = body && body.querySelector('#' + CSS.escape(jump.getAttribute('data-anchor'))); if (tgt) body.scrollTop = tgt.offsetTop - body.offsetTop; return; }
    const a = e.target.closest('[data-doc], [data-docfile]'); if (!a) return;
    e.preventDefault();
    { const h = $('help'); if (h && h.open && h.close) h.close(); }   // if a doc link was clicked inside the help popup, close it first
    const file = a.getAttribute('data-docfile'), titleKey = a.getAttribute('data-t') || '';
    if (file) openDocFile(file, '', titleKey); else openDoc(a.getAttribute('data-doc'), '', titleKey);
  });
  ['doc-x', 'doc-close'].forEach(id => { const b = $(id); if (b) b.addEventListener('click', () => { const d = $('doc'); if (d) d.close(); }); });
}

// ---------- help modal ----------
const HELP = {
  connect: ['conTitle', 'connectHelp'],
  flash: ['s3Title', 'flashHelp'],
  disclaimer: ['footDisclaimer', 'disclaimerText'],
};
function openHelp(key) { const m = HELP[key]; if (!m) return; const dlg = $('help'); if (!dlg) return; $('help-title').textContent = t(m[0]); $('help-body').innerHTML = t(m[1]); if (typeof dlg.showModal === 'function') dlg.showModal(); }
function closeHelp() { const d = $('help'); if (d && d.close) d.close(); }
function wireHelp() {
  document.querySelectorAll('.help-btn').forEach(b => b.addEventListener('click', () => openHelp(b.getAttribute('data-help'))));
  ['help-x', 'help-close'].forEach(id => { const b = $(id); if (b) b.addEventListener('click', closeHelp); });
  const dis = $('link-disclaimer'); if (dis) dis.addEventListener('click', e => { e.preventDefault(); openHelp('disclaimer'); });
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-open-disclaimer]')) { e.preventDefault(); openHelp('disclaimer'); } });
}

document.addEventListener('DOMContentLoaded', () => {
  initLang();
  initTheme();
  wireDocViewer();
  wireHelp();
  applyLang();
  $('fw-in').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) onFile(f);
  });
  $('btn-save').addEventListener('click', savePatched);
  $('flash-consent').addEventListener('change', refreshFlashUI);
  $('btn-connect').addEventListener('click', onConnect);
  $('btn-flash').addEventListener('click', onFlash);
  $('btn-cancel').addEventListener('click', onCancel);
  $('btn-copy-log').addEventListener('click', copyLog);
  $('btn-clear-log').addEventListener('click', clearLog);
  // Route every raw BLE frame into the protocol log: TX one colour, RX the other.
  window.NVFlash.wire = (dir, bytes) => log((dir === 'tx' ? 'TX ' : 'RX ') + hexs(bytes), dir === 'tx' ? 'log-tx' : 'log-rx');
  log('NAVEE Firmware ' + BUILD);
  if (!('bluetooth' in navigator)) flashLog(t('flErrNoBluetooth'));
});
