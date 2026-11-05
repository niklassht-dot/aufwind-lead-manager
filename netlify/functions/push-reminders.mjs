/* ==========================================================
   Täglicher Erinnerungs-Versand (Netlify Scheduled Function)

   Läuft stündlich. Ab 8:00 Uhr deutscher Zeit wird einmal pro Tag
   für jede offene Aufgabe eine Push-Nachricht verschickt:
     „Firma xy anrufen“                       (Anruf 5 Tage nach Entwurf)
     „Firma xy: Follow-up fällig“             (selbst gesetzter Termin)
   Nicht abgehakte Aufgaben werden an jedem folgenden Werktag erneut
   gemeldet („nachholen“), bis sie abgehakt sind.
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

export async function runReminders(now = new Date(), { force = false } = {}) {
  if (!force && Schedule.hourInGermany(now) < SEND_FROM_HOUR) return { skipped: "too_early" };

  const today = Schedule.todayInGermany(now);
  const subs = await listSubscriptions();
  if (!Object.keys(subs).length) return { skipped: "no_devices" };

  const doc = await getStore({ name: "aufwind-leads", consistency: "strong" }).get("leads", { type: "json" });
  const reminders = dueReminders(doc && doc.leads, today);

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
  schedule: "@hourly"
};
