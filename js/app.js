/* Veilchen-Kassa – Hausregel-Rechner für das Ingame-Transferbudget im FC27-Karrieremodus (FK Austria Wien).
   Kein echtes Geld: Eingaben sind die Zahlen aus dem Spiel, die App rechnet ein "realistisches" Budget.
   Reines Client-JS, kein Server. Daten: localStorage (+ optionale Auto-Backup-Datei). */
(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------
  const STORAGE_KEY = 'veilchen-kassa-v1';
  const THEME_KEY = 'veilchen-kassa-theme';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const round = (n) => Math.round(Number(n) || 0);
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
  const dateFmt = new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const timeFmt = new Intl.DateTimeFormat('de-AT', { hour: '2-digit', minute: '2-digit' });

  const MINUS = '−';
  function eur(n, sign = false) {
    const v = round(n);
    const pre = v < 0 ? MINUS : (sign && v > 0 ? '+' : '');
    return pre + nf0.format(Math.abs(v)) + ' €';
  }
  function eurShort(n) {
    const v = round(n), a = Math.abs(v), pre = v < 0 ? MINUS : '';
    if (a >= 1e6) return pre + nf2.format(a / 1e6) + ' Mio.';
    if (a >= 1e3) return pre + nf0.format(a / 1e3) + ' Tsd.';
    return pre + nf0.format(a);
  }
  const pct = (n) => nf2.format(n) + ' %';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cls = (n) => (round(n) < 0 ? 'neg' : round(n) > 0 ? 'pos' : '');

  /** Parst Geldbeträge: "3.000.000", "3 Mio", "3,5m", "750k", "750 Tsd", "1.250.000,50" */
  function parseMoney(input) {
    if (typeof input === 'number') return round(input);
    let s = String(input ?? '').trim().toLowerCase().replace(/€|eur|\s| /g, '');
    if (!s) return NaN;
    let neg = false;
    if (/^[-−]/.test(s)) { neg = true; s = s.slice(1); }
    let mult = 1;
    const suf = s.match(/(mio\.?|mrd\.?|m|tsd\.?|k|t)$/);
    if (suf) {
      const u = suf[1].replace('.', '');
      mult = u === 'mrd' ? 1e9 : (u === 'mio' || u === 'm') ? 1e6 : 1e3;
      s = s.slice(0, -suf[1].length);
    }
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if ((s.match(/\./g) || []).length > 1 || (mult === 1 && /\.\d{3}$/.test(s))) s = s.replace(/\./g, '');
    if (!/^\d*\.?\d+$|^\d+\.?$/.test(s)) return NaN;
    const n = parseFloat(s) * mult;
    return isNaN(n) ? NaN : round(neg ? -n : n);
  }
  function parseNum(input) {
    const s = String(input ?? '').trim().replace(/\s|%/g, '').replace(',', '.');
    if (s === '') return NaN;
    const n = Number(s);
    return isNaN(n) ? NaN : n;
  }
  const fmtInputMoney = (n) => (isFinite(n) && n !== null ? nf0.format(n) : '');
  const fmtInputNum = (n) => (isFinite(n) ? nf2.format(n) : '');

  function nextSeasonLabel(label, k = 1) {
    const m = String(label || '').match(/(\d{4})\s*\/\s*(\d{2,4})/);
    if (!m) return `Saison +${k}`;
    const y = Number(m[1]) + k;
    return `${y}/${String((y + 1) % 100).padStart(2, '0')}`;
  }

  const DOMESTIC = /^(österreich|oesterreich|austria|at|aut)$/i;

  // ---------------------------------------------------------------------------
  // Icons
  // ---------------------------------------------------------------------------
  const ICONS = {
    home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
    sell: '<path d="M7 17 17 7M9 7h8v8"/>',
    buy: '<path d="M17 7 7 17M15 17H7V9"/>',
    coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 15v2c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.7-2.7-3-6-3"/>',
    bank: '<path d="M3 10 12 4l9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
    upload: '<path d="M12 16V5M7 10l5-5 5 5M4 20h16"/>',
    warn: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.5"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  };
  const icon = (n, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${ICONS[n] || ''}</svg>`;

  // ---------------------------------------------------------------------------
  // State & Persistenz
  // ---------------------------------------------------------------------------
  const TYPE_LABEL = {
    sale: 'Verkauf', purchase: 'Kauf', event: 'Event', income: 'Einnahme', expense: 'Ausgabe', close: 'Saisonwechsel',
    rate: 'Rate', loan: 'Kredit', repay: 'Tilgung', fixed: 'Fixposten', interest: 'Zinsen',
  };
  const FILTER_TYPES = ['sale', 'purchase', 'event', 'close', 'income', 'expense', 'rate', 'loan', 'repay'];

  function defaultState() {
    return {
      version: 2,
      settings: {
        koestPct: 23,
        taxAfterFees: false,
        solidarityPct: 5,
        agentSellPct: 5,
        agentBuyPct: 5,
        loanPct: 6,
        overdraftPct: 8,
        upfrontPct: 40,
        rateYears: 2,
        carryMode: 'full',
        ffpEnabled: true,
        ffpLimit: 100,
        eventLevel: 'normal',
        eventIncome: true,
        training: [
          { id: uid(), maxAge: 18, pct: 3, flat: 90000 },
          { id: uid(), maxAge: 20, pct: 2, flat: 60000 },
          { id: uid(), maxAge: 22, pct: 1, flat: 30000 },
        ],
      },
      seasons: [],
      txs: [],
      loans: [],
      ui: { donutScope: 'all', sortDesc: true, otherKind: 'in' },
      savedAt: null,
    };
  }

  let storageOk = true;
  function load() {
    const def = defaultState();
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { storageOk = false; }
    if (!raw) return def;
    try {
      return normalize(JSON.parse(raw));
    } catch (e) {
      try { localStorage.setItem(STORAGE_KEY + '-defekt-' + Date.now(), raw); } catch (_) { /* ignore */ }
      return def;
    }
  }
  function normalize(data) {
    const def = defaultState();
    if (!data || typeof data !== 'object') return def;
    return {
      ...def,
      ...data,
      version: 2,
      settings: { ...def.settings, ...(data.settings || {}), training: Array.isArray(data.settings?.training) ? data.settings.training : def.settings.training },
      seasons: Array.isArray(data.seasons) ? data.seasons : [],
      txs: Array.isArray(data.txs) ? data.txs : [],
      loans: Array.isArray(data.loans) ? data.loans : [],
      ui: { ...def.ui, ...(data.ui || {}) },
    };
  }

  let state = load();
  const S = () => state.settings;

  function save(opts = {}) {
    syncEventStatus();
    state.savedAt = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageOk = true;
    } catch (e) {
      storageOk = false;
    }
    updateSaveState(true);
    Backup.schedule();
    if (!opts.silent) requestPersist();
  }
  function updateSaveState(flash) {
    const el = $('#saveState');
    if (!el) return;
    if (!storageOk) { el.textContent = 'Speichern blockiert!'; return; }
    el.textContent = state.savedAt ? 'Gespeichert ' + timeFmt.format(state.savedAt) : 'Lokal gespeichert';
    if (flash) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  }
  let persistAsked = false;
  function requestPersist() {
    if (persistAsked || !navigator.storage?.persist) return;
    persistAsked = true;
    navigator.storage.persist().catch(() => {});
  }

  // Undo
  let undoSnapshot = null;
  function snapshot() { undoSnapshot = JSON.stringify(state); }
  function undo() {
    if (!undoSnapshot) return;
    state = normalize(JSON.parse(undoSnapshot));
    undoSnapshot = null;
    save();
    renderAll();
    toast('Rückgängig gemacht.');
  }

  // Tab-Synchronisation
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try { state = normalize(JSON.parse(e.newValue)); renderAll(); toast('In einem anderen Tab geändert – neu geladen.'); } catch (_) { /* ignore */ }
  });

  // ---------------------------------------------------------------------------
  // Auto-Backup-Datei (File System Access API, Chrome/Edge)
  // ---------------------------------------------------------------------------
  const idb = {
    open() {
      return new Promise((res, rej) => {
        const r = indexedDB.open('veilchen-kassa', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    },
    async get(k) {
      const db = await this.open();
      return new Promise((res, rej) => { const t = db.transaction('kv').objectStore('kv').get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); });
    },
    async set(k, v) {
      const db = await this.open();
      return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
    },
    async del(k) {
      const db = await this.open();
      return new Promise((res) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = () => res(); t.onerror = () => res(); });
    },
  };

  const Backup = {
    supported: 'showSaveFilePicker' in window,
    handle: null,
    perm: 'none',
    last: null,
    timer: null,
    async init() {
      if (!this.supported) return;
      try {
        this.handle = await idb.get('backupHandle');
        if (this.handle) this.perm = await this.handle.queryPermission({ mode: 'readwrite' });
      } catch (_) { this.handle = null; }
    },
    async connect() {
      try {
        const h = await window.showSaveFilePicker({
          suggestedName: 'veilchen-kassa-backup.json',
          types: [{ description: 'Veilchen-Kassa Backup', accept: { 'application/json': ['.json'] } }],
        });
        this.handle = h;
        this.perm = 'granted';
        await idb.set('backupHandle', h);
        await this.write();
        toast('Auto-Backup-Datei verbunden: ' + h.name);
      } catch (e) {
        if (e?.name !== 'AbortError') toast('Backup-Datei konnte nicht verbunden werden.');
      }
      renderAll();
    },
    async reconnect() {
      if (!this.handle) return;
      try {
        this.perm = await this.handle.requestPermission({ mode: 'readwrite' });
        if (this.perm === 'granted') { await this.write(); toast('Auto-Backup wieder aktiv.'); }
      } catch (_) { /* ignore */ }
      renderAll();
    },
    async disconnect() {
      this.handle = null; this.perm = 'none';
      await idb.del('backupHandle').catch(() => {});
      renderAll();
    },
    async restoreFromHandle() {
      if (!this.handle) return;
      try {
        if (this.perm !== 'granted') this.perm = await this.handle.requestPermission({ mode: 'readwrite' });
        if (this.perm !== 'granted') return;
        const file = await this.handle.getFile();
        const data = JSON.parse(await file.text());
        if (!Array.isArray(data.seasons)) throw new Error('format');
        state = normalize(data);
        save();
        renderAll();
        toast('Daten aus Backup-Datei wiederhergestellt.');
      } catch (_) { toast('Backup-Datei konnte nicht gelesen werden.'); }
    },
    schedule() {
      if (!this.handle || this.perm !== 'granted') return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.write(), 600);
    },
    async write() {
      if (!this.handle || this.perm !== 'granted') return;
      try {
        const w = await this.handle.createWritable();
        await w.write(JSON.stringify(state, null, 2));
        await w.close();
        this.last = Date.now();
      } catch (_) {
        this.perm = 'prompt';
      }
    },
  };

  // ---------------------------------------------------------------------------
  // Kalkulation
  // ---------------------------------------------------------------------------
  function trainingComp(fee, age) {
    if (!(age > 0)) return 0;
    const rows = [...S().training].filter((r) => isFinite(r.maxAge)).sort((a, b) => a.maxAge - b.maxAge);
    const r = rows.find((row) => age <= row.maxAge);
    if (!r) return 0;
    return round(fee * (Number(r.pct) || 0) / 100 + (Number(r.flat) || 0));
  }

  /** Teilt Gesamtbetrag in Anzahlung (jetzt) + gleichmäßige Raten auf Folgesaisonen */
  function split(total, upPct, years) {
    years = Math.max(0, Math.floor(years || 0));
    if (!years || upPct >= 100) return { now: round(total), sched: [] };
    const now = round(total * Math.max(0, upPct) / 100);
    const rest = round(total) - now;
    const per = Math.trunc(rest / years);
    const sched = [];
    let acc = 0;
    for (let k = 1; k <= years; k++) {
      const a = k === years ? rest - acc : per;
      acc += a;
      sched.push({ offset: k, amount: a });
    }
    return { now, sched };
  }

  /** Verkauf: KöSt vereinfacht auf Erlös bzw. Erlös − Einkaufspreis (optional zusätzlich minus Abgaben) */
  function calcSale(v) {
    const s = S();
    const G = v.gross;
    const external = v.intl && !v.youth;
    const agent = round(G * v.agentPct / 100);
    const sol = external ? round(G * s.solidarityPct / 100) : 0;
    const tc = external ? trainingComp(G, v.age) : 0;
    const book = v.youth ? 0 : Math.max(0, v.book || 0);
    const base = G - book - (s.taxAfterFees ? agent + sol + tc : 0);
    const taxable = Math.max(0, base);
    const tax = round(taxable * s.koestPct / 100);
    const total = G - tax - sol - tc - agent;
    const sp = v.pay === 'raten' ? split(total, v.upPct, v.years) : { now: total, sched: [] };
    return { G, agent, sol, tc, book, taxable, tax, total, now: sp.now, sched: sp.sched };
  }

  function calcPurchase(v) {
    const s = S();
    const F = v.gross;
    const agent = round(F * v.agentPct / 100);
    const tc = v.intl ? trainingComp(F, v.age) : 0;
    const solInfo = v.intl ? round(F * s.solidarityPct / 100) : 0;
    const signing = Math.max(0, v.signing || 0);
    const sp = v.pay === 'raten' ? split(F, v.upPct, v.years) : { now: F, sched: [] };
    const now = -(sp.now + agent + tc + signing);
    const total = -(F + agent + tc + signing);
    return { F, agent, tc, solInfo, signing, total, now, feeNow: sp.now, sched: sp.sched.map((r) => ({ offset: r.offset, amount: -r.amount })) };
  }

  function calcOther(v) {
    const sign = v.kind === 'in' ? 1 : -1;
    const tax = v.kind === 'in' && v.taxed ? round(v.amount * S().koestPct / 100) : 0;
    const total = sign * v.amount - tax;
    const parts = Math.max(1, Math.floor(v.parts || 1));
    const sp = parts > 1 ? split(total, 100 / parts, parts - 1) : { now: total, sched: [] };
    return { sign, tax, total, now: sp.now, sched: sp.sched, parts };
  }

  function carry(x) {
    const m = S().carryMode;
    if (m === 'none') return 0;
    if (m === 'debt') return Math.min(0, x);
    return x;
  }

  function seasonIndex(id) { return state.seasons.findIndex((s) => s.id === id); }
  function currentSeason() { return state.seasons[state.seasons.length - 1] || null; }

  /** Kontoverlauf über alle Saisons. Ingame-Budget startet jede Saison neu (FC27 teilt neu zu), Netto wird übertragen. */
  function ledger() {
    const rows = [];
    let prev = null;
    state.seasons.forEach((s, idx) => {
      const txs = state.txs.filter((t) => t.seasonId === s.id).sort((a, b) => a.ts - b.ts);
      const carryNet = idx === 0 ? round(s.opening || 0) : carry(prev.endNet);
      const startNet = carryNet + round(s.grossBudget);
      const startGross = round(s.grossBudget);
      let net = startNet, gross = startGross, inc = 0, exp = 0, incOp = round(s.grossBudget), expOp = 0, ded = 0;
      for (const t of txs) {
        net += t.net; gross += t.gross || 0;
        if (t.net > 0) inc += t.net; else exp -= t.net;
        if (t.type !== 'loan' && t.type !== 'repay') { if (t.net > 0) incOp += t.net; else expOp -= t.net; }
        if (t.deduct) ded += Object.values(t.deduct).reduce((a, b) => a + (b || 0), 0);
      }
      const row = { s, idx, txs, carryNet, startNet, startGross, endNet: net, endGross: gross, inc, exp, incOp, expOp, ded, closed: idx < state.seasons.length - 1 };
      rows.push(row);
      prev = row;
    });
    return rows;
  }

  function loanOutstanding(loan) {
    const repaid = state.txs.filter((t) => t.type === 'repay' && t.loanId === loan.id).reduce((a, t) => a - t.net, 0);
    return Math.max(0, round(loan.principal - repaid));
  }
  function openLoans() { return state.loans.map((l) => ({ ...l, outstanding: loanOutstanding(l) })).filter((l) => l.outstanding > 0); }

  function upcomingInstallments() {
    const cur = state.seasons.length - 1;
    const list = [];
    for (const t of state.txs) {
      if (!t.schedule?.length) continue;
      const p = seasonIndex(t.seasonId);
      t.schedule.forEach((r, i) => {
        const due = p + r.offset;
        if (due > cur) list.push({ due, ahead: due - cur, amount: r.amount, title: t.title, type: t.type, no: i + 2, of: t.schedule.length + 1 });
      });
    }
    return list.sort((a, b) => a.due - b.due || a.amount - b.amount);
  }

  /** Wodurch unterscheidet sich das realistische Budget vom Ingame-Budget? */
  function diffBuckets(row) {
    const b = { carry: row.carryNet, tax: 0, fifa: 0, agent: 0, events: 0, rates: 0, ops: 0, credit: 0 };
    for (const t of row.txs) {
      const d = t.deduct || {};
      if (t.type === 'sale' || t.type === 'purchase') {
        b.tax -= d.tax || 0;
        b.fifa -= (d.sol || 0) + (d.tc || 0);
        b.agent -= (d.agent || 0) + (d.signing || 0);
        b.rates += t.deferred || 0;
      } else if (t.type === 'income' || t.type === 'expense') {
        b.tax -= d.tax || 0;
        b.ops += t.net + (d.tax || 0);
      } else if (t.type === 'event') {
        b.events += t.net;
      } else if (t.type === 'close') {
        b.ops += t.opsNet || 0;
        b.credit += t.interestNet || 0;
      } else if (t.type === 'rate') {
        if (['income', 'expense', 'close'].includes(t.parentType)) b.ops += t.net; else b.rates += t.net;
      } else if (t.type === 'fixed') b.ops += t.net;
      else if (t.type === 'loan' || t.type === 'repay' || t.type === 'interest') b.credit += t.net;
    }
    return b;
  }

  function saleDeductionTotals(scope) {
    const cur = currentSeason();
    const tot = { tax: 0, sol: 0, tc: 0, agent: 0, net: 0, gross: 0 };
    for (const t of state.txs) {
      if (t.type !== 'sale') continue;
      if (scope === 'season' && t.seasonId !== cur?.id) continue;
      const d = t.deduct || {};
      tot.tax += d.tax || 0; tot.sol += d.sol || 0; tot.tc += d.tc || 0; tot.agent += d.agent || 0;
      tot.net += t.total || 0; tot.gross += t.gross || 0;
    }
    return tot;
  }

  /** Raten aus früheren Saisons, die in Saison newIdx fällig werden */
  function dueRates(newIdx) {
    const out = [];
    for (const t of state.txs) {
      if (!t.schedule?.length) continue;
      const p = seasonIndex(t.seasonId);
      t.schedule.forEach((r, i) => {
        if (p + r.offset === newIdx) {
          out.push({ type: 'rate', title: `Rate ${i + 2}/${t.schedule.length + 1}: ${t.title}`, sub: TYPE_LABEL[t.type] || '', net: r.amount, parentId: t.id, parentType: t.type, rateNo: i });
        }
      });
    }
    return out;
  }

  /** Zinsen beim Saisonabschluss: Kredite + Überziehung */
  function closingInterest(prevRow) {
    const out = [];
    for (const l of openLoans()) {
      const i = round(l.outstanding * (Number(l.rate) || 0) / 100);
      if (i > 0) out.push({ label: `Zinsen ${l.name} (${pct(l.rate)} auf ${eur(l.outstanding)})`, amount: -i });
    }
    if (prevRow && prevRow.endNet < 0 && S().carryMode !== 'none') {
      const i = round(-prevRow.endNet * S().overdraftPct / 100);
      if (i > 0) out.push({ label: `Überziehungszinsen (${pct(S().overdraftPct)} auf ${eur(-prevRow.endNet)})`, amount: -i });
    }
    return out;
  }


  // ---------------------------------------------------------------------------
  // Saison-Events: fest hinterlegter Katalog, pro Saison budgetabhängig ausgewürfelt
  // pct = Anteil vom FC27-Transferbudget (vor Skalierung), win = Zeitfenster MM-DD,
  // minBudget = Event kommt nur ab diesem Budget, chance = Wahrscheinlichkeit pro Saison
  // ---------------------------------------------------------------------------
  const EVENT_CATALOG = [
    // Zum Saisonstart (01.07.) – werden beim Start automatisch abgezogen
    { id: 'stadion_betrieb', start: true, cat: 'Stadion', title: 'Stadion-Betriebskosten', desc: 'Strom, Reinigung, Security und Wartung der Generali-Arena für die neue Saison.', pct: [3, 4.5] },
    { id: 'versicherung', start: true, cat: 'Verwaltung', title: 'Vereinsversicherungen', desc: 'Haftpflicht, Spielerinvalidität und Gebäudeversicherung – Jahresprämie.', pct: [1, 1.8] },
    { id: 'verwaltung_1', start: true, cat: 'Personal', title: 'Geschäftsstelle & Verwaltung (1. Halbjahr)', desc: 'Gehälter Geschäftsstelle, Ticketing, Marketing und Medienabteilung.', pct: [1.5, 2.5] },
    { id: 'trainerstab_1', start: true, cat: 'Personal', title: 'Trainer- & Betreuerstab (1. Halbjahr)', desc: 'Co-Trainer, Tormanntrainer, Physios, Zeugwarte – Spielergehälter zahlt FC27 selbst.', pct: [2, 3.2] },
    { id: 'lizenz', start: true, cat: 'Verband', title: 'Bundesliga-Lizenz & Verbandsbeiträge', desc: 'Lizenzierungsgebühr sowie ÖFB- und Bundesliga-Beiträge.', pct: [0.4, 0.8] },
    { id: 'koest_min', start: true, cat: 'Steuern', title: 'Mindestkörperschaftsteuer', desc: 'Fällt auch in Verlustjahren an.', flat: 500 },

    // Fixe Termine über die Saison
    { id: 'frauen', cat: 'Verein', title: 'Frauenteam-Zuschuss', desc: 'Jahresbudget für die Austria-Damen in der ÖFB Frauen-Bundesliga.', win: ['08-15', '08-31'], pct: [0.6, 1.2] },
    { id: 'akademie', cat: 'Nachwuchs', title: 'Akademie & Young Violets', desc: 'Betriebskosten der Nachwuchsakademie und der Zweitmannschaft.', win: ['09-01', '09-05'], pct: [1.8, 2.8] },
    { id: 'reise_hin', cat: 'Spielbetrieb', title: 'Reisekosten Hinrunde', desc: 'Bus, Hotels und Verpflegung bei den Auswärtsspielen im Herbst.', win: ['10-01', '10-05'], pct: [0.6, 1.1] },
    { id: 'trainerstab_2', cat: 'Personal', title: 'Trainer- & Betreuerstab (2. Halbjahr)', desc: 'Zweite Tranche der Gehälter für den Betreuerstab.', win: ['01-01', '01-02'], pct: [2, 3.2] },
    { id: 'verwaltung_2', cat: 'Personal', title: 'Geschäftsstelle & Verwaltung (2. Halbjahr)', desc: 'Zweite Tranche der Verwaltungsgehälter.', win: ['01-01', '01-02'], pct: [1.5, 2.5] },
    { id: 'reise_rueck', cat: 'Spielbetrieb', title: 'Reisekosten Rückrunde', desc: 'Bus, Hotels und Verpflegung bei den Auswärtsspielen im Frühjahr.', win: ['03-01', '03-05'], pct: [0.6, 1.1] },

    // Zufällige Kosten
    { id: 'tl_sommer', cat: 'Spielbetrieb', title: 'Sommer-Trainingslager', desc: 'Quartier, Plätze und Anreise – heuer in {ort}.', vars: { ort: ['Bad Waltersdorf', 'Windischgarsten', 'Bad Tatzmannsdorf', 'Saalfelden', 'Längenfeld'] }, win: ['07-05', '07-20'], pct: [0.8, 1.6], chance: 0.85 },
    { id: 'tl_winter', cat: 'Spielbetrieb', title: 'Wintertrainingslager', desc: 'Sonne tanken für die Rückrunde in {ort}.', vars: { ort: ['Belek', 'Marbella', 'Side', 'Lagos', 'Dubai'] }, win: ['01-05', '01-15'], pct: [0.8, 1.6], chance: 0.75 },
    { id: 'rasen', cat: 'Stadion', title: 'Rasensanierung', desc: 'Der Rollrasen hat das Sommerkonzert nicht überlebt.', win: ['08-01', '09-20'], pct: [0.8, 2], chance: 0.55 },
    { id: 'derby_herbst', cat: 'Sicherheit', title: 'Sicherheitskosten Wiener Derby (Herbst)', desc: 'Zusätzliche Ordner, Polizei und Fantrennung beim Derby gegen Rapid.', win: ['09-15', '11-15'], pct: [0.3, 0.7], chance: 0.9 },
    { id: 'derby_frueh', cat: 'Sicherheit', title: 'Sicherheitskosten Wiener Derby (Frühjahr)', desc: 'Zusätzliche Ordner, Polizei und Fantrennung beim Derby gegen Rapid.', win: ['02-15', '04-30'], pct: [0.3, 0.7], chance: 0.9 },
    { id: 'pyro', cat: 'Strafen', title: 'Strafe: Pyrotechnik im Fansektor', desc: 'Der Senat 1 der Bundesliga verhängt eine Geldstrafe.', win: ['08-15', '05-15'], pct: [0.2, 0.6], chance: 0.5 },
    { id: 'rudel', cat: 'Strafen', title: 'Strafe: Rudelbildung', desc: 'Nach einer Rudelbildung gibt’s Post vom Strafsenat.', win: ['09-01', '04-30'], pct: [0.1, 0.3], chance: 0.25 },
    { id: 'medizin', cat: 'Medizin', title: 'Medizinische Abteilung', desc: 'Neue Reha-Geräte und Wartung der Kältekammer.', win: ['10-01', '02-28'], pct: [0.5, 1.3], chance: 0.45 },
    { id: 'winterdienst', cat: 'Stadion', title: 'Winterdienst & Rasenheizung', desc: 'Schneeräumung und Rasenheizung im Dauerbetrieb.', win: ['12-01', '02-10'], pct: [0.4, 1], chance: 0.8 },
    { id: 'energie', cat: 'Stadion', title: 'Energie-Nachzahlung', desc: 'Die Jahresabrechnung des Energieversorgers ist da.', win: ['02-01', '03-15'], pct: [0.4, 1.2], chance: 0.4 },
    { id: 'analyse', cat: 'Sportlich', title: 'Datenanalyse- & Video-Software', desc: 'Lizenzen für Leistungsdiagnostik und Videoanalyse.', win: ['08-01', '08-31'], pct: [0.3, 0.8], chance: 0.5 },
    { id: 'fanbetreuung', cat: 'Verein', title: 'Fanbetreuung & Choreo-Zuschuss', desc: 'Material für die große Choreo in der Osttribüne.', win: ['09-01', '09-30'], pct: [0.15, 0.4], chance: 0.5 },
    { id: 'wasserschaden', cat: 'Stadion', title: 'Wasserschaden in der Kabine', desc: 'Ein Rohrbruch setzt die Heimkabine unter Wasser.', win: ['11-01', '03-31'], pct: [0.4, 1], chance: 0.15 },
    { id: 'rechtsstreit', cat: 'Verwaltung', title: 'Arbeitsgerichtsverfahren', desc: 'Ein Ex-Spieler klagt auf ausstehende Prämien – Vergleich plus Anwaltskosten.', win: ['11-01', '05-31'], pct: [0.4, 1.2], chance: 0.15 },
    { id: 'abfindung', cat: 'Personal', title: 'Abfindung Co-Trainer', desc: 'Ein Co-Trainer geht vorzeitig, der Vertrag wird ausbezahlt.', win: ['10-01', '04-30'], pct: [1, 2.5], chance: 0.15, minBudget: 2000000 },
    { id: 'bus', cat: 'Spielbetrieb', title: 'Neuer Mannschaftsbus', desc: 'Der alte Bus hat ausgedient – der neue kommt in Violett.', win: ['07-15', '08-31'], pct: [1.5, 3], chance: 0.1, minBudget: 4000000 },
    { id: 'flutlicht', cat: 'Stadion', title: 'LED-Flutlicht-Wartung', desc: 'Pflichtprüfung und Tausch defekter Module für TV-taugliches Licht.', win: ['10-15', '11-30'], pct: [0.8, 2], chance: 0.3, minBudget: 3000000 },
    { id: 'kabine', cat: 'Stadion', title: 'Kabinen-Umbau', desc: 'Neue Kabine mit Eisbad und Taktikraum.', win: ['06-01', '06-25'], pct: [1, 2.5], chance: 0.2, minBudget: 5000000 },
    { id: 'vip', cat: 'Stadion', title: 'Renovierung VIP-Bereich', desc: 'Sponsoren wollen Logen auf Europacup-Niveau.', win: ['05-20', '06-25'], pct: [2, 4], chance: 0.25, minBudget: 8000000 },
    { id: 'tribuene', cat: 'Stadion', title: 'Tribünen-Modernisierung', desc: 'Neue Sitzschalen, Dach-Sanierung und barrierefreie Plätze.', win: ['04-01', '06-20'], pct: [5, 9], chance: 0.15, minBudget: 25000000 },

    // Einnahmen (ab und zu)
    { id: 'testspiel', income: true, cat: 'Einnahme', title: 'Testspiel gegen Topklub', desc: 'Freundschaftsspiel mit Antrittsgage gegen {gegner}.', vars: { gegner: ['Borussia Dortmund', 'AC Milan', 'Olympique Lyon', 'Ajax Amsterdam', 'Galatasaray'] }, win: ['07-10', '07-30'], pct: [0.8, 1.8], chance: 0.35 },
    { id: 'merch', income: true, cat: 'Einnahme', title: 'Trikot-Verkaufsschlager', desc: 'Das neue Heimtrikot geht weg wie warme Semmeln.', win: ['08-01', '09-15'], pct: [1, 2.5], chance: 0.45 },
    { id: 'zuschauer', income: true, cat: 'Einnahme', title: 'Zuschauer-Plus', desc: 'Ausverkauftes Haus nach dem Derbysieg – Mehreinnahmen beim Ticketing.', win: ['09-20', '04-30'], pct: [0.4, 1], chance: 0.3 },
    { id: 'tv_bonus', income: true, cat: 'Einnahme', title: 'TV-Bonus Topspiele', desc: 'Mehr Live-Übertragungen als geplant – Bonus vom Rechteinhaber.', win: ['12-01', '12-20'], pct: [0.6, 1.5], chance: 0.35 },
    { id: 'solidar_in', income: true, cat: 'Einnahme', title: 'Eingehender Solidaritätsbeitrag', desc: 'Ein ehemaliger Akademie-Spieler wechselt im Ausland – die Austria kassiert mit.', win: ['07-15', '06-15'], pct: [0.3, 1.2], chance: 0.25 },
    { id: 'sponsor_bonus', income: true, cat: 'Einnahme', title: 'Sponsor-Erfolgsprämie', desc: 'Der Hauptsponsor zahlt einen Bonus für die Platzierung.', win: ['05-15', '06-10'], pct: [1, 3], chance: 0.45 },
    { id: 'konzert', income: true, cat: 'Einnahme', title: 'Stadionvermietung Konzert', desc: 'Ein Open-Air-Konzert in der Generali-Arena bringt Miete.', win: ['06-01', '06-30'], pct: [0.8, 2], chance: 0.3 },
  ];

  // Anteil aller Kosten-Events am Budget je Härtestufe (wird pro Saison zufällig gewählt)
  const EVENT_LEVELS = {
    mild: { label: 'Mild', range: [0.08, 0.13] },
    normal: { label: 'Normal', range: [0.13, 0.22] },
    hart: { label: 'Hart', range: [0.24, 0.34] },
  };
  const MAX_SINGLE_EVENT = 0.12; // kein einzelnes Event über 12 % des Budgets

  /** Deterministischer Zufall: gleiche Saison, gleicher Plan – auch nach Neuladen */
  function seededRandom(seedStr) {
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) {
      h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function niceAmount(x) {
    const a = Math.abs(x);
    const step = a < 100000 ? 1000 : a < 1000000 ? 5000 : 10000;
    return Math.max(1000, Math.round(a / step) * step);
  }
  function seasonStartYear(label) {
    const m = String(label || '').match(/(\d{4})/);
    return m ? Number(m[1]) : new Date().getFullYear();
  }
  /** MM-DD innerhalb der Saison (Juli–Juni) in ein echtes Datum umrechnen */
  function seasonDate(mmdd, startYear) {
    const [m, d] = mmdd.split('-').map(Number);
    return new Date(Date.UTC(m >= 7 ? startYear : startYear + 1, m - 1, d));
  }
  const isoDate = (dt) => dt.toISOString().slice(0, 10);
  const fmtDay = (iso) => { const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; };
  const fmtDayShort = (iso) => { const [, m, d] = iso.split('-'); return `${d}.${m}.`; };
  const MONTHS = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  /** Event-Plan für eine Saison erzeugen – budgetabhängig, abwechslungsreich, reproduzierbar */
  function generateEvents(budget, label, seed) {
    const rand = seededRandom(String(seed));
    const s = S();
    const base = Math.max(round(budget), 500000);
    const y = seasonStartYear(label);
    const picked = [];
    for (const e of EVENT_CATALOG) {
      if (e.income && !s.eventIncome) continue;
      if (e.minBudget && budget < e.minBudget) continue;
      if (rand() > (e.chance ?? 1)) continue;
      const pctVal = e.pct ? e.pct[0] + rand() * (e.pct[1] - e.pct[0]) : 0;
      let date;
      if (e.start) date = isoDate(seasonDate('07-01', y));
      else {
        const from = seasonDate(e.win[0], y).getTime();
        const to = seasonDate(e.win[1], y).getTime();
        date = isoDate(new Date(from + Math.floor(rand() * ((to - from) / 86400000 + 1)) * 86400000));
      }
      let desc = e.desc;
      if (e.vars) Object.entries(e.vars).forEach(([k, list]) => { desc = desc.replace(`{${k}}`, list[Math.floor(rand() * list.length)]); });
      picked.push({ e, raw: e.flat ? e.flat : (base * pctVal) / 100, date, desc });
    }
    // Kosten auf einen zufälligen, gesunden Anteil des Budgets skalieren
    const lvl = EVENT_LEVELS[s.eventLevel] || EVENT_LEVELS.normal;
    const target = base * (lvl.range[0] + rand() * (lvl.range[1] - lvl.range[0]));
    const scalable = picked.filter((p) => !p.e.income && !p.e.flat).reduce((a, p) => a + p.raw, 0);
    const factor = scalable > 0 ? target / scalable : 1;
    return picked.map((p) => {
      let amt = p.e.flat ? p.raw : p.e.income ? p.raw : p.raw * factor;
      if (!p.e.flat) amt = niceAmount(Math.min(amt, base * MAX_SINGLE_EVENT));
      return {
        id: uid(), cid: p.e.id, title: p.e.title, desc: p.desc, cat: p.e.cat, date: p.date,
        start: !!p.e.start, amount: p.e.income ? amt : -amt, status: 'open', txId: null,
      };
    }).sort((a, b) => a.date.localeCompare(b.date) || a.amount - b.amount);
  }

  function seasonEvents(season) { return Array.isArray(season?.events) ? season.events : []; }
  function openEventsSum(season) { return seasonEvents(season).filter((e) => e.status !== 'done').reduce((a, e) => a + e.amount, 0); }

  /** Event abhaken (bucht es) oder wieder öffnen (storniert die Buchung) */
  function setEventDone(season, ev, done, { auto = false, ts = Date.now(), nextSeasonId } = {}) {
    if (done && ev.status !== 'done') {
      const tx = {
        id: uid(), seasonId: season.id, ts, type: 'event', title: ev.title, sub: `${ev.cat} · ${fmtDay(ev.date)}${auto ? ' · automatisch' : ''}`,
        gross: 0, net: ev.amount, total: ev.amount, eventId: ev.id, auto: auto && ev.start,
        lines: [{ label: ev.title, amount: ev.amount }, { label: ev.desc, amount: 0, muted: true, text: true }],
      };
      if (nextSeasonId) tx.nextSeasonId = nextSeasonId;
      state.txs.push(tx);
      ev.status = 'done';
      ev.txId = tx.id;
    } else if (!done && ev.status === 'done') {
      state.txs = state.txs.filter((t) => t.id !== ev.txId);
      ev.status = 'open';
      ev.txId = null;
    }
  }

  /** Nach Löschen/Import: Event-Status an vorhandene Buchungen angleichen */
  function syncEventStatus() {
    const ids = new Set(state.txs.map((t) => t.id));
    for (const s of state.seasons) {
      for (const ev of seasonEvents(s)) {
        if (ev.status === 'done' && !ids.has(ev.txId)) { ev.status = 'open'; ev.txId = null; }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // UI-Helfer: Toast, Dialog
  // ---------------------------------------------------------------------------
  function toast(msg, action) {
    const host = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
    host.appendChild(el);
    if (action) el.querySelector('button').addEventListener('click', () => { action.fn(); dismiss(); });
    const t = setTimeout(dismiss, action ? 7000 : 3500);
    function dismiss() { clearTimeout(t); el.classList.add('out'); setTimeout(() => el.remove(), 300); }
    while (host.children.length > 3) host.firstElementChild.remove();
  }

  const dlg = $('#dialog');
  function openDialog({ title, body, foot, onMount }) {
    dlg.innerHTML = `
      <div class="dlg-head"><h2 id="dlgTitle">${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Schließen">${icon('x')}</button></div>
      <div class="dlg-body">${body}</div>
      ${foot ? `<div class="dlg-foot">${foot}</div>` : ''}`;
    dlg.querySelector('[data-close]').addEventListener('click', () => dlg.close());
    if (!dlg.open) dlg.showModal();
    onMount?.(dlg);
  }
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  function confirmDialog({ title, text, ok = 'OK', danger = false, requireText = '' }) {
    return new Promise((resolve) => {
      openDialog({
        title,
        body: `<p>${text}</p>${requireText ? `<label class="field w6"><span>Zur Bestätigung „${esc(requireText)}“ eintippen</span><input class="input" id="confirmInput" autocomplete="off"></label>` : ''}`,
        foot: `<button type="button" class="btn" data-no>Abbrechen</button><button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-yes ${requireText ? 'disabled' : ''}>${esc(ok)}</button>`,
        onMount(d) {
          let done = false;
          const finish = (v) => { if (done) return; done = true; resolve(v); d.close(); };
          d.querySelector('[data-no]').addEventListener('click', () => finish(false));
          d.querySelector('[data-yes]').addEventListener('click', () => finish(true));
          d.addEventListener('close', () => finish(false), { once: true });
          const ci = d.querySelector('#confirmInput');
          if (ci) { ci.addEventListener('input', () => { d.querySelector('[data-yes]').disabled = ci.value.trim() !== requireText; }); ci.focus(); }
        },
      });
    });
  }

  function countUp(el, to) {
    const from = Number(el.dataset.v || 0);
    el.dataset.v = to;
    if (REDUCED || from === to) { el.textContent = eur(to); return; }
    const start = performance.now(), dur = 900;
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = eur(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------------------------------------------------------------------------
  // Charts (SVG, ohne Bibliothek – funktioniert offline)
  // ---------------------------------------------------------------------------
  function niceStep(range, ticks = 4) {
    const raw = Math.max(range, 1) / ticks;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  }

  const tip = $('#chartTip');
  function showTip(x, y, html) { tip.innerHTML = html; tip.hidden = false; tip.style.left = x + 'px'; tip.style.top = y + 'px'; }
  function hideTip() { tip.hidden = true; }

  function renderLineChart(host, rows) {
    const pts = [];
    rows.forEach((r) => {
      // Automatisch gebuchte Raten zum Saisonstart fließen in den Startpunkt ein
      const autos = r.txs.filter((t) => t.auto);
      let n = r.startNet + autos.reduce((a, t) => a + t.net, 0), g = r.startGross + autos.reduce((a, t) => a + (t.gross || 0), 0);
      pts.push({ net: n, gross: g, label: `Saisonstart ${r.s.label}`, season: r.idx, start: true });
      r.txs.filter((t) => !t.auto).forEach((t) => { n += t.net; g += t.gross || 0; pts.push({ net: n, gross: g, label: t.title, season: r.idx }); });
    });
    if (!pts.length) { host.innerHTML = '<p class="empty">Noch keine Daten.</p>'; return; }
    if (pts.length === 1) pts.push({ ...pts[0], start: false });

    const W = Math.max(300, host.clientWidth || 700);
    const H = W < 500 ? 220 : 270;
    const P = { l: W < 500 ? 48 : 64, r: 12, t: 22, b: 26 };
    const vals = pts.flatMap((p) => [p.net, p.gross]).concat(0);
    let min = Math.min(...vals), max = Math.max(...vals);
    const step = niceStep(max - min);
    min = Math.floor(min / step) * step; max = Math.ceil(max / step) * step;
    if (max === min) max = min + step;
    const x = (i) => P.l + (i * (W - P.l - P.r)) / (pts.length - 1);
    const y = (v) => P.t + ((max - v) * (H - P.t - P.b)) / (max - min);

    const ticks = [];
    for (let v = min; v <= max + 1; v += step) ticks.push(v);
    const lineNet = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.net).toFixed(1)}`).join('');
    const lineGross = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.gross).toFixed(1)}`).join('');
    const area = `${lineNet}L${x(pts.length - 1).toFixed(1)},${y(min).toFixed(1)}L${x(0).toFixed(1)},${y(min).toFixed(1)}Z`;
    const seps = pts.map((p, i) => (p.start ? i : -1)).filter((i) => i >= 0);

    host.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Budgetverlauf realistisch und ingame">
        <defs><linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--c-net)" stop-opacity=".22"/><stop offset="1" stop-color="var(--c-net)" stop-opacity="0"/>
        </linearGradient></defs>
        <g class="axis">
          ${ticks.map((v) => `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${P.l - 8}" y="${y(v) + 4}" text-anchor="end">${eurShort(v)}</text>`).join('')}
        </g>
        ${seps.map((i) => `<line class="season-sep" x1="${x(i)}" x2="${x(i)}" y1="${P.t - 6}" y2="${H - P.b}"/><text class="season-lbl" x="${x(i) > W - 70 ? x(i) - 4 : x(i) + 4}" text-anchor="${x(i) > W - 70 ? 'end' : 'start'}" y="${P.t - 8}">${esc(rows[pts[i].season].s.label)}</text>`).join('')}
        ${min < 0 && max > 0 ? `<line class="zero-line" x1="${P.l}" x2="${W - P.r}" y1="${y(0)}" y2="${y(0)}"/>` : ''}
        <path class="area-net fade-in" d="${area}"/>
        <path class="line-gross fade-in" d="${lineGross}"/>
        <path class="line-net draw" d="${lineNet}"/>
        <line class="hover-line" y1="${P.t}" y2="${H - P.b}" visibility="hidden"/>
        <circle class="hover-dot" r="5" visibility="hidden"/>
        <rect x="${P.l}" y="0" width="${W - P.l - P.r}" height="${H}" fill="transparent" class="hit"/>
      </svg>`;
    const svg = host.querySelector('svg');
    const pathNet = svg.querySelector('.line-net');
    if (!REDUCED) pathNet.style.setProperty('--len', Math.ceil(pathNet.getTotalLength()));
    else pathNet.classList.remove('draw');
    const hl = svg.querySelector('.hover-line'), hd = svg.querySelector('.hover-dot');
    const move = (e) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(pts.length - 1, Math.round(((px - P.l) / (W - P.l - P.r)) * (pts.length - 1))));
      const p = pts[i];
      hl.setAttribute('x1', x(i)); hl.setAttribute('x2', x(i)); hl.setAttribute('visibility', 'visible');
      hd.setAttribute('cx', x(i)); hd.setAttribute('cy', y(p.net)); hd.setAttribute('visibility', 'visible');
      const sx = r.left + (x(i) / W) * r.width, sy = r.top + (y(p.net) / H) * r.height;
      showTip(sx, sy, `${esc(p.label)}<br>Realistisch <b>${eur(p.net)}</b><br>Ingame (FC27) <b>${eur(p.gross)}</b>`);
    };
    const leave = () => { hl.setAttribute('visibility', 'hidden'); hd.setAttribute('visibility', 'hidden'); hideTip(); };
    const hit = svg.querySelector('.hit');
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', leave);
  }

  function renderDonut(host, segs, centerTop, centerBottom) {
    const total = segs.reduce((a, s) => a + Math.max(0, s.value), 0);
    const R = 60, C = 2 * Math.PI * R;
    let acc = 0;
    const circles = segs.map((s) => {
      const len = total ? (Math.max(0, s.value) / total) * C : 0;
      const c = `<circle r="${R}" cx="80" cy="80" stroke="${s.color}" data-len="${len}" stroke-dasharray="0 ${C}" stroke-dashoffset="${-acc}"><title>${esc(s.label)}: ${eur(s.value)}</title></circle>`;
      acc += len;
      return c;
    }).join('');
    host.innerHTML = `
      <div class="donut-wrap">
        <div class="donut">
          <svg viewBox="0 0 160 160" role="img" aria-label="Aufteilung der Verkaufserlöse">
            <circle r="${R}" cx="80" cy="80" stroke="var(--surface-2)"/>${circles}
          </svg>
          <div class="donut-center"><strong>${centerTop}</strong><span>${centerBottom}</span></div>
        </div>
        <ul class="legend-list">
          ${segs.map((s) => `<li><i style="background:${s.color}"></i><span>${esc(s.label)} <span class="pc">${total ? nf1.format((s.value / total) * 100) + ' %' : ''}</span></span><span class="num">${eur(s.value)}</span></li>`).join('')}
        </ul>
      </div>`;
    const apply = () => $$('circle[data-len]', host).forEach((c) => { c.style.strokeDasharray = `${c.dataset.len} ${C}`; });
    if (REDUCED) apply(); else requestAnimationFrame(() => requestAnimationFrame(apply));
  }

  function renderSeasonBars(host, rows) {
    if (!rows.length) { host.innerHTML = ''; return; }
    const W = Math.max(300, host.clientWidth || 700), H = 230;
    const P = { l: W < 500 ? 48 : 64, r: 10, t: 14, b: 30 };
    const vals = rows.flatMap((r) => [r.endNet, r.endGross]).concat(0);
    let min = Math.min(...vals), max = Math.max(...vals);
    const step = niceStep(max - min);
    min = Math.floor(min / step) * step; max = Math.ceil(max / step) * step;
    if (max === min) max = min + step;
    const y = (v) => P.t + ((max - v) * (H - P.t - P.b)) / (max - min);
    const band = (W - P.l - P.r) / rows.length;
    const bw = Math.min(34, band * 0.32);
    const ticks = [];
    for (let v = min; v <= max + 1; v += step) ticks.push(v);
    const bar = (cx, v, color, label, i) => {
      const y0 = y(0), y1 = y(v);
      const top = Math.min(y0, y1), h = Math.max(1, Math.abs(y1 - y0));
      return `<rect x="${cx}" y="${top}" width="${bw}" height="${h}" rx="4" fill="${color}" style="transform-origin:${cx}px ${y0}px;animation:barGrow .8s ${i * 70}ms var(--ease-out) both"><title>${esc(label)}: ${eur(v)}</title></rect>`;
    };
    host.innerHTML = `
      <style>@keyframes barGrow{from{transform:scaleY(0)}}</style>
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Endstände je Saison">
        <g class="axis">${ticks.map((v) => `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${P.l - 8}" y="${y(v) + 4}" text-anchor="end">${eurShort(v)}</text>`).join('')}</g>
        <line class="zero-line" x1="${P.l}" x2="${W - P.r}" y1="${y(0)}" y2="${y(0)}"/>
        ${rows.map((r, i) => {
          const cx = P.l + band * i + band / 2;
          return bar(cx - bw - 2, r.endGross, 'var(--c-gross)', `${r.s.label} Ingame`, i) + bar(cx + 2, r.endNet, r.endNet < 0 ? 'var(--neg)' : 'var(--c-net)', `${r.s.label} Realistisch`, i)
            + `<text class="season-lbl" x="${cx}" y="${H - 8}" text-anchor="middle">${esc(r.s.label)}</text>`;
        }).join('')}
      </svg>`;
  }

  // ---------------------------------------------------------------------------
  // Routing
  // ---------------------------------------------------------------------------
  const VIEWS = ['dashboard', 'verkauf', 'kauf', 'events', 'sonstiges', 'saison', 'protokoll', 'einstellungen'];
  let currentView = null;
  function routeFromHash() {
    const h = location.hash.replace('#', '').split('/');
    const v = VIEWS.includes(h[0]) ? h[0] : 'dashboard';
    if (v === 'sonstiges' && ['in', 'out', 'take', 'repay'].includes(h[1])) state.ui.otherKind = h[1];
    return v;
  }
  function go(view, sub) {
    const target = '#' + view + (sub ? '/' + sub : '');
    if (location.hash === target) { showView(view); return; }
    location.hash = target;
  }
  function showView(v) {
    const doSwitch = () => {
      if (v === 'saison' && currentView !== 'saison') wiz = null;
      currentView = v;
      // Inaktive Views leeren: Formulare nutzen gleiche IDs (#entryForm, #receipt)
      $$('.view').forEach((el) => { const on = el.id === 'view-' + v; el.classList.toggle('active', on); if (!on) el.innerHTML = ''; });
      $$('[data-nav]').forEach((b) => b.setAttribute('aria-current', b.dataset.nav === v ? 'page' : 'false'));
      renderView(v);
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    if (document.startViewTransition && !REDUCED && !document.hidden && currentView && currentView !== v) {
      // Absicherung: manche Browser verzögern den Callback, wenn der Tab nicht sichtbar ist
      let ran = false;
      const run = () => { if (ran) return; ran = true; doSwitch(); };
      try { document.startViewTransition(run); } catch (_) { run(); }
      setTimeout(run, 300);
    } else doSwitch();
  }
  window.addEventListener('hashchange', () => showView(routeFromHash()));

  function renderView(v) {
    hideTip();
    ({
      dashboard: renderDashboard,
      verkauf: () => renderTransfer('sale'),
      kauf: () => renderTransfer('purchase'),
      events: renderEvents,
      sonstiges: renderOther,
      saison: renderWizard,
      protokoll: renderLog,
      einstellungen: renderSettings,
    })[v]();
  }
  function renderAll() { updateSaveState(false); showView(currentView || routeFromHash()); }

  function needSeason(el, title) {
    el.innerHTML = `<div class="view-head"><div><div class="eyebrow">FC27 Karrieremodus</div><h1>${title}</h1></div></div>
      <div class="alert info">${icon('calendar')}<div>Leg zuerst die erste Saison mit dem Transferbudget an, das dir FC27 anzeigt.</div><button type="button" class="btn small primary" data-nav="saison">Saison anlegen</button></div>`;
  }

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------
  function backupBanner() {
    if (!storageOk) return `<div class="alert bad">${icon('warn')}<div><b>Der Browser blockiert lokales Speichern.</b> Ist ein privates Fenster offen? Bitte ein normales Fenster nutzen oder regelmäßig über „Einstellungen → Daten“ exportieren.</div></div>`;
    if (Backup.handle && Backup.perm !== 'granted') {
      return `<div class="alert info">${icon('link')}<div>Auto-Backup-Datei <b>${esc(Backup.handle.name)}</b> ist verbunden, der Browser verlangt nach dem Neustart eine Bestätigung.</div><button type="button" class="btn small" data-action="backup-reconnect">Freigeben</button></div>`;
    }
    return '';
  }

  function renderDashboard() {
    const el = $('#view-dashboard');
    if (!state.seasons.length) { renderOnboarding(el); return; }
    const rows = ledger();
    const row = rows[rows.length - 1];
    const s = row.s;
    const loans = openLoans();
    const debtLoans = loans.reduce((a, l) => a + l.outstanding, 0);
    const overdraft = Math.max(0, -row.endNet);
    const interestNext = loans.reduce((a, l) => a + round(l.outstanding * (Number(l.rate) || 0) / 100), 0) + round(overdraft * S().overdraftPct / 100);
    const up = upcomingInstallments();
    const diff = row.endNet - row.endGross;
    const b = diffBuckets(row);
    const ffpRatio = row.incOp > 0 ? (row.expOp / row.incOp) * 100 : (row.expOp > 0 ? 999 : 0);
    const ffpClass = ffpRatio > S().ffpLimit ? 'bad' : ffpRatio > S().ffpLimit * 0.85 ? 'warn' : '';
    const recent = [...state.txs].sort((a, c) => c.ts - a.ts).slice(0, 6);
    const scope = state.ui.donutScope;
    const netShare = row.endGross > 0 ? Math.max(0, Math.min(1, row.endNet / row.endGross)) : 0;
    const evs = seasonEvents(s);
    const openEvs = evs.filter((e) => e.status !== 'done');
    const openSum = openEventsSum(s);
    const afterEvents = row.endNet + openSum;
    const gd = s.gameDate || '';
    const dueEvs = gd ? openEvs.filter((e) => e.date <= gd) : [];

    const alerts = [];
    if (dueEvs.length) alerts.push(`<div class="alert warn">${icon('calendar')}<div><b>${dueEvs.length} Event(s) fällig</b> bis zum Spieldatum ${fmtDay(gd)} (${eur(dueEvs.reduce((a, e) => a + e.amount, 0), true)}).</div><button type="button" class="btn small" data-nav="events">Abhaken</button></div>`);
    if (row.endNet < 0) alerts.push(`<div class="alert bad">${icon('warn')}<div><b>Realistisches Budget im Minus (${eur(row.endNet)}).</b> Hausregel: keine Käufe mehr, bis wieder Plus. Beim Saisonwechsel fallen ${pct(S().overdraftPct)} Überziehungszinsen an.</div><button type="button" class="btn small" data-nav="sonstiges" data-sub="take">Kredit</button></div>`);
    else if (afterEvents < 0) alerts.push(`<div class="alert warn">${icon('warn')}<div><b>Achtung:</b> Nach allen geplanten Events wärst du bei ${eur(afterEvents)}. Plane einen Verkauf ein.</div></div>`);
    if (S().ffpEnabled && ffpClass === 'bad') alerts.push(`<div class="alert warn">${icon('warn')}<div><b>Fairplay-Warnung:</b> Ausgaben bei ${nf0.format(Math.min(ffpRatio, 999))} % der Einnahmen (Grenze ${nf0.format(S().ffpLimit)} %).</div></div>`);

    const bucketRows = [
      ['Übertrag aus Vorsaison', b.carry],
      ['Körperschaftsteuer', b.tax],
      ['FIFA-Abgaben (Solidarität, Ausbildung)', b.fifa],
      ['Berater & Handgelder', b.agent],
      ['Saison-Events', b.events],
      ['Ratenzahlungen (zeitl. Verschiebung)', b.rates],
      ['Sonstige Posten', b.ops],
      ['Kredite & Zinsen', b.credit],
    ].filter(([, v]) => round(v) !== 0);

    const upGroups = {};
    up.forEach((u) => { (upGroups[u.ahead] ||= []).push(u); });
    const nextEvs = openEvs.slice(0, 5);

    el.innerHTML = `
      ${backupBanner()}
      ${alerts.join('')}
      <div class="bento">
        <article class="tile hero span-8 reveal" style="--i:0">
          <div class="hero-watermark" aria-hidden="true">${esc(s.label)}</div>
          <div class="tile-kicker">Saison ${esc(s.label)} · FC27 Karrieremodus · Hausregel aktiv</div>
          <div class="hero-duo">
            <div>
              <div class="lbl">Realistisches Budget</div>
              <div class="hero-amount ${row.endNet < 0 ? 'neg' : ''}" id="heroAmount" data-v="0">${eur(0)}</div>
              <small>So viel darfst du im Spiel wirklich ausgeben.</small>
            </div>
            <div class="ingame">
              <div class="lbl">Ingame-Budget (FC27)</div>
              <div class="ingame-amount num">${eur(row.endGross)}</div>
              <small>So viel zeigt dir das Spiel gerade an.</small>
            </div>
          </div>
          <div class="hero-gap">
            <div class="hero-gap-bar" aria-hidden="true"><i data-scale="${netShare}"></i></div>
            <div class="hero-gap-text"><span>Differenz zum Spiel <b>${eur(diff, true)}</b></span><span>Nach allen geplanten Events <b>${eur(afterEvents)}</b></span></div>
          </div>
        </article>

        <div class="action-stack reveal" style="--i:1">
          <button type="button" class="big-action sell" data-nav="verkauf"><span class="ic">${icon('plus')}</span><span>Verkauf eintragen<small>Nur der Netto-Erlös zählt</small></span></button>
          <button type="button" class="big-action buy" data-nav="kauf"><span class="ic">${icon('plus')}</span><span>Kauf eintragen<small>Ablöse + Berater + Nebenkosten</small></span></button>
          <button type="button" class="big-action season" data-nav="saison"><span class="ic">${icon('flag')}</span><span>Neue Saison starten<small>Neues FC27-Budget, neuer Event-Plan</small></span></button>
          <button type="button" class="big-action small-link" data-nav="sonstiges"><span class="ic">${icon('coins')}</span><span>Sonstiges: Preisgeld, Sponsor, Kredit …</span></button>
        </div>

        <article class="tile span-8 reveal" style="--i:2">
          <div class="tile-head"><h2>Nächste Events</h2><button type="button" class="btn small ghost" data-nav="events">Alle ${evs.length} Events ${icon('arrow')}</button></div>
          ${evs.length
            ? (nextEvs.length ? eventListHtml(nextEvs, { checkable: true, gameDate: gd }) : '<p class="empty">Alle Events dieser Saison sind erledigt.</p>')
            : `<p class="empty">Noch kein Event-Plan für diese Saison.</p><button type="button" class="btn small primary" data-action="events-create">Event-Plan erstellen</button>`}
        </article>

        <article class="tile reveal" style="--i:3">
          <div class="tile-head"><h2>Ausblick Saisonende</h2><span class="tile-kicker">ohne weitere Transfers</span></div>
          <ul class="stat-list">
            <li><span>Realistisch jetzt</span><span class="num ${cls(row.endNet)}">${eur(row.endNet)}</span></li>
            <li><span>Offene Events (${openEvs.length})</span><span class="num ${cls(openSum)}">${eur(openSum, true)}</span></li>
          </ul>
          <div class="gap-diff"><span>Am Saisonende</span><strong class="${afterEvents < 0 ? 'neg' : ''}">${eur(afterEvents)}</strong></div>
        </article>

        <article class="tile reveal" style="--i:4">
          <div class="tile-head"><h2>Wohin geht die Differenz?</h2><span class="tile-kicker">Saison ${esc(s.label)}</span></div>
          <ul class="stat-list">
            ${bucketRows.length ? bucketRows.map(([l, v]) => `<li><span>${l}</span><span class="num ${cls(v)}">${eur(v, true)}</span></li>`).join('') : '<li class="empty">Noch keine Abweichung.</li>'}
          </ul>
          <div class="gap-diff"><span>Realistisch − Ingame</span><strong>${eur(diff, true)}</strong></div>
        </article>

        <article class="tile reveal" style="--i:5">
          <div class="tile-head"><h2>Schulden</h2><span class="tile-kicker">inkl. Zinslast</span></div>
          <div class="stat-big num ${debtLoans + overdraft > 0 ? 'neg' : ''}">${eur(-(debtLoans + overdraft))}</div>
          <ul class="stat-list">
            ${loans.map((l) => `<li><span>${esc(l.name)} <span class="muted small">(${pct(l.rate)})</span></span><span class="num">${eur(l.outstanding)}</span></li>`).join('')}
            ${overdraft ? `<li><span>Überziehung <span class="muted small">(${pct(S().overdraftPct)})</span></span><span class="num">${eur(overdraft)}</span></li>` : ''}
            ${interestNext ? `<li><span>Zinsen beim Saisonwechsel</span><span class="num neg">${eur(-interestNext)}</span></li>` : ''}
          </ul>
          ${!loans.length && !overdraft ? '<p class="empty">Schuldenfrei.</p>' : ''}
        </article>

        <article class="tile reveal" style="--i:6">
          <div class="tile-head"><h2>Offene Raten</h2><span class="tile-kicker">nächste Saisons</span></div>
          ${up.length ? Object.entries(upGroups).slice(0, 3).map(([ahead, list]) => `
            <div class="small muted" style="margin-top:8px"><b>${esc(nextSeasonLabel(s.label, Number(ahead)))}</b> · Saldo <span class="num ${cls(list.reduce((a, u) => a + u.amount, 0))}">${eur(list.reduce((a, u) => a + u.amount, 0), true)}</span></div>
            <ul class="stat-list" style="margin-top:4px">${list.slice(0, 4).map((u) => `<li><span>${esc(u.title)} <span class="muted small">${u.no}/${u.of}</span></span><span class="num ${cls(u.amount)}">${eur(u.amount, true)}</span></li>`).join('')}</ul>`).join('')
            : '<p class="empty">Keine offenen Raten. Ratenzahlung kannst du bei Kauf/Verkauf wählen.</p>'}
        </article>

        <article class="tile span-8 reveal" style="--i:7">
          <div class="tile-head"><h2>Budgetverlauf</h2>
            <div class="chart-legend"><span><i style="background:var(--c-net)"></i>Realistisch</span><span><i class="dash"></i>Ingame (FC27)</span></div>
          </div>
          <div class="chart-wrap" id="lineChart"></div>
        </article>

        <article class="tile reveal" style="--i:8">
          <div class="tile-head"><h2>Wohin geht der Erlös?</h2>
            <div class="seg" role="group" aria-label="Zeitraum">
              <button type="button" data-action="donut-scope" data-scope="season" aria-pressed="${scope === 'season'}">Saison</button>
              <button type="button" data-action="donut-scope" data-scope="all" aria-pressed="${scope === 'all'}">Gesamt</button>
            </div>
          </div>
          <div id="donutChart"></div>
        </article>

        <article class="tile span-8 reveal" style="--i:9">
          <div class="tile-head"><h2>Letzte Einträge</h2><button type="button" class="btn small ghost" data-nav="protokoll">Protokoll ${icon('arrow')}</button></div>
          ${recent.length ? `<ul class="tx-list">${recent.map((t) => txRow(t, false)).join('')}</ul>` : '<p class="empty">Noch keine Einträge in dieser Saison.</p>'}
        </article>

        <article class="tile reveal" style="--i:10">
          <div class="tile-head"><h2>Saison-Bilanz</h2><span class="tile-kicker">${S().ffpEnabled ? 'Fairplay-Check' : 'Ein/Aus'}</span></div>
          <ul class="stat-list">
            <li><span>Einnahmen inkl. FC27-Budget</span><span class="num pos">${eur(row.incOp)}</span></li>
            <li><span>Ausgaben</span><span class="num neg">${eur(-row.expOp)}</span></li>
          </ul>
          ${S().ffpEnabled ? `
            <div class="meter ${ffpClass}"><i data-scale="${Math.min(1, ffpRatio / Math.max(S().ffpLimit, 1))}"></i></div>
            <div class="small muted">Ausgabenquote <b class="num">${nf0.format(Math.min(ffpRatio, 999))} %</b> von max. ${nf0.format(S().ffpLimit)} %</div>` : ''}
        </article>
      </div>`;

    countUp($('#heroAmount'), row.endNet);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $$('[data-scale]', el).forEach((b2) => { b2.style.transform = `scaleX(${Math.max(0, Math.min(1, Number(b2.dataset.scale)))})`; });
    }));
    renderLineChart($('#lineChart'), rows);
    const d = saleDeductionTotals(scope);
    if (d.gross > 0) {
      renderDonut($('#donutChart'), [
        { label: 'Bleibt im Budget', value: Math.max(0, d.net), color: 'var(--c-net)' },
        { label: 'Körperschaftsteuer', value: d.tax, color: 'var(--c-tax)' },
        { label: 'Solidaritätsbeitrag', value: d.sol, color: 'var(--c-sol)' },
        { label: 'Ausbildungsentsch.', value: d.tc, color: 'var(--c-tc)' },
        { label: 'Berater', value: d.agent, color: 'var(--c-agent)' },
      ], nf0.format((Math.max(0, d.net) / d.gross) * 100) + ' %', 'bleibt netto');
    } else {
      $('#donutChart').innerHTML = `<p class="empty">Noch kein Verkauf${scope === 'season' ? ' in dieser Saison' : ''}. Danach siehst du hier, wie viel an Steuer, FIFA und Berater geht.</p>`;
    }
  }

  function renderOnboarding(el) {
    el.innerHTML = `
      ${backupBanner()}
      ${Backup.handle ? `<div class="alert info">${icon('upload')}<div>Keine Daten im Browser, aber eine Backup-Datei ist verbunden.</div><button type="button" class="btn small" data-action="backup-restore">Aus Backup laden</button></div>` : ''}
      <div class="onboard">
        <article class="tile hero reveal" style="--i:0">
          <div class="hero-watermark" aria-hidden="true">FC27</div>
          <div class="tile-kicker">Veilchen-Kassa · Hausregel für den Karrieremodus</div>
          <h1>FC27 zahlt 1:1.<br>Die Veilchen rechnen realistisch.</h1>
          <p class="hero-sub" style="max-width:54ch;margin-top:14px">Verkaufst du im Spiel um 3 Mio., steigt dein Transferbudget um 3 Mio. – ohne Steuern, FIFA-Abgaben oder Berater. Trag hier die Zahlen aus FC27 ein, die App rechnet dir aus, was realistisch übrig bleibt. Kein echtes Geld, nur deine Hausregel.</p>
          <div class="hero-actions"><button type="button" class="chip-btn" data-nav="saison">${icon('plus')}Erste Saison anlegen</button></div>
        </article>
        <article class="tile reveal" style="--i:1">
          <div class="tile-head"><h2>So funktioniert’s</h2></div>
          <ol>
            <li><b>Saison anlegen</b> – das Transferbudget eintragen, das FC27 dir zuteilt.</li>
            <li><b>Verkauf / Kauf eintragen</b> – Ablöse laut Spiel. Die App zeigt sofort die Aufschlüsselung, du bestätigst.</li>
            <li><b>Realistisches Budget beachten</b> – im Spiel nur so viel ausgeben, wie die App erlaubt.</li>
            <li><b>Neue Saison starten</b> – Fixkosten werden abgezogen, das neue FC27-Budget kommt dazu.</li>
          </ol>
          <p class="small muted" style="margin-top:14px">Alles bleibt in diesem Browser gespeichert – ohne Server, ohne Login. Tipp: unter Einstellungen → Daten eine Auto-Backup-Datei verbinden.</p>
          <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
            <button type="button" class="btn primary" data-nav="saison">${icon('plus')}Saison anlegen</button>
            <button type="button" class="btn" data-action="import">${icon('upload')}Backup importieren</button>
          </div>
        </article>
      </div>`;
  }

  function txRow(t, withDetail = true) {
    const net = t.net;
    const sub = [t.sub, t.note].filter(Boolean).join(' · ');
    const detail = withDetail ? `
      <div class="tx-detail"><div><div class="tx-detail-inner">
        <div>
          ${t.gross ? `<div class="r-line muted-line"><span>Ingame-Wirkung (FC27)</span><span class="num">${eur(t.gross, true)}</span></div>` : ''}
          ${(t.lines || []).map((l) => (l.text ? `<div class="r-line muted-line"><span>${esc(l.label)}</span></div>` : `<div class="r-line ${l.muted ? 'muted-line' : ''}"><span>${esc(l.label)}</span><span class="num ${l.muted ? '' : cls(l.amount)}">${l.muted ? eur(l.amount) : eur(l.amount, true)}</span></div>`)).join('')}
          ${t.total !== undefined && t.total !== t.net ? `<div class="r-line"><span>Netto gesamt</span><span class="num ${cls(t.total)}">${eur(t.total, true)}</span></div>` : ''}
          <div class="r-line total"><span>Wirkt aufs realistische Budget</span><span class="num ${cls(net)}">${eur(net, true)}</span></div>
          ${t.schedule?.length ? `<div class="r-sched">${t.schedule.map((r, i) => `<div><span>Rate ${i + 2}/${t.schedule.length + 1} · Saison +${r.offset}</span><span class="num ${cls(r.amount)}">${eur(r.amount, true)}</span></div>`).join('')}</div>` : ''}
        </div>
        <div><button type="button" class="btn small danger" data-action="delete-tx" data-id="${t.id}">${icon('trash')}Löschen</button></div>
      </div></div></div>` : '';
    return `
      <li class="tx-row" data-id="${t.id}">
        <button type="button" class="tx-main" ${withDetail ? 'data-action="toggle-tx"' : 'data-nav="protokoll"'} aria-expanded="false">
          <span class="tx-date"><span class="badge ${t.type} ${t.auto ? 'auto' : ''}">${TYPE_LABEL[t.type] || t.type}</span></span>
          <span style="min-width:0"><span class="tx-title" style="display:block">${esc(t.title)}</span><span class="tx-sub" style="display:block">${esc(sub || dateFmt.format(t.ts))}</span></span>
          <span class="num gross">${t.gross ? 'FC27 ' + eur(t.gross, true) : ''}</span>
          <span class="num ${cls(net)}"><b>${eur(net, true)}</b></span>
          ${withDetail ? icon('chevron', 'class="chev"') : '<span></span>'}
        </button>
        ${detail}
      </li>`;
  }

  // ---------------------------------------------------------------------------
  // Formular-Bausteine
  // ---------------------------------------------------------------------------
  const COUNTRIES = ['Österreich', 'Deutschland', 'Schweiz', 'Italien', 'Spanien', 'England', 'Frankreich', 'Niederlande', 'Belgien', 'Portugal', 'Kroatien', 'Slowenien', 'Serbien', 'Ungarn', 'Tschechien', 'Slowakei', 'Polen', 'Dänemark', 'Schweden', 'Norwegen', 'Türkei', 'Griechenland', 'Schottland', 'USA', 'Saudi-Arabien'];
  const OTHER_CATEGORIES = [
    ['Sponsoring', 'in'], ['Preisgeld Meisterschaft', 'in'], ['Preisgeld Cup', 'in'], ['Preisgeld Europacup', 'in'],
    ['Fernsehgelder', 'in'], ['Ticketing', 'in'], ['Eingehender Solidaritätsbeitrag', 'in'], ['Eingehende Ausbildungsentschädigung', 'in'],
    ['Leihgebühr (eingehend)', 'in'], ['Kaufoption gezogen (eingehend)', 'in'],
    ['Leihgebühr (ausgehend)', 'out'], ['Handgeld / Signing Fee', 'out'], ['Vertragsverlängerungsprämie', 'out'],
    ['Stadionausbau', 'out'], ['Instandhaltung', 'out'], ['Trainingsgelände', 'out'], ['Scouting', 'out'], ['Sonstige Ausgabe', 'out'],
  ];

  function field(name, label, { type = 'text', value = '', money = false, suffix = '', w = '', hint = '', attrs = '', list = '' } = {}) {
    const input = `<input class="input ${money ? 'money' : ''}" name="${name}" id="f-${name}" type="${type}" value="${esc(value)}" ${money ? 'inputmode="decimal" autocomplete="off" spellcheck="false" data-money' : ''} ${list ? `list="${list}"` : ''} ${attrs}>`;
    return `<label class="field ${w}" for="f-${name}"><span>${label}</span>${suffix ? `<div class="input-affix">${input}<em>${suffix}</em></div>` : input}${hint ? `<small>${hint}</small>` : ''}<span class="err" data-err="${name}"></span></label>`;
  }
  function toggle(name, label, checked = false) {
    return `<label class="toggle"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span class="sw"></span><span class="t">${label}</span></label>`;
  }
  function payMode() {
    const s = S();
    return `
      <div class="pay-mode">
        <div class="field" style="grid-column:auto"><span class="field-label">Zahlung</span>
          <div class="radio-seg" role="radiogroup" aria-label="Zahlungsmodalität">
            <label><input type="radio" name="pay" value="sofort" checked><span>Sofort</span></label>
            <label><input type="radio" name="pay" value="raten"><span>Raten</span></label>
          </div>
        </div>
        <label class="field half is-hidden" data-rate-field style="grid-column:auto"><span>Anzahlung jetzt</span><div class="input-affix"><input class="input" name="upPct" inputmode="decimal" value="${fmtInputNum(s.upfrontPct)}"><em>%</em></div><span class="err" data-err="upPct"></span></label>
        <label class="field half is-hidden" data-rate-field style="grid-column:auto"><span>Rest über Saisons</span><input class="input" name="years" inputmode="numeric" value="${s.rateYears}"><span class="err" data-err="years"></span></label>
      </div>`;
  }
  function knownPlayers() {
    return [...new Set(state.txs.filter((t) => t.type === 'sale' || t.type === 'purchase').map((t) => t.title))].sort((a, b) => a.localeCompare(b, 'de'));
  }

  function formShell({ el, eyebrow, title, intro, formHtml, submitLabel, kind }) {
    el.innerHTML = `
      <div class="view-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1></div></div>
      <p class="page-intro">${intro}</p>
      <div class="entry-layout">
        <div>
          <form class="tile span-12" id="entryForm" data-kind="${kind}" novalidate autocomplete="off" style="transform:none">
            <div class="form-grid">
              ${formHtml}
              <div class="form-actions">
                <button type="submit" class="btn primary big">${icon('check')}${submitLabel}</button>
                <button type="reset" class="btn ghost">Leeren</button>
                <span class="hint"><span class="kbd">Enter</span> bestätigt · Beträge wie „3,5 Mio“ oder „750k“ gehen auch</span>
              </div>
            </div>
          </form>
          <datalist id="playerList">${knownPlayers().map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
          <datalist id="countryList">${COUNTRIES.map((c) => `<option value="${c}">`).join('')}</datalist>
          <datalist id="catList">${OTHER_CATEGORIES.map(([c]) => `<option value="${esc(c)}">`).join('')}</datalist>
        </div>
        <aside class="receipt" aria-live="polite"><div class="receipt-card" id="receipt"></div></aside>
      </div>`;
    const f = $('#entryForm');
    f.addEventListener('input', (e) => onEntryInput(e, f));
    f.addEventListener('change', (e) => onEntryInput(e, f));
    f.addEventListener('submit', (e) => { e.preventDefault(); submitEntry(f); });
    f.addEventListener('reset', () => setTimeout(() => { $$('[data-rate-field]', f).forEach((x) => x.classList.add('is-hidden')); updateReceipt(f); }, 0));
    updateReceipt(f);
    const first = f.querySelector('input:not([type=radio]):not([type=checkbox])');
    if (first && matchMedia('(pointer:fine)').matches) first.focus();
  }

  // ---------------------------------------------------------------------------
  // Verkauf / Kauf
  // ---------------------------------------------------------------------------
  function renderTransfer(kind) {
    const isSale = kind === 'sale';
    const el = $(isSale ? '#view-verkauf' : '#view-kauf');
    const title = isSale ? 'Verkauf eintragen' : 'Kauf eintragen';
    if (!state.seasons.length) { needSeason(el, title); return; }
    const s = S();
    const formHtml = `
      ${field('player', 'Spieler *', { w: 'w4', attrs: 'autocomplete="off" required', list: 'playerList' })}
      ${field('age', 'Alter', { w: 'w2 half', attrs: 'inputmode="numeric" autocomplete="off"' })}
      ${field('gross', isSale ? 'Verkaufssumme laut FC27 *' : 'Ablöse laut FC27', { w: 'w6', money: true, suffix: '€', hint: isSale ? 'Die Ablöse, die dir das Spiel anzeigt.' : '0 oder leer = ablösefrei' })}
      ${field('club', isSale ? 'Gegenverein' : 'Herkunftsverein', { w: 'w4', attrs: 'autocomplete="off"' })}
      ${field('land', 'Land des Vereins', { w: 'w2', list: 'countryList', attrs: 'autocomplete="off" placeholder="z. B. Italien"', hint: 'Nicht Österreich = international' })}
      <div class="toggle-row">
        ${toggle('intl', 'Internationaler Transfer')}
        ${isSale ? toggle('youth', 'Eigenes Eigengewächs') : ''}
      </div>
      ${isSale ? field('book', 'Ursprünglicher Einkaufspreis (optional)', { w: 'w6', money: true, suffix: '€', hint: 'Dann wird die KöSt nur auf den Gewinn gerechnet. Wird automatisch übernommen, wenn du den Spieler hier gekauft hast.' }) : ''}
      ${payMode()}
      <details class="more"><summary>Details: Beraterprovision${isSale ? '' : ', Handgeld'}, Notiz</summary>
        <div class="form-grid">
          <label class="field w2 half"><span>Beraterprovision</span><div class="input-affix"><input class="input" name="agentPct" inputmode="decimal" value="${fmtInputNum(isSale ? s.agentSellPct : s.agentBuyPct)}"><em>%</em></div></label>
          ${isSale ? '' : field('signing', 'Handgeld / Signing Fee', { w: 'w4', money: true, suffix: '€' })}
          ${field('note', 'Notiz', { w: isSale ? 'w4' : 'w6', attrs: 'autocomplete="off"' })}
        </div>
      </details>`;
    formShell({
      el, kind, formHtml,
      eyebrow: `Saison ${esc(currentSeason().label)} · ${isSale ? 'Spieler abgeben' : 'Spieler holen'}`,
      title,
      intro: isSale
        ? 'Trag die Verkaufssumme ein, die FC27 dir anzeigt. Dem realistischen Budget wird nur der Netto-Erlös gutgeschrieben – ohne Körperschaftsteuer, FIFA-Abgaben und Berater.'
        : 'Trag die Ablöse aus FC27 ein. Rechts siehst du die Gesamtbelastung inklusive Berater, Ausbildungsentschädigung und Handgeld.',
      submitLabel: 'Bestätigen',
    });
  }

  // ---------------------------------------------------------------------------
  // Sonstiges (Einnahme, Ausgabe, Kredit)
  // ---------------------------------------------------------------------------
  function renderOther() {
    const el = $('#view-sonstiges');
    if (!state.seasons.length) { needSeason(el, 'Sonstiges'); return; }
    const k = state.ui.otherKind;
    const loans = openLoans();
    const kinds = [['in', 'Einnahme', 'plus'], ['out', 'Ausgabe', 'coins'], ['take', 'Kredit aufnehmen', 'bank'], ['repay', 'Kredit tilgen', 'check']];
    let body;
    if (k === 'in' || k === 'out') {
      body = `
        ${field('category', 'Kategorie *', { w: 'w4', list: 'catList', attrs: 'autocomplete="off" required placeholder="z. B. Preisgeld Cup, Stadionausbau"' })}
        ${field('amount', 'Betrag *', { w: 'w2', money: true, suffix: '€' })}
        ${field('note', 'Notiz', { w: 'w4', attrs: 'autocomplete="off"' })}
        ${field('parts', 'Verteilen auf Saisons', { w: 'w2 half', value: '1', attrs: 'inputmode="numeric"', hint: 'z. B. Stadionausbau über 5' })}
        <div class="toggle-row">
          ${k === 'in' ? toggle('taxed', `KöSt abziehen (${pct(S().koestPct)})`) : ''}
        </div>`;
    } else if (k === 'take') {
      body = `
        <label class="field w2" for="f-kind"><span>Art</span>
          <select class="input" name="lkind" id="f-kind">
            <option>Kontokorrentkredit</option><option>Bankkredit</option><option>Gesellschafterdarlehen</option><option>Investorendarlehen</option>
          </select>
        </label>
        ${field('lname', 'Bezeichnung', { w: 'w4', attrs: 'autocomplete="off" placeholder="z. B. Hausbank"' })}
        ${field('lamount', 'Betrag *', { w: 'w4', money: true, suffix: '€' })}
        <label class="field w2 half"><span>Zinssatz p. a.</span><div class="input-affix"><input class="input" name="lrate" inputmode="decimal" value="${fmtInputNum(S().loanPct)}"><em>%</em></div></label>`;
    } else {
      body = loans.length ? `
        <label class="field w4" for="f-loanId"><span>Kredit</span>
          <select class="input" name="loanId" id="f-loanId">${loans.map((l) => `<option value="${l.id}">${esc(l.name)} – offen ${eur(l.outstanding)}</option>`).join('')}</select>
        </label>
        ${field('ramount', 'Tilgungsbetrag *', { w: 'w2', money: true, suffix: '€', value: fmtInputMoney(loans[0].outstanding) })}`
        : `<p class="empty" style="grid-column:1/-1">Kein offener Kredit.</p>`;
    }
    formShell({
      el, kind: 'other',
      eyebrow: `Saison ${esc(currentSeason().label)} · kennt FC27 nicht`,
      title: 'Sonstiges',
      intro: 'Posten, die das Spiel nicht abbildet: Preisgelder, Sponsoring, Stadionausbau, Leihgebühren, Kredite. Sie wirken nur aufs realistische Budget.',
      formHtml: `<div class="kind-switch" role="radiogroup" aria-label="Art" style="grid-column:1/-1">
          ${kinds.map(([v, l]) => `<label><input type="radio" name="okind" value="${v}" ${k === v ? 'checked' : ''} ${v === 'repay' && !loans.length ? 'disabled' : ''}><span>${l}</span></label>`).join('')}
        </div>${body}`,
      submitLabel: 'Bestätigen',
    });
  }

  // ---------------------------------------------------------------------------
  // Formular-Logik
  // ---------------------------------------------------------------------------
  function formKind(f) {
    if (f.dataset.kind !== 'other') return f.dataset.kind;
    return 'other';
  }

  function onEntryInput(e, f) {
    const t = e.target;
    if (t.name === 'okind') {
      state.ui.otherKind = t.value;
      history.replaceState(null, '', '#sonstiges/' + t.value);
      renderOther();
      return;
    }
    if (t.name === 'pay') $$('[data-rate-field]', f).forEach((x) => x.classList.toggle('is-hidden', f.elements.pay.value !== 'raten'));
    if (t.name === 'loanId') {
      const l = openLoans().find((x) => x.id === t.value);
      if (l) f.elements.ramount.value = fmtInputMoney(l.outstanding);
    }
    if (t.name === 'land') {
      const v = t.value.trim();
      if (v) f.elements.intl.checked = !DOMESTIC.test(v);
    }
    if (t.name === 'category' && e.type === 'change') {
      const c = OTHER_CATEGORIES.find(([n]) => n.toLowerCase() === t.value.trim().toLowerCase());
      if (c && c[1] !== state.ui.otherKind) {
        const keep = { category: t.value, amount: f.elements.amount?.value, note: f.elements.note?.value, parts: f.elements.parts?.value };
        state.ui.otherKind = c[1];
        history.replaceState(null, '', '#sonstiges/' + c[1]);
        renderOther();
        const nf = $('#entryForm');
        Object.entries(keep).forEach(([k2, v2]) => { if (nf.elements[k2] && v2 != null) nf.elements[k2].value = v2; });
        updateReceipt(nf);
        return;
      }
    }
    if (t.name === 'player' && e.type === 'change' && f.dataset.kind === 'sale' && f.elements.book && !f.elements.book.value) {
      const buy = [...state.txs].reverse().find((x) => x.type === 'purchase' && x.title.toLowerCase() === t.value.trim().toLowerCase());
      if (buy && buy.gross) {
        f.elements.book.value = fmtInputMoney(-buy.gross);
        if (buy.meta?.age && !f.elements.age.value) f.elements.age.value = buy.meta.age + 1;
        toast(`Einkaufspreis aus Kauf übernommen: ${eur(-buy.gross)}`);
      }
    }
    if (t.classList.contains('invalid')) { t.classList.remove('invalid'); const er = f.querySelector(`[data-err="${t.name}"]`); if (er) er.textContent = ''; }
    updateReceipt(f);
  }

  function readForm(f) {
    const kind = formKind(f);
    const val = (n) => f.elements[n]?.value ?? '';
    const chk = (n) => !!f.elements[n]?.checked;
    const errors = {};
    const s = S();
    if (kind === 'sale' || kind === 'purchase') {
      const v = {
        player: val('player').trim(),
        age: parseInt(val('age'), 10) || 0,
        club: val('club').trim(),
        land: val('land').trim(),
        gross: val('gross').trim() === '' ? (kind === 'purchase' ? 0 : NaN) : parseMoney(val('gross')),
        intl: chk('intl'),
        youth: chk('youth'),
        pay: f.elements.pay?.value || 'sofort',
        upPct: parseNum(val('upPct')),
        years: parseInt(val('years'), 10) || 0,
        agentPct: parseNum(val('agentPct')),
        book: val('book') ? parseMoney(val('book')) : 0,
        signing: val('signing') ? parseMoney(val('signing')) : 0,
        note: val('note').trim(),
      };
      if (!isFinite(v.agentPct)) v.agentPct = kind === 'sale' ? s.agentSellPct : s.agentBuyPct;
      if (!isFinite(v.upPct)) v.upPct = s.upfrontPct;
      if (!v.player) errors.player = 'Bitte Spielernamen eintragen.';
      if (!isFinite(v.gross) || v.gross < 0) errors.gross = 'Gültigen Betrag eingeben, z. B. 3.000.000 oder 3 Mio.';
      else if (kind === 'sale' && v.gross === 0) errors.gross = 'Verkauf ohne Ablöse muss nicht eingetragen werden.';
      if (!isFinite(v.book) || v.book < 0) errors.book = 'Ungültiger Betrag.';
      if (!isFinite(v.signing) || v.signing < 0) errors.signing = 'Ungültiger Betrag.';
      if (val('age') && (v.age < 14 || v.age > 45)) errors.age = 'Alter 14–45.';
      if (v.pay === 'raten' && (v.years < 1 || v.years > 6)) errors.years = '1–6 Saisons';
      return { kind, v, errors };
    }
    const ok = state.ui.otherKind;
    if (ok === 'in' || ok === 'out') {
      const v = {
        kind: ok,
        category: val('category').trim(),
        amount: parseMoney(val('amount')),
        note: val('note').trim(),
        parts: parseInt(val('parts'), 10) || 1,
        taxed: chk('taxed'),
      };
      if (!v.category) errors.category = 'Kategorie wählen oder eintippen.';
      if (!isFinite(v.amount) || v.amount <= 0) errors.amount = 'Betrag größer 0 eingeben.';
      if (v.parts < 1 || v.parts > 30) errors.parts = '1–30';
      return { kind: 'other', v, errors };
    }
    if (ok === 'take') {
      const v = { kind: 'take', lkind: val('lkind'), name: val('lname').trim(), amount: parseMoney(val('lamount')), rate: parseNum(val('lrate')) };
      if (!isFinite(v.rate) || v.rate < 0) v.rate = s.loanPct;
      if (!isFinite(v.amount) || v.amount <= 0) errors.lamount = 'Betrag größer 0 eingeben.';
      return { kind: 'loan', v, errors };
    }
    const v = { kind: 'repay', loanId: val('loanId'), amount: parseMoney(val('ramount')) };
    const l = openLoans().find((x) => x.id === v.loanId);
    if (!l) errors.ramount = 'Kein offener Kredit gewählt.';
    else if (!isFinite(v.amount) || v.amount <= 0) errors.ramount = 'Betrag größer 0 eingeben.';
    else if (v.amount > l.outstanding) errors.ramount = `Maximal ${eur(l.outstanding)} offen.`;
    return { kind: 'loan', v, errors };
  }

  function buildTx({ kind, v }) {
    const s = S();
    if (kind === 'sale') {
      const c = calcSale(v);
      const lines = [{ label: 'Bruttoerlös (laut FC27)', amount: c.G }];
      const taxLabel = c.book
        ? `Körperschaftsteuer (${pct(s.koestPct)} auf Gewinn ${eur(c.taxable)})`
        : s.taxAfterFees ? `Körperschaftsteuer (${pct(s.koestPct)} auf ${eur(c.taxable)})` : `Körperschaftsteuer (${pct(s.koestPct)})`;
      lines.push({ label: taxLabel, amount: -c.tax });
      if (v.intl && !v.youth) {
        lines.push({ label: `Solidaritätsbeitrag (${pct(s.solidarityPct)}, international)`, amount: -c.sol });
        lines.push({ label: c.tc ? `Ausbildungsentschädigung (Alter ${v.age})` : 'Ausbildungsentschädigung (ab 23 bzw. ohne Alter: keine)', amount: -c.tc });
      }
      lines.push({ label: `Beraterprovision (${pct(v.agentPct)})`, amount: -c.agent });
      if (c.sched.length) lines.push({ label: `Davon jetzt (Anzahlung ${pct(v.upPct)})`, amount: c.now, muted: true });
      return {
        type: 'sale', title: v.player, sub: [v.club, v.land, v.intl ? 'international' : 'national', v.youth ? 'Eigengewächs' : ''].filter(Boolean).join(' · '),
        note: v.note, gross: c.G, net: c.now, total: c.total, deferred: c.now - c.total, lines, schedule: c.sched,
        deduct: { tax: c.tax, sol: c.sol, tc: c.tc, agent: c.agent },
        meta: { age: v.age || null, club: v.club, land: v.land, intl: v.intl, youth: v.youth, book: c.book, agentPct: v.agentPct, pay: v.pay },
      };
    }
    if (kind === 'purchase') {
      const c = calcPurchase(v);
      const lines = [{ label: v.gross ? 'Ablöse (laut FC27)' : 'Ablösefrei', amount: -c.F }];
      lines.push({ label: `Beraterprovision (${pct(v.agentPct)})`, amount: -c.agent });
      if (v.intl) lines.push({ label: c.tc ? `Ausbildungsentschädigung (Alter ${v.age})` : 'Ausbildungsentschädigung (ab 23 bzw. ohne Alter: keine)', amount: -c.tc });
      if (c.signing) lines.push({ label: 'Handgeld / Signing Fee', amount: -c.signing });
      if (c.solInfo) lines.push({ label: `Solidaritätsbeitrag ${pct(s.solidarityPct)} – wird von der Ablöse einbehalten, keine Mehrkosten`, amount: c.solInfo, muted: true });
      if (c.sched.length) lines.push({ label: `Davon Ablöse jetzt (Anzahlung ${pct(v.upPct)})`, amount: c.feeNow, muted: true });
      return {
        type: 'purchase', title: v.player, sub: [v.club, v.land, v.intl ? 'international' : 'national'].filter(Boolean).join(' · '),
        note: v.note, gross: -c.F, net: c.now, total: c.total, deferred: c.now - c.total, lines, schedule: c.sched,
        deduct: { tc: c.tc, agent: c.agent, signing: c.signing },
        meta: { age: v.age || null, club: v.club, land: v.land, intl: v.intl, agentPct: v.agentPct, pay: v.pay },
      };
    }
    if (kind === 'other') {
      const c = calcOther(v);
      const lines = [{ label: v.category, amount: c.sign * v.amount }];
      if (c.tax) lines.push({ label: `Körperschaftsteuer (${pct(s.koestPct)})`, amount: -c.tax });
      if (c.sched.length) lines.push({ label: `Davon jetzt (1/${c.parts})`, amount: c.now, muted: true });
      return {
        type: v.kind === 'in' ? 'income' : 'expense', title: v.category, sub: '', note: v.note,
        gross: 0, net: c.now, total: c.total, deferred: c.now - c.total, lines, schedule: c.sched, deduct: c.tax ? { tax: c.tax } : undefined,
        category: v.category,
      };
    }
    if (v.kind === 'take') {
      const name = v.name || v.lkind;
      return {
        type: 'loan', title: name, sub: `${v.lkind} · ${pct(v.rate)} p. a.`, gross: 0, net: v.amount, total: v.amount,
        lines: [{ label: 'Auszahlung ins realistische Budget', amount: v.amount }, { label: 'Zinsen je Saisonwechsel', amount: round(v.amount * v.rate / 100), muted: true }],
        _loan: { name, kind: v.lkind, rate: v.rate, principal: v.amount },
      };
    }
    const l = openLoans().find((x) => x.id === v.loanId);
    return {
      type: 'repay', title: `Tilgung ${l?.name || ''}`.trim(), sub: l ? `danach offen: ${eur(l.outstanding - v.amount)}` : '', gross: 0,
      net: -v.amount, total: -v.amount, loanId: v.loanId,
      lines: [{ label: 'Tilgung', amount: -v.amount }, { label: 'Restschuld danach', amount: (l?.outstanding || 0) - v.amount, muted: true }],
    };
  }

  function updateReceipt(f) {
    const box = $('#receipt');
    if (!box) return;
    const r = readForm(f);
    const kind = r.kind;
    const cur = currentSeason();
    const rows = ledger();
    const budgetNow = rows[rows.length - 1].endNet;
    const kicker = { sale: 'Aufschlüsselung · Verkauf', purchase: 'Aufschlüsselung · Kauf', other: 'Aufschlüsselung', loan: 'Aufschlüsselung · Kredit' }[kind];
    const title = (kind === 'sale' || kind === 'purchase') ? (r.v.player || 'Spieler …') : kind === 'other' ? (r.v.category || 'Kategorie …') : (r.v.kind === 'take' ? 'Kredit aufnehmen' : 'Kredit tilgen');
    const blocking = Object.keys(r.errors).filter((k) => !(k === 'player' || k === 'category'));
    let body;
    if (blocking.length && !(kind === 'purchase' && r.v.gross === 0)) {
      body = `<p class="empty">${kind === 'sale' ? 'Verkaufssumme eingeben' : 'Betrag eingeben'} – hier erscheint sofort, was realistisch im Budget ankommt.</p>`;
    } else {
      const tx = buildTx(r);
      const grossAbs = Math.abs(tx.gross || tx.lines[0].amount || 0);
      let bar = '';
      if (kind === 'sale' && grossAbs > 0) {
        const d = tx.deduct;
        const segs = [[Math.max(0, tx.total), 'var(--c-net)'], [d.tax, 'var(--c-tax)'], [d.sol, 'var(--c-sol)'], [d.tc, 'var(--c-tc)'], [d.agent, 'var(--c-agent)']];
        bar = `<div class="stack-bar" aria-hidden="true">${segs.map(([v, c]) => `<i style="flex-grow:${Math.max(0, v)};background:${c}"></i>`).join('')}</div>
          <div class="small muted">${nf1.format((tx.total / grossAbs) * 100)} % der Verkaufssumme bleiben realistisch übrig</div>`;
      }
      const netLabel = kind === 'sale' ? 'Netto-Zufluss zum Budget' : kind === 'purchase' ? 'Gesamtbelastung des Budgets' : kind === 'loan' ? 'Wirkung aufs Budget' : 'Wirkung aufs Budget';
      const after = budgetNow + tx.net;
      const note = kind === 'sale' && r.v.youth
        ? 'Eigengewächs: ausgebildet bei FK Austria Wien (Akademie &amp; Young Violets) – keine Solidaritäts- oder Ausbildungsanteile an fremde Vereine.'
        : kind === 'sale' && !r.v.intl ? 'Nationaler Transfer: keine FIFA-Solidaritäts- und Ausbildungsabgaben.'
        : kind === 'sale' ? 'Internationaler Transfer: FIFA-Solidaritätsbeitrag und (unter 23) Ausbildungsentschädigung gehen an die Ausbildungsvereine.'
        : kind === 'purchase' ? 'In FC27 sinkt das Budget nur um die Ablöse. Realistisch kommen Berater, ggf. Ausbildungsentschädigung und Handgeld dazu.'
        : kind === 'loan' ? 'Kredite gibt es in FC27 nicht – sie wirken nur aufs realistische Budget. Zinsen werden beim Saisonwechsel abgezogen.'
        : 'Wirkt nur aufs realistische Budget, FC27 kennt diesen Posten nicht.';
      body = `
        ${tx.lines.map((l, i) => `<div class="r-line ${l.muted ? 'muted-line' : ''}" style="animation-delay:${i * 30}ms"><span>${esc(l.label)}</span><span class="num ${l.muted ? '' : cls(l.amount)}">${l.muted ? eur(l.amount) : eur(l.amount, true)}</span></div>`).join('')}
        <div class="r-line total"><span>= ${netLabel}</span><span class="num ${cls(tx.total)}">${eur(tx.total, true)}</span></div>
        ${bar}
        ${tx.schedule?.length ? `<div class="r-sched"><div><b>Jetzt wirksam</b><b class="num ${cls(tx.net)}">${eur(tx.net, true)}</b></div>${tx.schedule.map((x, i) => `<div><span>${esc(nextSeasonLabel(cur.label, x.offset))} · Rate ${i + 2}</span><span class="num ${cls(x.amount)}">${eur(x.amount, true)}</span></div>`).join('')}</div>` : ''}
        <div class="sum-box" style="margin-top:14px">
          ${tx.gross ? `<div class="r-line"><span>FC27 bucht</span><span class="num">${eur(tx.gross, true)}</span></div>` : ''}
          <div class="r-line"><span>Realistisches Budget danach</span><span class="num ${cls(after)}"><b>${eur(after)}</b></span></div>
          ${openEventsSum(cur) ? `<div class="r-line"><span>… nach allen offenen Events</span><span class="num ${cls(after + openEventsSum(cur))}">${eur(after + openEventsSum(cur))}</span></div>` : ''}
        </div>
        ${kind === 'purchase' && after < 0 ? `<div class="alert bad" style="margin-top:12px">${icon('warn')}<div>Dieser Kauf bringt dein realistisches Budget ins Minus.</div></div>` : ''}
        <div class="r-note">${note}</div>`;
    }
    box.innerHTML = `<div class="receipt-top"><div class="tile-kicker">${kicker}</div><h3>${esc(title)}</h3></div><div class="receipt-body">${body}</div>`;
  }

  function submitEntry(f) {
    const r = readForm(f);
    $$('.err', f).forEach((x) => { x.textContent = ''; });
    $$('.invalid', f).forEach((x) => x.classList.remove('invalid'));
    const keys = Object.keys(r.errors);
    if (keys.length) {
      keys.forEach((k) => {
        const inp = f.elements[k];
        const er = f.querySelector(`[data-err="${k}"]`);
        if (er) er.textContent = r.errors[k];
        if (inp && inp.classList) inp.classList.add('invalid');
        if (inp && inp.closest && inp.closest('details')) inp.closest('details').open = true;
      });
      const firstBad = f.elements[keys[0]];
      firstBad?.focus?.();
      if (!f.querySelector(`[data-err="${keys[0]}"]`)) toast(r.errors[keys[0]]);
      return;
    }
    snapshot();
    const tx = buildTx(r);
    const cur = currentSeason();
    const rec = { id: uid(), seasonId: cur.id, ts: Date.now(), ...tx };
    if (tx._loan) {
      const loan = { id: uid(), ...tx._loan, seasonId: cur.id, ts: Date.now() };
      state.loans.push(loan);
      rec.loanId = loan.id;
      delete rec._loan;
    }
    state.txs.push(rec);
    save();
    toast(`${TYPE_LABEL[rec.type]} bestätigt: ${rec.title} (${eur(rec.net, true)})`, { label: 'Rückgängig', fn: undo });
    renderView(currentView);
  }

  // ---------------------------------------------------------------------------
  // Neue Saison – Assistent
  // ---------------------------------------------------------------------------
  let wiz = null;
  function initWizard() {
    const rows = ledger();
    const first = !rows.length;
    const prev = rows[rows.length - 1];
    wiz = {
      first,
      step: first ? 2 : 1,
      label: first ? '2026/27' : nextSeasonLabel(prev.s.label),
      budget: first ? '' : fmtInputMoney(prev.s.grossBudget),
      opening: '',
      seed: uid(),
      events: null,
      eventsFor: '',
    };
  }
  const wizSteps = () => (wiz.first ? [[2, 'Budget'], [3, 'Events'], [4, 'Bestätigen']] : [[1, 'Rückblick'], [2, 'Neues Budget'], [3, 'Events'], [4, 'Bestätigen']]);

  function wizEnsureEvents() {
    const b = parseMoney(wiz.budget);
    const key = `${wiz.seed}|${b}|${wiz.label}|${S().eventLevel}|${S().eventIncome}`;
    if (wiz.eventsFor !== key) {
      wiz.events = generateEvents(isFinite(b) ? b : 0, wiz.label, wiz.seed);
      wiz.eventsFor = key;
    }
    return wiz.events;
  }

  function wizardCalc() {
    const rows = ledger();
    const prev = rows[rows.length - 1];
    const newIdx = rows.length;
    const openPrev = wiz.first ? [] : seasonEvents(prev.s).filter((e) => e.status !== 'done');
    const openPrevSum = openPrev.reduce((a, e) => a + e.amount, 0);
    const interest = wiz.first ? [] : closingInterest(prev ? { ...prev, endNet: prev.endNet + openPrevSum } : prev);
    const interestSum = interest.reduce((a, i) => a + i.amount, 0);
    const endBefore = wiz.first ? 0 : prev.endNet;
    const restAfter = endBefore + openPrevSum + interestSum;
    const opening = parseMoney(wiz.opening);
    const carryNet = wiz.first ? (isFinite(opening) ? opening : 0) : carry(restAfter);
    const rates = wiz.first ? [] : dueRates(newIdx);
    const ratesSum = rates.reduce((a, r) => a + r.net, 0);
    const budget = parseMoney(wiz.budget);
    const b = isFinite(budget) ? budget : 0;
    const events = wiz.step >= 3 ? wizEnsureEvents() : [];
    const startEvents = events.filter((e) => e.start);
    const startSum = startEvents.reduce((a, e) => a + e.amount, 0);
    const laterSum = events.filter((e) => !e.start).reduce((a, e) => a + e.amount, 0);
    const start = carryNet + b + ratesSum + startSum;
    return { rows, prev, openPrev, openPrevSum, interest, interestSum, endBefore, restAfter, carryNet, rates, ratesSum, budget, events, startEvents, startSum, laterSum, start };
  }

  function eventListHtml(events, { checkable = false, gameDate = '' } = {}) {
    if (!events.length) return '<p class="empty">Keine Events.</p>';
    let html = '';
    let month = '';
    for (const ev of events) {
      const m = ev.date.slice(0, 7);
      if (m !== month) {
        month = m;
        const [yy, mm] = m.split('-');
        html += `<li class="ev-month">${MONTHS[Number(mm) - 1]} ${yy}</li>`;
      }
      const due = checkable && gameDate && ev.status !== 'done' && ev.date <= gameDate;
      html += `
        <li class="ev ${ev.status === 'done' ? 'done' : ''} ${due ? 'due' : ''} ${ev.amount > 0 ? 'plus' : ''}">
          ${checkable
            ? `<label class="ev-check" title="${ev.status === 'done' ? 'Wieder öffnen' : 'Abhaken und abziehen'}"><input type="checkbox" data-event="${ev.id}" ${ev.status === 'done' ? 'checked' : ''} aria-label="${esc(ev.title)} am ${fmtDay(ev.date)} ${ev.amount < 0 ? 'abziehen' : 'gutschreiben'}"><span>${icon('check')}</span></label>`
            : `<span class="ev-dot" aria-hidden="true"></span>`}
          <span class="ev-date">${fmtDayShort(ev.date)}${ev.start ? '<small>Saisonstart</small>' : ''}</span>
          <span class="ev-body"><b>${esc(ev.title)}</b><small>${esc(ev.desc)}</small></span>
          <span class="ev-cat">${esc(ev.cat)}${due ? '<em>fällig</em>' : ''}</span>
          <span class="num ev-amt ${cls(ev.amount)}">${eur(ev.amount, true)}</span>
        </li>`;
    }
    return `<ul class="ev-list">${html}</ul>`;
  }

  function renderWizard() {
    const el = $('#view-saison');
    if (!wiz) initWizard();
    const c = wizardCalc();
    const steps = wizSteps();
    const pos = steps.findIndex(([n]) => n === wiz.step);
    let panel = '';

    if (wiz.step === 1) {
      const p = c.prev;
      const sales = p.txs.filter((t) => t.type === 'sale'), buys = p.txs.filter((t) => t.type === 'purchase');
      const evDone = seasonEvents(p.s).filter((e) => e.status === 'done');
      panel = `
        <div class="eyebrow">Schritt 1 · Rückblick</div>
        <h2 style="margin:8px 0 14px">Saison ${esc(p.s.label)} abschließen</h2>
        <div class="small muted">Endstand realistisches Budget</div>
        <div class="wiz-big ${cls(p.endNet)}">${eur(p.endNet)}</div>
        <dl class="wiz-grid">
          <div><dt>FC27 zugeteilt</dt><dd>${eur(p.s.grossBudget)}</dd></div>
          <div><dt>Ingame-Endstand</dt><dd>${eur(p.endGross)}</dd></div>
          <div><dt>Differenz</dt><dd class="${cls(p.endNet - p.endGross)}">${eur(p.endNet - p.endGross, true)}</dd></div>
          <div><dt>Verkäufe</dt><dd>${sales.length} · ${eur(sales.reduce((a, t) => a + t.gross, 0))}</dd></div>
          <div><dt>Käufe</dt><dd>${buys.length} · ${eur(-buys.reduce((a, t) => a + t.gross, 0))}</dd></div>
          <div><dt>Events abgezogen</dt><dd class="${cls(evDone.reduce((a, e) => a + e.amount, 0))}">${evDone.length} · ${eur(evDone.reduce((a, e) => a + e.amount, 0), true)}</dd></div>
        </dl>
        ${c.openPrev.length ? `<div class="alert warn" style="margin-top:16px">${icon('warn')}<div><b>${c.openPrev.length} Event(s) noch nicht abgehakt</b> (${eur(c.openPrevSum, true)}). Sie werden beim Saisonabschluss automatisch gebucht.</div></div>
          <div class="tile" style="margin-top:10px;transform:none;box-shadow:none">${eventListHtml(c.openPrev)}</div>` : ''}
        ${c.interest.length ? `<div class="sum-box">${c.interest.map((i) => `<div class="r-line"><span>${esc(i.label)}</span><span class="num neg">${eur(i.amount, true)}</span></div>`).join('')}</div>` : ''}`;
    } else if (wiz.step === 2) {
      panel = `
        <div class="eyebrow">Schritt ${pos + 1} · Neues FC27-Budget</div>
        <h2 style="margin:8px 0 14px">${wiz.first ? 'Erste Saison anlegen' : 'Was teilt dir FC27 zu?'}</h2>
        <form id="wizBudget" class="form-grid" novalidate>
          ${field('wlabel', 'Saison', { value: wiz.label, w: 'w2', attrs: 'autocomplete="off"' })}
          ${field('wbudget', 'Transferbudget laut FC27 *', { value: wiz.budget, w: 'w4', money: true, suffix: '€', hint: 'Steht im Spiel unter Finanzen / Transferbudget.' })}
          ${wiz.first ? field('wopening', 'Startsaldo (optional)', { value: wiz.opening, w: 'w6', money: true, suffix: '€', hint: 'Nur falls du mitten in der Karriere startest, z. B. −2.000.000 als Altlast. Leer = 0.' }) : ''}
          <button type="submit" hidden tabindex="-1" aria-hidden="true"></button>
        </form>
        ${c.rates.length ? `<div class="sum-box"><div class="small muted" style="margin-bottom:4px">Fällige Raten in der neuen Saison</div>${c.rates.map((r) => `<div class="r-line"><span>${esc(r.title)}</span><span class="num ${cls(r.net)}">${eur(r.net, true)}</span></div>`).join('')}</div>` : ''}`;
    } else if (wiz.step === 3) {
      const costs = c.events.filter((e) => e.amount < 0), incomes = c.events.filter((e) => e.amount > 0);
      const b = isFinite(c.budget) && c.budget > 0 ? c.budget : 0;
      panel = `
        <div class="eyebrow">Schritt ${pos + 1} · Event-Plan</div>
        <h2 style="margin:8px 0 6px">Was dich in ${esc(wiz.label)} erwartet</h2>
        <p class="small muted" style="margin:0 0 12px">Ausgewürfelt passend zu deinem Budget. Events am 01.07. werden beim Start sofort abgezogen, der Rest kommt über die Saison – du hakst sie ab, wenn du im Spiel beim Datum bist.</p>
        <dl class="wiz-grid">
          <div><dt>Kosten-Events</dt><dd class="neg">${costs.length} · ${eur(costs.reduce((a, e) => a + e.amount, 0))}</dd></div>
          <div><dt>Einnahmen-Events</dt><dd class="pos">${incomes.length} · ${eur(incomes.reduce((a, e) => a + e.amount, 0), true)}</dd></div>
          <div><dt>Anteil am Budget</dt><dd>${b ? nf1.format((-costs.reduce((a, e) => a + e.amount, 0) / b) * 100) + ' %' : '–'}</dd></div>
        </dl>
        <div style="margin-top:14px">${eventListHtml(c.events)}</div>
        <button type="button" class="btn small" data-action="wiz-reroll" style="margin-top:12px">${icon('auto')}Anders würfeln</button>`;
    } else {
      panel = `
        <div class="eyebrow">Schritt ${pos + 1} · Bestätigen</div>
        <h2 style="margin:8px 0 14px">Saison ${esc(wiz.label)} starten</h2>
        <div class="sum-box">
          ${wiz.first ? `<div class="r-line"><span>Startsaldo</span><span class="num ${cls(c.carryNet)}">${eur(c.carryNet, true)}</span></div>` : `
            <div class="r-line"><span>Endstand ${esc(c.prev.s.label)}</span><span class="num ${cls(c.endBefore)}">${eur(c.endBefore)}</span></div>
            ${c.openPrev.length ? `<div class="r-line"><span>Offene Events ${esc(c.prev.s.label)} (${c.openPrev.length})</span><span class="num ${cls(c.openPrevSum)}">${eur(c.openPrevSum, true)}</span></div>` : ''}
            ${c.interest.map((i) => `<div class="r-line"><span>${esc(i.label)}</span><span class="num neg">${eur(i.amount, true)}</span></div>`).join('')}
            <div class="r-line"><span><b>Restbudget Vorsaison</b></span><span class="num ${cls(c.restAfter)}"><b>${eur(c.restAfter)}</b></span></div>
            ${c.carryNet !== c.restAfter ? `<div class="r-line muted-line"><span>Übertrag laut Einstellung</span><span class="num">${eur(c.carryNet)}</span></div>` : ''}`}
          <div class="r-line"><span>+ Neues Transferbudget FC27</span><span class="num">${eur(isFinite(c.budget) ? c.budget : 0, true)}</span></div>
          ${c.rates.length ? `<div class="r-line"><span>Fällige Raten</span><span class="num ${cls(c.ratesSum)}">${eur(c.ratesSum, true)}</span></div>` : ''}
          <div class="r-line"><span>Events zum Saisonstart (${c.startEvents.length})</span><span class="num ${cls(c.startSum)}">${eur(c.startSum, true)}</span></div>
          <div class="r-line total"><span>= Start-Budget realistisch</span><span class="num ${cls(c.start)}">${eur(c.start)}</span></div>
          <div class="r-line muted-line"><span>Noch geplant über die Saison</span><span class="num">${eur(c.laterSum, true)}</span></div>
        </div>
        <p class="small muted" style="margin-top:12px">${wiz.first ? '' : `Saison ${esc(c.prev.s.label)} wird archiviert und bleibt im Protokoll einsehbar. `}Ingame startest du mit ${eur(isFinite(c.budget) ? c.budget : 0)} – so wie FC27 es anzeigt.</p>`;
    }

    const isLast = wiz.step === 4;
    el.innerHTML = `
      <div class="view-head"><div><div class="eyebrow">Assistent</div><h1>${wiz.first ? 'Erste Saison' : 'Neue Saison starten'}</h1></div></div>
      <ol class="wiz-steps" style="--n:${steps.length}">
        ${steps.map(([, l], i) => `<li class="wiz-step ${i < pos ? 'done' : i === pos ? 'active' : ''}" ${i === pos ? 'aria-current="step"' : ''}><b>${i < pos ? '✓' : i + 1}</b><span>${l}</span></li>`).join('')}
      </ol>
      <article class="tile span-12 wiz-panel" style="transform:none">
        ${panel}
        <div class="wiz-nav">
          ${pos > 0 ? `<button type="button" class="btn" data-action="wiz-back">${icon('back')}Zurück</button>` : `<button type="button" class="btn ghost" data-nav="dashboard">Abbrechen</button>`}
          ${isLast ? `<button type="button" class="btn primary big" data-action="wiz-confirm">${icon('check')}Bestätigen &amp; Saison starten</button>` : `<button type="button" class="btn primary big" data-action="wiz-next">Weiter ${icon('arrow')}</button>`}
        </div>
      </article>`;

    if (wiz.step === 2) {
      const f = $('#wizBudget');
      f.addEventListener('input', () => { wiz.label = f.elements.wlabel.value; wiz.budget = f.elements.wbudget.value; if (f.elements.wopening) wiz.opening = f.elements.wopening.value; });
      f.addEventListener('submit', (e) => { e.preventDefault(); wizNext(); });
      if (matchMedia('(pointer:fine)').matches) { f.elements.wbudget.focus(); f.elements.wbudget.select(); }
    }
  }

  function wizNext() {
    if (wiz.step === 2) {
      const f = $('#wizBudget');
      const b = parseMoney(f.elements.wbudget.value);
      const label = f.elements.wlabel.value.trim();
      let bad = false;
      const setErr = (n, m) => { f.querySelector(`[data-err="${n}"]`).textContent = m; f.elements[n].classList.add('invalid'); bad = true; };
      if (!label) setErr('wlabel', 'Bezeichnung fehlt.');
      else if (state.seasons.some((s) => s.label === label)) setErr('wlabel', 'Gibt es schon.');
      if (!isFinite(b) || b < 0) setErr('wbudget', 'Budget eingeben, z. B. 7 Mio.');
      if (wiz.first && f.elements.wopening.value && !isFinite(parseMoney(f.elements.wopening.value))) setErr('wopening', 'Ungültiger Betrag.');
      if (bad) return;
      wiz.label = label;
      wiz.budget = f.elements.wbudget.value;
    }
    wiz.step = Math.min(4, wiz.step + 1);
    renderWizard();
    window.scrollTo({ top: 0 });
  }

  function wizConfirm() {
    const c = wizardCalc();
    if (!isFinite(c.budget) || c.budget < 0) { wiz.step = 2; renderWizard(); return; }
    snapshot();
    const now = Date.now();
    const newSeason = {
      id: uid(), label: wiz.label.trim(), grossBudget: round(c.budget), opening: wiz.first ? round(c.carryNet) : 0, ts: now,
      events: wizEnsureEvents().map((e) => ({ ...e })), gameDate: isoDate(seasonDate('07-01', seasonStartYear(wiz.label))),
    };
    let ts = now;
    if (!wiz.first) {
      const prevS = c.prev.s;
      for (const ev of c.openPrev) setEventDone(prevS, ev, true, { auto: true, ts: ts++, nextSeasonId: newSeason.id });
      state.txs.push({
        id: uid(), seasonId: prevS.id, ts: ts++, type: 'close', title: `Saisonabschluss ${prevS.label}`,
        sub: `weiter mit ${newSeason.label}`, gross: 0,
        net: c.interestSum, total: c.interestSum, opsNet: 0, interestNet: c.interestSum,
        lines: [
          ...(c.openPrev.length ? [{ label: `${c.openPrev.length} offene Event(s) automatisch gebucht`, amount: c.openPrevSum, muted: true }] : []),
          ...c.interest.map((i) => ({ label: i.label, amount: i.amount })),
          { label: `Neues FC27-Budget ${newSeason.label}`, amount: newSeason.grossBudget, muted: true },
        ],
        nextSeasonId: newSeason.id,
      });
    }
    const newIdx = state.seasons.length;
    state.seasons.push(newSeason);
    for (const r of dueRates(newIdx)) {
      state.txs.push({ id: uid(), seasonId: newSeason.id, ts: ts++, auto: true, gross: 0, total: r.net, lines: [{ label: r.title, amount: r.net }], ...r });
    }
    for (const ev of newSeason.events.filter((e) => e.start)) setEventDone(newSeason, ev, true, { auto: true, ts: ts++ });
    save();
    wiz = null;
    toast(`Saison ${newSeason.label} gestartet – ${newSeason.events.filter((e) => !e.start).length} Events über die Saison geplant.`, { label: 'Rückgängig', fn: undo });
    go('events');
  }

  // ---------------------------------------------------------------------------
  // Events der laufenden Saison
  // ---------------------------------------------------------------------------
  function renderEvents() {
    const el = $('#view-events');
    if (!state.seasons.length) { needSeason(el, 'Events'); return; }
    const s = currentSeason();
    const evs = seasonEvents(s);
    if (!evs.length) {
      el.innerHTML = `
        <div class="view-head"><div><div class="eyebrow">Saison ${esc(s.label)}</div><h1>Events</h1></div></div>
        <div class="alert info">${icon('calendar')}<div>Für diese Saison gibt es noch keinen Event-Plan. Er wird aus deinem FC27-Budget von <b>${eur(s.grossBudget)}</b> ausgewürfelt.</div><button type="button" class="btn small primary" data-action="events-create">Event-Plan erstellen</button></div>`;
      return;
    }
    const done = evs.filter((e) => e.status === 'done');
    const open = evs.filter((e) => e.status !== 'done');
    const rows = ledger();
    const row = rows[rows.length - 1];
    const gd = s.gameDate || '';
    const dueCount = gd ? open.filter((e) => e.date <= gd).length : 0;
    const y = seasonStartYear(s.label);
    el.innerHTML = `
      <div class="view-head">
        <div><div class="eyebrow">Saison ${esc(s.label)} · Vereinskalender</div><h1>Events</h1></div>
      </div>
      <p class="page-intro">Kommst du im Spiel an einem Datum vorbei, hak das Event ab – der Betrag wird sofort vom realistischen Budget abgezogen (oder gutgeschrieben). Versehentlich abgehakt? Einfach wieder aufmachen.</p>
      <div class="bento">
        <article class="tile span-8" style="transform:none">
          <div class="tile-head"><h2>Spieldatum</h2><span class="tile-kicker">wo bist du gerade in FC27?</span></div>
          <form class="gd-form" id="gameDateForm">
            <label class="field" style="grid-column:auto"><span>Datum im Spiel</span>
              <input class="input" type="date" name="gd" value="${esc(gd)}" min="${y}-07-01" max="${y + 1}-06-30"></label>
            <button type="submit" class="btn primary">${icon('check')}Alles bis dahin abhaken${dueCount ? ` (${dueCount})` : ''}</button>
          </form>
          <p class="small muted" style="margin-top:8px">Das Datum speichert sich. Offene Events bis dahin werden als <b>fällig</b> markiert.</p>
        </article>
        <article class="tile" style="transform:none">
          <div class="tile-head"><h2>Stand</h2><span class="tile-kicker">${done.length}/${evs.length} erledigt</span></div>
          <ul class="stat-list">
            <li><span>Bereits abgezogen</span><span class="num ${cls(done.reduce((a, e) => a + e.amount, 0))}">${eur(done.reduce((a, e) => a + e.amount, 0), true)}</span></li>
            <li><span>Noch offen</span><span class="num ${cls(openEventsSum(s))}">${eur(openEventsSum(s), true)}</span></li>
            <li><span>Budget nach allen Events</span><span class="num ${cls(row.endNet + openEventsSum(s))}"><b>${eur(row.endNet + openEventsSum(s))}</b></span></li>
          </ul>
        </article>
      </div>
      <article class="tile span-12" style="margin-top:16px;transform:none">
        ${eventListHtml(evs, { checkable: true, gameDate: gd })}
      </article>`;
    const f = $('#gameDateForm');
    f.addEventListener('change', (e) => { if (e.target.name === 'gd') { s.gameDate = e.target.value; save({ silent: true }); renderEvents(); } });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = f.elements.gd.value;
      if (!d) { toast('Bitte zuerst ein Spieldatum wählen.'); return; }
      s.gameDate = d;
      const due = seasonEvents(s).filter((ev) => ev.status !== 'done' && ev.date <= d);
      if (!due.length) { save({ silent: true }); toast('Bis zu diesem Datum ist alles erledigt.'); renderEvents(); return; }
      snapshot();
      let ts = Date.now();
      due.forEach((ev) => setEventDone(s, ev, true, { ts: ts++ }));
      save();
      renderEvents();
      toast(`${due.length} Event(s) bis ${fmtDay(d)} gebucht (${eur(due.reduce((a, ev) => a + ev.amount, 0), true)}).`, { label: 'Rückgängig', fn: undo });
    });
  }

  function onEventToggle(e) {
    const t = e.target;
    if (!t.matches?.('input[data-event]')) return;
    const s = currentSeason();
    const ev = seasonEvents(s).find((x) => x.id === t.dataset.event);
    if (!ev) return;
    snapshot();
    setEventDone(s, ev, t.checked);
    if (t.checked && (!s.gameDate || s.gameDate < ev.date)) s.gameDate = ev.date;
    save();
    toast(t.checked ? `${ev.title}: ${eur(ev.amount, true)} gebucht.` : `${ev.title} wieder offen.`, { label: 'Rückgängig', fn: undo });
    renderView(currentView);
  }

  // ---------------------------------------------------------------------------
  // Protokoll
  // ---------------------------------------------------------------------------
  const logFilter = { season: 'all', type: 'all', q: '' };
  function renderLog() {
    const el = $('#view-protokoll');
    const rows = ledger();
    const desc = state.ui.sortDesc;
    el.innerHTML = `
      <div class="view-head">
        <div><div class="eyebrow">Historie</div><h1>Protokoll</h1></div>
        <div class="data-actions">
          <button type="button" class="btn small" data-action="export-csv">${icon('download')}CSV</button>
          <button type="button" class="btn small" data-action="export-json">${icon('download')}JSON</button>
        </div>
      </div>
      ${rows.length ? `
      <details class="tile span-12" style="margin-bottom:18px;transform:none" ${state.ui.seasonTableOpen ? 'open' : ''} id="seasonTable">
        <summary style="cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center"><h2>Saisonübersicht</h2><span class="tile-kicker">${rows.length} Saison(s) · aufklappen</span></summary>
        <div class="chart-wrap" id="seasonBars" style="margin-top:14px"></div>
        <div class="table-wrap" style="margin-top:14px">
          <table class="data">
            <thead><tr><th>Saison</th><th>FC27 zugeteilt</th><th>Übertrag</th><th>Einnahmen</th><th>Ausgaben</th><th>Abgaben</th><th>Ende Ingame</th><th>Ende realistisch</th><th>Differenz</th><th></th></tr></thead>
            <tbody>
              ${rows.map((r, i) => `
                <tr class="${i === rows.length - 1 ? 'current' : ''}">
                  <td>${esc(r.s.label)}</td>
                  <td>${eur(r.s.grossBudget)}</td>
                  <td class="${cls(r.carryNet)}">${eur(r.carryNet)}</td>
                  <td class="pos">${eur(r.inc)}</td>
                  <td class="neg">${eur(-r.exp)}</td>
                  <td class="neg">${eur(-r.ded)}</td>
                  <td>${eur(r.endGross)}</td>
                  <td class="${cls(r.endNet)}"><b>${eur(r.endNet)}</b></td>
                  <td class="${cls(r.endNet - r.endGross)}">${eur(r.endNet - r.endGross, true)}</td>
                  <td style="white-space:nowrap">
                    <button type="button" class="btn small ghost" data-action="edit-season" data-id="${r.s.id}" aria-label="Saison ${esc(r.s.label)} bearbeiten">${icon('edit')}</button>
                    ${i === rows.length - 1 ? `<button type="button" class="btn small ghost danger" data-action="delete-season" data-id="${r.s.id}" aria-label="Saison ${esc(r.s.label)} löschen">${icon('trash')}</button>` : ''}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </details>` : ''}
      <div class="filters">
        <label class="field" style="grid-column:auto"><span>Saison</span>
          <select class="input" id="fSeason"><option value="all">Alle Saisons</option>${state.seasons.map((s) => `<option value="${s.id}" ${logFilter.season === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select></label>
        <label class="field" style="grid-column:auto"><span>Typ</span>
          <select class="input" id="fType"><option value="all">Alle Typen</option>${FILTER_TYPES.map((k) => `<option value="${k}" ${logFilter.type === k ? 'selected' : ''}>${TYPE_LABEL[k]}</option>`).join('')}</select></label>
        <label class="field" style="grid-column:auto"><span>Suche (Spieler, Verein …)</span>
          <input class="input" id="fQ" type="search" placeholder="z. B. Spielername" value="${esc(logFilter.q)}"></label>
        <button type="button" class="btn" data-action="sort-toggle" aria-label="Sortierung umkehren">${desc ? 'Neueste zuerst' : 'Älteste zuerst'}</button>
      </div>
      <div id="logList"></div>`;
    const renderList = () => {
      const q = logFilter.q.trim().toLowerCase();
      const list = $('#logList');
      let html = '';
      const seasonRows = desc ? [...rows].reverse() : rows;
      for (const r of seasonRows) {
        if (logFilter.season !== 'all' && r.s.id !== logFilter.season) continue;
        let txs = r.txs.filter((t) => (logFilter.type === 'all' || t.type === logFilter.type || (logFilter.type === 'close' && t.type === 'fixed'))
          && (!q || [t.title, t.sub, t.note, t.category].filter(Boolean).join(' ').toLowerCase().includes(q)));
        if (desc) txs = [...txs].reverse();
        if (!txs.length && (q || logFilter.type !== 'all')) continue;
        html += `
          <section class="season-block">
            <header class="season-head">
              <h2>Saison ${esc(r.s.label)}${r.closed ? ' <span class="badge">archiviert</span>' : ''}</h2>
              <div class="meta">
                <span>FC27 zugeteilt <b>${eur(r.s.grossBudget)}</b></span>
                <span>Übertrag <b>${eur(r.carryNet, true)}</b></span>
                <span>Start realistisch <b>${eur(r.startNet)}</b></span>
                <span>${r.closed ? 'Ende' : 'Aktuell'} realistisch <b class="${cls(r.endNet)}">${eur(r.endNet)}</b></span>
                <span>Ingame <b>${eur(r.endGross)}</b></span>
              </div>
            </header>
            ${txs.length ? `<ul class="tx-list">${txs.map((t) => txRow(t)).join('')}</ul>` : '<p class="empty">Keine Einträge.</p>'}
          </section>`;
      }
      list.innerHTML = html || `<p class="empty">${state.seasons.length ? 'Keine Einträge für diesen Filter.' : 'Noch keine Saison angelegt.'}</p>`;
    };
    renderList();
    $('#fSeason').addEventListener('change', (e) => { logFilter.season = e.target.value; renderList(); });
    $('#fType').addEventListener('change', (e) => { logFilter.type = e.target.value; renderList(); });
    $('#fQ').addEventListener('input', (e) => { logFilter.q = e.target.value; renderList(); });
    const st = $('#seasonTable');
    if (st) {
      const draw = () => { if (st.open) renderSeasonBars($('#seasonBars'), rows); };
      st.addEventListener('toggle', () => { state.ui.seasonTableOpen = st.open; save({ silent: true }); draw(); });
      draw();
    }
  }

  async function deleteTx(id) {
    const t = state.txs.find((x) => x.id === id);
    if (!t) return;
    const children = state.txs.filter((x) => x.parentId === id);
    const loanRelated = t.type === 'loan' ? state.txs.filter((x) => x.loanId === t.loanId && x.id !== id) : [];
    let text = `„${esc(t.title)}“ (${eur(t.net, true)}) wirklich löschen?`;
    if (t.type === 'close') text += ' Die Zinsen dieses Saisonwechsels werden damit zurückgenommen.';
    if (t.type === 'event') text += ' Das Event wird im Kalender wieder als offen markiert.';
    if (children.length) text += ` Die ${children.length} bereits gebuchte(n) Rate(n) werden mitgelöscht.`;
    if (loanRelated.length) text += ` Zugehörige Tilgungen (${loanRelated.length}) werden mitgelöscht.`;
    if (t.schedule?.length) text += ' Künftige Raten entfallen.';
    const ok = await confirmDialog({ title: 'Eintrag löschen', text, ok: 'Löschen', danger: true });
    if (!ok) return;
    snapshot();
    const remove = new Set([id, ...children.map((x) => x.id), ...loanRelated.map((x) => x.id)]);
    state.txs = state.txs.filter((x) => !remove.has(x.id));
    if (t.type === 'loan') state.loans = state.loans.filter((l) => l.id !== t.loanId);
    save();
    renderAll();
    toast('Eintrag gelöscht.', { label: 'Rückgängig', fn: undo });
  }

  function openEditSeason(id) {
    const s = state.seasons.find((x) => x.id === id);
    if (!s) return;
    const isFirst = state.seasons[0].id === id;
    openDialog({
      title: `Saison ${s.label} bearbeiten`,
      body: `<form id="editSeason" class="form-grid" novalidate>
        ${field('elabel', 'Saison', { value: s.label, w: 'w2' })}
        ${field('ebudget', 'Transferbudget laut FC27', { value: fmtInputMoney(s.grossBudget), money: true, suffix: '€', w: 'w4', hint: 'Falls der Vorstand das Budget während der Saison anpasst.' })}
        ${isFirst ? field('eopening', 'Startsaldo', { value: fmtInputMoney(s.opening || 0), money: true, suffix: '€', w: 'w6' }) : ''}
      </form>`,
      foot: `<button type="button" class="btn" data-c>Abbrechen</button><button type="submit" form="editSeason" class="btn primary">Speichern</button>`,
      onMount(d) {
        d.querySelector('[data-c]').addEventListener('click', () => d.close());
        const f = d.querySelector('#editSeason');
        f.addEventListener('submit', (e) => {
          e.preventDefault();
          const b = parseMoney(f.elements.ebudget.value);
          const o = isFirst ? parseMoney(f.elements.eopening.value || '0') : 0;
          if (!f.elements.elabel.value.trim() || !isFinite(b) || b < 0 || !isFinite(o)) { toast('Bitte gültige Werte eingeben.'); return; }
          snapshot();
          s.label = f.elements.elabel.value.trim();
          s.grossBudget = b;
          if (isFirst) s.opening = o;
          save();
          d.close();
          renderAll();
          toast('Saison aktualisiert.', { label: 'Rückgängig', fn: undo });
        });
      },
    });
  }

  async function deleteSeason(id) {
    const s = state.seasons.find((x) => x.id === id);
    if (!s || state.seasons[state.seasons.length - 1].id !== id) return;
    const n = state.txs.filter((t) => t.seasonId === id).length;
    const ok = await confirmDialog({ title: 'Saison löschen', text: `Saison <b>${esc(s.label)}</b> mit ${n} Eintrag/Einträgen löschen? Der Saisonwechsel davor wird zurückgenommen, die Vorsaison ist wieder aktiv.`, ok: 'Saison löschen', danger: true });
    if (!ok) return;
    snapshot();
    const loanIds = new Set(state.loans.filter((l) => l.seasonId === id).map((l) => l.id));
    state.seasons = state.seasons.filter((x) => x.id !== id);
    state.txs = state.txs.filter((t) => t.seasonId !== id && t.nextSeasonId !== id && !(t.loanId && loanIds.has(t.loanId)));
    state.loans = state.loans.filter((l) => !loanIds.has(l.id));
    save();
    renderAll();
    toast(`Saison ${s.label} gelöscht.`, { label: 'Rückgängig', fn: undo });
  }

  // ---------------------------------------------------------------------------
  // Einstellungen
  // ---------------------------------------------------------------------------
  function renderSettings() {
    const el = $('#view-einstellungen');
    const s = S();
    const row = (key, label, hint, suffix = '%') => `
      <div class="set-row"><label for="s-${key}">${label}${hint ? `<small>${hint}</small>` : ''}</label>
        <div class="input-affix"><input class="input" id="s-${key}" data-setting="${key}" inputmode="decimal" value="${fmtInputNum(s[key])}"><em>${suffix}</em></div></div>`;
    const backupState = !Backup.supported
      ? '<p class="small muted">Dein Browser unterstützt keine Auto-Backup-Datei (nur Chrome/Edge). Nutze den JSON-Export.</p>'
      : Backup.handle
        ? `<p class="small">Verbunden mit <b>${esc(Backup.handle.name)}</b> – ${Backup.perm === 'granted' ? `<span class="pos">aktiv, jede Änderung wird mitgeschrieben${Backup.last ? ' (zuletzt ' + timeFmt.format(Backup.last) + ')' : ''}</span>` : '<span class="neg">nach Neustart Freigabe nötig</span>'}.</p>`
        : '<p class="small muted">Noch keine Backup-Datei verbunden.</p>';
    el.innerHTML = `
      <div class="view-head"><div><div class="eyebrow">Hausregeln</div><h1>Einstellungen</h1></div></div>
      <div class="settings-grid">
        <article class="tile reveal" style="--i:0">
          <div class="tile-head"><h2>Steuern &amp; FIFA</h2></div>
          ${row('koestPct', 'Körperschaftsteuer', 'Österreich seit 2024: 23 %')}
          <div class="set-row"><label>KöSt-Basis<small>Aus: auf Erlös bzw. Erlös − Einkaufspreis. Ein: zusätzlich nach Abzug von Berater &amp; FIFA-Abgaben.</small></label>
            <label class="toggle" style="justify-self:end"><input type="checkbox" data-setting-bool="taxAfterFees" ${s.taxAfterFees ? 'checked' : ''}><span class="sw"></span><span class="t">Nach Abgaben</span></label></div>
          ${row('solidarityPct', 'Solidaritätsbeitrag', 'FIFA: 5 % bei internationalen Transfers')}
          ${row('agentSellPct', 'Beraterprovision Verkauf', 'Vorbelegung, pro Transfer änderbar')}
          ${row('agentBuyPct', 'Beraterprovision Kauf', 'Vorbelegung, pro Transfer änderbar')}
        </article>
        <article class="tile reveal" style="--i:1">
          <div class="tile-head"><h2>Schulden &amp; Raten</h2></div>
          ${row('loanPct', 'Kreditzins (Vorbelegung)', 'p. a., je Kredit änderbar')}
          ${row('overdraftPct', 'Überziehungszins', 'Kontokorrent auf negatives Budget, fällig beim Saisonwechsel')}
          ${row('upfrontPct', 'Anzahlung bei Raten', 'z. B. 40 % sofort')}
          ${row('rateYears', 'Raten-Laufzeit', 'Folgesaisons für den Rest', 'Sais.')}
        </article>
        <article class="tile reveal" style="--i:2">
          <div class="tile-head"><h2>Ausbildungsentschädigung</h2><span class="tile-kicker">Staffel</span></div>
          <p class="small muted">Nur bei internationalen Transfers, bis zum angegebenen Alter: Prozent der Ablöse + Pauschale. Beim Kauf auch bei ablösefreien Spielern.</p>
          <table class="mini-table">
            <thead><tr><th>bis Alter</th><th>% Ablöse</th><th>Pauschale €</th><th></th></tr></thead>
            <tbody>
              ${s.training.map((t) => `<tr>
                <td><input class="input" data-train="${t.id}" data-k="maxAge" inputmode="numeric" value="${t.maxAge}" aria-label="bis Alter"></td>
                <td><input class="input" data-train="${t.id}" data-k="pct" inputmode="decimal" value="${fmtInputNum(t.pct)}" aria-label="Prozent"></td>
                <td><input class="input money" data-train="${t.id}" data-k="flat" inputmode="decimal" value="${fmtInputMoney(t.flat)}" data-money aria-label="Pauschale"></td>
                <td><button type="button" class="btn small ghost" data-action="train-del" data-id="${t.id}" aria-label="Zeile löschen">${icon('trash')}</button></td></tr>`).join('')}
            </tbody>
          </table>
          <button type="button" class="btn small" data-action="train-add" style="margin-top:10px">${icon('plus')}Zeile</button>
        </article>
        <article class="tile reveal" style="--i:3">
          <div class="tile-head"><h2>Saisonwechsel &amp; Fairplay</h2></div>
          <p class="small muted">Das Ingame-Budget startet immer mit dem neuen FC27-Betrag. Hier legst du fest, was vom realistischen Restbudget mitgenommen wird.</p>
          <div class="radio-list">
            ${[['full', 'Restbudget &amp; Schulden übertragen', 'Neues Start-Budget = Rest nach Fixkosten + neues FC27-Budget (Standard).'],
               ['debt', 'Nur Schulden übertragen', 'Überschüsse verfallen, ein Minus bleibt stehen.'],
               ['none', 'Nichts übertragen', 'Jede Saison startet nur mit dem FC27-Budget.']]
              .map(([k, l, h]) => `<label class="radio-card"><input type="radio" name="carryMode" value="${k}" ${s.carryMode === k ? 'checked' : ''}><span><b>${l}</b><small>${h}</small></span></label>`).join('')}
          </div>
          <div class="set-row" style="margin-top:10px"><label>Fairplay-Warnung<small>Warnen, wenn Ausgaben einen Anteil der Einnahmen überschreiten</small></label>
            <label class="toggle" style="justify-self:end"><input type="checkbox" data-setting-bool="ffpEnabled" ${s.ffpEnabled ? 'checked' : ''}><span class="sw"></span><span class="t">Aktiv</span></label></div>
          ${row('ffpLimit', 'Grenze Ausgaben/Einnahmen', '100 % = nicht mehr ausgeben als einnehmen')}
        </article>
        <article class="tile wide reveal" style="--i:4">
          <div class="tile-head"><h2>Saison-Events</h2><span class="tile-kicker">${EVENT_CATALOG.length} Events im Katalog</span></div>
          <p class="small muted">Jede Saison wird aus diesem Katalog ein Plan passend zum FC27-Budget ausgewürfelt. Große Posten kommen nur bei großem Budget. Die Härte gilt für neu erstellte Pläne.</p>
          <div class="radio-list level-list">
            ${Object.entries(EVENT_LEVELS).map(([k, l]) => `<label class="radio-card"><input type="radio" name="eventLevel" value="${k}" ${s.eventLevel === k ? 'checked' : ''}><span><b>${l.label}</b><small>Kosten ca. ${nf0.format(l.range[0] * 100)}–${nf0.format(l.range[1] * 100)} % vom Budget</small></span></label>`).join('')}
          </div>
          <div class="set-row" style="margin-top:10px"><label>Einnahmen-Events<small>Ab und zu ein Plus: Testspiel-Gage, Trikot-Boom, Sponsor-Prämie …</small></label>
            <label class="toggle" style="justify-self:end"><input type="checkbox" data-setting-bool="eventIncome" ${s.eventIncome ? 'checked' : ''}><span class="sw"></span><span class="t">Aktiv</span></label></div>
          <details style="margin-top:10px"><summary class="small" style="cursor:pointer;color:var(--violet-ink);font-weight:600">Katalog ansehen</summary>
            <div style="overflow-x:auto;margin-top:8px"><table class="mini-table" style="min-width:560px">
              <thead><tr><th>Event</th><th>Wann</th><th>Anteil</th><th>Chance</th><th>ab Budget</th></tr></thead>
              <tbody>${EVENT_CATALOG.map((e) => `<tr><td><b>${esc(e.title)}</b><br><span class="small muted">${esc(e.cat)}${e.income ? ' · Einnahme' : ''}</span></td><td class="small">${e.start ? 'Saisonstart 01.07.' : `${e.win[0].split('-').reverse().join('.')}. – ${e.win[1].split('-').reverse().join('.')}.`}</td><td class="small">${e.flat ? eur(e.flat) : `${nf1.format(e.pct[0])}–${nf1.format(e.pct[1])} %`}</td><td class="small">${nf0.format((e.chance ?? 1) * 100)} %</td><td class="small">${e.minBudget ? eurShort(e.minBudget) + ' €' : '–'}</td></tr>`).join('')}</tbody>
            </table></div>
          </details>
        </article>
        <article class="tile wide reveal" style="--i:5">
          <div class="tile-head"><h2>Daten &amp; Sicherung</h2><span class="tile-kicker">${state.txs.length} Einträge · ${state.seasons.length} Saisons</span></div>
          <p class="small">Alles wird <b>automatisch im Browser gespeichert</b> (localStorage) – auch nach dem Schließen. Verloren geht es nur, wenn du die Browserdaten löschst oder einen anderen Browser nimmst. Darum zusätzlich:</p>
          ${backupState}
          <div class="data-actions" style="margin-top:12px">
            ${Backup.supported ? (Backup.handle
              ? (Backup.perm === 'granted' ? `<button type="button" class="btn small" data-action="backup-disconnect">${icon('x')}Backup-Datei trennen</button>` : `<button type="button" class="btn small primary" data-action="backup-reconnect">${icon('link')}Backup freigeben</button>`)
              : `<button type="button" class="btn small primary" data-action="backup-connect">${icon('link')}Auto-Backup-Datei verbinden</button>`) : ''}
            <button type="button" class="btn small" data-action="export-json">${icon('download')}JSON exportieren</button>
            <button type="button" class="btn small" data-action="export-csv">${icon('download')}CSV exportieren</button>
            <button type="button" class="btn small" data-action="import">${icon('upload')}JSON importieren</button>
            <button type="button" class="btn small danger" data-action="reset">${icon('trash')}Alles zurücksetzen</button>
          </div>
          <p class="small muted" style="margin-top:12px" id="persistInfo"></p>
        </article>
      </div>
      <p class="disclaimer">Hobby-Hausregel für den EA SPORTS FC27 Karrieremodus – kein echtes Geld, keine Steuer- oder Rechtsberatung. Alle Sätze sind vereinfachte Annäherungen an österreichische und FIFA-Regeln und frei änderbar.</p>`;

    navigator.storage?.persisted?.().then((p) => {
      const info = $('#persistInfo');
      if (info) info.textContent = p ? 'Browser-Speicher ist als dauerhaft markiert (wird nicht automatisch geräumt).' : 'Browser-Speicher ist nicht als dauerhaft markiert – Export/Backup empfohlen.';
    }).catch(() => {});
  }

  function onSettingsChange(e) {
    const t = e.target;
    const s = S();
    if (t.dataset.setting) {
      const n = parseNum(t.value);
      if (!isFinite(n) || n < 0) { t.classList.add('invalid'); return; }
      t.classList.remove('invalid');
      s[t.dataset.setting] = t.dataset.setting === 'rateYears' ? Math.max(1, Math.round(n)) : n;
      if (e.type === 'change') t.value = fmtInputNum(s[t.dataset.setting]);
      save({ silent: true });
    } else if (t.dataset.settingBool) {
      s[t.dataset.settingBool] = t.checked; save({ silent: true });
    } else if (t.name === 'carryMode') {
      s.carryMode = t.value; save({ silent: true });
    } else if (t.name === 'eventLevel') {
      s.eventLevel = t.value; save({ silent: true });
    } else if (t.dataset.train) {
      const r = s.training.find((x) => x.id === t.dataset.train);
      if (!r) return;
      const k = t.dataset.k;
      const n = k === 'flat' ? parseMoney(t.value || '0') : parseNum(t.value);
      if (!isFinite(n) || n < 0) { t.classList.add('invalid'); return; }
      t.classList.remove('invalid');
      r[k] = n; save({ silent: true });
    }
  }
  function renderSettingsKeepScroll() {
    const y = window.scrollY;
    renderSettings();
    $$('#view-einstellungen .reveal').forEach((x) => x.classList.remove('reveal'));
    window.scrollTo(0, y);
  }

  // ---------------------------------------------------------------------------
  // Export / Import
  // ---------------------------------------------------------------------------
  function download(name, content, mime) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const stamp = () => new Date().toISOString().slice(0, 10);
  function exportJSON() {
    download(`veilchen-kassa-${stamp()}.json`, JSON.stringify(state, null, 2), 'application/json');
    toast('JSON-Backup heruntergeladen.');
  }
  function exportCSV() {
    const head = ['Saison', 'Datum', 'Typ', 'Titel', 'Details', 'Notiz', 'Ingame (FC27)', 'Realistisch diese Saison', 'Realistisch gesamt', 'KöSt', 'Solidaritätsbeitrag', 'Ausbildungsentschädigung', 'Berater', 'Handgeld', 'Raten Folgesaisons'];
    const q = (v) => {
      const s = String(v ?? '');
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [head.join(';')];
    for (const r of ledger()) {
      for (const t of r.txs) {
        const d = t.deduct || {};
        lines.push([
          r.s.label, dateFmt.format(t.ts), TYPE_LABEL[t.type] || t.type, t.title, t.sub, t.note,
          t.gross || 0, t.net, t.total ?? t.net, d.tax || 0, d.sol || 0, d.tc || 0, d.agent || 0, d.signing || 0,
          (t.schedule || []).reduce((a, x) => a + x.amount, 0),
        ].map(q).join(';'));
      }
    }
    download(`veilchen-kassa-${stamp()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
    toast('CSV heruntergeladen (Excel-kompatibel, Semikolon).');
  }
  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.seasons) || !Array.isArray(data.txs)) throw new Error('format');
      const ok = await confirmDialog({ title: 'Backup importieren', text: `Import ersetzt alle aktuellen Daten durch <b>${data.seasons.length} Saison(s)</b> und <b>${data.txs.length} Eintrag/Einträge</b> aus „${esc(file.name)}“.`, ok: 'Importieren' });
      if (!ok) return;
      snapshot();
      state = normalize(data);
      save();
      renderAll();
      toast('Backup importiert.', { label: 'Rückgängig', fn: undo });
    } catch (_) {
      toast('Datei ist kein gültiges Veilchen-Kassa-Backup.');
    }
  });

  // ---------------------------------------------------------------------------
  // Globale Events
  // ---------------------------------------------------------------------------
  document.addEventListener('click', async (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      if (nav.dataset.sub && nav.dataset.nav === 'sonstiges') state.ui.otherKind = nav.dataset.sub;
      if (nav.dataset.nav === 'saison') wiz = null;
      go(nav.dataset.nav, nav.dataset.sub);
      return;
    }
    const a = e.target.closest('[data-action]');
    if (!a) return;
    const act = a.dataset.action;
    switch (act) {
      case 'edit-season': openEditSeason(a.dataset.id); break;
      case 'delete-season': deleteSeason(a.dataset.id); break;
      case 'toggle-tx': { const row = a.closest('.tx-row'); row.classList.toggle('open'); a.setAttribute('aria-expanded', row.classList.contains('open')); break; }
      case 'delete-tx': deleteTx(a.dataset.id); break;
      case 'donut-scope': state.ui.donutScope = a.dataset.scope; save({ silent: true }); renderDashboard(); break;
      case 'sort-toggle': state.ui.sortDesc = !state.ui.sortDesc; save({ silent: true }); renderLog(); break;
      case 'wiz-next': wizNext(); break;
      case 'wiz-back': { const steps = wizSteps().map(([n]) => n); wiz.step = steps[Math.max(0, steps.indexOf(wiz.step) - 1)]; renderWizard(); break; }
      case 'wiz-reroll': wiz.seed = uid(); renderWizard(); break;
      case 'events-create': {
        const cs = currentSeason();
        snapshot();
        cs.events = generateEvents(cs.grossBudget, cs.label, uid());
        cs.gameDate ||= isoDate(seasonDate('07-01', seasonStartYear(cs.label)));
        save();
        toast(`Event-Plan erstellt: ${cs.events.length} Events.`, { label: 'Rückgängig', fn: undo });
        go('events');
        break;
      }
      case 'wiz-confirm': wizConfirm(); break;
      case 'export-json': exportJSON(); break;
      case 'export-csv': exportCSV(); break;
      case 'import': $('#importFile').click(); break;
      case 'backup-connect': Backup.connect(); break;
      case 'backup-reconnect': Backup.reconnect(); break;
      case 'backup-disconnect': Backup.disconnect(); break;
      case 'backup-restore': Backup.restoreFromHandle(); break;
      case 'train-add': S().training.push({ id: uid(), maxAge: 23, pct: 0, flat: 0 }); save({ silent: true }); renderSettingsKeepScroll(); break;
      case 'train-del': S().training = S().training.filter((x) => x.id !== a.dataset.id); save({ silent: true }); renderSettingsKeepScroll(); break;
      case 'reset': {
        const ok = await confirmDialog({ title: 'Alles zurücksetzen', text: 'Löscht <b>alle Saisons, Einträge, Kredite und Einstellungen</b> in diesem Browser. Vorher am besten JSON exportieren.', ok: 'Endgültig löschen', danger: true, requireText: 'LÖSCHEN' });
        if (!ok) break;
        snapshot();
        state = defaultState();
        save();
        go('dashboard');
        renderAll();
        toast('Alle Daten zurückgesetzt.', { label: 'Rückgängig', fn: undo });
        break;
      }
      default: break;
    }
  });

  const settingsView = $('#view-einstellungen');
  settingsView.addEventListener('change', onSettingsChange);
  settingsView.addEventListener('input', (e) => { if (e.target.type !== 'checkbox' && e.target.type !== 'radio' && e.target.tagName !== 'SELECT') onSettingsChange(e); });
  // Event-Häkchen (Dashboard + Events-Seite)
  document.addEventListener('change', onEventToggle);

  // Geldfelder beim Verlassen hübsch formatieren
  document.addEventListener('focusout', (e) => {
    const t = e.target;
    if (!t.matches?.('input[data-money]') || !t.value.trim()) return;
    const n = parseMoney(t.value);
    if (isFinite(n)) {
      t.value = fmtInputMoney(n);
      t.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  $$('.bottom-nav [data-icon]').forEach((i) => { i.outerHTML = icon(i.dataset.icon); });
  $('#settingsBtn').innerHTML = icon('gear');

  // Theme
  function applyTheme() {
    let t = 'auto';
    try { t = localStorage.getItem(THEME_KEY) || 'auto'; } catch (_) { /* ignore */ }
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    const btn = $('#themeBtn');
    btn.innerHTML = icon(t === 'dark' ? 'moon' : t === 'light' ? 'sun' : 'auto');
    const label = `Farbmodus: ${{ auto: 'automatisch', light: 'hell', dark: 'dunkel' }[t]} (klicken zum Wechseln)`;
    btn.title = label;
    btn.setAttribute('aria-label', label);
  }
  $('#themeBtn').addEventListener('click', () => {
    let t = 'auto';
    try { t = localStorage.getItem(THEME_KEY) || 'auto'; } catch (_) { /* ignore */ }
    const next = { auto: 'light', light: 'dark', dark: 'auto' }[t];
    try { localStorage.setItem(THEME_KEY, next); } catch (_) { /* ignore */ }
    applyTheme();
    if (currentView === 'dashboard' || currentView === 'protokoll') renderView(currentView);
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const rows = ledger();
      if (currentView === 'dashboard' && $('#lineChart')) renderLineChart($('#lineChart'), rows);
      if (currentView === 'protokoll' && $('#seasonBars') && $('#seasonTable')?.open) renderSeasonBars($('#seasonBars'), rows);
    }, 200);
  });
  window.addEventListener('scroll', hideTip, { passive: true });

  // Test-Hook für automatisierte Prüfungen
  window.VeilchenKassa = { get state() { return state; }, calcSale, calcPurchase, calcOther, parseMoney, ledger, split };

  // Start
  applyTheme();
  Backup.init().finally(() => {
    try { localStorage.setItem(STORAGE_KEY + '-probe', '1'); localStorage.removeItem(STORAGE_KEY + '-probe'); } catch (_) { storageOk = false; }
    renderAll();
  });
})();
