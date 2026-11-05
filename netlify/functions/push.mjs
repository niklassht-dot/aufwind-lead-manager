/* ==========================================================
   API für Push-Benachrichtigungen (Header "x-aufwind-pin" nötig)
     GET  /api/push/key           öffentlicher VAPID-Schlüssel
     POST /api/push/subscribe     { subscription, device }  Gerät anmelden
     POST /api/push/unsubscribe   { endpoint }              Gerät abmelden
     POST /api/push/test          { endpoint }              Test an dieses Gerät
   ========================================================== */

import {
  json, pinIsValid, sleep, getVapidKeys, isValidSubscription,
  saveSubscription, removeSubscriptions, sendToSubscriptions, listSubscriptions, setPause, getPause
} from "../shared/push-core.mjs";

async function readBody(req) {
  try { return await req.json(); } catch { return null; }
}

export default async (req) => {
  if (!pinIsValid(req.headers.get("x-aufwind-pin"))) {
    await sleep(600);
    return json(401, { error: "unauthorized" });
  }

  const action = new URL(req.url).pathname.replace(/\/+$/, "").split("/").pop();
  const method = req.method.toUpperCase();

  try {
    if (action === "key" && method === "GET") {
      const { publicKey } = await getVapidKeys();
      const subs = await listSubscriptions();
      return json(200, { publicKey, devices: Object.keys(subs).length });
    }

    if (action === "subscribe" && method === "POST") {
      const body = (await readBody(req)) || {};
      if (!isValidSubscription(body.subscription)) return json(400, { error: "invalid_subscription" });
      await saveSubscription(body.subscription, body.device);
      return json(200, { ok: true });
    }

    if (action === "unsubscribe" && method === "POST") {
      const body = (await readBody(req)) || {};
      if (typeof body.endpoint === "string") await removeSubscriptions([body.endpoint]);
      return json(200, { ok: true });
    }

    if (action === "pause" && method === "POST") {
      const body = (await readBody(req)) || {};
      if (typeof body.endpoint !== "string") return json(400, { error: "endpoint_required" });
      if (body.until === undefined) return json(200, { pausedUntil: await getPause(body.endpoint) });
      const ok = await setPause(body.endpoint, body.until);
      return ok ? json(200, { ok: true, pausedUntil: body.until || "" }) : json(404, { error: "not_subscribed" });
    }

    if (action === "test" && method === "POST") {
      const body = (await readBody(req)) || {};
      const result = await sendToSubscriptions(
        {
          title: "Benachrichtigungen sind aktiv ✓",
          body: "So sehen deine Erinnerungen aus: „Firma xy anrufen“. Antippen öffnet die Liste.",
          url: "/",
          tag: "aufwind-test"
        },
        typeof body.endpoint === "string" ? body.endpoint : null
      );
      return json(200, result);
    }

    return json(405, { error: "method_not_allowed" });
  } catch (err) {
    console.error("[push]", err);
    return json(500, { error: "server_error" });
  }
};

export const config = {
  path: ["/api/push/key", "/api/push/subscribe", "/api/push/unsubscribe", "/api/push/test", "/api/push/pause"]
};
