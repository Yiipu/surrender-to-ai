const themeKey = 'theme';
const themeSwitcher = document.getElementById('theme-switcher');

function applyTheme(mode) {
  if (mode === 'auto') {
    document.documentElement.removeAttribute('data-theme');
    return;
  }
  document.documentElement.dataset.theme = mode;
}

const savedTheme = localStorage.getItem(themeKey) || 'auto';
themeSwitcher.value = savedTheme;
applyTheme(savedTheme);

themeSwitcher.addEventListener('change', e => {
  const mode = e.target.value;
  localStorage.setItem(themeKey, mode);
  applyTheme(mode);
});

const receipt = document.getElementById('receipt');
const dlsig = document.getElementById('dlsig');
const dlots = document.getElementById('dlots');

const historySwitcher = document.getElementById('history-switcher');
const upgradeOtsBtn = document.getElementById('upgrade-ots');
const verifyOtsBtn = document.getElementById('verify-ots');
const clearCacheBtn = document.getElementById('clear-cache');

const metaEffective = document.getElementById('meta-effective');
const metaDocId = document.getElementById('meta-docid');

const rFilename = document.getElementById('r-filename');
const rSha256 = document.getElementById('r-sha256');
const rStatus = document.getElementById('r-status');
const rOtsUnavailable = document.getElementById('r-ots-unavailable');
const rVerifyLabel = document.getElementById('r-verify-label');
const rVerify = document.getElementById('r-verify');
const rErrorLabel = document.getElementById('r-error-label');
const rError = document.getElementById('r-error');

const DB_NAME = 'surrender-to-ai';
const DB_VERSION = 1;
const STORE = 'submissions';

let dbPromise = null;
let currentSubmissionId = null;
let currentJsonUrl = null;
let currentOtsUrl = null;

function setRuntimeI18n(el, key) {
  el.dataset.i18nRuntime = key;
  el.textContent = window.t ? window.t(key, key) : key;
}

function showError(message) {
  if (!message) {
    rError.hidden = true;
    rErrorLabel.hidden = true;
    rError.textContent = '';
    return;
  }
  rError.hidden = false;
  rErrorLabel.hidden = false;
  rError.textContent = message;
}

function resetVerifyResult() {
  if (!rVerify || !rVerifyLabel) return;
  rVerify.hidden = true;
  rVerifyLabel.hidden = true;
  rVerify.textContent = '';
}

function showVerifyResult(text) {
  if (!rVerify || !rVerifyLabel) return;
  if (!text) {
    resetVerifyResult();
    return;
  }
  rVerifyLabel.hidden = false;
  rVerify.hidden = false;
  rVerify.textContent = text;
}

function revokeUrlSafely(url) {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
}

function resetReceiptLinks() {
  revokeUrlSafely(currentJsonUrl);
  revokeUrlSafely(currentOtsUrl);
  currentJsonUrl = null;
  currentOtsUrl = null;

  dlsig.hidden = true;
  dlots.hidden = true;
  dlsig.removeAttribute('href');
  dlots.removeAttribute('href');

  resetVerifyResult();
}

// Note: currently unused; kept as a helper for potential future export needs.
function bytesToB64(uint8) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < uint8.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function b64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function openDb() {
  if (!('indexedDB' in window)) {
    throw new Error('IndexedDB not available');
  }

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

async function getDb() {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

async function saveSubmission(record) {
  const db = await getDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(record);
  });

  // Keep only 10 newest
  const all = await listSubmissions(100);
  const extra = all.slice(10);
  if (extra.length === 0) return;

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore(STORE);
    for (const r of extra) store.delete(r.id);
  });
}

async function listSubmissions(limit = 10) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const idx = store.index('createdAt');
    const req = idx.openCursor(null, 'prev');

    const out = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || out.length >= limit) {
        resolve(out);
        return;
      }
      out.push(cursor.value);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

async function getSubmission(id) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function clearSubmissions() {
  const db = await getDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).clear();
  });
}

function formatHistoryLabel(r) {
  const when = new Date(r.createdAt).toISOString();
  return `${when} • ${r.sha256.slice(0, 12)}`;
}

function setHistoryOptions(records) {
  historySwitcher.innerHTML = '';
  if (!records || records.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.dataset.i18n = 'history.empty';
    opt.textContent = window.t ? window.t('history.empty', 'No cached submissions') : 'No cached submissions';
    historySwitcher.appendChild(opt);
    historySwitcher.disabled = true;
    upgradeOtsBtn.disabled = true;
    verifyOtsBtn.disabled = true;
    currentSubmissionId = null;
    return;
  }

  for (const r of records) {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = formatHistoryLabel(r);
    historySwitcher.appendChild(opt);
  }

  historySwitcher.disabled = false;
}

function setActionButtonsDisabled(disabled) {
  upgradeOtsBtn.disabled = disabled || !currentSubmissionId;
  verifyOtsBtn.disabled = disabled || !currentSubmissionId;
  clearCacheBtn.disabled = disabled;
  historySwitcher.disabled = disabled;
}

function renderSubmission(record) {
  if (!record) return;

  currentSubmissionId = record.id;

  // Populate metadata + receipt fields.
  metaEffective.textContent = record.timestampISO;
  metaDocId.textContent = record.sha256.slice(0, 12);

  rFilename.textContent = record.filename;
  rSha256.textContent = record.sha256;

  receipt.hidden = false;
  resetReceiptLinks();
  showError('');

  // JSON download
  const jsonBlob = new Blob([record.jsonContent], { type: 'application/json' });
  currentJsonUrl = URL.createObjectURL(jsonBlob);
  dlsig.href = currentJsonUrl;
  dlsig.download = record.filename;
  dlsig.hidden = false;

  // OTS download
  const otsBytes = b64ToBytes(record.otsB64);
  const otsBlob = new Blob([otsBytes], { type: 'application/octet-stream' });
  currentOtsUrl = URL.createObjectURL(otsBlob);
  dlots.href = currentOtsUrl;
  dlots.download = record.filename + '.ots';
  dlots.hidden = false;

  rOtsUnavailable.hidden = false;
  setRuntimeI18n(rStatus, 'status.cached');

  upgradeOtsBtn.disabled = false;
  verifyOtsBtn.disabled = false;
}

async function refreshHistoryAndMaybeRestore(selectId = null) {
  try {
    setRuntimeI18n(rStatus, 'status.loading_cache');
    const records = await listSubmissions(10);
    setHistoryOptions(records);

    const idToLoad = selectId || records[0]?.id;
    if (idToLoad) {
      historySwitcher.value = idToLoad;
      const rec = await getSubmission(idToLoad);
      if (rec) renderSubmission(rec);
    } else {
      // No cache
      receipt.hidden = true;
      resetReceiptLinks();
      showError('');
    }
  } catch {
    // IndexedDB unavailable -> still allow one-shot usage.
    historySwitcher.disabled = true;
    upgradeOtsBtn.disabled = true;
    verifyOtsBtn.disabled = true;
    setRuntimeI18n(rStatus, 'status.cache_unavailable');
  }
}

historySwitcher.addEventListener('change', async e => {
  const id = e.target.value;
  if (!id) return;
  try {
    const rec = await getSubmission(id);
    if (rec) renderSubmission(rec);
  } catch (err) {
    showError(err?.message || String(err));
  }
});

upgradeOtsBtn.addEventListener('click', async () => {
  if (!currentSubmissionId) return;

  setActionButtonsDisabled(true);
  showError('');
  setRuntimeI18n(rStatus, 'status.upgrading');

  try {
    const rec = await getSubmission(currentSubmissionId);
    if (!rec) throw new Error('No cached submission');

    const r = await fetch('/.netlify/functions/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ots_b64: rec.otsB64, encoding: 'base64' })
    });

    const j = await r.json();
    if (!r.ok) {
      setRuntimeI18n(rStatus, 'status.failed');
      showError(j?.message || 'Upgrade failed');
      return;
    }

    if (j.encoding !== 'base64' || typeof j.ots_b64 !== 'string') {
      setRuntimeI18n(rStatus, 'status.failed');
      showError(window.t ? window.t('status.unexpected_response', 'Unexpected response from server') : 'Unexpected response from server');
      return;
    }

    const updated = {
      ...rec,
      otsB64: j.ots_b64,
      otsUpgradedAt: Date.now()
    };

    try {
      await saveSubmission(updated);
    } catch {
      // If cache fails, still update UI.
    }

    renderSubmission(updated);
    setRuntimeI18n(rStatus, 'status.ots_upgraded');
  } catch (err) {
    setRuntimeI18n(rStatus, 'status.failed');
    showError(err?.message || String(err));
  } finally {
    setActionButtonsDisabled(false);
    await refreshHistoryAndMaybeRestore(currentSubmissionId);
  }
});

function formatAttestedTime(ts) {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return String(ts);
  const ms = ts > 1e12 ? ts : ts * 1000;
  return new Date(ms).toISOString();
}

function formatAttestations(attestations) {
  if (!attestations || typeof attestations !== 'object') return '';
  const lines = [];
  for (const [chain, info] of Object.entries(attestations)) {
    if (info && typeof info === 'object') {
      const height = info.height;
      const timestamp = info.timestamp;
      if (typeof height !== 'undefined' || typeof timestamp !== 'undefined') {
        const parts = [];
        if (typeof height !== 'undefined') parts.push(`height ${height}`);
        if (typeof timestamp !== 'undefined') parts.push(`time ${formatAttestedTime(timestamp)}`);
        lines.push(`${chain}: ${parts.join(', ')}`);
        continue;
      }
    }
    try {
      lines.push(`${chain}: ${JSON.stringify(info)}`);
    } catch {
      lines.push(`${chain}: ${String(info)}`);
    }
  }
  return lines.join('\n');
}

verifyOtsBtn.addEventListener('click', async () => {
  if (!currentSubmissionId) return;

  setActionButtonsDisabled(true);
  showError('');
  setRuntimeI18n(rStatus, 'status.verifying');
  showVerifyResult(window.t ? window.t('status.verifying', 'Verifying…') : 'Verifying…');

  try {
    const rec = await getSubmission(currentSubmissionId);
    if (!rec) throw new Error('No cached submission');

    const r = await fetch('/.netlify/functions/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ots_b64: rec.otsB64, sha256: rec.sha256, encoding: 'base64' })
    });

    const j = await r.json();

    if (!r.ok) {
      setRuntimeI18n(rStatus, 'status.verify_failed');
      const msg = j?.message || 'Verification failed';
      showError(msg);
      showVerifyResult(msg);
      return;
    }

    if (j?.verified === true) {
      setRuntimeI18n(rStatus, 'status.verified');
      showVerifyResult(formatAttestations(j.attestations) || (window.t ? window.t('status.verified', 'Verified') : 'Verified'));
      return;
    }

    if (j?.verified === false && j?.reason === 'pending') {
      setRuntimeI18n(rStatus, 'status.verify_pending');
      const pending = window.t ? window.t('status.verify_pending', 'Pending') : 'Pending';
      const hint = window.t ? window.t('sec.verify.p2', 'Note: when a proof is freshly created, it may need time and/or upgrading before full verification succeeds.') : 'Note: when a proof is freshly created, it may need time and/or upgrading before full verification succeeds.';
      showVerifyResult(`${pending}\n${hint}`);
      return;
    }

    setRuntimeI18n(rStatus, 'status.verify_failed');
    const msg = j?.message || j?.reason || 'Verification failed';
    showError(msg);
    showVerifyResult(msg);
  } catch (err) {
    setRuntimeI18n(rStatus, 'status.verify_failed');
    const msg = err?.message || String(err);
    showError(msg);
    showVerifyResult(msg);
  } finally {
    setActionButtonsDisabled(false);
    await refreshHistoryAndMaybeRestore(currentSubmissionId);
  }
});

clearCacheBtn.addEventListener('click', async () => {
  const ok = confirm(window.t ? window.t('action.clear_cache_confirm', 'Clear cached submissions?') : 'Clear cached submissions?');
  if (!ok) return;

  try {
    await clearSubmissions();
    historySwitcher.innerHTML = '';
    setHistoryOptions([]);
    receipt.hidden = true;
    resetReceiptLinks();
    showError('');
    setRuntimeI18n(rStatus, 'status.cache_cleared');
  } catch (err) {
    showError(err?.message || String(err));
  }
});

// Restore cache on load
refreshHistoryAndMaybeRestore();

document.getElementById('surrenderForm').addEventListener('submit', async e => {
  e.preventDefault();

  const sign = {
    type: 'surrender-to-ai',
    name: document.getElementById('name').value.slice(0, 200).trim(),
    note: document.getElementById('note').value.slice(0, 2000).trim(),
    timestamp: new Date().toISOString()
  };

  const content = JSON.stringify(sign, null, 2);
  const sha256 = await computeSHA256(content);
  const filename = `${sign.timestamp.replace(/[:.]/g, '-')}-${sha256.slice(0, 10)}.json`;

  // Populate metadata + receipt fields.
  metaEffective.textContent = sign.timestamp;
  metaDocId.textContent = sha256.slice(0, 12);

  rFilename.textContent = filename;
  rSha256.textContent = sha256;

  receipt.hidden = false;
  resetReceiptLinks();
  showError('');
  setRuntimeI18n(rStatus, 'status.submitting');

  // Always offer the JSON for local download.
  const jsonBlob = new Blob([content], { type: 'application/json' });
  currentJsonUrl = URL.createObjectURL(jsonBlob);
  dlsig.href = currentJsonUrl;
  dlsig.download = filename;
  dlsig.hidden = false;

  try {
    const r = await fetch('/.netlify/functions/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, sha256 })
    });

    const j = await r.json();

    if (!r.ok) {
      setRuntimeI18n(rStatus, 'status.failed');
      showError(j?.message || 'Request failed');
      return;
    }

    if (j.encoding !== 'base64' || typeof j.ots_b64 !== 'string') {
      setRuntimeI18n(rStatus, 'status.failed');
      showError(window.t ? window.t('status.unexpected_response', 'Unexpected response from server') : 'Unexpected response from server');
      return;
    }

    const otsBytes = b64ToBytes(j.ots_b64);
    const otsBlob = new Blob([otsBytes], { type: 'application/octet-stream' });
    currentOtsUrl = URL.createObjectURL(otsBlob);

    dlots.href = currentOtsUrl;
    dlots.download = filename + '.ots';
    dlots.hidden = false;

    rOtsUnavailable.hidden = false;

    const createdAt = Date.now();
    const record = {
      id: `${createdAt}-${sha256.slice(0, 12)}`,
      createdAt,
      timestampISO: sign.timestamp,
      filename,
      sha256,
      jsonContent: content,
      otsB64: j.ots_b64
    };

    try {
      await saveSubmission(record);
      setRuntimeI18n(rStatus, 'status.cached');
      await refreshHistoryAndMaybeRestore(record.id);
    } catch {
      // If IndexedDB fails, still allow one-shot downloads.
      setRuntimeI18n(rStatus, 'status.cache_unavailable');
      currentSubmissionId = null;
    }

    return;
  } catch (err) {
    setRuntimeI18n(rStatus, 'status.failed');
    showError(err?.message || String(err));
  }
});

async function computeSHA256(content) {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}
