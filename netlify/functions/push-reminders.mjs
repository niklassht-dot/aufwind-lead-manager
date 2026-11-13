/* ==========================================================
   Täglicher Erinnerungs-Versand (Netlify Scheduled Function)

   Läuft alle 15 Minuten. Ab 8:00 Uhr deutscher Zeit wird einmal pro Tag
   für jede offene Aufgabe eine Push-Nachricht verschickt:
     „Firma xy anrufen“                       (Anruf 5 Tage nach Entwurf)
     „Firma xy: Follow-up fällig“             (selbst gesetzter Termin)
   Nicht abgehakte Aufgaben werden an jedem folgenden Werktag erneut
   gemeldet („nachholen“), bis sie abgehakt sind.
   Dazu Kalender-Termine: Vorabend 18 Uhr, am Tag ab 8 Uhr, 60 Min vorher.
   Bereits gesendete Erinnerungen eines Tages werden protokolliert,
   damit nichts doppelt kommt.
   ========================================================== */

import { getStore } from "@netlify/blobs";
import "../../public/assets/js/schedule.js";
import { pushStore, sendToSubscriptions, listSubscriptions } from "../shared/push-core.mjs";

const Schedule = globalThis.AufwindSchedule;
const SEND_FROM_HOUR = 8;
const LOG_KEY = "reminder-log";

const shortDate = (iso) => { const [, m, d] = iso.split("-"); return `${d}.${m}.`; };

function notesPreview(lead) {
  const notes = String(lead.notes || "").replace(/\s+/g, " ").trim();
  const text = notes ? (notes.length > 160 ? notes.slice(0, 157) + "…" : notes) : "Keine Notizen.";
  return lead.phone ? `${text}\nTel.: ${lead.phone}` : text;
}

/** Alle heute zu meldenden Aufgaben. */
export function dueReminders(leads, today) {
  const out = [];
  const workday = Schedule.isWorkday(today);
  for (const lead of leads || []) {
    if (!lead || !lead.company) continue;
    for (const task of Schedule.leadTasks(lead, today)) {
      // heute fällig: immer melden; überfällig: nur an Werktagen erneut melden
      if (task.state !== "due" && !(task.state === "overdue" && workday)) continue;
      const overdue = task.state === "overdue";
      const base = task.kind === "call" ? `${lead.company} anrufen` : `${lead.company}: Follow-up fällig`;
      out.push({
        key: `${lead.id}:${task.kind}:${task.date}:${today}`,
        title: overdue ? `${base} – nachholen (seit ${shortDate(task.date)})` : base,
        body: notesPreview(lead),
        url: `/?lead=${encodeURIComponent(lead.id)}`,
        tag: `${task.kind}-${lead.id}`
      });
    }
  }
  return out;
}

/* ---------- Kalender-Termine ---------- */

const minutesInGermany = (now) => {
  const [h, m] = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(now).split(":").map(Number);
  return (h % 24) * 60 + m;
};
const addDaysISO = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const toMin = (t) => { const m = /^(\d{2}):(\d{2})$/.exec(t || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

function apptBody(a) {
  const parts = [];
  if (a.status === "vorgemerkt") parts.push("Status: vorgemerkt (noch nicht bestätigt)");
  if (a.location) parts.push(`Ort: ${a.location}`);
  if (a.notes) parts.push(String(a.notes).replace(/\s+/g, " ").slice(0, 140));
  return parts.join("\n") || "Antippen öffnet den Kalender.";
}

/**
 * Erinnerungen für Termine:
 *  - am Vorabend ab 18 Uhr: „Morgen 16:00 · …“
 *  - am Tag ab 8 Uhr:       „Heute 16:00 · …“
 *  - 60 Minuten vorher:     „In 60 Min: …“ (läuft alle 15 Minuten, daher auch vor 8 Uhr)
 */
export function dueAppointmentReminders(items, now = new Date()) {
  const today = Schedule.todayInGermany(now);
  const tomorrow = addDaysISO(today, 1);
  const nowMin = minutesInGermany(now);
  const hour = Math.floor(nowMin / 60);
  const out = [];
  for (const a of items || []) {
    if (!a || !a.date || a.remind === false || a.status === "abgesagt" || a.status === "erledigt") continue;
    const name = a.leadName || a.title || "Termin";
    const label = `${a.type || "Termin"}${a.leadName ? ` – ${a.leadName}` : a.title ? ` – ${a.title}` : ""}`;
    const at = a.time ? ` ${a.time}` : "";
    const base = { body: apptBody(a), url: `/?termin=${encodeURIComponent(a.id)}`, tag: `appt-${a.id}` };
    if (a.date === tomorrow && hour >= 18) {
      out.push({ ...base, key: `appt:${a.id}:${a.date}:${a.time}:eve`, title: `Morgen${at}: ${label}` });
    }
    if (a.date === today) {
      const start = toMin(a.time);
      if (hour >= SEND_FROM_HOUR && (start === null || start - nowMin > 60)) {
        out.push({ ...base, key: `appt:${a.id}:${a.date}:${a.time}:day`, title: `Heute${at}: ${label}` });
      }
      if (start !== null && start - nowMin <= 60 && start - nowMin >= -5) {
        const left = Math.max(0, start - nowMin);
        out.push({ ...base, key: `appt:${a.id}:${a.date}:${a.time}:soon`, title: left ? `In ${left} Min: ${name}` : `Jetzt: ${name}`, body: `${a.type || "Termin"} um ${a.time}\n${apptBody(a)}` });
      }
    }
  }
  return out;
}

export async function runReminders(now = new Date(), { force = false } = {}) {
  const today = Schedule.todayInGermany(now);
  const subs = await listSubscriptions();
  if (!Object.keys(subs).length) return { skipped: "no_devices" };

  const blobs = getStore({ name: "aufwind-leads", consistency: "strong" });
  const apptDoc = await blobs.get("appointments", { type: "json" });
  const reminders = dueAppointmentReminders(apptDoc ? Object.values(apptDoc.items || {}) : [], now);
  // Lead-Aufgaben erst ab 8 Uhr
  if (force || Schedule.hourInGermany(now) >= SEND_FROM_HOUR) {
    const doc = await blobs.get("leads", { type: "json" });
    reminders.push(...dueReminders(doc && doc.leads, today));
  }

  const store = pushStore();
  const log = (await store.get(LOG_KEY, { type: "json" })) || {};
  const sent = new Set(log.date === today ? log.sent || [] : []);

  let delivered = 0;
  for (const r of reminders) {
    if (sent.has(r.key)) continue;
    const result = await sendToSubscriptions({ title: r.title, body: r.body, url: r.url, tag: r.tag });
    if (result.sent > 0) delivered++;
    sent.add(r.key); // auch bei 0 Geräten nicht endlos wiederholen
  }
  await store.setJSON(LOG_KEY, { date: today, sent: [...sent] });
  return { today, due: reminders.length, delivered };
}

export default async () => {
  try {
    const result = await runReminders();
    console.log("[reminders]", JSON.stringify(result));
  } catch (err) {
    console.error("[reminders]", err);
  }
};

export const config = {
  schedule: "*/15 * * * *"
};
