/* ==========================================================
   Kalender der Lead-Liste
   - Monatsansicht + „Nächste Termine“
   - Termine anlegen/bearbeiten (mit Lead-Zuordnung)
   - im Lead-Formular: Termine dieses Leads
   - synchronisiert über /api/appointments, Push-Erinnerungen
     verschickt der Server (Vorabend, morgens, 1 Std vorher)
   ========================================================== */
(() => {
  "use strict";

  const App = () => window.AufwindApp;
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (v) => App().escapeHTML(v ?? "");

  const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const POLL_MS = 30000;

  const state = {
    items: [],
    version: 0,
    loaded: false,
    month: null,       // "YYYY-MM"
    selected: null,    // "YYYY-MM-DD" oder null (= nächste Termine)
    editingId: null,
    poll: null,
    panelLead: null
  };

  const panel = $("#calendarPanel");
  const dialog = $("#apptDialog");
  const form = $("#apptForm");

  /* ---------- Datum-Helfer ---------- */
  const today = () => App().todayISO();
  const pad = (n) => String(n).padStart(2, "0");
  const parse = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
  const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const addDays = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const dayLabel = (s) => {
    const d = parse(s);
    const t = today();
    const rel = s === t ? "Heute" : s === addDays(t, 1) ? "Morgen" : WEEKDAYS[d.getUTCDay()];
    return `${rel}, ${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.`;
  };
  const sortKey = (a) => a.date + (a.time || "99:99");
  const leadById = (id) => App().getLeads().find((l) => l.id === id);
  const apptName = (a) => {
    const lead = a.leadId && leadById(a.leadId);
    return (lead && lead.company) || a.leadName || a.title || "Termin";
  };

  /* ---------- Server ---------- */
  async function load({ quiet = false } = {}) {
    try {
      const data = await App().api("GET", "/appointments");
      const changed = !state.loaded || data.version !== state.version;
      state.items = data.items || [];
      state.version = data.version || 0;
      state.loaded = true;
      if (changed) { render(); renderLeadBox(); }
    } catch (err) {
      if (!quiet && err && err.status !== 401) App().toast("Kalender konnte nicht geladen werden.", true, 3000);
    }
  }

  async function save(item) {
    const data = await App().api("POST", "/appointments", { op: "upsert", item });
    const i = state.items.findIndex((x) => x.id === data.item.id);
    if (i >= 0) state.items[i] = data.item; else state.items.push(data.item);
    state.version = data.version;
    render(); renderLeadBox();
    return data.item;
  }

  async function remove(id) {
    const data = await App().api("POST", "/appointments", { op: "delete", id });
    state.items = state.items.filter((x) => x.id !== id);
    state.version = data.version;
    render(); renderLeadBox();
  }

  /* ---------- Darstellung ---------- */
  function itemHTML(a, { showDate = true } = {}) {
    const lead = a.leadId && leadById(a.leadId);
    const cls = `appt appt--${a.status === "bestätigt" ? "confirmed" : a.status === "abgesagt" ? "cancelled" : a.status === "erledigt" ? "done" : "tentative"}`;
    return `
      <li class="${cls}">
        <button type="button" class="appt__main" data-appt-edit="${esc(a.id)}">
          <span class="appt__when">${showDate ? `<b>${esc(dayLabel(a.date))}</b>` : ""}${a.time ? `<span>${esc(a.time)}</span>` : "<span>ganztägig</span>"}</span>
          <span class="appt__what">
            <span class="appt__name">${esc(apptName(a))}</span>
            <span class="appt__meta">${esc(a.type)}${a.title && lead && !a.title.startsWith(a.type) ? ` · ${esc(a.title)}` : ""}${a.location ? ` · ${esc(a.location)}` : ""}</span>
          </span>
          <span class="appt__status">${esc(a.status)}</span>
        </button>
        ${lead ? `<button type="button" class="appt__lead" data-appt-lead="${esc(lead.id)}" title="Lead öffnen" aria-label="Lead ${esc(lead.company)} öffnen">↗</button>` : ""}
      </li>`;
  }

  function monthHTML() {
    const [y, m] = state.month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1, 12));
    const offset = (first.getUTCDay() + 6) % 7; // Montag zuerst
    const daysIn = new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
    const byDay = {};
    state.items.forEach((a) => { if (a.status !== "abgesagt") (byDay[a.date] = byDay[a.date] || []).push(a); });
    const t = today();
    let cells = "";
    for (let i = 0; i < offset; i++) cells += `<span class="cal__day is-empty"></span>`;
    for (let d = 1; d <= daysIn; d++) {
      const key = `${state.month}-${pad(d)}`;
      const list = byDay[key] || [];
      const tentative = list.some((a) => a.status === "vorgemerkt");
      cells += `<button type="button" class="cal__day${key === t ? " is-today" : ""}${key === state.selected ? " is-selected" : ""}${list.length ? " has-items" : ""}" data-cal-day="${key}" aria-label="${d}. ${MONTHS[m - 1]}${list.length ? `, ${list.length} Termin${list.length > 1 ? "e" : ""}` : ""}">
        <span>${d}</span>${list.length ? `<i class="cal__dot${tentative ? " is-tentative" : ""}"></i>` : ""}
      </button>`;
    }
    return `
      <div class="cal__month">
        <div class="cal__monthhead">
          <button type="button" class="icon-btn" data-cal-nav="-1" aria-label="Vorheriger Monat">‹</button>
          <b>${MONTHS[m - 1]} ${y}</b>
          <button type="button" class="icon-btn" data-cal-nav="1" aria-label="Nächster Monat">›</button>
        </div>
        <div class="cal__grid">
          ${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => `<span class="cal__wd">${w}</span>`).join("")}
          ${cells}
        </div>
      </div>`;
  }

  function render() {
    if (!panel || !state.loaded) return;
    if (!state.month) state.month = today().slice(0, 7);
    const t = today();
    let title, list;
    if (state.selected) {
      title = dayLabel(state.selected);
      list = state.items.filter((a) => a.date === state.selected);
    } else {
      title = "Nächste Termine";
      list = state.items.filter((a) => a.date >= t && a.status !== "abgesagt" && a.status !== "erledigt");
    }
    list.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    const todayCount = state.items.filter((a) => a.date === t && a.status !== "abgesagt").length;

    panel.innerHTML = `
      <div class="cal__head">
        <h2>Kalender ${todayCount ? `<span class="cal__badge">${todayCount} heute</span>` : ""}</h2>
        <button type="button" class="btn btn--primary btn--sm" data-appt-new>+ Termin</button>
      </div>
      <div class="cal__body">
        ${monthHTML()}
        <div class="cal__agenda">
          <div class="cal__agendahead">
            <b>${esc(title)}</b>
            ${state.selected ? `<button type="button" class="link-btn" data-cal-clear>Alle nächsten Termine</button>` : ""}
          </div>
          ${list.length
            ? `<ul class="appt-list">${list.slice(0, 12).map((a) => itemHTML(a, { showDate: !state.selected })).join("")}</ul>`
            : `<p class="cal__empty">${state.selected ? "Keine Termine an diesem Tag." : "Keine anstehenden Termine."} <button type="button" class="link-btn" data-appt-new>Termin eintragen</button></p>`}
        </div>
      </div>`;
  }

  /* Termine im Lead-Formular */
  function renderLeadBox() {
    const box = $("#leadAppointments");
    if (!box) return;
    const lead = state.panelLead;
    if (!lead || !lead.id) { box.innerHTML = ""; box.hidden = true; return; }
    box.hidden = false;
    const list = state.items.filter((a) => a.leadId === lead.id).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    box.innerHTML = `
      <div class="field__labelrow"><label>Termine</label><button type="button" class="field__help link-btn" data-appt-new-lead="${esc(lead.id)}">+ Termin</button></div>
      ${list.length ? `<ul class="appt-list appt-list--compact">${list.map((a) => itemHTML(a)).join("")}</ul>` : `<p class="cal__empty">Noch kein Termin.</p>`}`;
  }

  /* ---------- Dialog ---------- */
  function fillLeadSelect(selectedId) {
    const sel = form.elements.leadId;
    const leads = App().getLeads().slice().sort((a, b) => a.company.localeCompare(b.company, "de"));
    sel.innerHTML = `<option value="">– ohne Lead –</option>` +
      leads.map((l) => `<option value="${esc(l.id)}"${l.id === selectedId ? " selected" : ""}>${esc(l.company)}</option>`).join("");
  }

  function openDialog(item = null, defaults = {}) {
    state.editingId = item ? item.id : null;
    const a = item || {
      date: defaults.date || state.selected || today(),
      time: "", duration: 60, type: "Persönliches Gespräch", status: "vorgemerkt",
      title: "", location: "", notes: "", remind: true, leadId: defaults.leadId || ""
    };
    fillLeadSelect(a.leadId);
    const f = form.elements;
    f.title.value = a.title || "";
    f.date.value = a.date || "";
    f.time.value = a.time || "";
    f.type.value = a.type || "Persönliches Gespräch";
    f.status.value = a.status || "vorgemerkt";
    f.duration.value = String([15, 30, 45, 60, 90, 120].includes(Number(a.duration)) ? a.duration : 60);
    f.location.value = a.location || "";
    f.notes.value = a.notes || "";
    f.remind.checked = a.remind !== false;
    $("#apptTitle").textContent = item ? "Termin bearbeiten" : "Neuer Termin";
    $("#apptDelete").hidden = !item;
    dialog.hidden = false;
    setTimeout(() => (item ? f.date : f.leadId).focus(), 30);
  }

  function closeDialog() {
    dialog.hidden = true;
    state.editingId = null;
  }

  async function submitDialog(e) {
    e.preventDefault();
    const f = form.elements;
    if (!f.date.value) { f.date.focus(); App().toast("Bitte ein Datum wählen.", true); return; }
    const lead = f.leadId.value ? leadById(f.leadId.value) : null;
    const item = {
      id: state.editingId || undefined,
      leadId: f.leadId.value,
      leadName: lead ? lead.company : "",
      title: f.title.value.trim(),
      date: f.date.value,
      time: f.time.value,
      duration: Number(f.duration.value),
      type: f.type.value,
      status: f.status.value,
      location: f.location.value.trim(),
      notes: f.notes.value,
      remind: f.remind.checked
    };
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const saved = await save(item);
      closeDialog();
      state.month = saved.date.slice(0, 7);
      render();
      App().toast(`Termin gespeichert: ${dayLabel(saved.date)}${saved.time ? `, ${saved.time}` : ""}`);
    } catch (err) {
      App().toast(err && err.status === 0 ? "Keine Verbindung – Termin nicht gespeichert." : "Speichern fehlgeschlagen.", true, 3500);
    } finally {
      submit.disabled = false;
    }
  }

  async function deleteCurrent() {
    if (!state.editingId) return;
    if (!window.confirm("Termin wirklich löschen?")) return;
    try {
      await remove(state.editingId);
      closeDialog();
      App().toast("Termin gelöscht");
    } catch (err) {
      App().toast("Löschen fehlgeschlagen.", true, 3000);
    }
  }

  /* ---------- Ereignisse ---------- */
  document.addEventListener("click", (e) => {
    const t = e.target;
    const edit = t.closest("[data-appt-edit]");
    if (edit) { const a = state.items.find((x) => x.id === edit.dataset.apptEdit); if (a) openDialog(a); return; }
    const leadBtn = t.closest("[data-appt-lead]");
    if (leadBtn) { App().openLead(leadBtn.dataset.apptLead); return; }
    if (t.closest("[data-appt-new]")) { openDialog(null); return; }
    const forLead = t.closest("[data-appt-new-lead]");
    if (forLead) { openDialog(null, { leadId: forLead.dataset.apptNewLead }); return; }
    const day = t.closest("[data-cal-day]");
    if (day) { state.selected = state.selected === day.dataset.calDay ? null : day.dataset.calDay; render(); return; }
    if (t.closest("[data-cal-clear]")) { state.selected = null; render(); return; }
    const nav = t.closest("[data-cal-nav]");
    if (nav) {
      const [y, m] = state.month.split("-").map(Number);
      const d = new Date(Date.UTC(y, m - 1 + Number(nav.dataset.calNav), 1, 12));
      state.month = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
      render();
    }
  });

  form.addEventListener("submit", submitDialog);
  $("#apptCancel").addEventListener("click", closeDialog);
  $("#apptDelete").addEventListener("click", deleteCurrent);
  dialog.addEventListener("click", (e) => { if (e.target === dialog) closeDialog(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !dialog.hidden) closeDialog(); });

  document.addEventListener("aufwind:panel-open", (e) => {
    state.panelLead = e.detail && e.detail.lead;
    renderLeadBox();
  });

  document.addEventListener("aufwind:unlocked", async () => {
    await load({ quiet: true });
    clearInterval(state.poll);
    state.poll = setInterval(() => { if (document.visibilityState === "visible") load({ quiet: true }); }, POLL_MS);
    // Aus einer Push-Nachricht geöffnet: /?termin=ID
    const id = new URLSearchParams(location.search).get("termin");
    if (id) {
      const a = state.items.find((x) => x.id === id);
      if (a) {
        state.month = a.date.slice(0, 7);
        state.selected = a.date;
        render();
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      history.replaceState(null, "", location.pathname);
    }
  });

  document.addEventListener("aufwind:locked", () => {
    clearInterval(state.poll);
    state.items = [];
    state.loaded = false;
    if (panel) panel.innerHTML = "";
    closeDialog();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.loaded) load({ quiet: true });
  });
})();
