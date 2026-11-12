/* ==========================================================
   Aufwind Studio – Lead Manager · API
   Netlify Function (v2) + Netlify Blobs

   Alle Leads liegen als ein JSON-Dokument im Blob-Store
   "aufwind-leads" unter dem Schlüssel "leads".
   Jede Änderung ist eine einzelne Operation (anlegen, ändern,
   löschen) und wird per ETag-Bedingung atomar gespeichert –
   gleichzeitige Änderungen an verschiedenen Leads gehen nie verloren.

   Endpunkte (Header "x-aufwind-pin" erforderlich):
     GET    /api/leads?since=<version>   Liste laden (oder {unchanged:true})
     POST   /api/leads                   Lead anlegen        { lead }
     PATCH  /api/leads/:id               Lead ändern         { updates, baseUpdatedAt, force? }
     DELETE /api/leads/:id               Lead löschen
     POST   /api/init                    Erstbefüllung, nur wenn leer   { leads }
     PUT    /api/import                  Komplette Liste ersetzen       { leads }
   ========================================================== */

import { getStore } from "@netlify/blobs";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { LEAD_BATCHES, companyKey } from "../shared/lead-batches.mjs";

const STORE_NAME = "aufwind-leads";
const DOC_KEY = "leads";
const MAX_LEADS = 5000;
const MAX_RETRIES = 10;

/* PIN: über Umgebungsvariable LEADS_PIN änderbar (Netlify → Site configuration → Environment variables). */
const DEFAULT_PIN = "2109";

const FIELD_LIMITS = {
  company: 300,
  contact: 300,
  phone: 100,
  website: 1000,
  draftUrl: 1000,
  status: 100,
  followUpDate: 10,
  draftSentDate: 10,
  callDoneFor: 10,
  callDoneOn: 10,
  followUpDoneFor: 10,
  followUpDoneOn: 10,
  notes: 20000
};
const EDITABLE_FIELDS = Object.keys(FIELD_LIMITS);

/* ---------------- Hilfen ---------------- */

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });

const sha = (value) => createHash("sha256").update(String(value)).digest();

function pinIsValid(provided) {
  const expected = process.env.LEADS_PIN || DEFAULT_PIN;
  if (!provided) return false;
  return timingSafeEqual(sha(provided), sha(expected));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeUrl(value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : "https://" + v.replace(/^\/+/, "");
}

function normalizeDate(value) {
  const v = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
}

function cleanField(key, value) {
  let v = String(value ?? "");
  if (key !== "notes") v = v.trim();
  if (key === "website" || key === "draftUrl") v = normalizeUrl(v);
  if (["followUpDate", "draftSentDate", "callDoneFor", "callDoneOn", "followUpDoneFor", "followUpDoneOn"].includes(key)) v = normalizeDate(v);
  return v.slice(0, FIELD_LIMITS[key]);
}

function pickUpdates(input) {
  const out = {};
  if (!input || typeof input !== "object") return out;
  for (const key of EDITABLE_FIELDS) {
    if (key in input) out[key] = cleanField(key, input[key]);
  }
  return out;
}

/* Statusliste wurde vereinfacht – alte Werte werden automatisch umgestellt. */
const LEGACY_STATUS = {
  "Offen": "Anrufen",
  "Warten auf Rückruf": "Rückruf vereinbart",
  "In 1–2 Wochen anrufen": "Rückruf vereinbart",
  "Interesse": "Termin vereinbart",
  "Angebot gesendet": "Entwurf gesendet",
  "Erledigt": "Kunde"
};
/** Noch nicht angewendete Lead-Pakete in das Dokument übernehmen. */
function applyBatches(doc) {
  const done = new Set(doc.appliedBatches || []);
  const pending = LEAD_BATCHES.filter((b) => !done.has(b.id));
  if (!pending.length) return false;
  const now = new Date().toISOString();
  doc.leads = doc.leads || [];
  for (const batch of pending) {
    for (const raw of batch.leads) {
      const key = companyKey(raw.company);
      const existing = doc.leads.find((l) => {
        const k = companyKey(l.company);
        return k && key && (k === key || (Math.min(k.length, key.length) >= 6 && (k.startsWith(key) || key.startsWith(k))));
      });
      if (existing) {
        // schon vorhanden: Status setzen (nicht bei reinen Ergänzungs-Paketen),
        // leere Felder ergänzen, Notiz anhängen
        if (!batch.update) existing.status = raw.status || existing.status;
        for (const f of ["contact", "phone", "website"]) if (!existing[f] && raw[f]) existing[f] = raw[f];
        if (raw.notes && !String(existing.notes || "").includes(raw.notes.split("\n")[0])) {
          existing.notes = [existing.notes, raw.notes].filter(Boolean).join("\n\n");
        }
        existing.updatedAt = now;
      } else if (!batch.update) {
        doc.leads.push(normalizeLead({ ...raw, createdAt: now, updatedAt: now }, now));
      }
    }
    done.add(batch.id);
  }
  doc.appliedBatches = [...done];
  return true;
}

const hasLegacy = (leads) => (leads || []).some((l) => LEGACY_STATUS[l && l.status]);

function normalizeLead(raw, now = new Date().toISOString()) {
  const r = raw && typeof raw === "object" ? raw : {};
  const lead = {
    id: typeof r.id === "string" && r.id.length <= 100 && r.id ? r.id : randomUUID(),
    ...Object.fromEntries(EDITABLE_FIELDS.map((k) => [k, cleanField(k, r[k])])),
    createdAt: typeof r.createdAt === "string" && r.createdAt ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === "string" && r.updatedAt ? r.updatedAt : now
  };
  lead.status = LEGACY_STATUS[lead.status] || lead.status || "Anrufen";
  return lead;
}

function normalizeList(list) {
  if (!Array.isArray(list)) return null;
  const seen = new Set();
  return list
    .filter((x) => x && typeof x === "object" && String(x.company ?? "").trim())
    .slice(0, MAX_LEADS)
    .map((x) => {
      const lead = normalizeLead(x);
      if (seen.has(lead.id)) lead.id = randomUUID();
      seen.add(lead.id);
      return lead;
    });
}

async function readBody(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/* ---------------- Speicher ---------------- */

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

async function readDoc(s) {
  const entry = await s.getWithMetadata(DOC_KEY, { type: "json" });
  if (!entry || !entry.data) return { doc: null, etag: null };
  return { doc: entry.data, etag: entry.etag };
}

/**
 * Atomare Änderung: liest das Dokument, wendet mutate() an und schreibt
 * nur, wenn sich das Dokument zwischenzeitlich nicht geändert hat.
 * mutate(doc) gibt entweder { doc, result } oder { error: Response } zurück.
 */
async function mutateDoc(mutate) {
  const s = store();
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { doc, etag } = await readDoc(s);
    if (!doc) return { error: json(409, { error: "not_initialized" }) };

    const outcome = mutate(structuredClone(doc));
    if (outcome.error) return outcome;

    const next = {
      ...outcome.doc,
      version: (doc.version || 0) + 1,
      updatedAt: new Date().toISOString()
    };
    const write = await s.setJSON(DOC_KEY, next, { onlyIfMatch: etag });
    if (write.modified !== false) return { doc: next, result: outcome.result };

    await sleep(40 + Math.random() * 120); // jemand war schneller → neu versuchen
  }
  return { error: json(503, { error: "busy" }) };
}

/* ---------------- Handler ---------------- */

export default async (req) => {
  if (!pinIsValid(req.headers.get("x-aufwind-pin"))) {
    await sleep(600); // bremst Durchprobieren
    return json(401, { error: "unauthorized" });
  }

  const url = new URL(req.url);
  const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean); // ["api","leads",":id"]
  const route = parts[1];
  const id = parts[2] ? decodeURIComponent(parts[2]) : null;
  const method = req.method.toUpperCase();

  try {
    /* ---- Liste laden ---- */
    if (route === "leads" && !id && method === "GET") {
      let { doc } = await readDoc(store());
      if (!doc) return json(200, { initialized: false, version: 0, leads: [] });
      if (LEAD_BATCHES.some((b) => !(doc.appliedBatches || []).includes(b.id))) {
        const withBatches = await mutateDoc((d) => { applyBatches(d); return { doc: d }; });
        if (withBatches.doc) doc = withBatches.doc;
      }
      if (hasLegacy(doc.leads)) {
        // einmalige Umstellung auf die neuen Statuswerte (atomar)
        const migrated = await mutateDoc((d) => {
          d.leads = (d.leads || []).map((l) => (LEGACY_STATUS[l.status] ? { ...l, status: LEGACY_STATUS[l.status] } : l));
          return { doc: d };
        });
        if (migrated.doc) doc = migrated.doc;
      }
      const since = Number(url.searchParams.get("since"));
      if (since && since === doc.version) return json(200, { initialized: true, unchanged: true, version: doc.version });
      return json(200, { initialized: true, version: doc.version, leads: doc.leads });
    }

    /* ---- Erstbefüllung ---- */
    if (route === "init" && method === "POST") {
      const body = await readBody(req);
      const leads = normalizeList(body && body.leads);
      if (!leads) return json(400, { error: "invalid_leads" });
      const doc = { version: 1, updatedAt: new Date().toISOString(), leads };
      const write = await store().setJSON(DOC_KEY, doc, { onlyIfNew: true });
      if (write.modified === false) {
        const { doc: existing } = await readDoc(store());
        return json(409, { error: "already_initialized", version: existing.version, leads: existing.leads });
      }
      return json(201, { version: doc.version, leads: doc.leads });
    }

    /* ---- Import: alles ersetzen ---- */
    if (route === "import" && method === "PUT") {
      const body = await readBody(req);
      const leads = normalizeList(body && body.leads);
      if (!leads) return json(400, { error: "invalid_leads" });
      const s = store();
      const { doc } = await readDoc(s);
      const next = { version: ((doc && doc.version) || 0) + 1, updatedAt: new Date().toISOString(), leads, appliedBatches: (doc && doc.appliedBatches) || [] };
      await s.setJSON(DOC_KEY, next);
      return json(200, { version: next.version, leads: next.leads });
    }

    /* ---- Lead anlegen ---- */
    if (route === "leads" && !id && method === "POST") {
      const body = await readBody(req);
      const input = body && body.lead;
      if (!input || !String(input.company ?? "").trim()) return json(400, { error: "company_required" });
      const now = new Date().toISOString();
      const lead = normalizeLead({ ...input, createdAt: now, updatedAt: now }, now);

      const out = await mutateDoc((doc) => {
        if (doc.leads.length >= MAX_LEADS) return { error: json(400, { error: "too_many_leads" }) };
        if (doc.leads.some((l) => l.id === lead.id)) lead.id = randomUUID();
        doc.leads.push(lead);
        return { doc, result: lead };
      });
      if (out.error) return out.error;
      return json(201, { version: out.doc.version, lead: out.result });
    }

    /* ---- Lead ändern ---- */
    if (route === "leads" && id && method === "PATCH") {
      const body = (await readBody(req)) || {};
      const updates = pickUpdates(body.updates);
      if ("company" in updates && !updates.company) return json(400, { error: "company_required" });

      const out = await mutateDoc((doc) => {
        const index = doc.leads.findIndex((l) => l.id === id);
        if (index === -1) return { error: json(404, { error: "not_found" }) };
        const current = doc.leads[index];
        if (!body.force && body.baseUpdatedAt && body.baseUpdatedAt !== current.updatedAt) {
          return { error: json(409, { error: "conflict", lead: current }) };
        }
        const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };
        doc.leads[index] = updated;
        return { doc, result: updated };
      });
      if (out.error) return out.error;
      return json(200, { version: out.doc.version, lead: out.result });
    }

    /* ---- Lead löschen ---- */
    if (route === "leads" && id && method === "DELETE") {
      const out = await mutateDoc((doc) => {
        doc.leads = doc.leads.filter((l) => l.id !== id);
        return { doc, result: null };
      });
      if (out.error) return out.error;
      return json(200, { version: out.doc.version, ok: true });
    }

    return json(405, { error: "method_not_allowed" });
  } catch (err) {
    console.error("[leads]", err);
    return json(500, { error: "server_error" });
  }
};

export const config = {
  path: ["/api/leads", "/api/leads/:id", "/api/init", "/api/import"]
};
