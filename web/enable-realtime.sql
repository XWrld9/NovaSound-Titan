-- ============================================================
-- Activer Supabase Realtime sur les tables likes et news_likes
-- À exécuter dans Supabase Dashboard → SQL Editor
-- ⚠️ OBLIGATOIRE pour que les likes s'actualisent en temps réel
-- ============================================================

-- Activer Realtime sur la table likes (chansons)
ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;

-- Activer Realtime sur la table news_likes
ALTER PUBLICATION supabase_realtime ADD TABLE public.news_likes;
