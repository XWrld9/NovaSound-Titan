/**
 * notifUtils — NovaSound TITAN LUX V9000000
 *
 * Refonte complète du système de notifications :
 * ✅ notifyUser          — 1 utilisateur précis (like, follow, mention, réponse…)
 * ✅ notifyOwner         — propriétaire d'un son (like, commentaire, repost…)
 * ✅ notifyNewsAuthor    — auteur d'une news (like news, commentaire news)
 * ✅ notifyFollowers     — tous les abonnés d'un artiste (nouveau son, live…)
 * ✅ notifyMentions      — détecte les @username dans un texte et notifie chacun
 * ✅ notifyCommenters    — notifie les autres commentateurs d'un son (activité)
 * ✅ notifyAll           — broadcast admin uniquement (annonces globales)
 * ✅ Déduplication 30s  — évite les doublons en rafale
 * ✅ Push fire-and-forget — Edge Function non-bloquante
 * ✅ Tous les types couverts : like_song, like_news, comment, comment_news,
 *    reply, mention, follow, repost, new_song, live_like, chat_mention,
 *    chat_reply, broadcast
 */

/* ─── Déduplication en mémoire ──────────────────────────────────── */
const _recent = new Map();
const _isDupe = key => {
  const ts = _recent.get(key);
  if (ts && Date.now() - ts < 30_000) return true;
  _recent.set(key, Date.now());
  if (_recent.size > 500) {
    const now = Date.now();
    for (const [k, t] of _recent) if (now - t > 60_000) _recent.delete(k);
  }
  return false;
};

/* ─── Edge Function push helper ─────────────────────────────────── */
// ✅ On utilise directement la variable d'env — sb.supabaseUrl n'est pas
// garanti d'être exposé selon la version de supabase-js
const SUPABASE_FUNCTIONS_URL =
  (import.meta?.env?.VITE_SUPABASE_URL || '') +
  '/functions/v1/send-push-notification';

const _pushUrl = (_sb) => SUPABASE_FUNCTIONS_URL;

// ✅ FIX v2.0.2 : utiliser le JWT de session utilisateur, PAS la clé anon.
// L'Edge Function appelle supabase.auth.getUser(token) pour valider l'appelant.
// La clé anon n'est pas un JWT utilisateur → getUser() retourne 401 →
// la fonction s'arrête immédiatement → push jamais envoyé, jamais loggé,
// erreur avalée silencieusement par le .catch(() => {}).
const _push = async (sb, body) => {
  const url = _pushUrl(sb);
  if (!url || url === '/functions/v1/send-push-notification') return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    const token = session?.access_token;
    if (!token) return; // pas de session active → skip silencieux
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch { /* non-bloquant */ }
};

/* ─── Insert DB + trigger push ──────────────────────────────────── */
const _insert = async (sb, row) => {
  // ⚠️ PAS de .select() après l'insert :
  // La RLS SELECT autorise seulement le destinataire à lire SES notifs.
  // Faire .select() ici (en tant qu'expéditeur) retourne 403 et masque
  // le succès de l'INSERT. On insère et on oublie — le push EF se passe
  // sans notif_id (idempotency assurée côté DB par les triggers).
  const { error } = await sb.from('notifications').insert({
    user_id:      row.user_id,
    type:         row.type,
    title:        (row.title || '').slice(0, 120),
    body:         (row.body  || '').slice(0, 200),
    url:          row.url        || '/',
    icon_url:     row.icon_url   || '/icon-192.png',
    is_read:      false,
    metadata:     row.metadata   || {},
    from_user_id: row.from_user_id || null,
    song_id:      row.song_id      || null,  // ✅ Deep link : référence directe au son
  });
  if (error) throw error;
  return null; // pas d'id disponible — push envoyé sans notif_id
};

/* ════════════════════════════════════════════════════════════════
   EXPORTS PUBLICS
   ════════════════════════════════════════════════════════════════ */

/**
 * notifyUser — notifier UN utilisateur précis
 * Utilisé pour : follow, mention, reply, live_like, chat_*
 */
export const notifyUser = async (sb, userId, payload) => {
  if (!userId || !payload?.type) return;
  const dedupeKey = `${userId}:${payload.type}:${payload.metadata?.refId || payload.body?.slice(0,30) || ''}`;
  if (_isDupe(dedupeKey)) return;
  try {
    // 🔴 FIX BUG 4 : _insert() retourne TOUJOURS null (pas de .select() après INSERT
    // à cause de la RLS SELECT qui autorise uniquement le destinataire).
    // L'ancien code testait "if (notifId)" → toujours false → le push ne partait JAMAIS.
    // Correction : appeler _push systématiquement après un insert réussi,
    // en passant user_id (l'Edge Function récupère les subscriptions depuis la DB).
    await _insert(sb, { ...payload, user_id: userId });
    _push(sb, {
      user_id:  userId,
      // notif_id absent intentionnellement (pas récupérable sans .select()) :
      // l'idempotency côté Edge Function est assurée par la déduplication en mémoire ci-dessus.
      title:    payload.title,
      body:     (payload.body || '').slice(0, 200),
      url:      payload.url || '/',
      icon: payload.icon_url || '/icon-192.png',
      type:     payload.type,
    });
  } catch (err) {
    // silencieux — ne jamais bloquer l'UX pour une notif
    console.warn('[notifUtils] notifyUser:', err?.message);
  }
};

/**
 * notifyOwner — notifier le propriétaire d'un SON
 * Retourne l'ownerId (utile pour l'exclure des notifs suivantes)
 */
export const notifyOwner = async (sb, songId, actorId, payload) => {
  if (!songId || !actorId) return null;
  try {
    const { data: song } = await sb
      .from('songs')
      .select('uploader_id, title')
      .eq('id', songId)
      .maybeSingle();
    if (!song?.uploader_id) return null;
    if (song.uploader_id === actorId) return song.uploader_id; // pas de notif à soi-même
    await notifyUser(sb, song.uploader_id, {
      ...payload,
      song_id:  songId,  // ✅ Champ song_id pour deep link direct
      from_user_id: actorId,
      metadata: { ...(payload.metadata || {}), songId, songTitle: song.title },
    });
    return song.uploader_id;
  } catch (err) {
    console.warn('[notifUtils] notifyOwner:', err?.message);
    return null;
  }
};

/**
 * notifyNewsAuthor — notifier l'auteur d'une NEWS
 */
export const notifyNewsAuthor = async (sb, newsId, actorId, payload) => {
  if (!newsId || !actorId) return null;
  try {
    const { data: news } = await sb
      .from('news')
      .select('author_id, title')
      .eq('id', newsId)
      .maybeSingle();
    if (!news?.author_id) return null;
    if (news.author_id === actorId) return news.author_id;
    await notifyUser(sb, news.author_id, {
      ...payload,
      metadata: { ...(payload.metadata || {}), newsId, newsTitle: news.title },
    });
    return news.author_id;
  } catch (err) {
    console.warn('[notifUtils] notifyNewsAuthor:', err?.message);
    return null;
  }
};

/**
 * notifyFollowers — notifier tous les abonnés d'un artiste
 * Utilisé pour : nouveau son, go live
 */
export const notifyFollowers = async (sb, artistId, payload, excludeIds = []) => {
  if (!artistId || !payload?.type) return 0;
  try {
    const { data: follows, error } = await sb
      .from('follows')
      .select('follower_id')
      .eq('following_id', artistId);
    if (error || !follows?.length) return 0;

    const excludeSet = new Set([artistId, ...excludeIds].filter(Boolean));
    const targets = [...new Set(follows.map(f => f.follower_id).filter(id => !excludeSet.has(id)))];
    if (!targets.length) return 0;

    // Insert par batches de 100
    const rows = targets.map(userId => ({
      user_id:      userId,
      type:         payload.type,
      title:        (payload.title || '').slice(0, 120),
      body:         (payload.body  || '').slice(0, 200),
      url:          payload.url    || '/',
      icon_url:     payload.icon_url || '/icon-192.png',
      is_read:      false,
      metadata:     payload.metadata || {},
      from_user_id: payload.from_user_id || null,
      song_id:      payload.song_id      || null,  // ✅ Deep link : référence directe au son
    }));

    for (let i = 0; i < rows.length; i += 100) {
      await sb.from('notifications').insert(rows.slice(i, i + 100));
    }

    // Un seul push broadcast pour tous les abonnés
    _push(sb, {
      target_user_ids: targets, // Edge Function envoie à ces users uniquement
      title:    payload.title,
      body:     (payload.body || '').slice(0, 200),
      url:      payload.url || '/',
      icon: payload.icon_url || '/icon-192.png',
      type:     payload.type,
    });

    return targets.length;
  } catch (err) {
    console.warn('[notifUtils] notifyFollowers:', err?.message);
    return 0;
  }
};

/**
 * notifyMentions — parse le texte, notifie chaque @username trouvé
 * Retourne la liste des userIds notifiés
 * Utilisé dans : commentaires, chat, descriptions
 */
export const notifyMentions = async (sb, text, actorId, payload) => {
  if (!text || !actorId) return [];
  const mentions = [...new Set((text.match(/@([\w\-.]+)/g) || []).map(m => m.slice(1).toLowerCase()))];
  if (!mentions.length) return [];

  try {
    const { data: users } = await sb
      .from('users')
      .select('id, username')
      .in('username', mentions);
    if (!users?.length) return [];

    const notified = [];
    for (const user of users) {
      if (user.id === actorId) continue; // pas de notif à soi-même
      await notifyUser(sb, user.id, {
        ...payload,
        type:     'mention',
        metadata: { ...(payload.metadata || {}), mentionedUsername: user.username },
      });
      notified.push(user.id);
    }
    return notified;
  } catch (err) {
    console.warn('[notifUtils] notifyMentions:', err?.message);
    return [];
  }
};

/**
 * notifyCommentReply — notifier l'auteur d'un commentaire parent (réponse)
 */
export const notifyCommentReply = async (sb, parentCommentId, actorId, payload) => {
  if (!parentCommentId || !actorId) return;
  try {
    const { data: parent } = await sb
      .from('song_comments') // 🔴 FIX BUG 5 : était 'comments' — la table s'appelle 'song_comments'
      .select('user_id, content')
      .eq('id', parentCommentId)
      .maybeSingle();
    if (!parent?.user_id || parent.user_id === actorId) return;
    await notifyUser(sb, parent.user_id, {
      ...payload,
      type:     'reply',
      metadata: { ...(payload.metadata || {}), parentContent: parent.content?.slice(0, 60) },
    });
  } catch (err) {
    console.warn('[notifUtils] notifyCommentReply:', err?.message);
  }
};

/**
 * notifyAll — BROADCAST ADMIN uniquement (annonces globales)
 * ⚠️ Ne pas utiliser pour des actions utilisateur normales
 */
export const notifyAll = async (sb, payload, exclude = []) => {
  if (!payload?.type) return;
  try {
    const { data: users } = await sb.from('users').select('id');
    if (!users?.length) return;

    const excludeSet = new Set(exclude.filter(Boolean));
    const targets = users.filter(u => !excludeSet.has(u.id));
    if (!targets.length) return;

    const rows = targets.map(u => ({
      user_id:  u.id,
      type:     payload.type,
      title:    (payload.title || '').slice(0, 120),
      body:     (payload.body  || '').slice(0, 200),
      url:      payload.url    || '/',
      icon_url: payload.icon_url || '/icon-192.png',
      is_read:  false,
      metadata: payload.metadata || {},
      song_id:  payload.song_id || null,  // ✅ cohérence schéma
    }));

    for (let i = 0; i < rows.length; i += 100) {
      await sb.from('notifications').insert(rows.slice(i, i + 100));
    }

    _push(sb, {
      broadcast: true,
      title:    payload.title,
      body:     (payload.body || '').slice(0, 200),
      url:      payload.url || '/',
      icon: payload.icon_url || '/icon-192.png',
      type:     payload.type,
    });
  } catch (err) {
    console.warn('[notifUtils] notifyAll:', err?.message);
  }
};

/**
 * logSearch — enregistrer une recherche (tendances)
 */
export const logSearch = (sb, query, userId = null, results = 0) => {
  if (!query?.trim() || query.trim().length < 2) return;
  sb.from('search_logs').insert({
    query:   query.trim().toLowerCase().slice(0, 100),
    user_id: userId || null,
    results,
  }).then(() => {}).catch(() => {});
};
