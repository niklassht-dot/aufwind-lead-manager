/* ==========================================================
   Gemeinsamer Kalender der Lead-Liste (Header "x-aufwind-pin" nötig)
     GET  /api/appointments                 → { version, items: [...] }
     POST /api/appointments { op: "upsert", item }   Termin anlegen/ändern
     POST /api/appointments { op: "delete", id }     Termin löschen

   Gespeichert in Netlify Blobs (Store "aufwind-leads", Schlüssel
   "appointments"), Änderungen atomar über ETag – wie die Leads.
   ========================================================== */

import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import { json, pinIsValid, sleep } from "../shared/push-core.mjs";
import { APPOINTMENT_SEEDS } from "../shared/appointment-seeds.mjs";
import { companyKey } from "../shared/lead-batches.mjs";

const KEY = "appointments";
export const APPOINTMENT_TYPES = ["Persönliches Gespräch", "Telefonat", "Videocall", "Entwurf vorstellen", "Sonstiges"];
export const APPOINTMENT_STATES = ["vorgemerkt", "bestätigt", "abgesagt", "erledigt"];

const store = () => getStore({ name: "aufwind-leads", consistency: "strong" });

const clean = (v, max) => String(v ?? "").trim().slice(0, max);
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const isTime = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ""));

export function normalizeAppointment(raw, prev = null) {
  const now = new Date().toISOString();
  const item = {
    id: (prev && prev.id) || clean(raw.id, 64) || randomUUID(),
    date: isDate(raw.date) ? raw.date : (prev && prev.date) || "",
    time: isTime(raw.time) ? raw.time : raw.time === "" ? "" : (prev && prev.time) || "",
    duration: Math.min(600, Math.max(5, Number(raw.duration) || (prev && prev.duration) || 60)),
    type: APPOINTMENT_TYPES.includes(raw.type) ? raw.type : (prev && prev.type) || "Persönliches Gespräch",
    status: APPOINTMENT_STATES.includes(raw.status) ? raw.status : (prev && prev.status) || "vorgemerkt",
    title: clean(raw.title ?? (prev && prev.title), 160),
    leadId: clean(raw.leadId ?? (prev && prev.leadId), 64),
    leadName: clean(raw.leadName ?? (prev && prev.leadName), 200),
    location: clean(raw.location ?? (prev && prev.location), 200),
    notes: String(raw.notes ?? (prev && prev.notes) ?? "").slice(0, 2000),
    remind: raw.remind === undefined ? (prev ? prev.remind !== false : true) : Boolean(raw.remind),
    createdAt: (prev && prev.createdAt) || now,
    updatedAt: now
  };
  return item;
}

async function readDoc() {
  const entry = await store().getWithMetadata(KEY, { type: "json" });
  return { doc: entry ? entry.data : null, etag: entry ? entry.etag : null };
}

/** Atomare Änderung mit Wiederholung bei gleichzeitigen Schreibzugriffen. */
async function mutate(fn) {
  const s = store();
  for (let i = 0; i < 12; i++) {
    const { doc, etag } = await readDoc();
    const current = doc || { version: 0, items: {}, appliedSeeds: [] };
    const next = structuredClone(current);
    const result = await fn(next);
    if (result === false) return current;
    next.version = (current.version || 0) + 1;
    next.updatedAt = new Date().toISOString();
    const write = await s.setJSON(KEY, next, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
    if (write.modified !== false) return next;
    await sleep(40 + Math.random() * 120);
  }
  throw new Error("appointments busy");
}

/** Vorgemerkte Termine (aus appointment-seeds.mjs) einmalig übernehmen. */
async function applySeeds(doc) {
  const done = new Set(doc.appliedSeeds || []);
  const pending = APPOINTMENT_SEEDS.filter((s) => !done.has(s.id));
  if (!pending.length) return false;
  const leadsDoc = await store().get("leads", { type: "json" });
  const leads = (leadsDoc && leadsDoc.leads) || [];
  for (const seed of pending) {
    for (const raw of seed.items) {
      const key = companyKey(raw.leadName);
      const lead = leads.find((l) => {
        const k = companyKey(l.company);
        return k && key && (k === key || (Math.min(k.length, key.length) >= 5 && (k.startsWith(key) || key.startsWith(k) || k.includes(key))));
      });
      const item = normalizeAppointment({ ...raw, leadId: lead ? lead.id : "", leadName: lead ? lead.company : raw.leadName });
      doc.items[item.id] = item;
    }
    done.add(seed.id);
  }
  doc.appliedSeeds = [...done];
  return true;
}

const sortItems = (items) => items.sort((a, b) => (a.date + (a.time || "99")).localeCompare(b.date + (b.time || "99")));

export default async (req) => {
  if (!pinIsValid(req.headers.get("x-aufwind-pin"))) {
    await sleep(600);
    return json(401, { error: "unauthorized" });
  }
  try {
    if (req.method === "GET") {
      let { doc } = await readDoc();
      if (!doc || APPOINTMENT_SEEDS.some((s) => !(doc.appliedSeeds || []).includes(s.id))) {
        doc = await mutate((d) => applySeeds(d));
      }
      return json(200, { version: doc.version || 0, items: sortItems(Object.values(doc.items || {})) });
    }

    if (req.method === "POST") {
      let body = null;
      try { body = await req.json(); } catch { /* leer */ }
      if (!body || typeof body !== "object") return json(400, { error: "invalid_body" });

      if (body.op === "upsert" && body.item && typeof body.item === "object") {
        let saved = null;
        const doc = await mutate((d) => {
          const prev = body.item.id ? d.items[body.item.id] : null;
          const item = normalizeAppointment(body.item, prev);
          if (!item.date) return false;
          d.items[item.id] = item;
          saved = item;
        });
        if (!saved) return json(400, { error: "date_required" });
        return json(200, { version: doc.version, item: saved });
      }

      if (body.op === "delete" && typeof body.id === "string") {
        const doc = await mutate((d) => {
          if (!d.items[body.id]) return false;
          delete d.items[body.id];
        });
        return json(200, { version: doc.version, ok: true });
      }
      return json(400, { error: "unknown_op" });
    }
    return json(405, { error: "method_not_allowed" });
  } catch (err) {
    console.error("[appointments]", err);
    return json(500, { error: "server_error" });
  }
};

export const config = { path: "/api/appointments" };
