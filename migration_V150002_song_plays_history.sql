-- Migration V150002 - Create song_plays_history table
-- NovaSound TITAN LUX - Historique des écoutes

-- Table pour suivre l'historique des écoutes des chansons
CREATE TABLE IF NOT EXISTS song_plays_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    listened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_song_plays_history_song_id ON song_plays_history(song_id);
CREATE INDEX IF NOT EXISTS idx_song_plays_history_user_id ON song_plays_history(user_id);
CREATE INDEX IF NOT EXISTS idx_song_plays_history_listened_at ON song_plays_history(listened_at DESC);

-- Politiques RLS
ALTER TABLE song_plays_history ENABLE ROW LEVEL SECURITY;

-- Politique pour les utilisateurs : voir leur propre historique
CREATE POLICY "Users can view their own play history" ON song_plays_history
    FOR SELECT USING (auth.uid() = user_id);

-- Politique pour les utilisateurs : insérer leur propre historique
CREATE POLICY "Users can insert their own play history" ON song_plays_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Politique pour les utilisateurs : modifier leur propre historique
CREATE POLICY "Users can update their own play history" ON song_plays_history
    FOR UPDATE USING (auth.uid() = user_id);

-- Politique pour les utilisateurs : supprimer leur propre historique
CREATE POLICY "Users can delete their own play history" ON song_plays_history
    FOR DELETE USING (auth.uid() = user_id);

-- Politique pour les admins : voir tout l'historique
CREATE POLICY "Admins can view all play history" ON song_plays_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() AND raw_user_meta_data->>'admin' = 'true'
        )
    );

-- Politique pour les admins : insérer n'importe quel historique
CREATE POLICY "Admins can insert any play history" ON song_plays_history
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() AND raw_user_meta_data->>'admin' = 'true'
        )
    );

-- Politique pour les admins : modifier n'importe quel historique
CREATE POLICY "Admins can update any play history" ON song_plays_history
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() AND raw_user_meta_data->>'admin' = 'true'
        )
    );

-- Politique pour les admins : supprimer n'importe quel historique
CREATE POLICY "Admins can delete any play history" ON song_plays_history
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() AND raw_user_meta_data->>'admin' = 'true'
        )
    );

-- Donner les permissions nécessaires
GRANT ALL ON song_plays_history TO authenticated;
GRANT SELECT ON song_plays_history TO anon;

-- Notifier le rechargement du schéma
NOTIFY pgrst, 'reload schema';
SELECT 'Migration V150002 completed successfully';
