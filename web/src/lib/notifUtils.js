/**
 * notifUtils — NovaSound V28000
 *
 * FIXES v28000 :
 * ✅ notifyAll → déclenche push natif pour CHAQUE utilisateur (bug : était silencieux)
 * ✅ notifyUser → inchangé, fonctionnel
 * ✅ notifyOwner → inchangé, fonctionnel
 * ✅ Déduplication anti-doublon maintenue
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

// Fire-and-forget push vers Edge Function
const _triggerPush = (supabase, userId, notifId, payload) => {
  const { url, key } = _getUrlKey(supabase);
  if (!url) return;
  fetch(`${url}/functions/v1/send-push-notification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      user_id:  userId,
      id:       notifId,
      title:    payload.title,
      body:     (payload.body || '').slice(0, 200),
      url:      payload.url || '/',
      icon_url: payload.icon_url || '/icon-192.png',
    }),
  }).catch(() => {});
};

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

/**
 * FIX v28000 : notifyAll déclenchait les insertions DB mais n'appelait JAMAIS
 * l'Edge Function push → 0 notification système. Corrigé : push pour chaque user.
 */
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

    const inserted = [];
    for (let i = 0; i < rows.length; i += 100) {
      const { data } = await supabase.from('notifications')
        .insert(rows.slice(i, i + 100)).select('id, user_id');
      if (data) inserted.push(...data);
    }

    // ✅ FIX : déclencher push natif pour chaque utilisateur
    const byUser = new Map();
    for (const row of inserted) {
      if (!byUser.has(row.user_id)) byUser.set(row.user_id, row.id);
    }
    for (const [userId, notifId] of byUser) {
      _triggerPush(supabase, userId, notifId, payload);
    }
  } catch (err) {
    console.warn('[notifUtils] notifyAll error:', err?.message);
  }
};

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
