/**
 * notifUtils — NovaSound TITAN LUX v8002
 *
 * Utilitaires côté client pour l'envoi de notifications.
 * 100% client-side — compatible Supabase Free Tier.
 * Pas de triggers DB, pas d'Edge Functions nécessaires.
 *
 * Fonctions exportées :
 *   notifyUser(supabase, userId, payload)   → 1 utilisateur
 *   notifyAll(supabase, payload, exclude[]) → TOUS les utilisateurs sauf exclus
 *   notifyOwner(supabase, songId, payload, actorId) → propriétaire d'un son
 */

const ADMIN_EMAIL = 'eloadxfamily@gmail.com';

/**
 * Anti-doublon en mémoire (clé = userId:type:refId, expire 30s)
 */
const _recentNotifs = new Map();
const _isDupe = (key) => {
  const ts = _recentNotifs.get(key);
  if (ts && Date.now() - ts < 30_000) return true;
  _recentNotifs.set(key, Date.now());
  // Nettoyage automatique des entrées expirées (max 200)
  if (_recentNotifs.size > 200) {
    const now = Date.now();
    for (const [k, t] of _recentNotifs) {
      if (now - t > 60_000) _recentNotifs.delete(k);
    }
  }
  return false;
};

/**
 * Insérer une notification pour UN utilisateur.
 * @param {object} supabase - client Supabase
 * @param {string} userId   - destinataire
 * @param {object} payload  - { type, title, body, url, icon_url?, metadata? }
 */
export const notifyUser = async (supabase, userId, payload) => {
  if (!userId || !payload?.type) return;

  const dedupeKey = `${userId}:${payload.type}:${payload.metadata?.refId || payload.body?.slice(0, 30)}`;
  if (_isDupe(dedupeKey)) return;

  try {
    await supabase.from('notifications').insert({
      user_id:  userId,
      type:     payload.type,
      title:    payload.title,
      body:     (payload.body || '').slice(0, 200),
      url:      payload.url || '/',
      icon_url: payload.icon_url || '/icon-192.png',
      is_read:  false,
      metadata: JSON.stringify(payload.metadata || {}),
    });
  } catch (err) {
    console.warn('[notifUtils] notifyUser error:', err?.message);
  }
};

/**
 * Insérer une notification pour TOUS les utilisateurs enregistrés.
 * Exclut automatiquement l'acteur et les IDs passés dans `exclude`.
 *
 * @param {object}   supabase  - client Supabase
 * @param {object}   payload   - { type, title, body, url, icon_url?, metadata? }
 * @param {string[]} exclude   - IDs à exclure (acteur, propriétaire déjà notifié…)
 */
export const notifyAll = async (supabase, payload, exclude = []) => {
  if (!payload?.type) return;

  try {
    // Récupérer tous les IDs utilisateurs
    const { data: users, error } = await supabase
      .from('users')
      .select('id');

    if (error || !users?.length) return;

    const excludeSet = new Set(exclude.filter(Boolean));

    // Construire le batch en filtrant les exclus et les doublons
    const rows = users
      .filter(u => !excludeSet.has(u.id))
      .map(u => ({
        user_id:  u.id,
        type:     payload.type,
        title:    payload.title,
        body:     (payload.body || '').slice(0, 200),
        url:      payload.url || '/',
        icon_url: payload.icon_url || '/icon-192.png',
        is_read:  false,
        metadata: JSON.stringify(payload.metadata || {}),
      }));

    if (!rows.length) return;

    // Insérer par batch de 100 pour éviter les limites Supabase
    for (let i = 0; i < rows.length; i += 100) {
      await supabase.from('notifications').insert(rows.slice(i, i + 100));
    }
  } catch (err) {
    console.warn('[notifUtils] notifyAll error:', err?.message);
  }
};

/**
 * Notifier le propriétaire d'un son.
 * Ne fait rien si actorId === ownerId (pas d'auto-notif).
 *
 * @param {object} supabase  - client Supabase
 * @param {string} songId    - ID du son
 * @param {string} actorId   - ID de l'acteur (liker, commenteur…)
 * @param {object} payload   - { type, title, body, url, icon_url?, metadata? }
 * @returns {string|null}    - uploader_id si trouvé
 */
export const notifyOwner = async (supabase, songId, actorId, payload) => {
  if (!songId || !actorId) return null;
  try {
    const { data: song } = await supabase
      .from('songs')
      .select('uploader_id, title')
      .eq('id', songId)
      .maybeSingle();

    if (!song?.uploader_id) return null;
    if (song.uploader_id === actorId) return song.uploader_id; // pas d'auto-notif

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
