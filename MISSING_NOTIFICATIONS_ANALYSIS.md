# 🔍 ANALYSE - TYPES DE NOTIFICATIONS MANQUANTS

## ✅ TYPES DÉJÀ CONFIGURÉS (VÉRIFIÉS)

### 1. **Likes** ✅
- **Composant**: `LikeButton.jsx`
- **Fonction**: `notifyOwner(songId, actorId, { type: 'like' })`
- **Notification**: `❤️ {username} a aimé ton son`

### 2. **Follows** ✅  
- **Composant**: `FollowButton.jsx`
- **Fonction**: `notifyUser(userId, { type: 'follow' })`
- **Notification**: `👤 {username} te suit`

### 3. **Commentaires** ✅
- **Composant**: `CommentSection.jsx`
- **Fonctions**: 
  - `notifyOwner(songId, actorId, { type: 'comment' })`
  - `notifyCommentReply(parentId, actorId, { type: 'reply' })`
  - `notifyMentions(text, actorId, { type: 'mention' })`
- **Notifications**: 
  - `💬 {username} a commenté ton son`
  - `↩ {username} a répondu à ton commentaire`
  - `🏷 {username} t'a mentionné dans un commentaire`

### 4. **Reposts** ✅
- **Composant**: `RepostButton.jsx`
- **Fonction**: `notifyOwner(songId, actorId, { type: 'repost' })`
- **Notification**: `🔁 {username} a repartagé ton son`

---

## ❓ TYPES POTENTIELLEMENT MANQUANTS À VÉRIFIER

### 1. **News Likes** ❓
- **Type**: `like_news`
- **Composant**: `NewsLikeButton.jsx` → À vérifier
- **Devrait utiliser**: `notifyNewsAuthor(newsId, actorId, { type: 'like_news' })`

### 2. **News Comments** ❓
- **Type**: `comment_news`
- **Composant**: `NewsCommentSection.jsx` → À vérifier
- **Devrait utiliser**: `notifyNewsAuthor(newsId, actorId, { type: 'comment_news' })`

### 3. **Chat Mentions** ❓
- **Types**: `chat_mention`, `chat_mention_all`, `chat_reply`
- **Composant**: `ChatPage.jsx` → À vérifier
- **Devrait utiliser**: `notifyUser(userId, { type: 'chat_*' })`

### 4. **Live Events** ❓
- **Types**: `live_start`, `live_invite`, `live_like`, `live_comment`, `live_join`, `live_leave`
- **Composant**: Pages Live → À vérifier
- **Devrait utiliser**: `notifyFollowers()` ou `notifyUser()`

### 5. **New Songs** ❓
- **Type**: `new_song`
- **Composant**: `MusicUploadPage.jsx` → À vérifier
- **Devrait utiliser**: `notifyFollowers(artistId, { type: 'new_song' })`

### 6. **Mood Votes** ❓
- **Type**: `mood_vote`
- **Composant**: `MoodVote.jsx` → À vérifier
- **Devrait utiliser**: `notifyOwner(songId, actorId, { type: 'mood_vote' })`

### 7. **Queue Songs** ❓
- **Type**: `queue_song`
- **Composant**: `AudioPlayer.jsx` → À vérifier
- **Devrait utiliser**: `notifyUser(userId, { type: 'queue_song' })`

### 8. **Achievements** ❓
- **Type**: `achievement`
- **Composant**: Système de trophées → À vérifier
- **Devrait utiliser**: `notifyUser(userId, { type: 'achievement' })`

### 9. **Broadcast** ❓
- **Type**: `broadcast`
- **Composant**: Admin panel → À vérifier
- **Devrait utiliser**: `notifyAll({ type: 'broadcast' })`

---

## 🎯 ACTIONS RECOMMANDÉES

### 1. **Vérifier les composants manquants**
```bash
# Rechercher ces composants :
find . -name "*News*" -type f
find . -name "*Chat*" -type f  
find . -name "*Live*" -type f
find . -name "*Upload*" -type f
find . -name "*Mood*" -type f
```

### 2. **Tester chaque type d'action**
- Liker une news → Devrait envoyer `like_news`
- Commenter une news → Devrait envoyer `comment_news`
- Mentionner @username dans le chat → Devrait envoyer `chat_mention`
- Démarrer un live → Devrait envoyer `live_start`
- Uploader un son → Devrait envoyer `new_song`
- Voter sur une vibe → Devrait envoyer `mood_vote`

### 3. **Vérifier la base de données**
```sql
-- Vérifier quels types sont réellement envoyés
SELECT type, COUNT(*) as count
FROM notifications 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY type
ORDER BY count DESC;
```

---

## 🔧 SOLUTIONS À IMPLÉMENTER

Si des types manquent, ajouter les notifications correspondantes dans les composants appropriés en utilisant les fonctions de `notifUtils.js`.
