/* ══════════════════════════════════════════════════════════════
   conn-detect.js  —  WiFi / Connection Intelligence Panel
   Save as:  static/conn-detect.js
   Load AFTER script.js in index.html

   Uses navigator.connection (Network Information API)
     conn.type          → wifi | ethernet | cellular | none | other
     conn.effectiveType → slow-2g | 2g | 3g | 4g
     conn.downlink      → estimated download Mbps (browser hint)
     conn.rtt           → round-trip estimate in ms (browser hint)
     conn.saveData      → true if Data Saver mode is ON

   Two UI targets:
   ① Inline strip  — lives inside the main speed-test card right column
                    gives a compact one-line summary at a glance
   ② Full card     — dedicated feature-grid card with hero, 2×2 metric
                    grid, live change log, and smart tip banner

   Falls back gracefully for Firefox / Safari (no Network Info API)
══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── DOM shortcuts ─────────────────────────────────────── */
  const $ = id => document.getElementById(id);

  /* Full card */
  const badge      = $('cd-badge');
  const iconWrap   = $('cd-icon');
  const iconEl     = $('cd-icon-i');
  const typeLabel  = $('cd-type-label');
  const typeSub    = $('cd-type-sub');
  const qualPill   = $('cd-quality-pill');
  const valDown    = $('cdv-downlink');
  const valRtt     = $('cdv-rtt');
  const valEff     = $('cdv-eff');
  const valSave    = $('cdv-save');
  const barDown    = $('cdb-downlink');
  const barRtt     = $('cdb-rtt');
  const cardDown   = $('cdm-downlink');
  const cardRtt    = $('cdm-rtt');
  const logScroll  = $('cd-log-scroll');
  const logCount   = $('cd-log-count');
  const tipEl      = $('cd-tip');

  /* Inline strip */
  const strip      = $('cd-strip');
  const stripIcon  = $('cd-strip-icon-i');
  const stripType  = $('cd-strip-type');
  const stripSub   = $('cd-strip-sub');
  const stripDl    = $('cd-strip-dl');
  const stripRtt   = $('cd-strip-rtt');
  const stripQual  = $('cd-strip-quality');

  let logEntries = 0;

  /* ── Connection type metadata ──────────────────────────── */
  const TYPE_META = {
    wifi:      { label: 'WiFi',       sub: 'Wireless LAN connection',     icon: 'fa-wifi',            cls: 'wifi',    stripCls: 'wifi-strip'  },
    ethernet:  { label: 'Ethernet',   sub: 'Wired broadband connection',  icon: 'fa-ethernet',        cls: 'eth',     stripCls: 'eth-strip'   },
    cellular:  { label: 'Cellular',   sub: 'Mobile data connection',      icon: 'fa-signal',          cls: 'cell',    stripCls: 'cell-strip'  },
    wimax:     { label: 'WiMAX',      sub: 'Wireless broadband (WiMAX)',  icon: 'fa-tower-broadcast', cls: 'cell',    stripCls: 'cell-strip'  },
    bluetooth: { label: 'Bluetooth',  sub: 'Bluetooth tether',            icon: 'fa-bluetooth-b',     cls: 'slow',    stripCls: 'slow-strip'  },
    none:      { label: 'Offline',    sub: 'No network connection',       icon: 'fa-circle-xmark',    cls: 'slow',    stripCls: 'slow-strip'  },
    other:     { label: 'Other',      sub: 'Unclassified connection',     icon: 'fa-network-wired',   cls: 'unknown', stripCls: ''            },
    unknown:   { label: 'Unknown',    sub: 'Type not reported',           icon: 'fa-circle-question', cls: 'unknown', stripCls: ''            },
  };

  /* ── Effective type display labels ────────────────────── */
  const EFF_LABEL = {
    'slow-2g': '2G Slow',
    '2g':      '2G',
    '3g':      '3G',
    '4g':      '4G / LTE',
  };

  /* ── Quality rating ────────────────────────────────────── */
  function rateQuality(downlink, rtt, effType) {
    if (downlink == null && rtt == null) {
      if (effType === '4g')                         return { t: 'Good',      c: 'good'      };
      if (effType === '3g')                         return { t: 'Fair',      c: 'fair'      };
      if (effType === '2g' || effType === 'slow-2g') return { t: 'Poor',    c: 'poor'      };
      return { t: '—', c: '' };
    }
    const dl = downlink ?? 10;
    const rt = rtt      ?? 100;
    if (dl >= 25 && rt <= 60)  return { t: 'Excellent', c: 'excellent' };
    if (dl >= 10 && rt <= 150) return { t: 'Good',      c: 'good'      };
    if (dl >= 2  && rt <= 400) return { t: 'Fair',      c: 'fair'      };
    return { t: 'Poor', c: 'poor' };
  }

  /* ── Smart tip builder ─────────────────────────────────── */
  function buildTip(conn, qual) {
    const type = conn?.type || 'unknown';
    if (conn?.saveData)   return { t: '⚡ Data Saver is ON — your browser limits background data. Test results may be lower than actual speed.', c: 'warn' };
    if (type === 'none')  return { t: '⚠️ No network detected. You appear to be offline.', c: 'warn' };
    if (type === 'bluetooth') return { t: '⚠️ Bluetooth tethering detected — expect high latency and limited throughput.', c: 'warn' };
    if (qual.c === 'excellent') return { t: '✅ Connection looks great! Ideal conditions for an accurate speed test.', c: 'good' };
    if (qual.c === 'good')      return { t: '✅ Good connection. Speed test should give reliable results.', c: 'good' };
    if (qual.c === 'fair')      return { t: '⚡ Moderate connection detected. Results may be lower than your plan speed.', c: 'warn' };
    if (qual.c === 'poor')      return { t: '⚠️ Weak signal detected. Move closer to your router or switch to ethernet for best results.', c: 'warn' };
    return { t: '📶 Connection detected. Click Start Test for full results.', c: 'info' };
  }

  /* ── Bar width helpers ─────────────────────────────────── */
  const dlBarPct  = dl  => dl  == null ? 0 : Math.min(100, Math.round((dl  / 100)  * 100));
  const rttBarPct = rtt => rtt == null ? 0 : Math.min(100, Math.round((rtt / 600)  * 100));

  /* ── Append change-log entry ───────────────────────────── */
  function appendLog(msg) {
    const emptyEl = logScroll.querySelector('.cd-log-empty');
    if (emptyEl) emptyEl.remove();

    logEntries++;
    logCount.textContent = `${logEntries} event${logEntries > 1 ? 's' : ''}`;

    const ts = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const entry = document.createElement('div');
    entry.className = 'cd-log-entry';
    entry.innerHTML = `
      <span class="cd-log-time">${ts}</span>
      <span class="cd-log-dot"></span>
      <span>${msg}</span>`;
    logScroll.insertBefore(entry, logScroll.firstChild);
    while (logScroll.children.length > 20) logScroll.removeChild(logScroll.lastChild);
  }

  /* ── Render inline strip ────────────────────────────────── */
  function renderStrip(conn, meta, qual) {
    const type      = conn?.type          ?? 'unknown';
    const downlink  = conn?.downlink      ?? null;
    const rtt       = conn?.rtt           ?? null;
    const effType   = conn?.effectiveType ?? null;

    strip.className = `cd-inline-strip ${meta.stripCls}`;
    stripIcon.className = `fa-solid ${meta.icon}`;

    if (type === 'cellular' && effType) {
      stripType.textContent = `${meta.label} — ${EFF_LABEL[effType] || effType}`;
    } else {
      stripType.textContent = meta.label;
    }
    stripSub.textContent = meta.sub;
    stripDl.textContent = downlink != null ? `${downlink.toFixed(1)} Mbps` : 'N/A Mbps';
    stripRtt.textContent = rtt != null ? `${rtt} ms RTT` : 'N/A RTT';
    stripQual.textContent = qual.t;
    stripQual.className   = `cd-strip-pill ${qual.c}`;
  }

  /* ── Render full card ───────────────────────────────────── */
  function renderCard(conn, meta, qual, isChange) {
    const type      = conn?.type          ?? 'unknown';
    const downlink  = conn?.downlink      ?? null;
    const rtt       = conn?.rtt           ?? null;
    const effType   = conn?.effectiveType ?? null;
    const saveData  = conn?.saveData      ?? false;

    iconWrap.className = `cd-type-icon ${meta.cls}`;
    iconEl.className   = `fa-solid ${meta.icon}`;

    typeLabel.textContent = meta.label;
    if (type === 'cellular' && effType) {
      typeSub.textContent = `${EFF_LABEL[effType] || effType} mobile connection`;
    } else {
      typeSub.textContent = meta.sub;
    }

    qualPill.textContent = qual.t;
    qualPill.className   = `cd-quality-pill ${qual.c}`;

    if (downlink != null) {
      valDown.textContent     = downlink.toFixed(1);
      barDown.style.width     = dlBarPct(downlink) + '%';
      cardDown.classList.add('lit');
    } else {
      valDown.textContent     = 'N/A';
      barDown.style.width     = '0%';
      cardDown.classList.remove('lit');
    }

    if (rtt != null) {
      valRtt.textContent  = rtt;
      barRtt.style.width  = rttBarPct(rtt) + '%';
      cardRtt.classList.add('lit');
    } else {
      valRtt.textContent  = 'N/A';
      barRtt.style.width  = '0%';
      cardRtt.classList.remove('lit');
    }

    valEff.textContent = effType ? (EFF_LABEL[effType] || effType) : 'N/A';
    valSave.textContent = saveData ? 'ON' : 'OFF';
    valSave.className   = `cd-metric-val ${saveData ? 'save-on' : 'save-off'}`;

    badge.textContent = isChange ? 'Updated' : 'Live';

    const tip = buildTip(conn, qual);
    tipEl.textContent = tip.t;
    tipEl.className   = `cd-tip ${tip.c}`;

    if (isChange) {
      const parts = [`Type → ${meta.label}`];
      if (downlink != null) parts.push(`Downlink ${downlink.toFixed(1)} Mbps`);
      if (rtt      != null) parts.push(`RTT ${rtt} ms`);
      if (effType)          parts.push(EFF_LABEL[effType] || effType);
      appendLog(parts.join(' · '));
    }
  }

  /* ── Combined render ────────────────────────────────────── */
  function render(conn, isChange = false) {
    const type = conn?.type ?? 'unknown';
    const meta = TYPE_META[type] || TYPE_META['unknown'];
    const qual = rateQuality(conn?.downlink ?? null, conn?.rtt ?? null, conn?.effectiveType ?? null);

    renderStrip(conn, meta, qual);
    renderCard(conn, meta, qual, isChange);
  }

  /* ── No API fallback ────────────────────────────────────── */
  function renderUnavailable() {
    strip.className = 'cd-inline-strip';
    stripIcon.className = 'fa-solid fa-circle-question';
    stripType.textContent = 'API Unavailable';
    stripSub.textContent  = 'Use Chrome/Edge for connection data';
    stripDl.textContent   = 'N/A';
    stripRtt.textContent  = 'N/A';
    stripQual.textContent = '—';
    stripQual.className   = 'cd-strip-pill';

    iconWrap.className    = 'cd-type-icon unknown';
    iconEl.className      = 'fa-solid fa-circle-question';
    typeLabel.textContent = 'API Unavailable';
    typeSub.textContent   = 'navigator.connection not supported in this browser';
    qualPill.textContent  = '—';
    qualPill.className    = 'cd-quality-pill';
    badge.textContent     = 'No API';
    ['cdv-downlink','cdv-rtt','cdv-eff','cdv-save'].forEach(id => $(id).textContent = 'N/A');
    tipEl.textContent = '⚠️ Network Information API not available. Supported in Chrome, Edge, Opera, and Samsung Internet. Firefox and Safari do not support it.';
    tipEl.className   = 'cd-tip warn';

    appendLog('navigator.connection API not available in this browser');
  }

  /* ── Init ───────────────────────────────────────────────── */
  function init() {
    const conn = navigator.connection
               || navigator.mozConnection
               || navigator.webkitConnection;

    if (!conn) { renderUnavailable(); return; }

    render(conn, false);
    appendLog(
      `Scan — type:${conn.type || '?'}  eff:${conn.effectiveType || '?'}` +
      (conn.downlink != null ? `  ↓${conn.downlink}Mbps` : '') +
      (conn.rtt      != null ? `  rtt:${conn.rtt}ms`     : '')
    );

    conn.addEventListener('change', () => render(conn, true));

    window.addEventListener('online', () => {
      appendLog('Browser came ONLINE');
      render(conn, true);
    });
    window.addEventListener('offline', () => {
      appendLog('Browser went OFFLINE');
      strip.className       = 'cd-inline-strip slow-strip';
      stripIcon.className   = 'fa-solid fa-circle-xmark';
      stripType.textContent = 'Offline';
      stripSub.textContent  = 'No network connection';
      stripQual.textContent = 'Offline';
      stripQual.className   = 'cd-strip-pill poor';
      iconWrap.className    = 'cd-type-icon slow';
      iconEl.className      = 'fa-solid fa-circle-xmark';
      typeLabel.textContent = 'Offline';
      qualPill.textContent  = 'No Signal';
      qualPill.className    = 'cd-quality-pill poor';
      badge.textContent     = 'Offline';
      tipEl.textContent     = '⚠️ No network connection. Check your router or mobile data.';
      tipEl.className       = 'cd-tip warn';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();