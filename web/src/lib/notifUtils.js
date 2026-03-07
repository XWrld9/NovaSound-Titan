/**
 * notifUtils — NovaSound TITAN LUX V60000
 *
 * V60000 :
 * ✅ notifyAll — broadcast edge function en 1 seul appel quand pas d'exclusions
 * ✅ notifyFollowers — notifier tous les abonnés d'un artiste
 * ✅ logSearch — enregistrer une recherche dans search_logs (tendances)
 * (tout le reste inchangé depuis V28000)
 */

const _recentNotifs = new Map();
const _isDupe = (key) => {
  const ts = _recentNotifs.get(key);
  if (ts && Date.now() - ts < 30_000) return true;
  _recentNotifs.set(key, Date.now());
  if (_recentNotifs.size > 200) {
    const now = Date.now();
    for (const [k, t] of _recentNotifs) {
      if (now - t > 60_000) _recentNotifs.delete(k);
    }
  }
  return false;
};

const _getUrlKey = (supabase) => ({
  url: supabase.supabaseUrl || import.meta?.env?.VITE_SUPABASE_URL || '',
  key: supabase.supabaseKey || import.meta?.env?.VITE_SUPABASE_ANON_KEY || '',
});

// Fire-and-forget push vers Edge Function (single user)
const _triggerPush = (supabase, userId, notifId, payload) => {
  const { url, key } = _getUrlKey(supabase);
  if (!url) return;
  fetch(`${url}/functions/v1/send-push-notification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      user_id:  userId,
      notif_id: notifId,
      title:    payload.title,
      body:     (payload.body || '').slice(0, 200),
      url:      payload.url || '/',
      icon_url: payload.icon_url || '/icon-192.png',
      type:     payload.type || 'default',
    }),
  }).catch(() => {});
};

// Fire-and-forget push BROADCAST — 1 seul appel pour TOUS les abonnés
const _triggerBroadcastPush = (supabase, payload) => {
  const { url, key } = _getUrlKey(supabase);
  if (!url) return;
  fetch(`${url}/functions/v1/send-push-notification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      broadcast: true,
      title:     payload.title,
      body:      (payload.body || '').slice(0, 200),
      url:       payload.url || '/',
      icon_url:  payload.icon_url || '/icon-192.png',
      type:      payload.type || 'default',
    }),
  }).catch(() => {});
};

// ── notifyUser — notifier un utilisateur précis ───────────────
export const notifyUser = async (supabase, userId, payload) => {
  if (!userId || !payload?.type) return;
  const dedupeKey = `${userId}:${payload.type}:${payload.metadata?.refId || payload.body?.slice(0, 30)}`;
  if (_isDupe(dedupeKey)) return;
  try {
    const { data: notifData } = await supabase.from('notifications').insert({
      user_id:  userId,
      type:     payload.type,
      title:    payload.title,
      body:     (payload.body || '').slice(0, 200),
      url:      payload.url || '/',
      icon_url: payload.icon_url || '/icon-192.png',
      is_read:  false,
      metadata: JSON.stringify(payload.metadata || {}),
    }).select('id').single();
    if (notifData?.id) _triggerPush(supabase, userId, notifData.id, payload);
  } catch (err) {
    console.warn('[notifUtils] notifyUser error:', err?.message);
  }
};

// ── notifyAll — notifier TOUS les utilisateurs ────────────────
// V60000 : si pas d'exclusions → broadcast push (1 seul appel edge function)
export const notifyAll = async (supabase, payload, exclude = []) => {
  if (!payload?.type) return;
  try {
    const { data: users, error } = await supabase.from('users').select('id');
    if (error || !users?.length) return;
    const excludeSet = new Set(exclude.filter(Boolean));
    const targets = users.filter(u => !excludeSet.has(u.id));
    if (!targets.length) return;

    const rows = targets.map(u => ({
      user_id:  u.id,
      type:     payload.type,
      title:    payload.title,
      body:     (payload.body || '').slice(0, 200),
      url:      payload.url || '/',
      icon_url: payload.icon_url || '/icon-192.png',
      is_read:  false,
      metadata: JSON.stringify(payload.metadata || {}),
    }));

    // Insérer les notifications en base (par batches de 100)
    for (let i = 0; i < rows.length; i += 100) {
      await supabase.from('notifications').insert(rows.slice(i, i + 100));
    }

    // Push : si aucune exclusion → 1 seul appel broadcast
    //        sinon → per-user (comportement V50000)
    if (exclude.filter(Boolean).length === 0) {
      _triggerBroadcastPush(supabase, payload);
    } else {
      const { data: inserted } = await supabase.from('notifications')
        .select('id, user_id')
        .eq('type', payload.type)
        .in('user_id', targets.map(u => u.id))
        .order('created_at', { ascending: false })
        .limit(targets.length);
      if (inserted) {
        const byUser = new Map();
        for (const row of inserted) {
          if (!byUser.has(row.user_id)) byUser.set(row.user_id, row.id);
        }
        for (const [userId, notifId] of byUser) {
          _triggerPush(supabase, userId, notifId, payload);
        }
      }
    }
  } catch (err) {
    console.warn('[notifUtils] notifyAll error:', err?.message);
  }
};

// ── notifyOwner — notifier le propriétaire d'un son ──────────
export const notifyOwner = async (supabase, songId, actorId, payload) => {
  if (!songId || !actorId) return null;
  try {
    const { data: song } = await supabase
      .from('songs').select('uploader_id, title').eq('id', songId).maybeSingle();
    if (!song?.uploader_id) return null;
    if (song.uploader_id === actorId) return song.uploader_id;
    await notifyUser(supabase, song.uploader_id, {
      ...payload,
      metadata: { ...(payload.metadata || {}), songId, songTitle: song.title },
    });
    return song.uploader_id;
  } catch (err) {
    console.warn('[notifUtils] notifyOwner error:', err?.message);
    return null;
  }
};

// ── notifyFollowers — notifier tous les abonnés d'un artiste ──
// V50000 : nouveau helper pour new_song, live_start, etc.
export const notifyFollowers = async (supabase, artistId, payload, excludeIds = []) => {
  if (!artistId || !payload?.type) return 0;
  try {
    const { data: follows, error } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', artistId);

    if (error || !follows?.length) return 0;

    const excludeSet = new Set([artistId, ...excludeIds].filter(Boolean));
    const targets = follows
      .map(f => f.follower_id)
      .filter(id => !excludeSet.has(id));

    if (!targets.length) return 0;

    let notified = 0;
    for (const userId of targets) {
      await notifyUser(supabase, userId, payload);
      notified++;
    }
    return notified;
  } catch (err) {
    console.warn('[notifUtils] notifyFollowers error:', err?.message);
    return 0;
  }
};

// ── logSearch — enregistrer une recherche (pour trending_searches) ─
// V60000 : fire-and-forget, ne bloque pas l'UX
export const logSearch = (supabase, query, userId = null, results = 0) => {
  if (!query?.trim() || query.trim().length < 2) return;
  supabase.from('search_logs').insert({
    query:   query.trim().toLowerCase().slice(0, 100),
    user_id: userId || null,
    results,
  }).then(() => {}).catch(() => {});
};
