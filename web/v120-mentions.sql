-- ═══════════════════════════════════════════════════════════════════
-- NovaSound TITAN LUX — Migration v120
-- Optimisation recherche @mentions dans chat_messages
-- ═══════════════════════════════════════════════════════════════════

-- Index GIN trigram sur content pour accélérer les recherches ILIKE
-- (requis par la fonctionnalité "Mes messages" qui cherche @username dans tous les messages)
-- Activer l'extension pg_trgm si pas déjà fait
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index GIN trigram sur chat_messages.content
-- Accélère drastiquement les .ilike('%@username%') sur des tables volumineuses
CREATE INDEX IF NOT EXISTS idx_chat_messages_content_trgm
  ON chat_messages USING gin (content gin_trgm_ops);

-- Index composite sur created_at pour les filtres mois/année
-- (les filtres "Ce mois" et "Cette année" utilisent gte+lte sur created_at)
-- Déjà couvert par idx_chat_messages_created_at — aucune action requise.

-- Index sur users.username pour l'autocomplétion @mention
-- (requête ILIKE 'username%' sur la table users)
CREATE INDEX IF NOT EXISTS idx_users_username_lower
  ON users (lower(username) text_pattern_ops);

