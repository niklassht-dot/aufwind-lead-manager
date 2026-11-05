/* ==========================================================
   POST /api/extract   (Header "x-aufwind-pin" nötig)
   { image: "data:image/jpeg;base64,…" }
   → { company, contact, phone, website, notes }

   Liest aus einem Bild (Screenshot von Google Maps, Website,
   Instagram, Visitenkarte …) die Firmendaten mit Claude aus.
   Benötigt die Umgebungsvariable ANTHROPIC_API_KEY.
   ========================================================== */

import { json, pinIsValid, sleep } from "../shared/push-core.mjs";

const MAX_BASE64 = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const PROMPT = `Du bekommst ein Bild (z. B. Screenshot von Google Maps, einer Website, Instagram/Facebook, einem Branchenbuch oder ein Foto einer Visitenkarte / eines Firmenschilds).
Lies die Kontaktdaten des Unternehmens heraus, das im Bild im Mittelpunkt steht.

Antworte NUR mit einem JSON-Objekt, ohne Erklärung, in genau dieser Form:
{"company":"","contact":"","phone":"","website":"","notes":""}

Regeln:
- company: Firmenname, wie er im Bild steht (ohne Zusätze wie Bewertungen).
- contact: Name einer Ansprechperson (Inhaber/Geschäftsführer), nur wenn sichtbar.
- phone: Telefonnummer so wie abgebildet; bei mehreren die erste geschäftliche.
- website: Website-Adresse mit https:// davor, nur wenn sichtbar (keine Social-Media-Profile, außer es gibt sonst keine).
- notes: kurze Infos auf Deutsch, die für eine Kaltakquise nützlich sind, z. B. Branche, Ort/Adresse, Bewertung, Öffnungszeiten, E-Mail, Instagram – höchstens 3 kurze Zeilen.
- Was nicht im Bild steht, bleibt "". Nichts erfinden.`;

function parseJSON(text) {
  const m = String(text || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

const clean = (v, max) => String(v ?? "").replace(/\s+\n/g, "\n").trim().slice(0, max);

export default async (req) => {
  if (!pinIsValid(req.headers.get("x-aufwind-pin"))) {
    await sleep(600);
    return json(401, { error: "unauthorized" });
  }
  if (req.method.toUpperCase() !== "POST") return json(405, { error: "method_not_allowed" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json(503, { error: "no_api_key" });

  let body = null;
  try { body = await req.json(); } catch { /* leer */ }
  const m = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(body && body.image || ""));
  if (!m || !TYPES.includes(m[1])) return json(400, { error: "invalid_image" });
  if (m[2].length > MAX_BASE64) return json(413, { error: "image_too_large" });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
        max_tokens: 600,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } },
            { type: "text", text: PROMPT }
          ]
        }]
      })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("[extract] Claude-Fehler", res.status, data && data.error);
      return json(502, { error: "claude_error", status: res.status });
    }
    const text = (data && data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
    const out = parseJSON(text);
    if (!out) return json(422, { error: "nothing_found" });

    let website = clean(out.website, 300);
    if (website && !/^https?:\/\//i.test(website)) website = "https://" + website;
    return json(200, {
      company: clean(out.company, 200),
      contact: clean(out.contact, 200),
      phone: clean(out.phone, 60),
      website,
      notes: clean(out.notes, 600)
    });
  } catch (err) {
    console.error("[extract]", err);
    return json(500, { error: "server_error" });
  }
};

export const config = { path: "/api/extract" };
