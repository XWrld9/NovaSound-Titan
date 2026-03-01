/**
 * send-push-notification — Supabase Edge Function
 * NovaSound TITAN LUX v800
 * © 2026 NovaSound TITAN LUX — ELOADXFAMILY
 *
 * Déclenchement : Database Webhook → INSERT sur public.notifications
 * Compatible    : Android Chrome/Firefox, PC Chrome/Firefox/Edge/Safari, iOS 16.4+ PWA
 *
 * Env vars (Supabase Dashboard → Edge Functions → Secrets) :
 *   VAPID_PUBLIC_KEY          = BNyTAf5wmou_w-d62...
 *   VAPID_PRIVATE_KEY         = <ta clé privée — voir SETUP.md>
 *   VAPID_SUBJECT             = mailto:eloadxfamily@gmail.com
 *   SUPABASE_URL              = (automatique)
 *   SUPABASE_SERVICE_ROLE_KEY = (automatique)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Helpers base64url ──────────────────────────────────────────────────────

function toB64Url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - b64.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

// ── Import clé privée VAPID (format raw EC P-256 32 bytes) ────────────────

async function importPrivateKey(b64urlKey: string): Promise<CryptoKey> {
  const raw = fromB64Url(b64urlKey);

  // Construire enveloppe PKCS8 pour EC P-256
  const pkcs8Header = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00,
    0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
    0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  const pkcs8 = new Uint8Array(pkcs8Header.length + raw.length);
  pkcs8.set(pkcs8Header);
  pkcs8.set(raw, pkcs8Header.length);

  return crypto.subtle.importKey(
    "pkcs8", pkcs8.buffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  );
}

// ── Générer le JWT VAPID ───────────────────────────────────────────────────

async function makeVapidJWT(
  endpoint: string,
  publicKey: string,
  privateKeyB64: string,
  subject: string,
): Promise<string> {
  const { protocol, host } = new URL(endpoint);
  const audience = `${protocol}//${host}`;
  const now = Math.floor(Date.now() / 1000);

  const header  = toB64Url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = toB64Url(new TextEncoder().encode(JSON.stringify({ aud: audience, exp: now + 43200, sub: subject })));
  const input   = `${header}.${payload}`;

  const key = await importPrivateKey(privateKeyB64);
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(input)
  );

  return `${input}.${toB64Url(new Uint8Array(sig))}`;
}

// ── Chiffrement RFC 8291 (aes128gcm) ──────────────────────────────────────

async function encryptPayload(
  plaintext: string,
  p256dh: string,
  auth: string,
): Promise<{ body: Uint8Array }> {
  const receiverPub = fromB64Url(p256dh);
  const authSecret  = fromB64Url(auth);
  const salt        = crypto.getRandomValues(new Uint8Array(16));

  // Clé ECDH éphémère du serveur
  const serverPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
  );
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverPair.publicKey));

  // Importer la clé publique du navigateur
  const recvKey = await crypto.subtle.importKey(
    "raw", receiverPub, { name: "ECDH", namedCurve: "P-256" }, false, []
  );

  // ECDH → sharedSecret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: recvKey }, serverPair.privateKey, 256
  );

  // HKDF extract (PRK)
  const prkKey = await crypto.subtle.importKey("raw", sharedBits, { name: "HKDF" }, false, ["deriveBits"]);

  // info = "WebPush: info\0" + receiverPub + serverPubRaw
  const infoWebpush = concat(
    enc("WebPush: info\0"), receiverPub, serverPubRaw
  );
  const ikm = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: authSecret, info: infoWebpush },
    prkKey, 256
  );

  // HKDF pour CEK (Content Encryption Key) et IV
  const contentKey = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);

  const cekInfo   = enc("Content-Encoding: aes128gcm\0");
  const nonceInfo = enc("Content-Encoding: nonce\0");

  const cekBits   = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: cekInfo   }, contentKey, 128);
  const nonceBits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: nonceInfo }, contentKey, 96);

  const aesKey = await crypto.subtle.importKey("raw", cekBits, "AES-GCM", false, ["encrypt"]);
  const iv     = new Uint8Array(nonceBits);

  // Padder le plaintext (1 byte délimiteur RFC 8291)
  const data     = enc(plaintext);
  const padded   = new Uint8Array(data.length + 1);
  padded.set(data);
  padded[data.length] = 0x02; // pad delimiter

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, aesKey, padded)
  );

  // Construire le header RFC 8188 : salt(16) + rs(4) + keyidlen(1) + keyid(65)
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  const header = concat(salt, recordSize, new Uint8Array([serverPubRaw.length]), serverPubRaw);
  const body   = concat(header, ciphertext);

  return { body };
}

function enc(str: string): Uint8Array { return new TextEncoder().encode(str); }
function concat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

// ── Envoyer UN push ───────────────────────────────────────────────────────

interface Sub { endpoint: string; p256dh: string; auth: string; }
interface PushPayload {
  title: string; body: string; icon?: string; badge?: string;
  url?: string; tag?: string; notifId?: string;
  image?: string; timestamp?: number; renotify?: boolean;
}

async function sendOnePush(
  sub: Sub, payload: PushPayload,
  pubKey: string, privKey: string, subject: string,
): Promise<{ ok: boolean; status?: number; endpoint: string }> {
  try {
    const jwt         = await makeVapidJWT(sub.endpoint, pubKey, privKey, subject);
    const { body }    = await encryptPayload(JSON.stringify(payload), sub.p256dh, sub.auth);

    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        "Authorization":    `vapid t=${jwt},k=${pubKey}`,
        "Content-Type":     "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL":              "86400",
        "Urgency":          "normal",
      },
      body,
    });

    return { ok: res.ok, status: res.status, endpoint: sub.endpoint };
  } catch (err) {
    console.error("[Push] sendOnePush error:", err);
    return { ok: false, endpoint: sub.endpoint };
  }
}

// ── Handler principal ──────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type, Authorization" } });
  }
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const VAPID_PUB  = Deno.env.get("VAPID_PUBLIC_KEY")          ?? "";
  const VAPID_PRIV = Deno.env.get("VAPID_PRIVATE_KEY")         ?? "";
  const SUBJECT    = Deno.env.get("VAPID_SUBJECT")             ?? "mailto:eloadxfamily@gmail.com";
  const SB_URL     = Deno.env.get("SUPABASE_URL")              ?? "";
  const SB_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!VAPID_PUB || !VAPID_PRIV) {
    console.error("[Push] VAPID keys missing!");
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), { status: 500 });
  }

  let raw: Record<string, unknown>;
  try { raw = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  // Supporte à la fois l'appel direct et le format webhook Supabase
  const record = (raw.record ?? raw) as Record<string, unknown>;

  const userId  = record.user_id  as string;
  const title   = (record.title   as string) || "NovaSound TITAN LUX";
  const msgBody = (record.body    as string) || "";
  const url     = (record.url     as string) || "/";
  const icon    = (record.icon_url as string) || "/icon-192.png";
  const notifId = String(record.id ?? "");

  if (!userId) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400 });

  const supabase = createClient(SB_URL, SB_KEY);

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) { console.error("[Push] DB error:", error); return new Response(JSON.stringify({ error: error.message }), { status: 500 }); }
  if (!subs?.length) return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), { status: 200 });

  const pushPayload: PushPayload = {
    title,
    body:    msgBody,
    icon,
    badge:   "/notification-badge.png",  // ✅ v3000: icône monochrome pour barre de statut Android
    url,
    tag:     "novasound-" + (notifId || Date.now()),
    notifId,
    image:   (record.image_url as string) || undefined,
    timestamp: Date.now(),
  };

  const results = await Promise.allSettled(
    subs.map((s: Sub) => sendOnePush(s, pushPayload, VAPID_PUB, VAPID_PRIV, SUBJECT))
  );

  // Purger les subscriptions expirées (410 Gone ou 404 Not Found)
  const expired = results
    .filter(r => r.status === "fulfilled" && !r.value.ok && [404, 410].includes(r.value.status ?? 0))
    .map(r => (r as PromiseFulfilledResult<{ endpoint: string }>).value.endpoint);

  if (expired.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", expired);
    console.log("[Push] Purged expired subscriptions:", expired.length);
  }

  const sent   = results.filter(r => r.status === "fulfilled" && r.value.ok).length;
  const failed = results.length - sent;

  console.log(`[Push] user=${userId} | sent=${sent} | failed=${failed} | purged=${expired.length}`);

  return new Response(
    JSON.stringify({ sent, failed, total: results.length, purged: expired.length }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
