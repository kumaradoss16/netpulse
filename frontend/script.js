/* ========================================================================
   NetPulse – Cloudflare Edition (frontend)
   - Uses Cloudflare Worker API as backend:
     /get-ip, /get-geoip, /get-servers, /download-test, /upload-test, /run-speedtest
   ======================================================================== */

const API_BASE = "https://net-pulse-api.kumaradoss16.workers.dev";

/* ───────────────────────────── Navbar + Brand typing ───────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.querySelector(".menu-toggle");
  const navLinks = document.querySelector(".nav-links");
  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      navLinks.classList.toggle("active");
      const icon = menuToggle.querySelector("i");
      if (!icon) return;
      if (navLinks.classList.contains("active")) {
        icon.classList.remove("fa-bars");
        icon.classList.add("fa-times");
      } else {
        icon.classList.remove("fa-times");
        icon.classList.add("fa-bars");
      }
    });
  }

  // Brand typing effect
  (function () {
    const el = document.getElementById("brand");
    if (!el) return;
    const text = el.dataset.text || "DevSpireHub";
    let i = 0;
    let isDeleting = false;
    const typeSpeed = 100;
    const deleteSpeed = 50;
    const pauseTime = 2000;
    const restartPause = 500;

    function typeLoop() {
      const currentText = text.slice(0, i);
      el.textContent = currentText;
      if (!isDeleting && i < text.length) {
        i++;
        setTimeout(typeLoop, typeSpeed);
      } else if (!isDeleting && i === text.length) {
        isDeleting = true;
        setTimeout(typeLoop, pauseTime);
      } else if (isDeleting && i > 0) {
        i--;
        setTimeout(typeLoop, deleteSpeed);
      } else if (isDeleting && i === 0) {
        isDeleting = false;
        setTimeout(typeLoop, restartPause);
      }
    }
    typeLoop();
  })();

  // Init dashboard on DOM ready
  initNetPulse();
});

/* ══════════════════════════════════════════════════════
   SPEEDOMETER GAUGE
   ══════════════════════════════════════════════════════ */

const C = document.getElementById("speedo"),
  ctx = C.getContext("2d");
const W = C.width,
  H = C.height,
  CX = W / 2,
  CY = H / 2,
  MAX = 200;
const R_OUT = 120,
  R_IN = 97,
  R_T = 90,
  R_L = 77,
  R_G1 = 92,
  R_G2 = 80;
const SEG = 120,
  GAP = 0.018;
const A0 = (210 * Math.PI) / 180,
  AR = (300 * Math.PI) / 180;
const vA = v => A0 + (Math.min(Math.max(v, 0), MAX) / MAX) * AR;

function sCol(i, n, lit) {
  const t = i / n;
  let r, g, b;
  if (t < 0.33) {
    const p = t / 0.33;
    r = Math.round(248 + (34 - 248) * p);
    g = Math.round(113 + (211 - 113) * p);
    b = Math.round(113 + (238 - 113) * p);
  } else if (t < 0.66) {
    const p = (t - 0.33) / 0.33;
    r = Math.round(34 + (129 - 34) * p);
    g = Math.round(211 + (140 - 211) * p);
    b = Math.round(238 + (248 - 238) * p);
  } else {
    const p = (t - 0.66) / 0.34;
    r = Math.round(129 + (52 - 129) * p);
    g = Math.round(140 + (211 - 140) * p);
    b = Math.round(248 + (153 - 248) * p);
  }
  return `rgba(${r},${g},${b},${lit ? 0.9 : 0.07})`;
}

const SEGS = Array.from({ length: SEG }, (_, i) => ({
  a0: A0 + (i / SEG) * AR,
  a1: A0 + (i / SEG) * AR + AR / SEG - GAP
}));

const TICKS = [0, 50, 100, 150, 200].map(v => {
  const a = vA(v),
    ca = Math.cos(a),
    sa = Math.sin(a);
  return {
    v,
    ox: CX + R_T * ca,
    oy: CY + R_T * sa,
    ix: CX + (R_T - 9) * ca,
    iy: CY + (R_T - 9) * sa,
    lx: CX + R_L * ca,
    ly: CY + R_L * sa
  };
});

function draw(val) {
  ctx.clearRect(0, 0, W, H);
  const lit = Math.round((val / MAX) * SEG);
  SEGS.forEach(({ a0, a1 }, i) => {
    ctx.beginPath();
    ctx.arc(CX, CY, R_OUT, a0, a1);
    ctx.arc(CX, CY, R_IN, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = sCol(i, SEG, i < lit);
    ctx.fill();
  });
  const f = ctx.createRadialGradient(CX, CY, 0, CX, CY, R_IN);
  f.addColorStop(0, "#141414");
  f.addColorStop(1, "#0e0e0e");
  ctx.beginPath();
  ctx.arc(CX, CY, R_IN - 2, 0, Math.PI * 2);
  ctx.fillStyle = f;
  ctx.fill();
  if (val > 1) {
    const ga = vA(val);
    ctx.save();
    ctx.shadowBlur = 16;
    ctx.shadowColor = "#22d3ee";
    ctx.beginPath();
    ctx.arc(CX, CY, R_G1, A0, ga);
    ctx.strokeStyle = "#22d3ee18";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#818cf8";
    ctx.beginPath();
    ctx.arc(CX, CY, R_G2, A0, ga);
    ctx.strokeStyle = "#818cf815";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
  TICKS.forEach(({ ox, oy, ix, iy, lx, ly, v }) => {
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ix, iy);
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.font = "600 8px Inter,Segoe UI,sans-serif";
    ctx.fillStyle = "#3f3f46";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(v, lx, ly);
  });
  const na = vA(val),
    nt = R_IN - 7,
    ntl = 18,
    p2 = na + Math.PI / 2;
  const tx = CX + nt * Math.cos(na),
    ty = CY + nt * Math.sin(na),
    bx = CX - ntl * Math.cos(na),
    by = CY - ntl * Math.sin(na);
  const p1x = CX + 4 * Math.cos(p2),
    p1y = CY + 4 * Math.sin(p2),
    p2x = CX - 4 * Math.cos(p2),
    p2y = CY - 4 * Math.sin(p2);
  ctx.save();
  ctx.shadowBlur = 14;
  ctx.shadowColor = "#22d3ee";
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(p1x, p1y);
  ctx.lineTo(bx, by);
  ctx.lineTo(p2x, p2y);
  ctx.closePath();
  const ng = ctx.createLinearGradient(bx, by, tx, ty);
  ng.addColorStop(0, "#111111");
  ng.addColorStop(0.5, "#22d3ee");
  ng.addColorStop(1, "#e0f9ff");
  ctx.fillStyle = ng;
  ctx.fill();
  ctx.restore();
  const pg = ctx.createRadialGradient(CX, CY, 0, CX, CY, 12);
  pg.addColorStop(0, "#ffffff14");
  pg.addColorStop(0.35, "#22d3ee");
  pg.addColorStop(0.7, "#0c3a4a");
  pg.addColorStop(1, "#0a0a0a");
  ctx.beginPath();
  ctx.arc(CX, CY, 12, 0, Math.PI * 2);
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(CX, CY, 12, 0, Math.PI * 2);
  ctx.strokeStyle = "#22d3ee20";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(CX, CY, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "#22d3ee";
  ctx.fill();
  const dv = document.getElementById("dr-val");
  if (dv) dv.textContent = Math.round(val);
}

// Needle physics
const C2 = {
  k: 0.045,
  f: 0.78,
  wk: 0.032,
  wf: 0.82,
  wa: 0.14,
  wa2: 0.04,
  wn: 0.025,
  wq: 0.038,
  wr: 0.3,
  ev: 0.018,
  ep: 0.04
};
let pos = 0,
  vel = 0,
  tgt = 0,
  md = "idle",
  wc = 0,
  wcl = 0,
  ph = 0,
  raf = null;

function tick() {
  if (md === "wobble") {
    if (wc < wcl) wc = Math.min(wc + C2.wr, wcl);
    ph += C2.wq;
    const o =
      Math.sin(ph) * wc * C2.wa +
      Math.sin(ph * 2.3) * wc * C2.wa2 +
      (Math.random() - 0.5) * wc * C2.wn;
    vel += (Math.max(0, wc + o) - pos) * C2.wk;
    vel *= C2.wf;
  } else {
    vel += (tgt - pos) * C2.k;
    vel *= C2.f;
    if (Math.abs(vel) < C2.ev && Math.abs(tgt - pos) < C2.ep) {
      pos = tgt;
      vel = 0;
      draw(pos);
      raf = null;
      return;
    }
  }
  pos = Math.max(0, pos + vel);
  draw(pos);
  raf = requestAnimationFrame(tick);
}

const loop = () => {
  if (!raf) raf = requestAnimationFrame(tick);
};
const nSet = v => {
  md = "spring";
  tgt = Math.min(v, MAX);
  loop();
};
const nWob = c => {
  md = "wobble";
  wcl = Math.min(c, MAX);
  wc = pos;
  ph = 0;
  vel *= 0.4;
  loop();
};
const nRst = () => {
  md = "spring";
  tgt = 0;
  loop();
};

draw(0);

/* ══════════════════════════════════════════════════════
   Loading bars
   ══════════════════════════════════════════════════════ */

let lbInt = null;
function showLB(t) {
  const row = document.getElementById(`lb-${t}`),
    fill = document.getElementById(`lb-${t}-fill`),
    pct = document.getElementById(`lb-${t}-pct`);
  if (!row || !fill || !pct) return;
  row.classList.remove("hidden");
  fill.style.width = "0%";
  pct.textContent = "0%";
  pct.className = "lb-pct active";
  let p = 0;
  clearInterval(lbInt);
  lbInt = setInterval(() => {
    const s = Math.max(0.3, (92 - p) * 0.025);
    p = Math.min(p + s, 92);
    fill.style.width = p + "%";
    pct.textContent = Math.round(p) + "%";
    if (p >= 92) clearInterval(lbInt);
  }, 80);
}
function doneLB(t) {
  clearInterval(lbInt);
  const fill = document.getElementById(`lb-${t}-fill`),
    pct = document.getElementById(`lb-${t}-pct`),
    row = document.getElementById(`lb-${t}`);
  if (!fill || !pct || !row) return;
  fill.style.transition = "width .5s ease";
  fill.style.width = "100%";
  pct.textContent = "100%";
  pct.className = "lb-pct";
  setTimeout(() => {
    row.classList.add("hidden");
    fill.style.transition = "";
    fill.style.width = "0%";
  }, 900);
}
function hideAllLB() {
  clearInterval(lbInt);
  ["dl", "ul"].forEach(t => {
    const row = document.getElementById(`lb-${t}`),
      fill = document.getElementById(`lb-${t}-fill`),
      pct = document.getElementById(`lb-${t}-pct`);
    if (!row || !fill || !pct) return;
    row.classList.add("hidden");
    fill.style.width = "0%";
    pct.textContent = "0%";
  });
}

/* ══════════════════════════════════════════════════════
   GeoIP (via Worker /get-geoip)
   ══════════════════════════════════════════════════════ */

let lastGeoIP = null;

async function fetchGeoIP() {
  const badge = document.getElementById("geo-badge");
  if (badge) badge.textContent = "Loading";
  ["geo-isp", "geo-loc", "geo-country", "geo-tz", "geo-host"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = "—";
      el.className = "geo-val loading";
    }
  });
  try {
    const res = await fetch(API_BASE + "/get-geoip", { cache: "no-store" });
    const d = await res.json();
    if (d.error) throw new Error(d.error);
    lastGeoIP = d;
    const isp = (d.isp || "").replace(/^AS\d+\s+/, "");
    function set(id, v) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = v || "—";
      el.className = "geo-val";
    }
    set("geo-isp", isp);
    set("geo-loc", d.city);
    set("geo-country", `${d.country} — ${d.region}`);
    set("geo-tz", d.timezone);
    set("geo-host", d.hostname !== "N/A" ? d.hostname : d.ip);
    if (badge) badge.textContent = "Live";
    const ipEl = document.getElementById("conn-ip");
    if (ipEl) {
      ipEl.textContent = d.ip || "—";
      ipEl.classList.add("hi");
    }
    const chip = document.getElementById("ip-chip");
    if (chip) {
      chip.textContent = d.ip;
      chip.className = "chip live";
    }
  } catch (e) {
    if (badge) badge.textContent = "Error";
    ["geo-isp", "geo-loc", "geo-country", "geo-tz", "geo-host"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = "Unavailable";
    });
  }
}

/* ══════════════════════════════════════════════════════
   Connection quality (Network Information API)
   ══════════════════════════════════════════════════════ */

function detectConnectionQuality() {
  const nc =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;

  const badge = document.getElementById("conn-type-badge");
  const typeName = document.getElementById("conn-type-name");
  const typeSub = document.getElementById("conn-type-sub");
  const typeIco = document.getElementById("conn-type-ico");
  const ringFg = document.getElementById("ring-fg");
  const ringLabel = document.getElementById("ring-label");
  const sigEtype = document.getElementById("sig-etype");
  const sigDownlink = document.getElementById("sig-downlink");
  const sigRtt = document.getElementById("sig-rtt");
  const sigSavedata = document.getElementById("sig-savedata");
  const qualFill = document.getElementById("sig-quality-fill");
  const qualPct = document.getElementById("sig-quality-pct");
  const qualDesc = document.getElementById("sig-quality-desc");

  if (!nc) {
    if (badge) badge.textContent = "Unsupported";
    if (typeName) typeName.textContent = "API Unavailable";
    if (typeSub)
      typeSub.textContent =
        "navigator.connection not supported in this browser";
    if (typeIco) typeIco.className = "fas fa-question-circle";
    if (sigEtype) sigEtype.textContent = "N/A";
    if (sigDownlink) sigDownlink.textContent = "N/A";
    if (sigRtt) sigRtt.textContent = "N/A";
    if (sigSavedata) sigSavedata.textContent = "N/A";
    if (qualDesc)
      qualDesc.textContent =
        "Try Chrome or Edge for full Network Information API support.";
    return;
  }

  const type = (nc.type || "").toLowerCase();
  const etype = (nc.effectiveType || "").toLowerCase();
  const downlink = nc.downlink ?? null;
  const rtt = nc.rtt ?? null;
  const saveData = nc.saveData ?? false;

  let connLabel, iconClass, colorClass, typeDetail;
  if (type === "ethernet") {
    connLabel = "Wired (Ethernet)";
    iconClass = "fas fa-network-wired";
    colorClass = "conn-wired";
    typeDetail = "Stable, low-latency wired connection";
  } else if (type === "wifi") {
    connLabel = "WiFi";
    iconClass = "fas fa-wifi";
    colorClass = "conn-wifi";
    typeDetail = "Wireless LAN connection";
  } else if (type === "cellular") {
    const cLabel =
      etype === "4g"
        ? "4G/LTE"
        : etype === "3g"
        ? "3G"
        : etype === "2g"
        ? "2G"
        : etype === "slow-2g"
        ? "Slow 2G"
        : "Cellular";
    connLabel = `Cellular (${cLabel})`;
    iconClass = "fas fa-signal";
    colorClass = "conn-cellular";
    typeDetail = "Mobile network connection";
  } else if (type === "none") {
    connLabel = "Offline";
    iconClass = "fas fa-times-circle";
    colorClass = "conn-offline";
    typeDetail = "No network detected";
  } else {
    if (etype === "4g") {
      connLabel = downlink > 50 ? "Wired / Fast WiFi" : "WiFi / 4G";
      iconClass = downlink > 50 ? "fas fa-network-wired" : "fas fa-wifi";
      colorClass = "conn-wifi";
      typeDetail = "High-speed connection detected";
    } else {
      connLabel = "Unknown";
      iconClass = "fas fa-globe";
      colorClass = "";
      typeDetail = `Effective type: ${etype || "unknown"}`;
    }
  }

  let score = 0;
  if (etype === "4g") score += 50;
  else if (etype === "3g") score += 30;
  else if (etype === "2g") score += 15;
  else if (etype === "slow-2g") score += 5;
  else score += 50;

  if (downlink !== null) {
    if (downlink >= 100) score += 50;
    else if (downlink >= 50) score += 40;
    else if (downlink >= 20) score += 30;
    else if (downlink >= 5) score += 20;
    else if (downlink >= 1) score += 10;
    else score += 5;
  } else {
    score += 25;
  }

  if (rtt !== null) {
    if (rtt <= 20) score = Math.min(score, 100);
    else if (rtt <= 50) score = Math.min(score * 0.95, 100);
    else if (rtt <= 100) score = Math.min(score * 0.85, 100);
    else if (rtt <= 200) score *= 0.7;
    else score *= 0.5;
  }
  if (saveData) score *= 0.75;
  if (type === "none") score = 0;
  score = Math.min(100, Math.round(score));

  let qualLabel, qualDescText, qualFillColor;
  if (score >= 80) {
    qualLabel = "Excellent";
    qualDescText = "Great connection — speed test should run smoothly.";
    qualFillColor = "#22d3ee";
  } else if (score >= 60) {
    qualLabel = "Good";
    qualDescText = "Solid connection — expect reliable results.";
    qualFillColor = "#34d399";
  } else if (score >= 40) {
    qualLabel = "Fair";
    qualDescText = "Moderate connection — results may vary slightly.";
    qualFillColor = "#fbbf24";
  } else if (score >= 20) {
    qualLabel = "Poor";
    qualDescText = "Weak signal — speed test results may be inconsistent.";
    qualFillColor = "#f87171";
  } else {
    qualLabel = "Critical";
    qualDescText = "Very poor or no connection — testing may fail.";
    qualFillColor = "#ef4444";
  }

  if (badge) badge.textContent = qualLabel;
  if (typeName) typeName.textContent = connLabel;
  if (typeSub) typeSub.textContent = typeDetail;
  if (typeIco) typeIco.className = iconClass;
  const hero = document.getElementById("conn-type-hero");
  if (hero) hero.className = `conn-type-hero ${colorClass}`;
  if (sigEtype) sigEtype.textContent = etype ? etype.toUpperCase() : "N/A";
  if (sigDownlink)
    sigDownlink.textContent =
      downlink !== null ? `${downlink} Mbps` : "N/A";
  if (sigRtt) sigRtt.textContent = rtt !== null ? `${rtt} ms` : "N/A";
  if (sigSavedata) {
    sigSavedata.textContent = saveData ? "Enabled ⚡" : "Off";
    sigSavedata.style.color = saveData ? "#fbbf24" : "";
  }
  if (qualFill) {
    qualFill.style.background = qualFillColor;
    qualFill.style.width = score + "%";
  }
  if (qualPct) qualPct.textContent = score + "%";
  if (qualDesc) qualDesc.textContent = qualDescText;

  if (ringFg) {
    const offset = 113 - (score / 100) * 113;
    ringFg.style.stroke = qualFillColor;
    ringFg.style.strokeDashoffset = offset;
  }
  if (ringLabel) {
    ringLabel.textContent = score;
    ringLabel.style.color = qualFillColor;
  }

  nc.onchange = detectConnectionQuality;
}

/* ══════════════════════════════════════════════════════
   Public IP chip (via Worker /get-ip)
   ══════════════════════════════════════════════════════ */

(async function () {
  try {
    const res = await fetch(API_BASE + "/get-ip", { cache: "no-store" });
    const d = await res.json();
    const chip = document.getElementById("ip-chip");
    if (!chip) return;
    if (d.ip && d.ip !== "Unavailable") {
      chip.textContent = d.ip;
      chip.className = "chip live";
    } else {
      chip.textContent = "Unavailable";
      chip.className = "chip error";
    }
  } catch {
    const chip = document.getElementById("ip-chip");
    if (chip) {
      chip.textContent = "Unavailable";
      chip.className = "chip error";
    }
  }
})();

/* ══════════════════════════════════════════════════════
   History + Chart (localStorage)
   ══════════════════════════════════════════════════════ */

let chartInst = null,
  curTab = "bar";
const SK = "netpulse_v2",
  MX = 10;

function loadHist() {
  try {
    return JSON.parse(localStorage.getItem(SK)) || [];
  } catch {
    return [];
  }
}
function saveResult(r) {
  const h = loadHist();
  h.push(r);
  if (h.length > MX) h.shift();
  localStorage.setItem(SK, JSON.stringify(h));
}
function clearHistory() {
  localStorage.removeItem(SK);
  renderHist();
  renderChart();
}
function rating(dl) {
  if (dl >= 100) return { t: "Excellent", c: "excellent" };
  if (dl >= 50) return { t: "Good", c: "good" };
  if (dl >= 20) return { t: "Fair", c: "fair" };
  return { t: "Poor", c: "poor" };
}
function renderHist() {
  const h = loadHist(),
    body = document.getElementById("hist-scroll");
  if (!body) return;
  if (!h.length) {
    body.innerHTML =
      '<div class="hist-empty">No past tests yet. Run a test to see history.</div>';
    return;
  }
  body.innerHTML = h
    .map((r, i) => {
      const rt = rating(r.download);
      return `<div class="hist-row">
        <div class="hist-col">#${i + 1}</div>
        <div class="hist-col">${r.download.toFixed(1)} Mbps</div>
        <div class="hist-col">${r.upload.toFixed(1)} Mbps</div>
        <div class="hist-col">${r.ping.toFixed(1)} ms</div>
        <div class="hist-col hist-tag ${rt.c}">${rt.t}</div>
        <div class="hist-col hist-time">${r.time}</div>
      </div>`;
    })
    .join("");
}

function switchTab(tab, e) {
  curTab = tab;
  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  if (e && e.target) e.target.classList.add("active");
  renderChart();
}

function renderChart() {
  const h = loadHist();
  const empty = document.getElementById("chart-empty"),
    wrap = document.getElementById("chart-wrap"),
    canvas = document.getElementById("myChart"),
    badge = document.getElementById("chart-badge");
  if (!canvas) return;
  if (!h.length) {
    if (empty) empty.style.display = "flex";
    if (wrap) wrap.style.display = "none";
    if (badge) badge.textContent = "No data";
    if (chartInst) {
      chartInst.destroy();
      chartInst = null;
    }
    return;
  }
  if (empty) empty.style.display = "none";
  if (wrap) wrap.style.display = "block";
  if (badge)
    badge.textContent = `${h.length} run${h.length > 1 ? "s" : ""}`;

  const labels = h.map((_, i) => `#${i + 1}`);
  const dl = h.map(r => r.download),
    ul = h.map(r => r.upload),
    pg = h.map(r => r.ping);

  const opts = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#52525b",
          font: {
            size: 10,
            family: "Inter,Segoe UI,sans-serif"
          },
          boxWidth: 8,
          padding: 12
        }
      },
      tooltip: {
        backgroundColor: "#111111",
        borderColor: "#222222",
        borderWidth: 1,
        titleColor: "#71717a",
        bodyColor: "#e4e4e7",
        padding: 10,
        titleFont: { size: 10 },
        bodyFont: { size: 11, weight: "bold" }
      }
    },
    scales: {
      x: {
        ticks: { color: "#3f3f46", font: { size: 9 } },
        grid: { color: "#1c1c1c" },
        border: { color: "#222222" }
      },
      y: {
        ticks: { color: "#3f3f46", font: { size: 9 } },
        grid: { color: "#1c1c1c" },
        border: { color: "#222222" },
        beginAtZero: true
      }
    }
  };

  let ds;
  if (curTab === "bar") {
    ds = [
      {
        label: "Download",
        data: dl,
        backgroundColor: "#22d3ee18",
        borderColor: "#22d3ee",
        borderWidth: 1.5,
        borderRadius: 4
      },
      {
        label: "Upload",
        data: ul,
        backgroundColor: "#818cf818",
        borderColor: "#818cf8",
        borderWidth: 1.5,
        borderRadius: 4
      },
      {
        label: "Ping",
        data: pg,
        backgroundColor: "#34d39918",
        borderColor: "#34d399",
        borderWidth: 1.5,
        borderRadius: 4
      }
    ];
  } else {
    ds = [
      {
        label: "Download",
        data: dl,
        borderColor: "#22d3ee",
        backgroundColor: "#22d3ee0a",
        borderWidth: 1.5,
        pointBackgroundColor: "#22d3ee",
        pointRadius: 3,
        tension: 0.4,
        fill: true
      },
      {
        label: "Upload",
        data: ul,
        borderColor: "#818cf8",
        backgroundColor: "#818cf80a",
        borderWidth: 1.5,
        pointBackgroundColor: "#818cf8",
        pointRadius: 3,
        tension: 0.4,
        fill: true
      },
      {
        label: "Ping",
        data: pg,
        borderColor: "#34d399",
        backgroundColor: "#34d3990a",
        borderWidth: 1.5,
        pointBackgroundColor: "#34d399",
        pointRadius: 3,
        tension: 0.4,
        fill: true
      }
    ];
  }

  if (chartInst) {
    chartInst.destroy();
    chartInst = null;
  }
  chartInst = new Chart(canvas, {
    type: curTab === "bar" ? "bar" : "line",
    data: { labels, datasets: ds },
    options: opts
  });
}

/* ══════════════════════════════════════════════════════
   SPEED TEST FLOW (Cloudflare Worker)
   ══════════════════════════════════════════════════════ */

function formatTime() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function runSpeedTest() {
  const btn = document.getElementById("btn-start");
  const statusEl = document.getElementById("status-text");
  const errEl = document.getElementById("error-text");
  const srvEl = document.getElementById("server-label");
  const pingEl = document.getElementById("ping-val");
  const dlEl = document.getElementById("dl-val");
  const ulEl = document.getElementById("ul-val");
  const jitEl = document.getElementById("jitter-val");
  const qualEl = document.getElementById("quality-label");

  if (errEl) errEl.textContent = "";
  hideAllLB();
  nRst();

  if (btn) {
    btn.disabled = true;
    btn.classList.add("running");
  }
  if (statusEl) statusEl.textContent = "Finding best server…";

  try {
    // Ensure we have geo
    if (!lastGeoIP) {
      await fetchGeoIP();
    }
    const latLon = (lastGeoIP && lastGeoIP.loc || "0,0").split(",");
    const lat = parseFloat(latLon[0]) || 0.0;
    const lon = parseFloat(latLon[1]) || 0.0;

    // Get nearby servers (Speedtest.net) via Worker
    const srvRes = await fetch(
      API_BASE + `/get-servers?lat=${lat}&lon=${lon}`,
      { cache: "no-store" }
    );
    const srvData = await srvRes.json();
    const servers = srvData.servers || [];
    if (!servers.length) throw new Error("No nearby servers found.");
    const best = servers[0];
    if (srvEl)
      srvEl.textContent = `${best.name} (${best.country}) — ${best.sponsor}`;
    if (statusEl) statusEl.textContent = "Running test…";

    // Visual: wobble needle while waiting
    nWob(150);
    showLB("dl");
    showLB("ul");

    // Call one-shot Worker speedtest
    const url =
      API_BASE +
      `/run-speedtest?lat=${lat}&lon=${lon}&server_host=${encodeURIComponent(
        best.host
      )}`;
    const t0 = performance.now();
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    const t1 = performance.now();
    if (data.error) throw new Error(data.error);

    // Stop wobble and set final value
    nSet(data.download || 0);
    doneLB("dl");
    doneLB("ul");

    // Fill metrics
    if (pingEl) pingEl.textContent = `${data.ping.toFixed(1)} ms`;
    if (jitEl) jitEl.textContent = `${data.jitter.toFixed(1)} ms`;
    if (dlEl)
      dlEl.textContent = `${data.download.toFixed(1)} Mbps`;
    if (ulEl)
      ulEl.textContent = `${data.upload.toFixed(1)} Mbps`;

    // Quality label based on download
    const rt = rating(data.download || 0);
    if (qualEl) {
      qualEl.textContent = rt.t;
      qualEl.className = `chip quality ${rt.c}`;
    }

    if (statusEl)
      statusEl.textContent = `Completed in ${((t1 - t0) / 1000).toFixed(
        1
      )}s`;

    // Save to history
    saveResult({
      ping: data.ping || 0,
      download: data.download || 0,
      upload: data.upload || 0,
      jitter: data.jitter || 0,
      time: formatTime()
    });
    renderHist();
    renderChart();
  } catch (e) {
    if (errEl) errEl.textContent = e.message || "Speed test failed.";
    hideAllLB();
    nRst();
    if (statusEl) statusEl.textContent = "Error";
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("running");
    }
  }
}

/* ══════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════ */

function initNetPulse() {
  // Start with connection info + geo + history
  detectConnectionQuality();
  fetchGeoIP();
  renderHist();
  renderChart();

  // Start button
  const btn = document.getElementById("btn-start");
  if (btn) {
    btn.addEventListener("click", e => {
      e.preventDefault();
      runSpeedTest();
    });
  }

  // Clear history button
  const clr = document.getElementById("btn-clear-history");
  if (clr) clr.addEventListener("click", clearHistory);

  // Chart tab buttons
  document.querySelectorAll("[data-chart-tab]").forEach(btn => {
    btn.addEventListener("click", e => {
      const tab = btn.getAttribute("data-chart-tab");
      switchTab(tab, e);
    });
  });
}
