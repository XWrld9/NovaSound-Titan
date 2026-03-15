/**
 * ⚡ EDGE FUNCTION FINALE - NovaSound TITAN LUX v1000001
 *
 * ✅ CORRECTIF v1000001 :
 * - encryptPayload réécrit selon RFC 8291 (Web Push Message Encryption)
 * - concat() helper ajouté pour l'assemblage des buffers
 * - Dérivation ECDH correcte : clé privée éphémère + clé publique subscriber
 * - IKM via HKDF(salt=auth_secret, ikm=ecdh_secret, info=keyInfo) conforme RFC 8291
 * - CEK et NONCE via HKDF(salt=randomSalt, ikm=ikm, info=...) conforme RFC 8188
 * - Header aes128gcm correct : salt(16) + rs(4) + idlen(1) + ephemeral_public(65)
 * - Padding record final avec délimiteur 0x02
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://tleuzlyfelrnykpbwhkc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZXV6bHlmZWxybnlrcGJ3aGtjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU4Njg5NSwiZXhwIjoyMDg3MTYyODk1fQ.AxYNyho-IywJt4-5bpyL8rQ0cN9W1J4f-o2cxeaABK4';

const VAPID_PUBLIC_KEY  = 'BOfOThRQ1WFrroj7sGuIVy-R2u--fgE_1_FInA6OwhrhdY2lomv7Co4gMXLRvZg257FbDztvNOgYWqCbk8C4qZc';
const VAPID_PRIVATE_KEY = 'd1UoZRYkI4T6Uo7y5cF7byqXXX60LaMEt8wXtX1eG7A';
const VAPID_SUBJECT     = 'mailto:eloadxfamily@gmail.com';

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

/** Concatène plusieurs Uint8Array en un seul. */
function concat(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
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

async function makeVapidJWT(endpoint: string, pub: string, priv: string, sub: string): Promise<string> {
  const header  = { alg: "ES256", typ: "JWT" };
  const now     = Math.floor(Date.now() / 1000);
  const payload = { sub, aud: new URL(endpoint).origin, exp: now + 12 * 3600, iat: now };
  const key     = await importPrivateKey(priv, pub);

  const encodedHeader  = toB64Url(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = toB64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signInput      = `${encodedHeader}.${encodedPayload}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signInput)
  );
  return `${signInput}.${toB64Url(new Uint8Array(signature))}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// encryptPayload — RFC 8291 + RFC 8188 (aes128gcm)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Chiffre `data` pour la livraison Web Push.
 *
 * Algorithme :
 *   1. Générer une paire éphémère ECDH P-256
 *   2. ECDH(privateEphemeral, subscriberPublic) → ecdhSecret
 *   3. IKM = HKDF(salt=authSecret, ikm=ecdhSecret, info="WebPush: info\x00"+sub_pub+eph_pub, L=32)
 *   4. salt₂ = 16 octets aléatoires
 *   5. CEK   = HKDF(salt=salt₂, ikm=IKM, info="Content-Encoding: aes128gcm\x00\x01", L=16)
 *   6. NONCE = HKDF(salt=salt₂, ikm=IKM, info="Content-Encoding: nonce\x00\x01",     L=12)
 *   7. ciphertext = AES-128-GCM(CEK, NONCE, plaintext || 0x02)
 *   8. Retourner : header_aes128gcm || ciphertext
 *      header = salt₂(16) + rs(4, BE=4096) + idlen(1=65) + ephemeralPublic(65)
 */
async function encryptPayload(data: string, p256dhB64: string, authB64: string): Promise<Uint8Array> {
  const enc = new TextEncoder();

  // Clés subscriber
  const subscriberPublic = fromB64Url(p256dhB64); // 65 octets, non-compressé
  const authSecret       = fromB64Url(authB64);   // 16 octets

  // 1. Paire éphémère
  const ephemeral = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
  );
  const ephemeralPublicRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", ephemeral.publicKey)
  ); // 65 octets

  // 2. Import clé publique subscriber
  const subscriberPublicKey = await crypto.subtle.importKey(
    "raw", subscriberPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false, []
  );

  // 3. ECDH → secret partagé (256 bits)
  const ecdhBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: subscriberPublicKey },
    ephemeral.privateKey, // ✅ clé PRIVÉE éphémère (bug corrigé)
    256
  );

  // 4. Import ecdhSecret comme clé HKDF
  const ecdhKey = await crypto.subtle.importKey(
    "raw", ecdhBits, { name: "HKDF" }, false, ["deriveBits"]
  );

  // 5. IKM via RFC 8291
  //    keyInfo = "WebPush: info\x00" || subscriberPublic(65) || ephemeralPublic(65)
  const keyInfo = concat([
    enc.encode("WebPush: info\x00"),
    subscriberPublic,
    ephemeralPublicRaw,
  ]);
  //    IKM = HKDF(salt=authSecret, ikm=ecdhSecret, info=keyInfo, L=32)
  //          ↳ sous le capot : Extract(authSecret, ecdhSecret) → PRK
  //                            Expand(PRK, keyInfo, 32)        → IKM
  const ikmBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authSecret, info: keyInfo },
    ecdhKey, 256
  );

  // 6. Sel aléatoire pour le chiffrement de contenu (RFC 8188)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 7. Import IKM comme clé HKDF
  const ikmKey = await crypto.subtle.importKey(
    "raw", ikmBits, { name: "HKDF" }, false, ["deriveBits"]
  );

  // 8. CEK = HKDF(salt, IKM, "Content-Encoding: aes128gcm\x00\x01", 16)
  const cekInfo = concat([enc.encode("Content-Encoding: aes128gcm\x00"), new Uint8Array([1])]);
  const cekBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: cekInfo },
    ikmKey, 128
  );

  // 9. NONCE = HKDF(salt, IKM, "Content-Encoding: nonce\x00\x01", 12)
  const nonceInfo = concat([enc.encode("Content-Encoding: nonce\x00"), new Uint8Array([1])]);
  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
    ikmKey, 96
  );

  // 10. Import CEK pour AES-GCM
  const cek = await crypto.subtle.importKey(
    "raw", cekBits, { name: "AES-GCM" }, false, ["encrypt"]
  );

  // 11. Chiffrement AES-128-GCM
  //     plaintext = data + 0x02 (délimiteur dernier enregistrement RFC 8188)
  const plaintext        = enc.encode(data);
  const paddedPlaintext  = concat([plaintext, new Uint8Array([2])]);

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: new Uint8Array(nonceBits) },
      cek,
      paddedPlaintext
    )
  );

  // 12. Header aes128gcm : salt(16) + rs(4, BE) + idlen(1) + ephemeralPublic(65)
  const rsBytes = new Uint8Array(4);
  new DataView(rsBytes.buffer).setUint32(0, 4096, false); // record size = 4096

  const header = concat([
    salt,                                        // 16 octets
    rsBytes,                                     // 4 octets
    new Uint8Array([ephemeralPublicRaw.length]), // 1 octet = 65
    ephemeralPublicRaw,                          // 65 octets
  ]);

  return concat([header, ciphertext]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Sub { endpoint: string; p256dh: string; auth: string; user_id?: string; }
interface PushAction { action: string; title: string; icon?: string; }
interface Payload {
  title: string; body: string; icon: string; badge: string; url: string;
  tag: string; notifId: string; image?: string; actions?: PushAction[];
  renotify?: boolean; silent?: boolean; timestamp?: number;
}
interface SendResult { ok: boolean; status?: number; endpoint: string; user_id?: string; retries?: number; ms?: number; }

// ─────────────────────────────────────────────────────────────────────────────
// Types de notifications supportés (22/22)
// ─────────────────────────────────────────────────────────────────────────────
const SUPPORTED_TYPES = [
  'like', 'like_song', 'like_news',
  'comment', 'comment_news', 'reply', 'mention',
  'follow', 'repost',
  'new_song', 'queue_song', 'mood_vote',
  'news',
  'chat_reply', 'chat_mention', 'chat_mention_all',
  'live_start', 'live_started', 'live_invite', 'live_join', 'live_comment', 'live_like', 'live_leave',
  'achievement', 'broadcast',
];

// ─────────────────────────────────────────────────────────────────────────────
// Urgency & TTL
// ─────────────────────────────────────────────────────────────────────────────
const URGENCY_MAP: Record<string, string> = {
  like:"low", like_song:"low", repost:"low", mood_vote:"low",
  comment:"normal", comment_news:"normal", reply:"normal", mention:"normal", follow:"normal",
  new_song:"normal", queue_song:"normal",
  news:"low",
  chat_reply:"high", chat_mention:"high", chat_mention_all:"high",
  live_start:"high", live_started:"high", live_invite:"high", live_comment:"high",
  live_join:"high", live_like:"normal", live_leave:"normal",
  achievement:"high", broadcast:"normal",
  default:"normal",
};

const TTL_MAP: Record<string, number> = {
  live_start:3600, live_started:3600, live_invite:3600, live_like:3600,
  live_comment:3600, live_join:3600, live_leave:1800,
  chat_reply:86400, chat_mention:86400, chat_mention_all:86400,
  queue_song:3600,
  news:2592000,
  like:604800, like_song:604800, comment:604800, comment_news:604800,
  reply:604800, mention:604800, follow:604800, repost:604800,
  new_song:604800, mood_vote:604800,
  achievement:604800, broadcast:604800,
  default:86400,
};

const getUrgency = (t: string) => URGENCY_MAP[t] ?? URGENCY_MAP.default;
const getTTL     = (t: string) => TTL_MAP[t]     ?? TTL_MAP.default;
const sleep      = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// sendOne — retry + backoff exponentiel
// ─────────────────────────────────────────────────────────────────────────────
async function sendOne(
  s: Sub, p: Payload,
  pub: string, priv: string, subj: string,
  urgency: string, ttl: number
): Promise<SendResult> {
  const t0 = Date.now();
  let lastStatus = 0;

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
      if (res.ok) return { ok: true,  status: res.status, endpoint: s.endpoint, user_id: s.user_id, ms: Date.now() - t0 };
      if (res.status === 404 || res.status === 410)
        return { ok: false, status: res.status, endpoint: s.endpoint, user_id: s.user_id, ms: Date.now() - t0 };
    } catch {
      lastStatus = 0;
    }
  }
  return { ok: false, status: lastStatus, endpoint: s.endpoint, user_id: s.user_id, ms: Date.now() - t0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// sendBatch — concurrence limitée à 10
// ─────────────────────────────────────────────────────────────────────────────
async function sendBatch(
  subs: Sub[], payload: Payload,
  pub: string, priv: string, subj: string,
  urgency: string, ttl: number
): Promise<SendResult[]> {
  const results: SendResult[] = [];
  for (let i = 0; i < subs.length; i += 10) {
    const settled = await Promise.allSettled(
      subs.slice(i, i + 10).map(s => sendOne(s, payload, pub, priv, subj, urgency, ttl))
    );
    for (const r of settled)
      results.push(r.status === "fulfilled" ? r.value : { ok: false, status: 0, endpoint: "unknown" });
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler principal
// ─────────────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age":       "86400",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET" && req.url.includes("/health")) {
    return new Response(JSON.stringify({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "v1000001",
      supported_types: SUPPORTED_TYPES.length,
      vapid_configured: !!VAPID_PUBLIC_KEY,
      features: [
        "22 notification types supported",
        "RFC 8291 compliant Web Push encryption (fixed)",
        "Achievement notifications with high urgency",
        "Broadcast notifications with TTL management",
        "Correct ephemeral ECDH key derivation",
        "Retry exponential backoff",
        "Batch processing with concurrency control",
        "Automatic subscription cleanup",
      ],
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json();
    const {
      user_id, target_user_ids, broadcast, type,
      title, body: notifBody, url, icon, image, actions,
      renotify, silent, notif_id,
    } = body;

    if (!type || !SUPPORTED_TYPES.includes(type)) {
      return new Response(JSON.stringify({
        error: "Invalid notification type",
        supported_types: SUPPORTED_TYPES,
        received_type: type,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token    = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Récupérer les abonnements
    let query;
    if (user_id) {
      query = supabase.from("push_subscriptions").select("*").eq("user_id", user_id).is("deleted_at", null);
    } else if (target_user_ids && Array.isArray(target_user_ids)) {
      query = supabase.from("push_subscriptions").select("*").in("user_id", target_user_ids).is("deleted_at", null);
    } else if (broadcast) {
      query = supabase.from("push_subscriptions").select("*").is("deleted_at", null).limit(1000);
    } else {
      return new Response(JSON.stringify({ error: "Missing target specification" }), { status: 400 });
    }

    const { data: subs, error: dbErr } = await query;
    if (dbErr)    return new Response(JSON.stringify({ error: dbErr.message }), { status: 500 });
    if (!subs?.length) return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), { status: 200 });

    const payload: Payload = {
      title,
      body:     notifBody,
      icon:     icon || "/icon-192.png",
      badge:    "/notification-badge.png",
      url:      url  || "/",
      tag:      `novasound-${notif_id || Date.now()}`,
      notifId:  notif_id || Date.now().toString(),
      timestamp: Date.now(),
      renotify: Boolean(renotify),
      silent:   Boolean(silent),
      ...(image   ? { image }   : {}),
      ...(actions ? { actions } : {}),
    };

    const urgency = getUrgency(type);
    const ttl     = getTTL(type);
    console.log(`[Push v1000001] → ${subs.length} sub(s) | type=${type} urgency=${urgency} ttl=${ttl}s broadcast=${broadcast}`);

    const results = await sendBatch(subs as Sub[], payload, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, urgency, ttl);

    const expired: string[] = [];
    let sentCount = 0, totalMs = 0;
    for (const r of results) {
      if (r.ok) sentCount++;
      else if (r.status === 404 || r.status === 410) expired.push(r.endpoint);
      totalMs += r.ms ?? 0;
    }

    if (expired.length) {
      const { error: purgeErr } = await supabase.from("push_subscriptions").delete().in("endpoint", expired);
      if (purgeErr) console.error("[Push] Purge error:", purgeErr);
      else          console.log(`[Push] Purged ${expired.length} expired sub(s)`);
    }

    await supabase.from("push_notification_logs").insert({
      notif_id,
      user_id,
      type,
      is_broadcast: !!broadcast,
      total:   subs.length,
      sent:    sentCount,
      failed:  subs.length - sentCount,
      purged:  expired.length,
      avg_ms:  Math.round(totalMs / subs.length),
      status:  sentCount === subs.length ? "sent" : sentCount > 0 ? "partial" : "failed",
      created_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({
      success: true,
      results: {
        total:   subs.length,
        sent:    sentCount,
        failed:  subs.length - sentCount,
        purged:  expired.length,
        avg_ms:  Math.round(totalMs / subs.length),
        type, urgency, ttl,
        timestamp: new Date().toISOString(),
      },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[Push v1000001] Error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: error.message,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
