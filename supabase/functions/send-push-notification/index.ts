/**
 * send-push-notification — NovaSound TITAN LUX V400000
 *
 * ✅ V400000 — Support complet de TOUS les types de notifications :
 *   like | comment | follow | new_song | repost | news
 *   chat_reply | chat_mention | chat_mention_all | mood_vote
 *   live_start | live_invite | queue_song | achievement
 * ✅ V400000 — DB Trigger hook : insert dans notifications → auto-push
 * ✅ V400000 — Webhook mode via X-Webhook-Secret header
 * ✅ V400000 — Rate limiting per user (max 60 push/hr)
 * ✅ V400000 — Batch size configurable (env PUSH_BATCH_SIZE)
 * ✅ V400000 — Type-specific urgency, TTL, and rich action buttons
 * ✅ V400000 — Extended idempotency guard + structured logging
 * ✅ V300000 — VAPID x/y extracted dynamically
 * ✅ V300000 — Retry logic: 3 attempts, exponential backoff
 * ✅ V300000 — Concurrence limited: max 10 parallel
 * ✅ V300000 — Broadcast mode (all subscribed users)
 * ✅ V300000 — Delivery tracking in push_notification_logs
 * ✅ V300000 — Auto-purge 404/410 subscriptions
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Crypto helpers ───────────────────────────────────────────────────────────
function toB64Url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64Url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - b64.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}
function extractXY(pubKeyB64url: string): { x: string; y: string } {
  const raw = fromB64Url(pubKeyB64url);
  if (raw.length !== 65 || raw[0] !== 0x04)
    throw new Error(`Invalid EC public key: expected 65 bytes, got ${raw.length}`);
  return { x: toB64Url(raw.slice(1, 33)), y: toB64Url(raw.slice(33, 65)) };
}
async function importPrivateKey(privB64url: string, pubB64url: string): Promise<CryptoKey> {
  const { x, y } = extractXY(pubB64url);
  return crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: privB64url, x, y, key_ops: ["sign"], ext: true },
    { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );
}
async function makeVapidJWT(endpoint: string, pubKey: string, privKey: string, sub: string): Promise<string> {
  const { protocol, host } = new URL(endpoint);
  const now = Math.floor(Date.now() / 1000);
  const hdr = toB64Url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const pld = toB64Url(new TextEncoder().encode(JSON.stringify({ aud: `${protocol}//${host}`, exp: now + 43200, sub })));
  const input = `${hdr}.${pld}`;
  const key = await importPrivateKey(privKey, pubKey);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(input));
  return `${input}.${toB64Url(new Uint8Array(sig))}`;
}
function enc(s: string) { return new TextEncoder().encode(s); }
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}
async function hkdfExpand(prk: CryptoKey, info: Uint8Array, len: number): Promise<Uint8Array> {
  const t = new Uint8Array(0);
  const n = Math.ceil(len / 32);
  const out: Uint8Array[] = [];
  let prev = t;
  for (let i = 1; i <= n; i++) {
    const data = concat(prev, info, new Uint8Array([i]));
    const raw = await crypto.subtle.sign("HMAC", prk, data);
    prev = new Uint8Array(raw);
    out.push(prev);
  }
  return concat(...out).slice(0, len);
}
async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<CryptoKey> {
  const saltKey = await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", saltKey, ikm));
  return crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}
async function encryptPayload(p256dh: string, auth: string, plaintext: string): Promise<{ body: ArrayBuffer; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const clientPublicKey = fromB64Url(p256dh);
  const authSecret = fromB64Url(auth);
  const serverKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeyPair.publicKey));
  const clientPub = await crypto.subtle.importKey("raw", clientPublicKey, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedBits = await crypto.subtle.deriveBits({ name: "ECDH", public: clientPub }, serverKeyPair.privateKey, 256);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const authInfo = enc("Content-Encoding: auth\0");
  const prk = await hkdfExtract(authSecret, new Uint8Array(sharedBits));
  const ikm = await hkdfExpand(prk, authInfo, 32);
  const keyInfo = concat(enc("Content-Encoding: aesgcm\0"), enc("P-256\0"), new Uint8Array([0, 65]), clientPublicKey, new Uint8Array([0, 65]), serverPublicKeyRaw);
  const nonceInfo = concat(enc("Content-Encoding: nonce\0"), enc("P-256\0"), new Uint8Array([0, 65]), clientPublicKey, new Uint8Array([0, 65]), serverPublicKeyRaw);
  const prk2 = await hkdfExtract(salt, ikm);
  const contentKey = await hkdfExpand(prk2, keyInfo, 16);
  const nonce = await hkdfExpand(prk2, nonceInfo, 12);
  const key = await crypto.subtle.importKey("raw", contentKey, "AES-GCM", false, ["encrypt"]);
  const padded = concat(new Uint8Array(2), enc(plaintext));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, padded);
  return { body: encrypted, salt, serverPublicKey: serverPublicKeyRaw };
}

// ─── Type-specific configuration ─────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { urgency: string; ttl: number; icon?: string; actions?: { action: string; title: string }[] }> = {
  like:             { urgency: "normal", ttl: 86400,    icon: "❤️"  },
  comment:          { urgency: "high",   ttl: 86400,    icon: "💬",  actions: [{ action: "view", title: "View comment" }, { action: "reply", title: "Reply" }] },
  follow:           { urgency: "normal", ttl: 604800,   icon: "👤",  actions: [{ action: "profile", title: "View profile" }] },
  new_song:         { urgency: "normal", ttl: 604800,   icon: "🎵",  actions: [{ action: "play", title: "Play now" }] },
  repost:           { urgency: "low",    ttl: 604800,   icon: "🔁"  },
  news:             { urgency: "low",    ttl: 2592000,  icon: "📰",  actions: [{ action: "read", title: "Read article" }] },
  chat_reply:       { urgency: "high",   ttl: 3600,     icon: "💬",  actions: [{ action: "reply", title: "Reply" }] },
  chat_mention:     { urgency: "high",   ttl: 3600,     icon: "📢",  actions: [{ action: "view", title: "View chat" }] },
  chat_mention_all: { urgency: "high",   ttl: 3600,     icon: "📢",  actions: [{ action: "view", title: "View chat" }] },
  mood_vote:        { urgency: "low",    ttl: 604800,   icon: "🎭"  },
  live_start:       { urgency: "high",   ttl: 3600,     icon: "🔴",  actions: [{ action: "join", title: "Join Live" }] },
  live_invite:      { urgency: "high",   ttl: 3600,     icon: "🎙️", actions: [{ action: "join", title: "Join now" }] },
  queue_song:       { urgency: "normal", ttl: 3600,     icon: "🎵"  },
  achievement:      { urgency: "normal", ttl: 604800,   icon: "🏆",  actions: [{ action: "view", title: "View achievement" }] },
};

function getConfig(type: string) {
  return TYPE_CONFIG[type] ?? { urgency: "normal", ttl: 604800 };
}

// ─── Send web push ────────────────────────────────────────────────────────────
interface Sub { endpoint: string; p256dh: string; auth: string; user_id: string; }
interface Payload {
  title: string; body: string; icon?: string; badge?: string; url?: string;
  tag?: string; notifId?: string; renotify?: boolean; silent?: boolean;
  image?: string; actions?: { action: string; title: string }[];
}
interface SendResult { ok: boolean; status: number; endpoint: string; ms?: number; }

async function sendPush(sub: Sub, payload: Payload, PUB: string, PRIV: string, SUBJ: string, urgency: string, ttl: number): Promise<SendResult> {
  const t0 = Date.now();
  const jwt = await makeVapidJWT(sub.endpoint, PUB, PRIV, SUBJ);
  const json = JSON.stringify(payload);
  const { body, salt, serverPublicKey } = await encryptPayload(sub.p256dh, sub.auth, json);
  const headers: Record<string, string> = {
    "Content-Type":     "application/octet-stream",
    "Content-Encoding": "aesgcm",
    "Encryption":       `salt=${toB64Url(salt)}`,
    "Crypto-Key":       `dh=${toB64Url(serverPublicKey)};p256ecdsa=${PUB}`,
    "Authorization":    `vapid t=${jwt},k=${PUB}`,
    "TTL":              String(ttl),
    "Urgency":          urgency,
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt - 1)));
    try {
      const res = await fetch(sub.endpoint, { method: "POST", headers, body });
      const ms = Date.now() - t0;
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "5", 10);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }
      return { ok: res.ok, status: res.status, endpoint: sub.endpoint, ms };
    } catch { if (attempt === 2) return { ok: false, status: 0, endpoint: sub.endpoint, ms: Date.now() - t0 }; }
  }
  return { ok: false, status: 0, endpoint: sub.endpoint, ms: Date.now() - t0 };
}

async function sendBatch(subs: Sub[], payload: Payload, PUB: string, PRIV: string, SUBJ: string, urgency: string, ttl: number, batchSize = 10): Promise<SendResult[]> {
  const results: SendResult[] = [];
  for (let i = 0; i < subs.length; i += batchSize) {
    const batch = subs.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(s => sendPush(s, payload, PUB, PRIV, SUBJ, urgency, ttl)));
    results.push(...batchResults);
  }
  return results;
}

// ─── Rate limiter check ───────────────────────────────────────────────────────
async function checkRateLimit(db: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  try {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count } = await db
      .from("push_notification_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneHourAgo)
      .eq("status", "sent");
    return (count ?? 0) < 60;
  } catch { return true; }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const t0 = Date.now();

  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  // ── Environment ──────────────────────────────────────────────────────────
  const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const PUB              = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const PRIV             = Deno.env.get("VAPID_PRIVATE_KEY")!;
  const SUBJ             = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@novasound.app";
  const WEBHOOK_SECRET   = Deno.env.get("PUSH_WEBHOOK_SECRET");
  const BATCH_SIZE       = parseInt(Deno.env.get("PUSH_BATCH_SIZE") || "10", 10);

  if (!SUPABASE_URL || !SERVICE_KEY || !PUB || !PRIV) {
    return new Response(JSON.stringify({ error: "Missing environment variables" }), { status: 500 });
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader    = req.headers.get("Authorization") || "";
  const webhookSecret = req.headers.get("X-Webhook-Secret") || "";
  const isWebhook     = WEBHOOK_SECRET && webhookSecret === WEBHOOK_SECRET;
  const isServiceRole = authHeader.includes(SERVICE_KEY);

  // Allow: service_role key, webhook, or valid anon+JWT
  let db = createClient(SUPABASE_URL, SERVICE_KEY);

  if (!isWebhook && !isServiceRole) {
    // Verify anon key + JWT
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!ANON_KEY || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const userDb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user }, error } = await userDb.auth.getUser();
    if (error || !user) {
      return new Response(JSON.stringify({ error: "Invalid JWT" }), { status: 401 });
    }
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let rec: Record<string, unknown>;
  try {
    rec = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const {
    user_id: userId,
    title, body: bodyText, url, icon, image, actions, renotify, silent,
    notif_id: notifId,
    type = "default",
    broadcast: isBroadcast = false,
  } = rec as {
    user_id?: string; title: string; body: string; url?: string; icon?: string; image?: string;
    actions?: { action: string; title: string }[]; renotify?: boolean; silent?: boolean;
    notif_id?: string; type?: string; broadcast?: boolean;
  };

  // Validate required fields
  if (!title || !bodyText) {
    return new Response(JSON.stringify({ error: "Missing required fields: title, body" }), { status: 400 });
  }
  if (!isBroadcast && !userId) {
    return new Response(JSON.stringify({ error: "user_id required for targeted push" }), { status: 400 });
  }

  // ── Idempotency guard ────────────────────────────────────────────────────
  if (notifId) {
    try {
      const { data: already } = await db
        .from("push_notification_logs")
        .select("id")
        .eq("notif_id", notifId)
        .eq("status", "sent")
        .limit(1)
        .maybeSingle();
      if (already) {
        console.log(`[Push] notif_id=${notifId} already sent, skipping`);
        return new Response(JSON.stringify({ sent: 0, reason: "already_sent", notif_id: notifId }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
    } catch (_) {}
  }

  // ── Rate limit check (non-broadcast only) ────────────────────────────────
  if (!isBroadcast && userId) {
    const allowed = await checkRateLimit(db, userId);
    if (!allowed) {
      console.warn(`[Push] Rate limit hit for user_id=${userId}`);
      return new Response(JSON.stringify({ sent: 0, reason: "rate_limited" }), { status: 429, headers: { "Content-Type": "application/json" } });
    }
  }

  // ── Type config ──────────────────────────────────────────────────────────
  const typeCfg = getConfig(type as string);
  const urgency = typeCfg.urgency;
  const ttl     = typeCfg.ttl;
  
  // Build icon: prefer explicit icon, else type emoji, else default
  const finalIcon  = (icon as string) || (typeCfg.icon ? undefined : "/icon-192.png");
  const finalActions = (actions as { action: string; title: string }[]) ?? typeCfg.actions;

  // ── Fetch subscriptions ──────────────────────────────────────────────────
  let query = db.from("push_subscriptions").select("endpoint,p256dh,auth,user_id");
  if (!isBroadcast) query = query.eq("user_id", userId!);

  const { data: subs, error: dbErr } = await query;
  if (dbErr) {
    console.error("[Push] DB error:", dbErr);
    return new Response(JSON.stringify({ error: dbErr.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  if (!subs?.length) {
    return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  // ── Build payload ────────────────────────────────────────────────────────
  const payload: Payload = {
    title, body: bodyText,
    icon:    finalIcon || "/icon-192.png",
    badge:   "/notification-badge.png",
    url,
    tag:     `novasound-${type}-${notifId || Date.now()}`,
    notifId,
    renotify: Boolean(renotify),
    silent:   Boolean(silent),
    ...(image        ? { image }        : {}),
    ...(finalActions ? { actions: finalActions } : {}),
  };

  console.log(`[Push V400000] type=${type} urgency=${urgency} ttl=${ttl}s subs=${subs.length} broadcast=${isBroadcast}`);

  // ── Send ─────────────────────────────────────────────────────────────────
  const results = await sendBatch(subs as Sub[], payload, PUB, PRIV, SUBJ, urgency, ttl, BATCH_SIZE);

  // ── Classify results ─────────────────────────────────────────────────────
  const expired: string[] = [];
  let sentCount = 0;
  let totalMs   = 0;
  for (const r of results) {
    if (r.ok) sentCount++;
    else if (r.status === 404 || r.status === 410) expired.push(r.endpoint);
    totalMs += r.ms ?? 0;
  }

  // ── Purge expired subscriptions ──────────────────────────────────────────
  if (expired.length) {
    const { error: purgeErr } = await db.from("push_subscriptions").delete().in("endpoint", expired);
    if (purgeErr) console.error("[Push] Purge error:", purgeErr);
    else console.log(`[Push] Purged ${expired.length} expired sub(s)`);
  }

  // ── Mark notification as pushed ──────────────────────────────────────────
  if (sentCount > 0 && notifId && !isBroadcast) {
    try {
      await db.from("notifications")
        .update({ push_sent: true, push_sent_at: new Date().toISOString() })
        .eq("id", notifId);
    } catch (_) {}
  }

  // ── Delivery log ─────────────────────────────────────────────────────────
  try {
    await db.from("push_notification_logs").insert({
      notif_id:     notifId || null,
      user_id:      userId  || null,
      type,
      is_broadcast: isBroadcast,
      total:        results.length,
      sent:         sentCount,
      failed:       results.length - sentCount,
      purged:       expired.length,
      avg_ms:       results.length > 0 ? Math.round(totalMs / results.length) : 0,
      status:       sentCount > 0 ? "sent" : "failed",
    });
  } catch (_) {}

  const elapsed = Date.now() - t0;
  console.log(`[Push V400000] Done ${elapsed}ms | sent=${sentCount}/${results.length} purged=${expired.length}`);

  return new Response(
    JSON.stringify({ sent: sentCount, failed: results.length - sentCount, total: results.length, purged: expired.length, elapsed_ms: elapsed, type }),
    { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
  );
});
