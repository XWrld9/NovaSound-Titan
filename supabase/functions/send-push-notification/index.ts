/**
 * send-push-notification — NovaSound V28000
 *
 * FIXES v28000 :
 * ✅ x/y VAPID hardcodés → désormais extraits dynamiquement depuis VAPID_PUBLIC_KEY
 * ✅ Support icon_url + icon (compatibilité)
 * ✅ Logs détaillés des erreurs push par endpoint
 * ✅ Purge automatique subscriptions 404/410
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function toB64Url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64Url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - b64.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

// ✅ FIX: x/y extraits dynamiquement depuis la clé publique non compressée (65 bytes)
function extractXY(pubKeyB64url: string): { x: string; y: string } {
  const raw = fromB64Url(pubKeyB64url);
  if (raw.length !== 65 || raw[0] !== 0x04) throw new Error(`Invalid EC key length: ${raw.length}`);
  return { x: toB64Url(raw.slice(1, 33)), y: toB64Url(raw.slice(33, 65)) };
}

async function importPrivateKey(privB64url: string, pubB64url: string): Promise<CryptoKey> {
  const { x, y } = extractXY(pubB64url);
  return crypto.subtle.importKey("jwk",
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
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

async function encryptPayload(plaintext: string, p256dh: string, auth: string): Promise<Uint8Array> {
  const recvPub = fromB64Url(p256dh), authSec = fromB64Url(auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const sPub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const rKey = await crypto.subtle.importKey("raw", recvPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = await crypto.subtle.deriveBits({ name: "ECDH", public: rKey }, pair.privateKey, 256);
  const prk = await crypto.subtle.importKey("raw", shared, { name: "HKDF" }, false, ["deriveBits"]);
  const ikm = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: authSec, info: concat(enc("WebPush: info\0"), recvPub, sPub) }, prk, 256);
  const ck = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);
  const cek = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: enc("Content-Encoding: aes128gcm\0") }, ck, 128);
  const nonce = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: enc("Content-Encoding: nonce\0") }, ck, 96);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const data = enc(plaintext), padded = new Uint8Array(data.length + 1);
  padded.set(data); padded[data.length] = 0x02;
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: new Uint8Array(nonce), tagLength: 128 }, aes, padded));
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096, false);
  return concat(concat(salt, rs, new Uint8Array([sPub.length]), sPub), cipher);
}

interface Sub { endpoint: string; p256dh: string; auth: string; }
interface Payload { title: string; body: string; icon: string; badge: string; url: string; tag: string; notifId: string; }

async function sendOne(s: Sub, p: Payload, pub: string, priv: string, subj: string) {
  try {
    const jwt = await makeVapidJWT(s.endpoint, pub, priv, subj);
    const body = await encryptPayload(JSON.stringify(p), s.p256dh, s.auth);
    const res = await fetch(s.endpoint, {
      method: "POST",
      headers: { "Authorization": `vapid t=${jwt},k=${pub}`, "Content-Type": "application/octet-stream", "Content-Encoding": "aes128gcm", "TTL": "86400", "Urgency": "normal" },
      body,
    });
    if (!res.ok) console.warn(`[Push] ${s.endpoint.slice(-20)}: ${res.status}`);
    return { ok: res.ok, status: res.status, endpoint: s.endpoint };
  } catch (e) {
    console.error("[Push] sendOne error:", e);
    return { ok: false, endpoint: s.endpoint };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type, Authorization" } });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const PUB  = Deno.env.get("VAPID_PUBLIC_KEY")          ?? "";
  const PRIV = Deno.env.get("VAPID_PRIVATE_KEY")         ?? "";
  const SUBJ = Deno.env.get("VAPID_SUBJECT")             ?? "mailto:eloadxfamily@gmail.com";
  const SURL = Deno.env.get("SUPABASE_URL")              ?? "";
  const SKEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!PUB || !PRIV) return new Response(JSON.stringify({ error: "VAPID keys not configured" }), { status: 500 });
  try { extractXY(PUB); } catch { return new Response(JSON.stringify({ error: "Invalid VAPID_PUBLIC_KEY" }), { status: 500 }); }

  let raw: Record<string, unknown>;
  try { raw = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const rec     = (raw.record ?? raw) as Record<string, unknown>;
  const userId  = rec.user_id   as string;
  const title   = (rec.title    as string) || "NovaSound TITAN LUX";
  const body    = (rec.body     as string) || "";
  const url     = (rec.url      as string) || "/";
  const icon    = (rec.icon_url as string) || (rec.icon as string) || "/icon-192.png";
  const notifId = String(rec.id ?? "");

  if (!userId) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400 });

  const db = createClient(SURL, SKEY);
  const { data: subs, error } = await db.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", userId);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!subs?.length) return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), { status: 200 });

  const payload: Payload = { title, body, icon, badge: "/notification-badge.png", url, tag: `novasound-${notifId || Date.now()}`, notifId };
  const results = await Promise.allSettled(subs.map((s: Sub) => sendOne(s, payload, PUB, PRIV, SUBJ)));

  const expired = results
    .filter(r => r.status === "fulfilled" && !(r as PromiseFulfilledResult<{ok:boolean;status?:number;endpoint:string}>).value.ok && [404,410].includes((r as PromiseFulfilledResult<{ok:boolean;status?:number;endpoint:string}>).value.status ?? 0))
    .map(r => (r as PromiseFulfilledResult<{endpoint:string}>).value.endpoint);
  if (expired.length) await db.from("push_subscriptions").delete().in("endpoint", expired);

  const sent = results.filter(r => r.status === "fulfilled" && (r as PromiseFulfilledResult<{ok:boolean}>).value.ok).length;
  console.log(`[Push] user=${userId} sent=${sent}/${results.length} purged=${expired.length}`);
  return new Response(JSON.stringify({ sent, failed: results.length - sent, total: results.length, purged: expired.length }), { status: 200, headers: { "Content-Type": "application/json" } });
});
