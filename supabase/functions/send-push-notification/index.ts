/**
 * send-push-notification — NovaSound TITAN LUX VTITAN_FINAL
 *
 * ✅ VTITAN_FINAL — Compatibilité PC/Desktop renforcée (Chrome FCM, Firefox, Edge, Safari macOS)
 * ✅ VTITAN_FINAL — Content-Length header ajouté (requis par certains push services desktop)
 * ✅ VTITAN_FINAL — Timestamp dans payload pour fraîcheur côté SW
 * ✅ VTITAN_FINAL — CORS headers corrects sur toutes les réponses
 * ✅ VTITAN_FINAL — Tous les types de notifications supportés
 * ✅ VTITAN_FINAL — Encryption aes128gcm moderne (RFC 8291)
 * ✅ VTITAN_FINAL — Retry exponentiel 3 tentatives
 * ✅ VTITAN_FINAL — Concurrence limitée à 10 envois parallèles
 * ✅ VTITAN_FINAL — Mode broadcast complet
 * ✅ VTITAN_FINAL — Idempotency guard via notif_id
 * ✅ VTITAN_FINAL — Purge automatique subscriptions 404/410
 * ✅ VTITAN_FINAL — Delivery tracking dans push_notification_logs
 * ✅ VTITAN_FINAL — Auth guard service_role + anon_key + JWT
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─────────────────────────────────────────────────────────────────────────────
// Crypto helpers
// ─────────────────────────────────────────────────────────────────────────────
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
    throw new Error(`Invalid EC public key: expected 65 bytes uncompressed, got ${raw.length}`);
  return { x: toB64Url(raw.slice(1, 33)), y: toB64Url(raw.slice(33, 65)) };
}

async function importPrivateKey(privB64url: string, pubB64url: string): Promise<CryptoKey> {
  const { x, y } = extractXY(pubB64url);
  return crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: privB64url, x, y, key_ops: ["sign"], ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  );
}

// ── VAPID JWT — l'audience est TOUJOURS l'origin de l'endpoint ───────────────
// Chrome Desktop → https://fcm.googleapis.com
// Firefox Desktop → https://updates.push.services.mozilla.com
// Safari/Edge → their own push services
async function makeVapidJWT(endpoint: string, pubKey: string, privKey: string, sub: string): Promise<string> {
  const url = new URL(endpoint);
  const aud = `${url.protocol}//${url.host}`;
  const now = Math.floor(Date.now() / 1000);
  const hdr = toB64Url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const pld = toB64Url(new TextEncoder().encode(JSON.stringify({ aud, exp: now + 43200, sub, iat: now })));
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

async function encryptPayload(plaintext: string, p256dh: string, auth: string): Promise<Uint8Array> {
  const recvPub = fromB64Url(p256dh);
  const authSec = fromB64Url(auth);
  const salt    = crypto.getRandomValues(new Uint8Array(16));
  const pair    = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const sPub    = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const rKey    = await crypto.subtle.importKey("raw", recvPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared  = await crypto.subtle.deriveBits({ name: "ECDH", public: rKey }, pair.privateKey, 256);
  const prk     = await crypto.subtle.importKey("raw", shared, { name: "HKDF" }, false, ["deriveBits"]);
  const ikm     = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authSec, info: concat(enc("WebPush: info\0"), recvPub, sPub) }, prk, 256
  );
  const ck    = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);
  const cek   = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: enc("Content-Encoding: aes128gcm\0") }, ck, 128);
  const nonce = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: enc("Content-Encoding: nonce\0") }, ck, 96);
  const aes   = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const data  = enc(plaintext);
  const padded = new Uint8Array(data.length + 1);
  padded.set(data); padded[data.length] = 0x02;
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: new Uint8Array(nonce), tagLength: 128 }, aes, padded));
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  return concat(concat(salt, rs, new Uint8Array([sPub.length]), sPub), cipher);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Sub { endpoint: string; p256dh: string; auth: string; user_id?: string; }
interface PushAction { action: string; title: string; icon?: string; }
interface Payload { title: string; body: string; icon: string; badge: string; url: string; tag: string; notifId: string; image?: string; actions?: PushAction[]; renotify?: boolean; silent?: boolean; timestamp?: number; }
interface SendResult { ok: boolean; status?: number; endpoint: string; user_id?: string; retries?: number; ms?: number; }

// ─────────────────────────────────────────────────────────────────────────────
// Urgency & TTL
// ─────────────────────────────────────────────────────────────────────────────
const URGENCY_MAP: Record<string, string> = {
  like:"low", comment:"normal", follow:"normal", new_song:"normal", repost:"low",
  news:"low", chat_reply:"high", chat_mention:"high", chat_mention_all:"high",
  mood_vote:"low", live_start:"high", live_started:"high", live_invite:"high",
  live_like:"normal", live_comment:"high", live_join:"high", live_leave:"normal",
  queue_song:"normal", achievement:"normal", default:"normal",
};
const TTL_MAP: Record<string, number> = {
  live_start:3600, live_started:3600, live_invite:3600, live_like:3600, live_comment:3600,
  live_join:3600, live_leave:1800, chat_reply:86400, chat_mention:86400, chat_mention_all:86400,
  like:604800, follow:604800, new_song:604800, comment:604800, repost:604800,
  mood_vote:604800, news:2592000, queue_song:3600, achievement:604800, default:86400,
};
const getUrgency = (t: string) => URGENCY_MAP[t] ?? URGENCY_MAP.default;
const getTTL     = (t: string) => TTL_MAP[t]     ?? TTL_MAP.default;
const sleep      = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// sendOne — retry + backoff
// ─────────────────────────────────────────────────────────────────────────────
async function sendOne(s: Sub, p: Payload, pub: string, priv: string, subj: string, urgency: string, ttl: number): Promise<SendResult> {
  const t0 = Date.now(); let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(300 * Math.pow(2, attempt - 1));
    try {
      const jwt  = await makeVapidJWT(s.endpoint, pub, priv, subj);
      const body = await encryptPayload(JSON.stringify(p), s.p256dh, s.auth);
      const res  = await fetch(s.endpoint, {
        method: "POST",
        headers: {
          "Authorization":    `vapid t=${jwt},k=${pub}`,
          "Content-Type":     "application/octet-stream",
          "Content-Encoding": "aes128gcm",
          "Content-Length":   String(body.length),
          "TTL":              String(ttl),
          "Urgency":          urgency,
        },
        body,
      });
      lastStatus = res.status;
      if (res.ok || res.status === 201) return { ok: true, status: res.status, endpoint: s.endpoint, user_id: s.user_id, retries: attempt, ms: Date.now() - t0 };
      if (res.status === 404 || res.status === 410) return { ok: false, status: res.status, endpoint: s.endpoint, user_id: s.user_id, retries: attempt, ms: Date.now() - t0 };
      if (res.status === 429) {
        const w = parseInt(res.headers.get("Retry-After") || "0") * 1000 || 300 * Math.pow(2, attempt);
        await sleep(Math.min(w, 10000)); continue;
      }
      if (res.status === 400) { let e = ''; try { e = await res.text(); } catch {} console.warn(`[Push] 400: ${e.slice(0,200)}`); return { ok: false, status: res.status, endpoint: s.endpoint, user_id: s.user_id, retries: attempt, ms: Date.now() - t0 }; }
      if (res.status >= 500) { console.warn(`[Push] ${res.status} retry ${attempt + 1}`); continue; }
      return { ok: false, status: res.status, endpoint: s.endpoint, user_id: s.user_id, retries: attempt, ms: Date.now() - t0 };
    } catch (e) {
      console.error(`[Push] exception attempt ${attempt + 1}:`, e);
      if (attempt === 2) return { ok: false, status: 0, endpoint: s.endpoint, user_id: s.user_id, retries: attempt, ms: Date.now() - t0 };
    }
  }
  return { ok: false, status: lastStatus, endpoint: s.endpoint, user_id: s.user_id, retries: 3, ms: Date.now() - t0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// sendBatch — concurrence 10
// ─────────────────────────────────────────────────────────────────────────────
async function sendBatch(subs: Sub[], payload: Payload, pub: string, priv: string, subj: string, urgency: string, ttl: number): Promise<SendResult[]> {
  const results: SendResult[] = [];
  for (let i = 0; i < subs.length; i += 10) {
    const settled = await Promise.allSettled(subs.slice(i, i + 10).map(s => sendOne(s, payload, pub, priv, subj, urgency, ttl)));
    for (const r of settled) results.push(r.status === "fulfilled" ? r.value : { ok: false, status: 0, endpoint: "unknown" });
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });

  const t0   = Date.now();
  const PUB  = Deno.env.get("VAPID_PUBLIC_KEY")          ?? "BOfOThRQ1WFrroj7sGuIVy-R2u--fgE_1_FInA6OwhrhdY2lomv7Co4gMXLRvZg257FbDztvNOgYWqCbk8C4qZc";
  const PRIV = Deno.env.get("VAPID_PRIVATE_KEY")         ?? "d1UoZRYkI4T6Uo7y5cF7byqXXX60LaMEt8wXtX1eG7A";
  const SUBJ = Deno.env.get("VAPID_SUBJECT")             ?? "mailto:eloadxfamily@gmail.com";
  const SURL = Deno.env.get("SUPABASE_URL")              ?? "https://tleuzlyfrelrnkpbwhkc.supabase.co";
  const SKEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZXV6bHlmZWxybnlrcGJ3aGtjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU4Njg5NSwiZXhwIjoyMDg3MTYyODk1fQ.AxYNyho-IywJt4-5bpyL8rQ0cN9W1J4f-o2cxeaABK4";
  const AKEY = Deno.env.get("SUPABASE_ANON_KEY")         ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZXV6bHlmZWxybnlrcGJ3aGtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODY4OTUsImV4cCI6MjA4NzE2Mjg5NX0.PEXcdsykNhIhtXOmprBkshqZfZ9qkc8WKmFbBNSn-II";

  if (!SURL || !SKEY) return json({ error: "Server configuration error" }, 500);

  const authH = req.headers.get("Authorization") ?? "";
  const token = authH.startsWith("Bearer ") ? authH.slice(7) : "";
  const isSR  = !!(SKEY && token === SKEY);
  const isAK  = !!(AKEY && token === AKEY);
  const isJWT = !isSR && !isAK && token.startsWith("eyJ") && token.split(".").length === 3;
  if (!token || (!isSR && !isAK && !isJWT)) return json({ error: "Unauthorized" }, 401);
  if (!PUB || !PRIV) return json({ error: "VAPID keys not configured" }, 500);
  try { extractXY(PUB); } catch (e: unknown) { return json({ error: `Invalid VAPID_PUBLIC_KEY: ${e instanceof Error ? e.message : e}` }, 500); }

  let raw: Record<string, unknown>;
  try { raw = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const rec         = (raw.record ?? raw) as Record<string, unknown>;
  const isBroadcast = Boolean(raw.broadcast ?? rec.broadcast);
  const userId      = rec.user_id as string | undefined;
  const notifId     = String(rec.id ?? rec.notif_id ?? "");
  const type        = (rec.type    as string) || "default";
  const title       = (rec.title   as string) || "NovaSound TITAN LUX";
  const body        = (rec.body    as string) || "";
  const url         = (rec.url     as string) || "/";
  const icon        = (rec.icon_url as string) || (rec.icon as string) || "/icon-192.png";
  const image       = (rec.image_url as string) || (rec.image as string) || undefined;
  const actions     = (rec.actions  as PushAction[]) || undefined;

  if (isBroadcast && !isSR) return json({ error: "Broadcast requires service_role authorization" }, 403);
  if (!isBroadcast && !userId) return json({ error: "user_id required" }, 400);

  const db = createClient(SURL, SKEY);

  // Idempotency
  if (notifId) {
    try {
      const { data: already } = await db.from("push_notification_logs").select("id").eq("notif_id", notifId).eq("status", "sent").limit(1).maybeSingle();
      if (already) return json({ sent: 0, reason: "already_sent", notif_id: notifId });
    } catch (_) {}
  }

  let query = db.from("push_subscriptions").select("endpoint,p256dh,auth,user_id");
  if (!isBroadcast) query = query.eq("user_id", userId!);
  const { data: subs, error: dbErr } = await query;
  if (dbErr) return json({ error: dbErr.message }, 500);
  if (!subs?.length) return json({ sent: 0, reason: "no_subscriptions" });

  const payload: Payload = {
    title, body, icon,
    badge:     "/notification-badge.png",
    url,
    tag:       `novasound-${notifId || Date.now()}`,
    notifId,
    timestamp: Date.now(),
    renotify:  Boolean(rec.renotify),
    silent:    Boolean(rec.silent),
    ...(image   ? { image }   : {}),
    ...(actions ? { actions } : {}),
  };

  const urgency = getUrgency(type);
  const ttl     = getTTL(type);
  console.log(`[Push] → ${subs.length} sub(s) | type=${type} urgency=${urgency} ttl=${ttl}s broadcast=${isBroadcast}`);

  const results = await sendBatch(subs as Sub[], payload, PUB, PRIV, SUBJ, urgency, ttl);

  const expired: string[] = [];
  let sentCount = 0, totalMs = 0;
  for (const r of results) {
    if (r.ok) sentCount++;
    else if (r.status === 404 || r.status === 410) expired.push(r.endpoint);
    totalMs += r.ms ?? 0;
  }

  if (expired.length) {
    const { error: purgeErr } = await db.from("push_subscriptions").delete().in("endpoint", expired);
    if (purgeErr) console.error("[Push] Purge error:", purgeErr);
    else console.log(`[Push] Purged ${expired.length} expired sub(s)`);
  }

  if (sentCount > 0 && notifId && !isBroadcast) {
    try { await db.from("notifications").update({ push_sent: true, push_sent_at: new Date().toISOString() }).eq("id", notifId); } catch (_) {}
  }

  try {
    await db.from("push_notification_logs").insert({
      notif_id: notifId || null, user_id: userId || null, type, is_broadcast: isBroadcast,
      total: results.length, sent: sentCount, failed: results.length - sentCount,
      purged: expired.length, avg_ms: results.length > 0 ? Math.round(totalMs / results.length) : 0,
      status: sentCount > 0 ? "sent" : "failed",
    });
  } catch (_) {}

  const elapsed = Date.now() - t0;
  console.log(`[Push] Done ${elapsed}ms | sent=${sentCount}/${results.length} purged=${expired.length}`);

  return json({ sent: sentCount, failed: results.length - sentCount, total: results.length, purged: expired.length, elapsed_ms: elapsed });
});
