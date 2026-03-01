/**
 * send-push — Supabase Edge Function
 * NovaSound TITAN LUX v800
 * © 2026 NovaSound TITAN LUX — ELOADXFAMILY
 *
 * Reçoit un payload de notification et envoie les Web Push
 * à tous les appareils enregistrés de l'utilisateur cible.
 *
 * Compatible : Android (Chrome/Firefox), PC (Chrome/Firefox/Edge), iOS 16.4+ PWA
 *
 * Variables d'environnement requises dans Supabase :
 *   VAPID_PUBLIC_KEY   — clé publique VAPID (base64url)
 *   VAPID_PRIVATE_KEY  — clé privée VAPID (base64url)
 *   VAPID_SUBJECT      — mailto: ou URL du site
 *   SUPABASE_URL       — URL du projet Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — clé service role
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Helpers Web Push ─────────────────────────────────────────────

function base64UrlToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

function uint8ArrayToBase64Url(array: Uint8Array): string {
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateVapidHeaders(
  endpoint: string,
  vapidPublic: string,
  vapidPrivate: string,
  subject: string
): Promise<Record<string, string>> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 12 * 3600; // 12h

  // JWT header + payload
  const header  = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: audience, exp, sub: subject };

  const enc = (obj: object) =>
    uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(obj)));

  const signingInput = `${enc(header)}.${enc(payload)}`;

  // Import private key
  const privateKeyBytes = base64UrlToUint8Array(vapidPrivate);
  const key = await crypto.subtle.importKey(
    'raw', privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${uint8ArrayToBase64Url(new Uint8Array(sig))}`;

  return {
    Authorization: `vapid t=${jwt}, k=${vapidPublic}`,
    'Content-Type': 'application/json',
    TTL: '86400',
  };
}

async function encryptPayload(
  payload: string,
  p256dh: string,
  auth: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  // Générer la clé éphémère du serveur
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, ['deriveKey', 'deriveBits']
  );

  // Exporter la clé publique du serveur (non compressée = 65 bytes)
  const serverPublicKeyRaw = await crypto.subtle.exportKey('raw', serverKeyPair.publicKey);
  const serverPublicKey = new Uint8Array(serverPublicKeyRaw);

  // Importer la clé publique du client
  const clientPublicKeyBytes = base64UrlToUint8Array(p256dh);
  const clientPublicKey = await crypto.subtle.importKey(
    'raw', clientPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false, []
  );

  // Auth secret
  const authSecret = base64UrlToUint8Array(auth);

  // ECDH shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey },
    serverKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // Salt aléatoire (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // PRK via HKDF
  const prk = await crypto.subtle.importKey('raw', authSecret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prkHmac = new Uint8Array(await crypto.subtle.sign('HMAC', prk, concat(sharedSecret, new TextEncoder().encode('Content-Encoding: auth\0'))));

  const prkKey = await crypto.subtle.importKey('raw', prkHmac, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

  // Context string
  const context = concat(
    new TextEncoder().encode('P-256\0'),
    new Uint8Array([0, 65]), clientPublicKeyBytes,
    new Uint8Array([0, 65]), serverPublicKey
  );

  // CEK + nonce
  const cekInfo   = concat(new TextEncoder().encode('Content-Encoding: aesgcm\0'), context);
  const nonceInfo = concat(new TextEncoder().encode('Content-Encoding: nonce\0'), context);

  const cekBytes   = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, concat(cekInfo,   new Uint8Array([1]))));
  const nonceBytes = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, concat(nonceInfo, new Uint8Array([1]))));

  const cek   = cekBytes.slice(0, 16);
  const nonce = nonceBytes.slice(0, 12);

  // Chiffrer
  const cekKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const payloadBytes = new TextEncoder().encode(payload);
  const paddedPayload = concat(new Uint8Array(2), payloadBytes); // 2 bytes de padding length = 0

  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    cekKey,
    paddedPayload
  ));

  return { ciphertext, salt, serverPublicKey };
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) { result.set(arr, offset); offset += arr.length; }
  return result;
}

// ── Envoi d'un push à un endpoint ────────────────────────────────

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payloadObj: object,
  vapidPublic: string,
  vapidPrivate: string,
  vapidSubject: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const payloadStr = JSON.stringify(payloadObj);

  let headers: Record<string, string>;
  let body: Uint8Array | undefined;

  try {
    const { ciphertext, salt, serverPublicKey } = await encryptPayload(
      payloadStr,
      subscription.p256dh,
      subscription.auth
    );

    headers = await generateVapidHeaders(
      subscription.endpoint,
      vapidPublic,
      vapidPrivate,
      vapidSubject
    );
    headers['Content-Encoding'] = 'aesgcm';
    headers['Encryption'] = `salt=${uint8ArrayToBase64Url(salt)}`;
    headers['Crypto-Key']  = `dh=${uint8ArrayToBase64Url(serverPublicKey)}`;
    headers['Content-Length'] = String(ciphertext.length);
    delete headers['Content-Type']; // binaire, pas json

    body = ciphertext;
  } catch {
    // Fallback : envoi sans chiffrement (Chrome l'accepte parfois pour debug)
    headers = await generateVapidHeaders(subscription.endpoint, vapidPublic, vapidPrivate, vapidSubject);
    body = new TextEncoder().encode(payloadStr);
  }

  try {
    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers,
      body,
    });

    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ── Handler principal ─────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')  ?? '';
  const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT')     ?? 'mailto:eloadxfamily@gmail.com';
  const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')      ?? '';
  const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: {
    user_id: string;
    title: string;
    body: string;
    url?: string;
    icon?: string;
    tag?: string;
    badge?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  if (!body.user_id || !body.title) {
    return new Response(JSON.stringify({ error: 'user_id and title required' }), { status: 400 });
  }

  // Client Supabase avec service role pour accéder aux subscriptions
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Récupérer tous les appareils enregistrés de l'utilisateur
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', body.user_id);

  if (error || !subs?.length) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no subscriptions' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Payload push
  const pushPayload = {
    title:  body.title,
    body:   body.body || '',
    icon:   body.icon  || '/icon-192.png',
    badge:  body.badge || '/icon-192.png',
    url:    body.url   || '/',
    tag:    body.tag   || 'novasound',
    vibrate: [100, 50, 100],
    requireInteraction: false,
  };

  // Envoyer à tous les appareils en parallèle
  const results = await Promise.allSettled(
    subs.map(sub => sendWebPush(sub, pushPayload, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT))
  );

  // Nettoyer les subscriptions expirées (status 404 ou 410)
  const expired: string[] = [];
  results.forEach((res, i) => {
    if (res.status === 'fulfilled' && (res.value.status === 404 || res.value.status === 410)) {
      expired.push(subs[i].endpoint);
    }
  });
  if (expired.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expired);
  }

  const sent = results.filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<{ ok: boolean }>).value.ok).length;

  return new Response(
    JSON.stringify({ sent, total: subs.length, expired: expired.length }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  );
});
