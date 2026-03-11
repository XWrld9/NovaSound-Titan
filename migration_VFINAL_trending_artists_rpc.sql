DROP FUNCTION IF EXISTS public.get_trending_artists(text, integer);

CREATE OR REPLACE FUNCTION public.get_trending_artists(
  period text DEFAULT '7d',
  lim    integer DEFAULT 15
)
RETURNS TABLE (
  user_id      text,
  username     text,
  avatar_url   text,
  period_plays bigint,
  songs_count  bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    u.id                        AS user_id,
    u.username,
    u.avatar_url,
    COALESCE(SUM(e.cnt), 0)    AS period_plays,
    COUNT(DISTINCT s.id)        AS songs_count
  FROM public.users u
  JOIN public.songs s ON s.uploader_id = u.id AND s.is_archived = false
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
    FROM public.song_play_events spe
    WHERE spe.song_id = s.id
      AND spe.played_at >= NOW() - (
        CASE period
          WHEN '24h'  THEN INTERVAL '24 hours'
          WHEN '30d'  THEN INTERVAL '30 days'
          ELSE             INTERVAL '7 days'
        END
      )
  ) e ON true
  GROUP BY u.id, u.username, u.avatar_url
  ORDER BY period_plays DESC, songs_count DESC
  LIMIT lim;
$$;

GRANT EXECUTE ON FUNCTION public.get_trending_artists(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trending_artists(text, integer) TO anon;