/* ==========================================================
   Aufwind Studio – Lead Manager
   Vanilla JS · Daten zentral über die Netlify-API (/api/leads),
   damit alle Geräte und Personen dieselbe Liste sehen.
   ========================================================== */

(() => {
  "use strict";

  /* ---------------------------------------------------------
     Konstanten
     --------------------------------------------------------- */

  /** Alter lokaler Speicher (v1) – wird nur noch einmalig für die Übernahme gelesen. */
  const LEGACY_STORAGE_KEY = "aufwind_leads_v1";
  const SESSION_KEY = "aufwind_pin";               // PIN gilt bis Browser/Tab geschlossen wird
  const API_BASE = "/api";
  const POLL_INTERVAL = 8000;                      // ms – wie oft nach Änderungen anderer gefragt wird

  const STATUSES = [
    "Anrufen",
    "Rückruf vereinbart",
    "Termin vereinbart",
    "Entwurf in Arbeit",
    "Entwurf gesendet",
    "Kunde",
    "Abgelehnt"
  ];

  /** Alte Statuswerte → neue (bestehende Leads werden automatisch umgestellt). */
  const LEGACY_STATUS = {
    "Offen": "Anrufen",
    "Warten auf Rückruf": "Rückruf vereinbart",
    "In 1–2 Wochen anrufen": "Rückruf vereinbart",
    "Interesse": "Termin vereinbart",
    "Angebot gesendet": "Entwurf gesendet",
    "Erledigt": "Kunde"
  };
  const mapStatus = (s) => {
    const v = String(s ?? "").trim();
    return LEGACY_STATUS[v] || v || "Anrufen";
  };

  const STATUS_TONE = {
    "Anrufen": "yellow",
    "Rückruf vereinbart": "lightblue",
    "Termin vereinbart": "blue",
    "Entwurf in Arbeit": "gray",
    "Entwurf gesendet": "violet",
    "Kunde": "green",
    "Abgelehnt": "red"
  };

  /** Abgeschlossene Leads: kein „fällig/überfällig“, in Standardsortierung ans Ende. */
  const CLOSED_STATUSES = new Set(["Kunde", "Abgelehnt"]);

  /** Statuswerte, die in der Übersicht als „Rückruf“ zählen. */
  const CALLBACK_STATUSES = new Set(["Rückruf vereinbart"]);

  /** Kategorie „Entwurf machen“: noch kein Entwurf-Link (Kunden und Absagen ausgenommen).
      Sobald ein Entwurf-Link eingetragen ist, fällt der Lead automatisch heraus. */
  const needsDraft = (lead) => !lead.draftUrl && !CLOSED_STATUSES.has(lead.status);

  /* ---------------------------------------------------------
     Startdaten (Stand: Export vom 15.10.2026, inkl. eigener Änderungen)
     --------------------------------------------------------- */

  const SEED_DATA = [
    { company: "Fahrschule Bär", contact: "", phone: "0171 2254490", status: "Rückruf vereinbart", followUpDate: "2026-10-30",
      website: "", draftUrl: "",
      notes: "Nach dem Urlaub alles Weitere besprechen. Intern wird aktuell überarbeitet. Rückruf am 30.10.2026." },
    { company: "Ostsee Immo", contact: "", phone: "03834 839790", status: "Offen", followUpDate: "",
      website: "https://ostseeimmo.de", draftUrl: "",
      notes: "Noch nicht kontaktiert." },
    { company: "Zaunbau Team Nord", contact: "", phone: "0178 19 42 470", status: "Rückruf vereinbart", followUpDate: "",
      website: "https://www.zaunbau-team-nord.de", draftUrl: "",
      notes: "Anfang Dezember abstimmen, wenn Saison vorbei ist. Interesse besteht. Rückruf für die erste Dezemberwoche vereinbart." },
    { company: "Hautliebe", contact: "", phone: "015757244206", status: "Offen", followUpDate: "",
      website: "https://www.hautliebe-kosmetik.de", draftUrl: "",
      notes: "In einer Woche anrufen." },
    { company: "Delicate Pole", contact: "", phone: "0172 4437767", status: "Offen", followUpDate: "",
      website: "https://www.delicate-pole.de", draftUrl: "",
      notes: "Gespräch erfolgt / erledigt." },
    { company: "Physio aktiv HGW", contact: "", phone: "03834 / 820359", status: "Warten auf Rückruf", followUpDate: "",
      website: "https://www.physioaktiv-greifswald.de", draftUrl: "",
      notes: "Warten auf Rückruf." },
    { company: "Zeeb Bautrocknung / die trocknungsprofis", contact: "", phone: "07031 651188", status: "Offen", followUpDate: "",
      website: "https://www.dietrocknungsprofis.de", draftUrl: "",
      notes: "Noch nicht kontaktiert." },
    { company: "Allround Service Schwarzer", contact: "Tino Schwarzer", phone: "0152 29496506", status: "Offen", followUpDate: "",
      website: "", draftUrl: "",
      notes: "Gespräch erfolgt / erledigt." },
    { company: "Zimmerei Bork", contact: "", phone: "+49 162 6917143", status: "Offen", followUpDate: "",
      website: "https://www.zimmerei-bork.de", draftUrl: "",
      notes: "Gespräch erfolgt / erledigt." },
    { company: "Fahrschule Löwen", contact: "", phone: "0172 13 03 973", status: "Warten auf Rückruf", followUpDate: "",
      website: "https://fahrschul-loewen.de", draftUrl: "",
      notes: "Warten auf Rückruf." },
    { company: "KFZ-Gutachter Koch", contact: "", phone: "01522 1399087", status: "In 1–2 Wochen anrufen", followUpDate: "",
      website: "", draftUrl: "",
      notes: "Noch einmal in 1–2 Wochen anrufen." },
    { company: "Hairpoint MV", contact: "", phone: "0174 9008769", status: "Anrufen", followUpDate: "",
      website: "https://www.hairpointmv.de", draftUrl: "",
      notes: "Noch anrufen." },
    { company: "WK Päschke GmbH (Abbrucharbeiten, Betonbohr- und -sägearbeiten)", contact: "", phone: "0385 20747422", status: "Offen", followUpDate: "",
      website: "", draftUrl: "",
      notes: "Noch nicht kontaktiert." },
    { company: "Bootsfahrschule Müritz e.K.", contact: "", phone: "03991 6747470", status: "Offen", followUpDate: "",
      website: "https://www.sportbootfuehrerschein-mueritz.de", draftUrl: "",
      notes: "Noch nicht kontaktiert." },
    { company: "HD Restaurant", contact: "", phone: "03991 1265220", status: "Offen", followUpDate: "",
      website: "https://www.hdrestaurant.de", draftUrl: "",
      notes: "Haben nach Preis gefragt" }
  ];

  /**
   * Recherchierte aktuelle Websites (Stand 15.10.2026).
   * Wird einmalig in bestehende Browser-Daten übernommen – nur dort, wo das Feld noch leer ist.
   */
  const WEBSITE_MIGRATION_ID = "websites-2026-10-15";
  const RESEARCHED_WEBSITES = {
    "Zaunbau Team Nord": "https://www.zaunbau-team-nord.de",
    "Ostsee Immo": "https://ostseeimmo.de",
    "Hautliebe": "https://www.hautliebe-kosmetik.de",
    "Delicate Pole": "https://www.delicate-pole.de",
    "Physio aktiv HGW": "https://www.physioaktiv-greifswald.de",
    "Zeeb Bautrocknung / die trocknungsprofis": "https://www.dietrocknungsprofis.de",
    "Zimmerei Bork": "https://www.zimmerei-bork.de",
    "Fahrschule Löwen": "https://fahrschul-loewen.de",
    "Hairpoint MV": "https://www.hairpointmv.de",
    "Bootsfahrschule Müritz e.K.": "https://www.sportbootfuehrerschein-mueritz.de",
    "HD Restaurant": "https://www.hdrestaurant.de"
  };

  /* ---------------------------------------------------------
     Hilfsfunktionen
     --------------------------------------------------------- */

  const $ = (sel, root = document) => root.querySelector(sel);

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    // Fallback für ältere Browser / unsichere Kontexte
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const pad = (n) => String(n).padStart(2, "0");

  /** Lokales Datum als YYYY-MM-DD (keine UTC-Verschiebung). */
  function toISODate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function todayISO() {
    return toISODate(new Date());
  }

  function addDaysISO(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return toISODate(d);
  }

  /** YYYY-MM-DD → TT.MM.JJJJ */
  function formatDate(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  }

  function formatDateTime(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())} Uhr`;
  }

  /** Akzeptiert YYYY-MM-DD oder TT.MM.JJJJ, sonst "". */
  function normalizeDate(value) {
    const v = String(value ?? "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
    return "";
  }

  /** Montag–Sonntag der aktuellen Woche als ISO-Daten. */
  function currentWeekRange() {
    const now = new Date();
    const day = (now.getDay() + 6) % 7; // Mo = 0
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return [toISODate(start), toISODate(end)];
  }

  /**
   * tel:-Link aus der angezeigten Nummer ableiten.
   * Die angezeigte Nummer selbst bleibt unverändert.
   */
  function telHref(phone) {
    let n = String(phone || "").replace(/[^\d+]/g, "");
    if (!n) return "";
    if (n.startsWith("00")) n = "+" + n.slice(2);
    else if (n.startsWith("0")) n = "+49" + n.slice(1);
    return "tel:" + n;
  }

  /** Ergänzt fehlendes https:// – sonst unverändert. */
  function normalizeUrl(value) {
    const v = String(value ?? "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    return "https://" + v.replace(/^\/+/, "");
  }

  /** Anzeige-Text: Domain ohne www, ohne Protokoll. */
  function displayUrl(url) {
    try {
      const u = new URL(url);
      const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
      return u.hostname.replace(/^www\./, "") + path;
    } catch (e) {
      return url;
    }
  }

  /* ---------------------------------------------------------
     Datenmodell
     --------------------------------------------------------- */

  function normalizeLead(raw) {
    const now = new Date().toISOString();
    const r = raw && typeof raw === "object" ? raw : {};
    return {
      id: typeof r.id === "string" && r.id ? r.id : uid(),
      company: String(r.company ?? "").trim(),
      contact: String(r.contact ?? "").trim(),
      phone: String(r.phone ?? "").trim(),
      website: normalizeUrl(r.website),
      draftUrl: normalizeUrl(r.draftUrl),
      status: mapStatus(r.status),
      followUpDate: normalizeDate(r.followUpDate),
      draftSentDate: normalizeDate(r.draftSentDate),
      callDoneFor: normalizeDate(r.callDoneFor),
      callDoneOn: normalizeDate(r.callDoneOn),
      followUpDoneFor: normalizeDate(r.followUpDoneFor),
      followUpDoneOn: normalizeDate(r.followUpDoneOn),
      notes: String(r.notes ?? ""),
      createdAt: typeof r.createdAt === "string" && r.createdAt ? r.createdAt : now,
      updatedAt: typeof r.updatedAt === "string" && r.updatedAt ? r.updatedAt : now
    };
  }

  function createLead(data) {
    const now = new Date().toISOString();
    return normalizeLead({ ...data, id: uid(), createdAt: now, updatedAt: now });
  }

  const EDITABLE_FIELDS = ["company", "contact", "phone", "website", "draftUrl", "status", "followUpDate", "draftSentDate",
    "callDoneFor", "callDoneOn", "followUpDoneFor", "followUpDoneOn", "notes"];

  function pickEditable(updates) {
    const out = {};
    EDITABLE_FIELDS.forEach((key) => {
      if (key in updates) out[key] = updates[key];
    });
    return out;
  }

  /* ---------------------------------------------------------
     Storage-Schicht (Server-Sync)
     Die Oberfläche liest synchron aus dem Cache (getLeads/getLead).
     Änderungen werden sofort im Cache angezeigt (optimistisch) und
     an die API geschickt; schlägt das fehl, wird zurückgerollt.
     --------------------------------------------------------- */

  const cache = { leads: [], version: 0, loaded: false };
  let pendingOps = 0;

  class ApiError extends Error {
    constructor(status, data) {
      super(`API ${status}`);
      this.status = status;
      this.data = data || {};
    }
  }

  /** PIN: im Tab (sessionStorage) oder dauerhaft auf dem Gerät (localStorage, „angemeldet bleiben“). */
  function getPin() {
    try {
      return window.sessionStorage.getItem(SESSION_KEY) || window.localStorage.getItem(SESSION_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function setPin(pin, remember = false) {
    try {
      if (pin) {
        window.sessionStorage.setItem(SESSION_KEY, pin);
        if (remember) window.localStorage.setItem(SESSION_KEY, pin);
      } else {
        window.sessionStorage.removeItem(SESSION_KEY);
        window.localStorage.removeItem(SESSION_KEY);
      }
    } catch (e) { /* ignorieren */ }
  }

  async function api(method, path, body) {
    let res;
    try {
      res = await fetch(API_BASE + path, {
        method,
        headers: {
          "content-type": "application/json",
          "x-aufwind-pin": getPin()
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store"
      });
    } catch (e) {
      setSyncState("offline");
      throw new ApiError(0, { error: "network" });
    }
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (res.status === 401) {
      handleUnauthorized();
      throw new ApiError(401, data);
    }
    if (!res.ok) throw new ApiError(res.status, data);
    return data;
  }

  function track(promise) {
    pendingOps++;
    setSyncState("saving");
    return promise.finally(() => {
      pendingOps--;
      if (pendingOps === 0 && syncState !== "offline") setSyncState("ok");
    });
  }

  /** Übernimmt eine neue Server-Version; bei Sprüngen (andere haben geändert) neu laden. */
  function acceptVersion(version) {
    if (!version) return;
    if (version === cache.version + 1) cache.version = version;
    else refreshAndRender();
  }

  /** Neu laden und – falls nötig – neu zeichnen; Fehler zeigt der Sync-Status. */
  function refreshAndRender() {
    refreshFromServer({ force: true })
      .then((changed) => { if (changed && els.rowMenu.hidden) renderLeads(); })
      .catch(() => {});
  }

  function getLeads() {
    return cache.leads;
  }

  function getLead(id) {
    return cache.leads.find((l) => l.id === id) || null;
  }

  function replaceInCache(lead) {
    const index = cache.leads.findIndex((l) => l.id === lead.id);
    if (index === -1) cache.leads.push(normalizeLead(lead));
    else cache.leads[index] = normalizeLead(lead);
  }

  /** Lead anlegen → gibt den gespeicherten Lead zurück (oder wirft). */
  async function addLead(data) {
    const temp = createLead(data);
    cache.leads.push(temp);
    renderLeads();
    try {
      const res = await track(api("POST", "/leads", { lead: temp }));
      const index = cache.leads.findIndex((l) => l.id === temp.id);
      if (index !== -1) cache.leads[index] = normalizeLead(res.lead);
      acceptVersion(res.version);
      renderLeads();
      return res.lead;
    } catch (err) {
      cache.leads = cache.leads.filter((l) => l.id !== temp.id);
      renderLeads();
      throw err;
    }
  }

  /**
   * Lead ändern.
   * Ergebnis: { lead } | { conflict: true, serverLead } | { notFound: true }
   */
  async function updateLead(id, updates, { force = false } = {}) {
    const before = getLead(id);
    if (!before) return { notFound: true };
    const optimistic = normalizeLead({ ...before, ...pickEditable(updates), updatedAt: new Date().toISOString() });
    replaceInCache(optimistic);
    renderLeads();
    try {
      const res = await track(api("PATCH", `/leads/${encodeURIComponent(id)}`, {
        updates: pickEditable(updates),
        baseUpdatedAt: before.updatedAt,
        force
      }));
      replaceInCache(res.lead);
      acceptVersion(res.version);
      renderLeads();
      return { lead: normalizeLead(res.lead) };
    } catch (err) {
      if (err.status === 409 && err.data && err.data.lead) {
        replaceInCache(err.data.lead);
        renderLeads();
        refreshAndRender();
        return { conflict: true, serverLead: normalizeLead(err.data.lead) };
      }
      if (err.status === 404) {
        cache.leads = cache.leads.filter((l) => l.id !== id);
        renderLeads();
        return { notFound: true };
      }
      replaceInCache(before);
      renderLeads();
      throw err;
    }
  }

  async function deleteLead(id) {
    const index = cache.leads.findIndex((l) => l.id === id);
    if (index === -1) return;
    const removed = cache.leads[index];
    cache.leads.splice(index, 1);
    renderLeads();
    try {
      const res = await track(api("DELETE", `/leads/${encodeURIComponent(id)}`));
      acceptVersion(res.version);
    } catch (err) {
      cache.leads.splice(Math.min(index, cache.leads.length), 0, removed);
      renderLeads();
      throw err;
    }
  }

  /** Komplette Liste ersetzen (JSON-Import). */
  async function replaceAllLeads(leads) {
    const res = await track(api("PUT", "/import", { leads }));
    cache.leads = res.leads.map(normalizeLead);
    cache.version = res.version;
    renderLeads();
  }

  /** Alte, nur lokal gespeicherte Daten (v1) lesen – inkl. recherchierter Websites. */
  function readLegacyLocalLeads() {
    try {
      const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) return null;
      return parsed.map((l) => {
        const lead = normalizeLead(l);
        if (!lead.website && RESEARCHED_WEBSITES[lead.company]) lead.website = RESEARCHED_WEBSITES[lead.company];
        return lead;
      });
    } catch (e) {
      return null;
    }
  }

  /** Erster Start: gemeinsame Liste ist noch leer → lokale Daten oder Startdaten hochladen. */
  async function initializeServer() {
    const local = readLegacyLocalLeads();
    const leads = local || SEED_DATA.map(createLead);
    try {
      const res = await track(api("POST", "/init", { leads }));
      cache.leads = res.leads.map(normalizeLead);
      cache.version = res.version;
      if (local) showToast(`${local.length} Leads aus diesem Browser in die gemeinsame Liste übernommen`, false, 4000);
    } catch (err) {
      if (err.status === 409 && err.data && Array.isArray(err.data.leads)) {
        // Jemand anderes war schneller – dessen Liste verwenden
        cache.leads = err.data.leads.map(normalizeLead);
        cache.version = err.data.version;
      } else {
        throw err;
      }
    }
  }

  let refreshing = null;

  /**
   * Holt den aktuellen Stand vom Server.
   * Gibt true zurück, wenn sich etwas geändert hat.
   */
  function refreshFromServer({ force = false } = {}) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const since = force || !cache.loaded ? "" : `?since=${cache.version}`;
      const res = await api("GET", `/leads${since}`);
      if (syncState === "offline") setSyncState(pendingOps ? "saving" : "ok");
      if (!res.initialized) {
        await initializeServer();
        cache.loaded = true;
        return true;
      }
      if (res.unchanged) return false;
      // Während eigene Änderungen unterwegs sind, nichts überschreiben
      if (pendingOps > 0) return false;
      cache.leads = res.leads.map(normalizeLead);
      cache.version = res.version;
      cache.loaded = true;
      return true;
    })().finally(() => { refreshing = null; });
    return refreshing;
  }

  /* ---------------------------------------------------------
     Sync-Status & Polling
     --------------------------------------------------------- */

  let syncState = "ok";
  let pollTimer = null;

  function setSyncState(state) {
    syncState = state;
    const el = document.getElementById("syncStatus");
    if (!el) return;
    el.dataset.state = state;
    el.textContent = {
      ok: "Synchronisiert",
      saving: "Speichert …",
      offline: "Offline – keine Verbindung"
    }[state] || "";
  }

  async function poll() {
    if (document.body.classList.contains("is-locked")) return;
    if (document.visibilityState !== "visible") return;
    try {
      const changed = await refreshFromServer();
      // Offenes Zeilenmenü nicht unter der Hand wegrendern
      if (changed && els.rowMenu.hidden) renderLeads();
    } catch (e) { /* Status zeigt offline */ }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(poll, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  function showSaveError(err) {
    if (err && err.status === 401) return; // Sperrbildschirm übernimmt
    if (err && err.status === 0) {
      showToast("Keine Verbindung – Änderung wurde nicht gespeichert.", true, 4000);
    } else {
      showToast("Speichern fehlgeschlagen – bitte erneut versuchen.", true, 4000);
    }
  }

  /* ---------------------------------------------------------
     Follow-up-Logik
     --------------------------------------------------------- */

  const Schedule = window.AufwindSchedule;

  /** Aufgaben eines Leads (Anruf nach Entwurf, eigener Follow-up) – Logik in schedule.js. */
  function leadTasks(lead, today = todayISO()) {
    return Schedule.leadTasks(lead, today);
  }

  /** Gesamtzustand: "none" | "closed" | "overdue" | "due" | "upcoming" */
  function followState(lead, today = todayISO()) {
    const tasks = leadTasks(lead, today);
    if (!tasks.length) return "none";
    const states = tasks.map((t) => t.state);
    if (states.includes("overdue")) return "overdue";
    if (states.includes("due")) return "due";
    if (states.includes("upcoming")) return "upcoming";
    if (states.includes("closed")) return "closed";
    return "none";
  }

  /** Nächster offener Termin (für Sortierung). */
  function nextTaskDate(lead, today = todayISO()) {
    const open = leadTasks(lead, today)
      .filter((t) => ["overdue", "due", "upcoming"].includes(t.state))
      .map((t) => t.date)
      .sort();
    return open[0] || "";
  }

  /** Alle offenen bzw. heute erledigten Aufgaben – für die Tagesliste. */
  function collectTodayTasks(leads, today) {
    const overdue = [];
    const due = [];
    const doneToday = [];
    leads.forEach((lead) => {
      leadTasks(lead, today).forEach((task) => {
        const entry = { lead, task };
        if (task.state === "overdue") overdue.push(entry);
        else if (task.state === "due") due.push(entry);
        else if (task.done && task.doneOn === today) doneToday.push(entry);
      });
    });
    overdue.sort((a, b) => a.task.date.localeCompare(b.task.date));
    return { overdue, due, doneToday };
  }

  /* ---------------------------------------------------------
     DOM-Referenzen & UI-Zustand
     --------------------------------------------------------- */

  const els = {
    summary: $("#leadSummary"),
    tbody: $("#leadTableBody"),
    list: $("#leadList"),
    empty: $("#emptyState"),
    search: $("#searchInput"),
    statusFilter: $("#statusFilter"),
    draftFilter: $("#draftFilter"),
    sortSelect: $("#sortSelect"),
    followFilter: $("#followupFilter"),
    addBtn: $("#addLeadBtn"),
    fab: $("#fabAddBtn"),
    sortBtns: document.querySelectorAll(".sort-btn"),

    dataBtn: $("#dataBtn"),
    dataMenu: $("#dataMenu"),
    importInput: $("#importInput"),

    rowMenu: $("#rowMenu"),

    overlay: $("#panelOverlay"),
    panel: $("#leadPanel"),
    form: $("#leadForm"),
    panelTitle: $("#panelTitle"),
    panelMeta: $("#panelMeta"),
    saveBtn: $("#panelSaveBtn"),
    deleteBtn: $("#panelDeleteBtn"),
    cancelBtn: $("#panelCancelBtn"),
    closeBtn: $("#panelCloseBtn"),
    companyError: $("#companyError"),
    fCompany: $("#f-company"),
    fStatus: $("#f-status"),
    fDate: $("#f-followUpDate"),
    fDraftSent: $("#f-draftSentDate"),
    autoDates: $("#autoDates"),
    followUpDone: $("#followUpDone"),
    today: $("#todayPanel"),
    websiteSearchLink: $("#websiteSearchLink"),
    imageInput: $("#imageImportInput"),
    imageBtn: $("#imageImportBtn"),
    imageHint: $("#imageImportHint"),
    addFromImageBtn: $("#addFromImageBtn"),

    lockForm: $("#lockForm"),
    pinInput: $("#pinInput"),
    pinError: $("#pinError"),
    lockBtn: $("#lockBtn"),
    lockSubmit: $("#lockForm .lock-btn"),
    rememberPin: $("#rememberPin"),
    pushBtn: $("#pushBtn"),

    confirm: $("#confirmDialog"),
    confirmText: $("#confirmText"),
    confirmDetail: $("#confirmDetail"),
    confirmOk: $("#confirmOk"),
    confirmCancel: $("#confirmCancel"),

    toast: $("#toast")
  };

  const ui = {
    sortKey: null,      // null = Standardsortierung
    sortDir: 1,
    editingId: null,    // null = neuer Lead
    panelOpen: false,
    snapshot: "",
    menuLeadId: null,
    menuTrigger: null,
    lastFocus: null,
    confirmResolve: null
  };
  try {
    const saved = localStorage.getItem("aufwind-sort") || "";
    if (saved) { const [k, d] = saved.split(":"); ui.sortKey = k || null; ui.sortDir = Number(d) || 1; }
  } catch (e) { /* egal */ }

  /* ---------------------------------------------------------
     Filtern & Sortieren
     --------------------------------------------------------- */

  function matchesSearch(lead, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    const haystack = [lead.company, lead.contact, lead.phone, lead.website, lead.draftUrl, lead.notes].join(" ").toLowerCase();
    if (haystack.includes(q)) return true;
    // Telefonnummern unabhängig von Leerzeichen finden
    const qDigits = q.replace(/\D/g, "");
    if (qDigits.length >= 3) {
      const phoneDigits = lead.phone.replace(/\D/g, "");
      if (phoneDigits.includes(qDigits)) return true;
    }
    return false;
  }

  function filterLeads(leads) {
    const query = els.search.value.trim();
    const status = els.statusFilter.value;
    const follow = els.followFilter.value;
    const today = todayISO();
    const [weekStart, weekEnd] = currentWeekRange();

    return leads.filter((lead) => {
      if (!matchesSearch(lead, query)) return false;
      if (status && lead.status !== status) return false;
      const draft = els.draftFilter.value;
      if (draft === "missing" && !needsDraft(lead)) return false;
      if (draft === "present" && !lead.draftUrl) return false;

      if (follow) {
        const state = followState(lead, today);
        if (follow === "today" && state !== "due") return false;
        if (follow === "overdue" && state !== "overdue") return false;
        if (follow === "none" && leadTasks(lead, today).some((t) => !t.done)) return false;
        if (follow === "week") {
          if (CLOSED_STATUSES.has(lead.status)) return false;
          if (!leadTasks(lead, today).some((t) => !t.done && t.date >= weekStart && t.date <= weekEnd)) return false;
        }
      }
      return true;
    });
  }

  const collator = new Intl.Collator("de", { sensitivity: "base", numeric: true });

  function defaultRank(lead, today) {
    if (CLOSED_STATUSES.has(lead.status)) return 4;
    switch (followState(lead, today)) {
      case "overdue": return 0;
      case "due": return 1;
      case "upcoming": return 2;
      default: return 3;
    }
  }

  function compareDates(a, b) {
    if (a && b) return a.localeCompare(b);
    return 0;
  }

  function sortLeads(leads, nrMap) {
    const today = todayISO();
    const byNr = (a, b) => nrMap.get(a.id) - nrMap.get(b.id);
    const list = [...leads];

    if (!ui.sortKey) {
      return list.sort((a, b) =>
        defaultRank(a, today) - defaultRank(b, today) ||
        compareDates(nextTaskDate(a, today), nextTaskDate(b, today)) ||
        byNr(a, b)
      );
    }

    const dir = ui.sortDir;
    return list.sort((a, b) => {
      let cmp = 0;
      if (ui.sortKey === "company") {
        cmp = collator.compare(a.company, b.company);
      } else if (ui.sortKey === "status") {
        const ia = STATUSES.indexOf(a.status);
        const ib = STATUSES.indexOf(b.status);
        cmp = (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      } else if (ui.sortKey === "createdAt") {
        cmp = String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
      } else if (ui.sortKey === "followUpDate") {
        // Leere Termine immer ans Ende
        const da = nextTaskDate(a, today);
        const db = nextTaskDate(b, today);
        if (!da && !db) cmp = 0;
        else if (!da) return 1;
        else if (!db) return -1;
        else cmp = da.localeCompare(db);
      }
      return cmp * dir || byNr(a, b);
    });
  }

  /* ---------------------------------------------------------
     Rendering
     --------------------------------------------------------- */

  function statusOptions(selected) {
    const values = STATUSES.includes(selected) || !selected ? STATUSES : [selected, ...STATUSES];
    return values
      .map((s) => `<option value="${escapeHTML(s)}"${s === selected ? " selected" : ""}>${escapeHTML(s)}</option>`)
      .join("");
  }

  function toneClass(status) {
    return "tone-" + (STATUS_TONE[status] || "gray");
  }

  function phoneHTML(phone) {
    if (!phone) return `<span class="empty-dash">–</span>`;
    return `<a class="phone-link" href="${escapeHTML(telHref(phone))}" title="Anrufen">${escapeHTML(phone)}</a>`;
  }

  function shortDate(iso) {
    const [, m, d] = iso.split("-");
    return `${d}.${m}.`;
  }

  function followupHTML(lead, today, { compact = true } = {}) {
    const tasks = leadTasks(lead, today);
    if (!tasks.length) return compact ? `<span class="followup followup--none">—</span>` : "";

    const lines = tasks.map((task) => {
      const cls = {
        overdue: " followup--overdue",
        due: " followup--due",
        closed: " followup--closed",
        done: " followup--done"
      }[task.state] || "";
      const hint = task.state === "overdue"
        ? `<span class="followup-hint">nachholen</span>`
        : task.state === "due" ? `<span class="followup-hint">heute</span>`
        : task.state === "done" ? `<span class="followup-hint">✓</span>` : "";
      const shifted = task.info && task.info.shifted ? ` (verschoben: ${task.info.reasons.join(", ")})` : "";
      const doneText = task.done ? ` – erledigt${task.doneOn ? " am " + formatDate(task.doneOn) : ""}` : "";
      const title = `${task.kind === "call" ? "Anruf" : "Follow-up"}: ${Schedule.formatWithWeekday(task.date)}${shifted}${doneText}`;
      return `<span class="followup followup--task${cls}" title="${escapeHTML(title)}"><span class="followup-tag">${task.label}</span>${shortDate(task.date)}${hint}</span>`;
    });
    return `<div class="followup-stack">${lines.join("")}</div>`;
  }

  /** compact = Tabelle (nur Label), sonst Label + Domain (Mobile). */
  function webLinksHTML(lead, compact = false) {
    const link = (url, label, cls) =>
      `<a class="web-link ${cls}" href="${escapeHTML(url)}" target="_blank" rel="noopener" title="${escapeHTML(label)}: ${escapeHTML(url)}">` +
      (compact
        ? `${escapeHTML(label)} <span aria-hidden="true">↗</span>`
        : `<span class="web-link__label">${escapeHTML(label)}</span>${escapeHTML(displayUrl(url))}`) +
      `</a>`;
    const links = [];
    if (lead.website) links.push(link(lead.website, compact ? "Aktuell" : "Aktuell", "web-link--current"));
    if (lead.draftUrl) links.push(link(lead.draftUrl, "Entwurf", "web-link--draft"));
    if (needsDraft(lead)) links.push(`<span class="draft-missing">Entwurf machen</span>`);
    return links.join("");
  }

  function rowHTML(lead, nr, today) {
    return `
      <tr data-id="${escapeHTML(lead.id)}">
        <td class="col-nr">${pad(nr)}</td>
        <td>
          <div class="company">${escapeHTML(lead.company)}</div>
          ${lead.contact ? `<div class="contact">${escapeHTML(lead.contact)}</div>` : ""}
          ${ui.sortKey === "createdAt" && lead.createdAt ? `<div class="contact added-on">hinzugefügt ${escapeHTML(formatDateTime(lead.createdAt).split(",")[0])}</div>` : ""}
        </td>
        <td>${phoneHTML(lead.phone)}</td>
        <td>${lead.website || lead.draftUrl || needsDraft(lead) ? `<div class="web-links">${webLinksHTML(lead, true)}</div>` : `<span class="empty-dash">–</span>`}</td>
        <td>
          <label class="sr-only" for="st-${escapeHTML(lead.id)}">Status für ${escapeHTML(lead.company)}</label>
          <select id="st-${escapeHTML(lead.id)}" class="status-select ${toneClass(lead.status)}" data-action="status">${statusOptions(lead.status)}</select>
        </td>
        <td>${followupHTML(lead, today)}</td>
        <td>${lead.notes ? `<div class="notes-preview">${escapeHTML(lead.notes)}</div>` : `<span class="empty-dash">–</span>`}</td>
        <td><button type="button" class="row-menu-btn" data-action="menu" aria-haspopup="true" aria-expanded="false" aria-label="Aktionen für ${escapeHTML(lead.company)}">⋯</button></td>
      </tr>`;
  }

  function itemHTML(lead, today) {
    const date = followupHTML(lead, today, { compact: false });
    const phone = lead.phone ? phoneHTML(lead.phone) : "";
    const meta = date || phone ? `<div class="lead-item__meta">${date}${phone}</div>` : "";
    return `
      <li class="lead-item" data-id="${escapeHTML(lead.id)}" tabindex="0">
        <div class="company">${escapeHTML(lead.company)}</div>
        ${lead.contact ? `<div class="contact">${escapeHTML(lead.contact)}</div>` : ""}
        ${ui.sortKey === "createdAt" && lead.createdAt ? `<div class="contact added-on">hinzugefügt ${escapeHTML(formatDateTime(lead.createdAt).split(",")[0])}</div>` : ""}
        <div class="lead-item__status"><span class="status-pill ${toneClass(lead.status)}">${escapeHTML(lead.status)}</span></div>
        ${meta}
        ${lead.website || lead.draftUrl || needsDraft(lead) ? `<div class="lead-item__web">${webLinksHTML(lead)}</div>` : ""}
        ${lead.notes ? `<p class="notes-preview">${escapeHTML(lead.notes)}</p>` : ""}
      </li>`;
  }

  function renderSummary(leads) {
    const today = todayISO();
    const open = leads.filter((l) => l.status === "Anrufen").length;
    const noDraft = leads.filter(needsDraft).length;
    const callbacks = leads.filter((l) => CALLBACK_STATUSES.has(l.status)).length;
    const todayTasks = collectTodayTasks(leads, today);
    const due = todayTasks.due.length;
    const overdue = todayTasks.overdue.length;

    let html = `
      <span><strong>${leads.length}</strong> Leads</span>
      <span><strong>${open}</strong> anrufen</span>
      <button type="button" class="summary-link" data-summary="nodraft"><strong>${noDraft}</strong> Entwurf machen</button>
      <span><strong>${callbacks}</strong> ${callbacks === 1 ? "Rückruf" : "Rückrufe"}</span>
      <span class="${due ? "is-due" : ""}"><strong>${due}</strong> ${due === 1 ? "Aufgabe" : "Aufgaben"} heute</span>`;
    if (overdue) html += `<span class="is-overdue"><strong>${overdue}</strong> nachholen</span>`;
    els.summary.innerHTML = html;
  }

  /* ---------- Tages-To-do-Liste ---------- */

  function todoItemHTML({ lead, task }, today) {
    const isCall = task.kind === "call";
    const action = isCall ? "anrufen" : "Follow-up";
    let when = "";
    if (task.state === "overdue") {
      const days = Schedule.daysBetween(task.date, today);
      when = `<span class="todo__when todo__when--overdue">${days === 1 ? "seit gestern" : `seit ${formatDate(task.date)} · ${days} Tage`}</span>`;
    } else if (task.done) {
      when = `<span class="todo__when">erledigt</span>`;
    }
    const origin = isCall && lead.draftSentDate ? `Entwurf vom ${shortDate(lead.draftSentDate)}` : "";
    const notes = String(lead.notes || "").replace(/\s+/g, " ").trim();
    return `
      <li class="todo${task.done ? " is-done" : ""}" data-id="${escapeHTML(lead.id)}" data-kind="${task.kind}">
        <button type="button" class="todo__check" data-action="toggle-task" role="checkbox" aria-checked="${task.done}"
          aria-label="${escapeHTML(lead.company)} ${action} – ${task.done ? "als offen markieren" : "abhaken"}"></button>
        <div class="todo__main">
          <div class="todo__title"><span class="todo__company">${escapeHTML(lead.company)}</span> <span class="todo__action">${action}</span>${when}</div>
          <div class="todo__meta">
            ${lead.phone ? `<a class="phone-link" href="${escapeHTML(telHref(lead.phone))}">${escapeHTML(lead.phone)}</a>` : `<span class="empty-dash">keine Nummer</span>`}
            ${origin ? `<span>${origin}</span>` : ""}
            ${notes ? `<span class="todo__notes">${escapeHTML(notes)}</span>` : ""}
          </div>
        </div>
      </li>`;
  }

  function renderToday(leads) {
    const today = todayISO();
    const { overdue, due, doneToday } = collectTodayTasks(leads, today);
    const openCount = overdue.length + due.length;

    const group = (title, items, cls = "") =>
      items.length
        ? `<div class="today__group ${cls}"><h3 class="today__label">${title} <span>${items.length}</span></h3><ul class="todo-list">${items.map((e) => todoItemHTML(e, today)).join("")}</ul></div>`
        : "";

    let body = group("Nachholen", overdue, "today__group--overdue") + group("Heute", due);
    if (!openCount) body = `<p class="today__empty">${doneToday.length ? "Alles erledigt für heute. 👍" : "Heute steht nichts an."}</p>`;
    body += group("Heute erledigt", doneToday, "today__group--done");

    els.today.innerHTML = `
      <header class="today__head">
        <h2>Heute zu tun</h2>
        <span class="today__date">${Schedule.formatWithWeekday(today)}</span>
        ${openCount ? `<span class="today__count">${openCount} offen</span>` : ""}
      </header>
      ${body}`;
  }

  async function toggleTask(leadId, kind) {
    const lead = getLead(leadId);
    if (!lead) return;
    const today = todayISO();
    const task = leadTasks(lead, today).find((t) => t.kind === kind);
    if (!task) return;
    const done = !task.done;
    const label = kind === "call" ? "Anruf" : "Follow-up";
    await quickUpdate(leadId, Schedule.doneUpdates(lead, kind, done, today),
      () => done ? `${label} bei „${lead.company}“ abgehakt` : `${label} bei „${lead.company}“ wieder offen`);
  }

  function updateSortIndicators() {
    if (els.sortSelect) {
      const v = ui.sortKey ? `${ui.sortKey}:${ui.sortDir}` : "";
      els.sortSelect.value = [...els.sortSelect.options].some((o) => o.value === v) ? v : "";
    }
    els.sortBtns.forEach((btn) => {
      const active = btn.dataset.sort === ui.sortKey;
      btn.querySelector(".sort-ind").textContent = active ? (ui.sortDir === 1 ? "▲" : "▼") : "";
      btn.closest("th").setAttribute("aria-sort", active ? (ui.sortDir === 1 ? "ascending" : "descending") : "none");
    });
  }

  function renderLeads() {
    if (document.body.classList.contains("is-locked")) return;
    const all = getLeads();
    const today = todayISO();
    const nrMap = new Map(all.map((l, i) => [l.id, i + 1]));
    const visible = sortLeads(filterLeads(all), nrMap);

    renderSummary(all);
    renderToday(all);
    els.tbody.innerHTML = visible.map((l) => rowHTML(l, nrMap.get(l.id), today)).join("");
    els.list.innerHTML = visible.map((l) => itemHTML(l, today)).join("");

    const isEmpty = visible.length === 0;
    document.querySelector(".table-wrap").hidden = isEmpty;
    els.list.hidden = isEmpty;
    els.empty.hidden = !isEmpty;
    els.empty.textContent = !cache.loaded
      ? "Lade Leads …"
      : all.length
      ? "Keine Leads für diese Suche oder diesen Filter."
      : "Noch keine Leads – über „+ Lead hinzufügen“ den ersten anlegen.";

    updateSortIndicators();
  }

  /* ---------------------------------------------------------
     Toast
     --------------------------------------------------------- */

  let toastTimer = null;

  function showToast(message, isError = false, duration = 2200) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.toggle("is-error", isError);
    els.toast.hidden = false;
    requestAnimationFrame(() => els.toast.classList.add("is-visible"));
    toastTimer = setTimeout(() => {
      els.toast.classList.remove("is-visible");
      setTimeout(() => { els.toast.hidden = true; }, 220);
    }, duration);
  }

  /* ---------------------------------------------------------
     Bestätigungsdialog (Promise-basiert)
     --------------------------------------------------------- */

  function confirmDialog({ message, detail = "", confirmLabel = "Löschen", cancelLabel = "Abbrechen", danger = true, extraLabel = "", dateValue = null }) {
    return new Promise((resolve) => {
      els.confirm.dataset.cancelled = "";
      const extra = document.getElementById("confirmExtra");
      const dateInput = document.getElementById("confirmDate");
      extra.hidden = !extraLabel;
      extra.textContent = extraLabel;
      extra.onclick = () => closeConfirm("extra");
      dateInput.hidden = dateValue === null;
      if (dateValue !== null) dateInput.value = dateValue;
      ui.confirmResolve = resolve;
      els.confirmText.textContent = message;
      els.confirmDetail.textContent = detail;
      els.confirmDetail.hidden = !detail;
      els.confirmOk.textContent = confirmLabel;
      els.confirmCancel.textContent = cancelLabel;
      els.confirmOk.className = "btn " + (danger ? "btn--danger" : "btn--primary");
      els.confirm.hidden = false;
      els.confirmCancel.focus();
    });
  }

  function closeConfirm(result) {
    if (!ui.confirmResolve) return;
    els.confirm.hidden = true;
    const resolve = ui.confirmResolve;
    ui.confirmResolve = null;
    resolve(result);
  }

  /* ---------------------------------------------------------
     Sidepanel
     --------------------------------------------------------- */

  function formValues() {
    const fd = new FormData(els.form);
    const out = {};
    EDITABLE_FIELDS.forEach((key) => { out[key] = String(fd.get(key) ?? ""); });
    out.company = out.company.trim();
    out.contact = out.contact.trim();
    out.phone = out.phone.trim();
    out.website = normalizeUrl(out.website);
    out.draftUrl = normalizeUrl(out.draftUrl);
    return out;
  }

  function isDirty() {
    return ui.panelOpen && JSON.stringify(formValues()) !== ui.snapshot;
  }

  function setFieldError(show) {
    els.companyError.hidden = !show;
    els.fCompany.classList.toggle("is-invalid", show);
    els.fCompany.setAttribute("aria-invalid", show ? "true" : "false");
  }

  /** Werte des Formulars als „Lead“ für die Aufgabenlogik. */
  function formLead() {
    const f = els.form.elements;
    return {
      status: f.status.value,
      draftSentDate: f.draftSentDate.value,
      followUpDate: f.followUpDate.value,
      callDoneFor: f.callDoneFor.value,
      callDoneOn: f.callDoneOn.value,
      followUpDoneFor: f.followUpDoneFor.value,
      followUpDoneOn: f.followUpDoneOn.value
    };
  }

  /** Anruftermin + Häkchen im Panel live anzeigen. */
  function renderAutoDates() {
    const today = todayISO();
    const lead = formLead();
    const tasks = leadTasks(lead, today);
    const call = tasks.find((t) => t.kind === "call");
    const manual = tasks.find((t) => t.kind === "manual");

    if (!call) {
      els.autoDates.innerHTML = `<p class="auto-dates__empty">Sobald das Datum gesetzt ist, wird der Anruf automatisch berechnet (5 Tage später, nur Werktage).</p>`;
    } else {
      els.autoDates.innerHTML = `
        <div class="auto-dates__row">
          <span class="auto-dates__label">Anrufen am</span>
          <span class="auto-dates__value">${Schedule.formatWithWeekday(call.date)}</span>
          ${call.info.shifted ? `<span class="auto-dates__note">verschoben wegen ${escapeHTML(call.info.reasons.join(", "))}</span>` : ""}
        </div>
        <label class="done-toggle">
          <input type="checkbox" data-done-kind="call"${call.done ? " checked" : ""}>
          <span>Anruf erledigt${call.done && call.doneOn ? ` <em>(am ${formatDate(call.doneOn)})</em>` : ""}</span>
        </label>`;
    }

    els.followUpDone.innerHTML = manual
      ? `<label class="done-toggle">
          <input type="checkbox" data-done-kind="manual"${manual.done ? " checked" : ""}>
          <span>Follow-up erledigt${manual.done && manual.doneOn ? ` <em>(am ${formatDate(manual.doneOn)})</em>` : ""}</span>
        </label>`
      : "";
  }

  /** Häkchen im Panel → versteckte Felder setzen (gespeichert wird mit „Änderungen speichern“). */
  function onPanelDoneToggle(e) {
    const box = e.target.closest("[data-done-kind]");
    if (!box) return;
    const kind = box.dataset.doneKind;
    const updates = Schedule.doneUpdates(formLead(), kind, box.checked, todayISO());
    Object.entries(updates).forEach(([key, value]) => { els.form.elements[key].value = value; });
    renderAutoDates();
  }

  /* ---------------------------------------------------------
     Lead aus Bild: Screenshot/Foto → Claude liest Firmendaten aus
     --------------------------------------------------------- */

  const IMAGE_HINT_DEFAULT = "Screenshot von Google Maps, Website, Instagram oder Foto einer Visitenkarte. Am Rechner geht auch Einfügen mit Strg/Cmd + V.";

  /** Bild verkleinern (max. 1600 px) und als JPEG-Data-URL zurückgeben. */
  function imageToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad_image")); };
      img.src = url;
    });
  }

  function setImageHint(text, state = "") {
    els.imageHint.textContent = text;
    els.imageHint.dataset.state = state;
  }

  /* Kostenlose Variante: Texterkennung direkt im Browser (Tesseract, liegt unter /vendor). */
  let ocrWorkerPromise = null;
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src; el.onload = resolve; el.onerror = () => reject(new Error("ocr_load"));
      document.head.appendChild(el);
    });
  }
  async function ocrWorker() {
    if (!ocrWorkerPromise) {
      ocrWorkerPromise = (async () => {
        if (!window.Tesseract) await loadScript("/vendor/tesseract/tesseract.min.js");
        return window.Tesseract.createWorker("deu", 1, {
          workerPath: "/vendor/tesseract/worker.min.js",
          corePath: "/vendor/tesseract/core",
          langPath: "/vendor/tesseract/lang",
          gzip: true
        });
      })().catch((e) => { ocrWorkerPromise = null; throw e; });
    }
    return ocrWorkerPromise;
  }

  /** Aus erkanntem Text Firma, Telefon, Website und Notizen herausfiltern. */
  function parseLeadText(lines) {
    const clean = lines
      .map((l) => ({ text: String(l.text || "").replace(/[|_—–]+/g, " ").replace(/\s+/g, " ").trim(), h: l.h || 0, y: l.y || 0 }))
      .filter((l) => l.text.length >= 2);
    const all = clean.map((l) => l.text).join("\n");

    const email = (all.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [""])[0];
    let phone = "";
    for (const m of all.matchAll(/(?:\+49|0049|\(?0)[\d\s/().-]{6,}\d/g)) {
      const digits = m[0].replace(/\D/g, "");
      if (digits.length >= 8 && digits.length <= 15) { phone = m[0].replace(/\s+/g, " ").trim(); break; }
    }
    const IGNORE = /google|gstatic|maps\.app|goo\.gl|instagram\.com|facebook\.com|apple\.com|whatsapp/i;
    let website = "";
    const withoutMail = all.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, " ");
    for (const m of withoutMail.matchAll(/(?:https?:\/\/)?(?:www\.)?[a-z0-9äöü][a-z0-9äöü-]{1,62}(?:\.[a-z0-9-]{2,})*\.(?:de|com|net|org|eu|info|biz|shop|online|site|app|io|at|ch|berlin|hamburg|gmbh)\b(?:\/[^\s]*)?/gi)) {
      if (IGNORE.test(m[0])) continue;
      website = m[0].replace(/[.,;:)]+$/, "");
      if (!/^https?:\/\//i.test(website)) website = "https://" + website.replace(/^\/+/, "");
      break;
    }

    // Firma: größte Schrift, die nach einem Namen aussieht (keine Uhrzeit, Nummer, Adresse, Bewertung)
    const NOT_NAME = /^(\d{1,2}[:.]\d{2}|\d+\s*%|\d{5}\b)|@|https?:|www\.|\.(de|com)\b|^(geöffnet|geschlossen|route|anrufen|website|teilen|speichern|bewertungen|übersicht|info|fotos|in der nähe)/i;
    const candidates = clean.filter((l) => /[A-Za-zÄÖÜäöüß]{3,}/.test(l.text) && !NOT_NAME.test(l.text) && !(phone && l.text.includes(phone)) && l.text.length <= 70);
    const company = (candidates.slice().sort((a, b) => b.h - a.h || a.y - b.y)[0] || { text: "" }).text.replace(/[^\wÄÖÜäöüß&.,'´\-+()\s]/g, "").trim();

    const notes = [];
    const address = clean.find((l) => /\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]/.test(l.text) || /(straße|str\.|weg|platz|allee|ring|damm)\s*\d/i.test(l.text));
    if (address) notes.push(address.text);
    const rating = all.match(/\b([1-5][,.]\d)\s*(?:★|\*|\()/);
    if (rating) notes.push(`Bewertung ${rating[1].replace(".", ",")} ★`);
    if (email) notes.push(email);
    return { company, contact: "", phone, website, notes: notes.join(" · ") };
  }

  async function extractLocally(image) {
    setImageHint("Texterkennung im Browser … (beim ersten Mal ca. 10 Sekunden)", "busy");
    const worker = await ocrWorker();
    const { data } = await worker.recognize(image);
    const lines = (data.lines || []).map((l) => ({ text: l.text, h: l.bbox ? l.bbox.y1 - l.bbox.y0 : 0, y: l.bbox ? l.bbox.y0 : 0 }));
    const info = parseLeadText(lines.length ? lines : String(data.text || "").split("\n").map((t) => ({ text: t })));
    if (!info.company && !info.phone && !info.website) { const e = new Error("nothing_found"); e.data = { error: "nothing_found" }; throw e; }
    return info;
  }

  async function importFromImage(file) {
    if (!file || !/^image\//.test(file.type)) return;
    els.imageBtn.disabled = true;
    setImageHint("Bild wird gelesen …", "busy");
    try {
      const image = await imageToDataUrl(file);
      // Mit Claude-Schlüssel genauer; ohne Schlüssel kostenlos im Browser
      let info;
      try {
        info = await api("POST", "/extract", { image });
      } catch (err) {
        if (err && err.data && err.data.error === "no_api_key") info = await extractLocally(image);
        else throw err;
      }
      const form = els.form.elements;
      const filled = [];
      const set = (name, value, label) => {
        if (!value) return;
        const el = form[name];
        if (el.value.trim() && name !== "notes") return; // Eingetragenes nicht überschreiben
        el.value = name === "notes" && el.value.trim() ? `${el.value.trim()}\n${value}` : value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        filled.push(label);
      };
      set("company", info.company, "Firma");
      set("contact", info.contact, "Ansprechpartner");
      set("phone", info.phone, "Telefon");
      set("website", info.website, "Website");
      set("notes", info.notes, "Notizen");
      if (filled.length) {
        setImageHint(`✓ Übernommen: ${filled.join(", ")}. Bitte kurz prüfen und speichern.`, "ok");
      } else {
        setImageHint("Im Bild wurden keine neuen Firmendaten gefunden.", "error");
      }
    } catch (err) {
      const code = err && err.data && err.data.error;
      const msg = code === "nothing_found" ? "Im Bild wurden keine Firmendaten gefunden."
        : code === "image_too_large" ? "Das Bild ist zu groß."
        : err && err.status === 0 ? "Keine Verbindung – bitte später nochmal."
        : err && err.message === "bad_image" ? "Das Bild konnte nicht geöffnet werden."
        : err && err.message === "ocr_load" ? "Texterkennung konnte nicht geladen werden – Internetverbindung prüfen."
        : "Auslesen hat nicht geklappt – bitte nochmal versuchen.";
      setImageHint(msg, "error");
    } finally {
      els.imageBtn.disabled = false;
      els.imageInput.value = "";
    }
  }

  /** Statuswerte vor dem Entwurf – beim Setzen des Datums auf „Entwurf gesendet“ vorschlagen. */
  const PRE_DRAFT_STATUSES = new Set(["Anrufen", "Rückruf vereinbart", "Termin vereinbart", "Entwurf in Arbeit"]);

  function updateWebsiteSearchLink() {
    const company = els.fCompany.value.trim();
    els.websiteSearchLink.hidden = !company;
    els.websiteSearchLink.href = "https://www.google.com/search?q=" + encodeURIComponent(company + " Website");
  }

  function openPanel(lead = null, { focus = "company" } = {}) {
    closeRowMenu();
    document.dispatchEvent(new CustomEvent("aufwind:panel-open", { detail: { lead } }));
    setImageHint(IMAGE_HINT_DEFAULT);
    ui.editingId = lead ? lead.id : null;
    ui.lastFocus = document.activeElement;

    const data = lead || { company: "", contact: "", phone: "", website: "", draftUrl: "", status: "Anrufen", followUpDate: "", draftSentDate: "", callDoneFor: "", callDoneOn: "", followUpDoneFor: "", followUpDoneOn: "", notes: "" };

    els.fStatus.innerHTML = statusOptions(data.status);
    els.form.elements.company.value = data.company;
    els.form.elements.contact.value = data.contact;
    els.form.elements.phone.value = data.phone;
    els.form.elements.website.value = data.website;
    els.form.elements.draftUrl.value = data.draftUrl;
    updateWebsiteSearchLink();
    els.form.elements.status.value = data.status;
    els.form.elements.followUpDate.value = data.followUpDate;
    els.form.elements.draftSentDate.value = data.draftSentDate;
    ["callDoneFor", "callDoneOn", "followUpDoneFor", "followUpDoneOn"].forEach((k) => {
      els.form.elements[k].value = data[k] || "";
    });
    renderAutoDates();
    els.form.elements.notes.value = data.notes;
    setFieldError(false);

    els.panelTitle.textContent = lead ? lead.company || "Lead bearbeiten" : "Lead hinzufügen";
    els.saveBtn.textContent = lead ? "Änderungen speichern" : "Lead speichern";
    els.deleteBtn.hidden = !lead;
    els.panelMeta.textContent = lead
      ? `Angelegt ${formatDateTime(lead.createdAt)} · Zuletzt geändert ${formatDateTime(lead.updatedAt)}`
      : "";

    ui.snapshot = JSON.stringify(formValues());
    ui.panelOpen = true;

    els.overlay.hidden = false;
    els.panel.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
    requestAnimationFrame(() => {
      els.overlay.classList.add("is-visible");
      els.panel.classList.add("is-open");
    });

    // Fokus nach dem Einblenden setzen
    setTimeout(() => {
      const target = focus === "followUpDate" ? els.fDate : els.fCompany;
      target.focus({ preventScroll: true });
      if (focus === "followUpDate" && typeof target.showPicker === "function") {
        try { target.showPicker(); } catch (e) { /* nicht überall erlaubt */ }
      }
    }, 120);
  }

  async function closePanel({ force = false } = {}) {
    if (!ui.panelOpen) return;
    if (!force && isDirty()) {
      const discard = await confirmDialog({ message: "Änderungen verwerfen?", confirmLabel: "Verwerfen" });
      if (!discard) return;
    }
    ui.panelOpen = false;
    ui.editingId = null;
    els.panel.classList.remove("is-open");
    els.overlay.classList.remove("is-visible");
    els.panel.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
    setTimeout(() => { if (!ui.panelOpen) els.overlay.hidden = true; }, 300);
    if (ui.lastFocus && document.contains(ui.lastFocus)) {
      ui.lastFocus.focus({ preventScroll: true });
    }
  }

  /** Konflikt: jemand anderes hat den Lead inzwischen geändert. */
  async function resolveConflict(id, values, serverLead) {
    const overwrite = await confirmDialog({
      message: `„${serverLead.company}“ wurde inzwischen von jemand anderem geändert.`,
      detail: "Deine Änderungen trotzdem speichern und den anderen Stand überschreiben?",
      confirmLabel: "Meine speichern",
      cancelLabel: "Anderen Stand behalten",
      danger: false
    });
    if (!overwrite) {
      showToast("Aktueller Stand übernommen");
      return;
    }
    try {
      const res = await updateLead(id, values, { force: true });
      if (res.notFound) showToast("Der Lead wurde inzwischen gelöscht.", true, 4000);
      else showToast("Änderungen gespeichert");
    } catch (err) {
      showSaveError(err);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    const values = formValues();
    if (!values.company) {
      setFieldError(true);
      els.fCompany.focus();
      return;
    }

    const editingId = ui.editingId;
    closePanel({ force: true });

    try {
      if (editingId) {
        const res = await updateLead(editingId, values);
        if (res.conflict) await resolveConflict(editingId, values, res.serverLead);
        else if (res.notFound) showToast("Der Lead wurde inzwischen von jemand anderem gelöscht.", true, 4000);
        else showToast("Änderungen gespeichert");
      } else {
        await addLead(values);
        showToast("Lead gespeichert");
      }
    } catch (err) {
      showSaveError(err);
      // Eingaben nicht verlieren: Panel mit den Werten wieder öffnen
      const lead = editingId ? getLead(editingId) : null;
      if (!editingId || lead) {
        openPanel(lead ? { ...lead, ...values } : null);
        if (!lead) Object.entries(values).forEach(([k, v]) => { if (els.form.elements[k]) els.form.elements[k].value = v; });
        ui.snapshot = "__unsaved__"; // gilt als ungespeichert
      }
    }
  }

  async function confirmAndDelete(id) {
    const lead = getLead(id);
    if (!lead) return false;
    const ok = await confirmDialog({ message: `„${lead.company}“ wirklich löschen?` });
    if (!ok) return false;
    try {
      await deleteLead(id);
      showToast("Lead gelöscht");
      return true;
    } catch (err) {
      showSaveError(err);
      return false;
    }
  }

  /** Schnelle Änderung (Status, erledigt) direkt aus der Liste. */
  async function quickUpdate(id, updates, successMessage) {
    try {
      const res = await updateLead(id, updates);
      if (res.conflict) showToast("Inzwischen von jemand anderem geändert – aktueller Stand geladen.", true, 4000);
      else if (res.notFound) showToast("Der Lead wurde inzwischen gelöscht.", true, 4000);
      else showToast(successMessage(res.lead));
    } catch (err) {
      showSaveError(err);
    }
  }

  /* ---------------------------------------------------------
     Zeilen-Menü (…)
     --------------------------------------------------------- */

  function openRowMenu(trigger, leadId) {
    if (ui.menuLeadId === leadId && !els.rowMenu.hidden) {
      closeRowMenu();
      return;
    }
    closeRowMenu();
    closeDataMenu();
    ui.menuLeadId = leadId;
    ui.menuTrigger = trigger;
    trigger.setAttribute("aria-expanded", "true");

    const menu = els.rowMenu;
    menu.hidden = false;
    const rect = trigger.getBoundingClientRect();
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    let top = rect.bottom + 4;
    if (top + mh > window.innerHeight - 8) top = rect.top - mh - 4;
    const left = Math.max(8, Math.min(rect.right - mw, window.innerWidth - mw - 8));
    menu.style.top = `${Math.max(8, top)}px`;
    menu.style.left = `${left}px`;
    menu.querySelector("button").focus({ preventScroll: true });
  }

  function closeRowMenu() {
    if (els.rowMenu.hidden) return;
    els.rowMenu.hidden = true;
    if (ui.menuTrigger) ui.menuTrigger.setAttribute("aria-expanded", "false");
    ui.menuLeadId = null;
    ui.menuTrigger = null;
  }

  async function handleRowAction(action) {
    const id = ui.menuLeadId;
    closeRowMenu();
    const lead = id && getLead(id);
    if (!lead) return;

    if (action === "edit") openPanel(lead);
    if (action === "followup") openPanel(lead, { focus: "followUpDate" });
    if (action === "done") {
      quickUpdate(id, { status: "Abgelehnt" }, () => `„${lead.company}“ als abgelehnt markiert`);
    }
    if (action === "delete") confirmAndDelete(id);
  }

  /* ---------------------------------------------------------
     Daten-Menü: Export / Import
     --------------------------------------------------------- */

  function toggleDataMenu() {
    const open = els.dataMenu.hidden;
    closeRowMenu();
    els.dataMenu.hidden = !open;
    els.dataBtn.setAttribute("aria-expanded", String(open));
  }

  function closeDataMenu() {
    els.dataMenu.hidden = true;
    els.dataBtn.setAttribute("aria-expanded", "false");
  }

  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJSON() {
    const leads = getLeads();
    const payload = {
      app: "aufwind-lead-manager",
      version: 1,
      exportedAt: new Date().toISOString(),
      leads
    };
    downloadFile(JSON.stringify(payload, null, 2), `aufwind-leads-${todayISO()}.json`, "application/json");
    showToast(`${leads.length} Leads als JSON exportiert`);
  }

  function csvCell(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function exportCSV() {
    const leads = getLeads();
    const header = ["Firma", "Ansprechpartner", "Telefon", "Aktuelle Website", "Unser Entwurf", "Status", "Follow-up", "Follow-up erledigt", "Entwurf verschickt", "Anruf", "Anruf erledigt", "Notizen"];
    const rows = leads.map((l) => {
      const tasks = leadTasks(l);
      const call = tasks.find((t) => t.kind === "call");
      const manual = tasks.find((t) => t.kind === "manual");
      return [l.company, l.contact, l.phone, l.website, l.draftUrl, l.status, formatDate(l.followUpDate),
        manual && manual.done ? formatDate(manual.doneOn) || "ja" : "",
        formatDate(l.draftSentDate), call ? formatDate(call.date) : "", call && call.done ? formatDate(call.doneOn) || "ja" : "", l.notes];
    });
    // Semikolon + BOM: öffnet sauber in deutschem Excel/Numbers
    const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
    downloadFile(csv, `aufwind-leads-${todayISO()}.csv`, "text/csv;charset=utf-8");
    showToast(`${leads.length} Leads als CSV exportiert`);
  }

  async function importJSON(file) {
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (e) {
      showToast("Die Datei ist kein gültiges JSON.", true, 3500);
      return;
    }

    const list = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.leads) ? parsed.leads : null;
    if (!list) {
      showToast("Keine Leadliste in der Datei gefunden.", true, 3500);
      return;
    }

    const seen = new Set();
    const leads = list
      .filter((x) => x && typeof x === "object" && String(x.company ?? "").trim())
      .map(normalizeLead)
      .map((l) => {
        if (seen.has(l.id)) l.id = uid();
        seen.add(l.id);
        return l;
      });

    if (!leads.length) {
      showToast("Die Datei enthält keine gültigen Leads.", true, 3500);
      return;
    }

    const current = getLeads().length;
    const ok = await confirmDialog({
      message: `${leads.length} Leads importieren?`,
      detail: `Die gemeinsame Liste (${current} Leads) wird für alle ersetzt. Tipp: vorher als JSON exportieren.`,
      confirmLabel: "Importieren",
      danger: false
    });
    if (!ok) return;

    try {
      await replaceAllLeads(leads);
      showToast(`${leads.length} Leads importiert`);
    } catch (err) {
      showSaveError(err);
    }
  }

  /* ---------------------------------------------------------
     Events
     --------------------------------------------------------- */

  function leadIdFrom(el) {
    const host = el.closest("[data-id]");
    return host ? host.dataset.id : null;
  }

  function bindEvents() {
    // Suche & Filter
    els.search.addEventListener("input", renderLeads);
    els.statusFilter.addEventListener("change", renderLeads);
    els.draftFilter.addEventListener("change", renderLeads);
    // Klick auf „X Entwurf machen“ in der Übersicht → Kategorie anzeigen (erneut klicken → alle)
    document.addEventListener("click", (e) => {
      if (!e.target.closest('[data-summary="nodraft"]')) return;
      els.draftFilter.value = els.draftFilter.value === "missing" ? "" : "missing";
      renderLeads();
    });
    els.followFilter.addEventListener("change", renderLeads);

    // Sortierung per Auswahlfeld (wird pro Gerät gemerkt)
    els.sortSelect.addEventListener("change", () => {
      const [key, dir] = els.sortSelect.value.split(":");
      ui.sortKey = key || null;
      ui.sortDir = Number(dir) || 1;
      try { localStorage.setItem("aufwind-sort", els.sortSelect.value); } catch (e) { /* egal */ }
      renderLeads();
    });

    // Sortierung: auf → ab → Standard
    els.sortBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.sort;
        if (ui.sortKey !== key) { ui.sortKey = key; ui.sortDir = 1; }
        else if (ui.sortDir === 1) { ui.sortDir = -1; }
        else { ui.sortKey = null; ui.sortDir = 1; }
        renderLeads();
      });
    });

    // Neuer Lead
    els.addBtn.addEventListener("click", () => openPanel());
    els.fab.addEventListener("click", () => openPanel());

    // Lead aus Bild
    els.imageBtn.addEventListener("click", () => els.imageInput.click());
    els.imageInput.addEventListener("change", () => importFromImage(els.imageInput.files[0]));
    els.addFromImageBtn.addEventListener("click", () => { openPanel(); els.imageInput.click(); });
    document.addEventListener("paste", (e) => {
      if (!ui.panelOpen) return;
      const item = [...(e.clipboardData ? e.clipboardData.items : [])].find((i) => i.type.startsWith("image/"));
      if (!item) return;
      e.preventDefault();
      importFromImage(item.getAsFile());
    });

    // Tabelle
    els.tbody.addEventListener("click", (e) => {
      const id = leadIdFrom(e.target);
      if (!id) return;
      if (e.target.closest("a, select, label")) return; // Anruf-Link & Status-Select
      const actionEl = e.target.closest("[data-action]");
      if (actionEl && actionEl.dataset.action === "menu") {
        e.stopPropagation();
        openRowMenu(actionEl, id);
        return;
      }
      const lead = getLead(id);
      if (lead) openPanel(lead);
    });

    els.tbody.addEventListener("change", (e) => {
      const select = e.target.closest('select[data-action="status"]');
      if (!select) return;
      const id = leadIdFrom(select);
      quickUpdate(id, { status: select.value }, (l) => `Status: ${l.status}`);
    });

    // Mobile-Liste
    els.list.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      const id = leadIdFrom(e.target);
      const lead = id && getLead(id);
      if (lead) openPanel(lead);
    });
    els.list.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.target.closest("a")) return;
      const id = leadIdFrom(e.target);
      const lead = id && getLead(id);
      if (lead) openPanel(lead);
    });

    // Zeilen-Menü
    els.rowMenu.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-row-action]");
      if (btn) handleRowAction(btn.dataset.rowAction);
    });

    // Daten-Menü
    els.dataBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleDataMenu(); });
    els.dataMenu.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-data]");
      if (!btn) return;
      closeDataMenu();
      const action = btn.dataset.data;
      if (action === "export-json") exportJSON();
      if (action === "export-csv") exportCSV();
      if (action === "import-json") els.importInput.click();
    });
    els.importInput.addEventListener("change", async () => {
      const file = els.importInput.files && els.importInput.files[0];
      if (file) await importJSON(file);
      els.importInput.value = "";
    });

    // Klick außerhalb schließt Menüs
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#rowMenu, [data-action='menu']")) closeRowMenu();
      if (!e.target.closest("#dataDropdown")) closeDataMenu();
    });
    window.addEventListener("resize", closeRowMenu);
    window.addEventListener("scroll", closeRowMenu, true);

    // Panel
    els.form.addEventListener("submit", handleSave);
    els.cancelBtn.addEventListener("click", () => closePanel());
    els.closeBtn.addEventListener("click", () => closePanel());
    els.overlay.addEventListener("click", () => closePanel());
    els.fCompany.addEventListener("input", () => {
      if (els.fCompany.value.trim()) setFieldError(false);
      updateWebsiteSearchLink();
    });
    els.deleteBtn.addEventListener("click", async () => {
      const id = ui.editingId;
      if (!id) return;
      const deleted = await confirmAndDelete(id);
      if (deleted) closePanel({ force: true });
    });

    // Schnellauswahl Follow-up
    els.form.querySelector(".chips:not(.chips--draft)").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-offset]");
      if (!chip) return;
      const offset = chip.dataset.offset;
      els.fDate.value = offset === "clear" ? "" : addDaysISO(Number(offset));
      renderAutoDates();
    });

    // Tages-To-do-Liste: abhaken oder Lead öffnen
    els.today.addEventListener("click", (e) => {
      const item = e.target.closest(".todo");
      if (!item) return;
      if (e.target.closest("a")) return;
      if (e.target.closest('[data-action="toggle-task"]')) {
        toggleTask(item.dataset.id, item.dataset.kind);
        return;
      }
      const lead = getLead(item.dataset.id);
      if (lead) openPanel(lead);
    });

    // Häkchen im Panel
    els.form.addEventListener("change", onPanelDoneToggle);
    els.fDate.addEventListener("change", renderAutoDates);
    els.fDate.addEventListener("input", renderAutoDates);

    // Entwurf verschickt → Termine berechnen, Status vorschlagen
    const onDraftDateChange = () => {
      renderAutoDates();
      if (els.fDraftSent.value && PRE_DRAFT_STATUSES.has(els.fStatus.value)) {
        els.fStatus.value = "Entwurf gesendet";
      }
    };
    els.fDraftSent.addEventListener("input", onDraftDateChange);
    els.fDraftSent.addEventListener("change", onDraftDateChange);
    els.form.querySelector(".chips--draft").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-draft]");
      if (!chip) return;
      const v = chip.dataset.draft;
      els.fDraftSent.value = v === "clear" ? "" : addDaysISO(Number(v));
      onDraftDateChange();
    });

    // Strg/⌘ + Enter speichert
    els.form.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        els.form.requestSubmit();
      }
    });

    // Dialog
    els.confirmOk.addEventListener("click", () => closeConfirm(true));
    els.confirmCancel.addEventListener("click", () => { els.confirm.dataset.cancelled = "button"; closeConfirm(false); });
    els.confirm.addEventListener("click", (e) => { if (e.target === els.confirm) closeConfirm(false); });

    // Escape: Dialog → Menüs → Panel
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!els.confirm.hidden) { closeConfirm(false); return; }
      if (!els.rowMenu.hidden) {
        const trigger = ui.menuTrigger;
        closeRowMenu();
        if (trigger) trigger.focus();
        return;
      }
      if (!els.dataMenu.hidden) { closeDataMenu(); els.dataBtn.focus(); return; }
      if (ui.panelOpen) closePanel();
    });

    // Beim Zurückkehren in den Tab sofort neuen Stand holen (und Fälligkeiten neu berechnen)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        renderLeads();
        poll();
      }
    });
    window.addEventListener("focus", poll);
    window.addEventListener("online", poll);

    // Warnung beim Verlassen mit ungespeicherten Änderungen
    window.addEventListener("beforeunload", (e) => {
      if (isDirty() || pendingOps > 0) { e.preventDefault(); e.returnValue = ""; }
    });
  }

  /* ---------------------------------------------------------
     Start
     --------------------------------------------------------- */

  /* ---------------------------------------------------------
     PIN-Sperre
     --------------------------------------------------------- */

  /* ---------------------------------------------------------
     Deep-Link: /?lead=<id> (z. B. aus einer Push-Nachricht)
     --------------------------------------------------------- */

  function openLeadFromUrl(href = window.location.href) {
    let id = null;
    try { id = new URL(href).searchParams.get("lead"); } catch (e) { id = null; }
    if (!id) return;
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
    if (document.body.classList.contains("is-locked")) return;
    const lead = getLead(id);
    if (lead) {
      if (!ui.panelOpen) openPanel(lead);
    } else {
      showToast("Dieser Lead existiert nicht mehr.", true, 3500);
    }
  }

  /* ---------------------------------------------------------
     Push-Benachrichtigungen
     --------------------------------------------------------- */

  const push = { supported: false, registration: null, subscription: null, busy: false };

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function urlBase64ToUint8Array(base64) {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }

  function deviceName() {
    const ua = navigator.userAgent;
    if (/iphone/i.test(ua)) return "iPhone";
    if (/ipad/i.test(ua)) return "iPad";
    if (/android/i.test(ua)) return "Android";
    if (/mac/i.test(ua)) return "Mac";
    if (/windows/i.test(ua)) return "Windows";
    return "Browser";
  }

  function updatePushButton() {
    const on = Boolean(push.subscription) && Notification.permission === "granted";
    els.pushBtn.hidden = false;
    els.pushBtn.dataset.state = on ? "on" : "off";
    const paused = on && push.pausedUntil && push.pausedUntil > todayISO();
    els.pushBtn.textContent = paused ? `⏸ Push ab ${formatDate(push.pausedUntil).slice(0, 6)}` : on ? "🔔 Push an" : "🔔 Push aktivieren";
  }

  async function initPush() {
    if (push.initialized) return;
    push.initialized = true;
    const canPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

    // iPhone/iPad: Push gibt es nur in der installierten Web-App (Home-Bildschirm)
    if (!canPush) {
      if (isIOS() && !isStandalone()) {
        els.pushBtn.hidden = false;
        els.pushBtn.dataset.state = "off";
        els.pushBtn.textContent = "🔔 Push aktivieren";
        els.pushBtn.addEventListener("click", showIOSInstallHint);
      }
      return;
    }

    push.supported = true;
    try {
      push.registration = await navigator.serviceWorker.register("/sw.js");
      push.subscription = await push.registration.pushManager.getSubscription();
      if (push.subscription) {
        // Abo beim Server auffrischen (falls es dort entfernt wurde)
        api("POST", "/push/subscribe", { subscription: push.subscription.toJSON(), device: deviceName() }).catch(() => {});
      }
    } catch (e) {
      return;
    }
    updatePushButton();
    loadPause();
    els.pushBtn.addEventListener("click", onPushButton);
  }

  function showIOSInstallHint() {
    confirmDialog({
      message: "Push auf dem iPhone einrichten",
      detail: "1. In Safari unten auf „Teilen“ tippen  2. „Zum Home-Bildschirm“ wählen  3. Die App „Anrufliste“ vom Home-Bildschirm öffnen und dort „Push aktivieren“ tippen.",
      confirmLabel: "Verstanden",
      cancelLabel: "Schließen",
      danger: false
    });
  }

  /** Pause dieses Geräts laden (bis Datum keine Erinnerungen). */
  async function loadPause() {
    if (!push.subscription) return "";
    try {
      const r = await api("POST", "/push/pause", { endpoint: push.subscription.endpoint });
      push.pausedUntil = r.pausedUntil || "";
    } catch (e) { push.pausedUntil = ""; }
    updatePushButton();
    return push.pausedUntil;
  }

  function nextMondayISO() {
    const d = new Date();
    const add = ((8 - d.getDay()) % 7) || 7;
    d.setDate(d.getDate() + add);
    return toISODate(d);
  }

  async function onPushButton() {
    if (push.busy) return;
    if (push.subscription && Notification.permission === "granted") {
      const paused = push.pausedUntil && push.pausedUntil > todayISO();
      const answer = await confirmDialog({
        message: paused ? `Push auf diesem Gerät pausiert bis ${formatDate(push.pausedUntil)}.` : "Push-Benachrichtigungen sind auf diesem Gerät aktiv.",
        detail: paused
          ? "Ab diesem Tag kommen die Erinnerungen wieder. Andere Geräte (z. B. dein Partner) sind nicht betroffen."
          : "Erinnerungen kommen ab 8 Uhr am Tag des Anrufs oder eines gesetzten Follow-ups – und an jedem folgenden Werktag erneut, bis die Aufgabe abgehakt ist.",
        confirmLabel: "Test senden",
        extraLabel: paused ? "Pause beenden" : "Pausieren …",
        cancelLabel: "Ausschalten",
        danger: false
      });
      if (answer === "extra") {
        if (paused) { await setPausePush(""); return; }
        const ok = await confirmDialog({
          message: "Erinnerungen auf diesem Gerät pausieren",
          detail: "Wieder senden ab:",
          dateValue: nextMondayISO(),
          confirmLabel: "Pausieren",
          danger: false
        });
        const until = document.getElementById("confirmDate").value;
        if (ok && until) await setPausePush(until);
        return;
      }
      if (answer === true) await sendTestPush();
      else if (els.confirm.dataset.cancelled === "button") await disablePush();
      return;
    }
    await enablePush();
  }

  async function setPausePush(until) {
    try {
      await api("POST", "/push/pause", { endpoint: push.subscription.endpoint, until });
      push.pausedUntil = until;
      updatePushButton();
      showToast(until ? `Pausiert – Erinnerungen wieder ab ${formatDate(until)}` : "Push wieder aktiv");
    } catch (e) {
      showToast("Pause konnte nicht gespeichert werden.", true);
    }
  }

  async function enablePush() {
    push.busy = true;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        showToast("Benachrichtigungen wurden nicht erlaubt – in den Geräte-Einstellungen änderbar.", true, 5000);
        return;
      }
      const { publicKey } = await api("GET", "/push/key");
      push.subscription = await push.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
      await api("POST", "/push/subscribe", { subscription: push.subscription.toJSON(), device: deviceName() });
      updatePushButton();
      await sendTestPush();
    } catch (err) {
      if (err && err.status === 401) return;
      showToast("Push konnte nicht aktiviert werden.", true, 4000);
    } finally {
      push.busy = false;
    }
  }

  async function disablePush() {
    push.busy = true;
    try {
      if (push.subscription) {
        const endpoint = push.subscription.endpoint;
        await push.subscription.unsubscribe().catch(() => {});
        await api("POST", "/push/unsubscribe", { endpoint }).catch(() => {});
      }
      push.subscription = null;
      updatePushButton();
      showToast("Push auf diesem Gerät ausgeschaltet");
    } finally {
      push.busy = false;
    }
  }

  async function sendTestPush() {
    try {
      const res = await api("POST", "/push/test", { endpoint: push.subscription && push.subscription.endpoint });
      showToast(res.sent ? "Test-Benachrichtigung gesendet" : "Test konnte nicht zugestellt werden.", !res.sent, 3500);
    } catch (err) {
      if (err && err.status !== 401) showToast("Test konnte nicht gesendet werden.", true, 3500);
    }
  }

  // Klick auf eine Benachrichtigung, während die App schon offen ist
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "open-url") openLeadFromUrl(event.data.url);
    });
  }

  let appStarted = false;

  function prepareApp() {
    if (appStarted) return;
    appStarted = true;
    els.statusFilter.insertAdjacentHTML(
      "beforeend",
      STATUSES.map((s) => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join("")
    );
    bindEvents();
  }

  /** PIN mit dem Server prüfen und Daten laden. */
  async function unlockWith(pin, remember = false) {
    setPin(pin, remember);
    els.lockSubmit.disabled = true;
    els.lockSubmit.textContent = "Prüfe …";
    try {
      await refreshFromServer({ force: true });
    } catch (err) {
      if (err.status === 401) {
        pinFailed();
      } else {
        setPin("");
        els.pinError.textContent = err.status === 0
          ? "Server nicht erreichbar – Internetverbindung prüfen."
          : "Server-Fehler – bitte gleich noch einmal versuchen.";
        els.pinError.hidden = false;
        els.pinInput.value = "";
        els.pinInput.focus();
      }
      return;
    } finally {
      els.lockSubmit.disabled = false;
      els.lockSubmit.textContent = "Entsperren";
    }
    prepareApp();
    els.pinError.hidden = true;
    document.body.classList.remove("is-locked");
    setSyncState("ok");
    renderLeads();
    startPolling();
    initPush();
    openLeadFromUrl();
    document.dispatchEvent(new CustomEvent("aufwind:unlocked"));
  }

  function clearSensitiveDom() {
    els.tbody.innerHTML = "";
    els.list.innerHTML = "";
    els.summary.innerHTML = "";
  }

  function showLockScreen() {
    stopPolling();
    closeRowMenu();
    closeDataMenu();
    cache.leads = [];
    cache.version = 0;
    cache.loaded = false;
    clearSensitiveDom();
    document.dispatchEvent(new CustomEvent("aufwind:locked"));
    document.body.classList.add("is-locked");
    els.pinInput.value = "";
    els.pinInput.focus();
  }

  async function lockApp() {
    if (ui.panelOpen) {
      await closePanel();
      if (ui.panelOpen) return; // Verwerfen abgelehnt
    }
    setPin("");
    els.pinError.hidden = true;
    showLockScreen();
  }

  /** Server lehnt den PIN ab (z. B. PIN wurde geändert). */
  function handleUnauthorized() {
    if (document.body.classList.contains("is-locked")) return;
    setPin("");
    if (ui.panelOpen) closePanel({ force: true });
    els.pinError.textContent = "Bitte PIN erneut eingeben.";
    els.pinError.hidden = false;
    showLockScreen();
  }

  function pinFailed() {
    setPin("");
    els.pinError.textContent = "Falscher PIN";
    els.pinError.hidden = false;
    els.pinInput.value = "";
    const card = els.lockForm;
    card.classList.remove("is-shaking");
    void card.offsetWidth;
    card.classList.add("is-shaking");
    els.pinInput.focus();
  }

  function tryUnlock() {
    const pin = els.pinInput.value.trim();
    if (!pin || els.lockSubmit.disabled) return;
    unlockWith(pin, els.rememberPin.checked);
  }

  function initLock() {
    els.lockForm.addEventListener("submit", (e) => { e.preventDefault(); tryUnlock(); });
    els.pinInput.addEventListener("input", () => {
      els.pinInput.value = els.pinInput.value.replace(/\D/g, "").slice(0, 4);
      els.pinError.hidden = true;
      if (els.pinInput.value.length === 4) tryUnlock();
    });
    els.lockBtn.addEventListener("click", lockApp);

    const savedPin = getPin();
    if (savedPin) unlockWith(savedPin);
    else els.pinInput.focus();
  }

  /* Schnittstelle für den Kalender (calendar.js) */
  window.AufwindApp = {
    api,
    getLeads: () => getLeads(),
    openLead: (id) => {
      const lead = getLeads().find((l) => l.id === id);
      if (lead) openPanel(lead);
    },
    toast: showToast,
    escapeHTML,
    todayISO
  };

  initLock();
})();
