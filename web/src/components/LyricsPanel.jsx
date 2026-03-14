/**
 * LyricsPanel — NovaSound TITAN LUX v5000
 * Panneau paroles sur SongPage :
 * - Chargement depuis la table `song_lyrics`
 * - Saisie manuelle par le propriétaire
 * - Mise en évidence de la ligne en cours (timecodes LRC)
 * - Scroll auto vers la ligne active
 * - Mode plein-écran karaoké
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import {
  Mic2, Edit3, Save, X, Maximize2, Minimize2,
  ChevronDown, ChevronUp, Lock, Music
} from 'lucide-react';

// ── Parser format LRC : [mm:ss.xx] ligne ──────────────────────────
const parseLRC = (lrc) => {
  if (!lrc) return null;
  const lines = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;
  let match;
  while ((match = regex.exec(lrc)) !== null) {
    const time = parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / 1000;
    lines.push({ time, text: match[4].trim() });
  }
  return lines.length > 0 ? lines.sort((a, b) => a.time - b.time) : null;
};

// ── Plain text → tableau de lignes ────────────────────────────────
const parsePlain = (text) => {
  if (!text) return [];
  return text.split('\n').map((line, i) => ({ time: null, text: line, id: i }));
};

const LyricsPanel = ({ song, currentTime = 0, isExpanded = false }) => {
  const { currentUser } = useAuth();
  const [lyrics, setLyrics]         = useState(null); // { content, format, uploader_id }
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState(false);
  const [editText, setEditText]     = useState('');
  const [saving, setSaving]         = useState(false);
  const [karaoke, setKaraoke]       = useState(false);
  const [expanded, setExpanded]     = useState(isExpanded);
  const [activeIdx, setActiveIdx]   = useState(-1);

  const parsedRef  = useRef([]);
  const lineRefs   = useRef({});
  const scrollRef  = useRef(null);
  const isOwner = currentUser?.id === song?.uploader_id;

  // ── Charger les paroles ────────────────────────────────────────
  useEffect(() => {
    if (!song?.id) return;
    setLoading(true);
    supabase
      .from('song_lyrics')
      .select('*')
      .eq('song_id', song.id)
      .maybeSingle()
      .then(({ data }) => {
        setLyrics(data || null);
        setLoading(false);
      });
  }, [song?.id]);

  // ── Parser les paroles ─────────────────────────────────────────
  useEffect(() => {
    if (!lyrics?.content) { parsedRef.current = []; return; }
    const lrc = parseLRC(lyrics.content);
    parsedRef.current = lrc || parsePlain(lyrics.content);
  }, [lyrics]);

  // ── Ligne active selon currentTime ────────────────────────────
  useEffect(() => {
    if (!parsedRef.current.length || !currentTime) return;
    const timed = parsedRef.current.filter(l => l.time !== null);
    if (!timed.length) return;
    let idx = -1;
    for (let i = 0; i < timed.length; i++) {
      if (currentTime >= timed[i].time) idx = i;
    }
    if (idx !== activeIdx) {
      setActiveIdx(idx);
      // Scroll auto
      const el = lineRefs.current[idx];
      if (el && scrollRef.current) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentTime, activeIdx]);

  // ── Sauvegarder ───────────────────────────────────────────────
  const saveLyrics = async () => {
    if (!song?.id || !isOwner) return;
    setSaving(true);
    try {
      const format = editText.includes('[') ? 'lrc' : 'plain';
      if (lyrics?.id) {
        await supabase.from('song_lyrics').update({ content: editText, format }).eq('id', lyrics.id);
      } else {
        await supabase.from('song_lyrics').insert({
          song_id: song.id,
          uploader_id: currentUser.id,
          content: editText,
          format,
        });
      }
      setLyrics(prev => ({ ...(prev || {}), content: editText, format }));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const lines = parsedRef.current;
  const hasTimecodes = lines.some(l => l.time !== null);

  // ── RENDER ─────────────────────────────────────────────────────
  return (
    <div className={`bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden transition-all duration-300 ${karaoke ? 'fixed inset-0 z-[200] rounded-none border-none bg-black/95' : ''}`}>

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-800 ${karaoke ? 'bg-black/50' : ''}`}>
        <div className="flex items-center gap-2">
          <Mic2 className="w-4 h-4 text-fuchsia-400" />
          <span className="text-sm font-bold text-white">Paroles</span>
          {hasTimecodes && (
            <span className="text-[10px] bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 px-2 py-0.5 rounded-full">
              SYNC
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOwner && !editing && (
            <button
              onClick={() => { setEditing(true); setEditText(lyrics?.content || ''); }}
              className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-fuchsia-400 transition-colors"
              title="Modifier les paroles"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}
          {lyrics && (
            <button
              onClick={() => setKaraoke(!karaoke)}
              className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-white transition-colors"
              title="Mode karaoké"
            >
              {karaoke ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
          {!karaoke && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-white transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Contenu */}
      <AnimatePresence>
        {(expanded || karaoke) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Mode édition */}
            {editing ? (
              <div className="p-4">
                <p className="text-xs text-gray-500 mb-2">
                  Format LRC supporté : <code className="text-fuchsia-400">[01:23.45] paroles ici</code> pour synchronisation automatique
                </p>
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  rows={12}
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl p-3 focus:outline-none focus:border-fuchsia-500 font-mono resize-none placeholder-gray-600"
                  placeholder={`[00:10.00] Premier couplet...\n[00:20.00] Deuxième ligne...\n\nOu colle les paroles sans timecodes.`}
                />
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={saveLyrics}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-sm font-medium transition-all hover:opacity-90 disabled:opacity-60"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 rounded-xl bg-gray-800 text-gray-400 text-sm hover:text-white transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : loading ? (
              <div className="p-6 text-center">
                <div className="w-6 h-6 border-2 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin mx-auto" />
              </div>
            ) : !lyrics?.content ? (
              <div className="p-8 text-center">
                <Music className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Aucune parole pour ce titre.</p>
                {isOwner && (
                  <button
                    onClick={() => { setEditing(true); setEditText(''); setExpanded(true); }}
                    className="mt-3 text-fuchsia-400 text-sm hover:text-fuchsia-300 underline"
                  >
                    Ajouter les paroles
                  </button>
                )}
                {!isOwner && (
                  <p className="text-gray-600 text-xs mt-1 flex items-center justify-center gap-1">
                    <Lock className="w-3 h-3" />
                    Seul l'artiste peut ajouter les paroles
                  </p>
                )}
              </div>
            ) : (
              // Paroles
              <div
                ref={scrollRef}
                className={`overflow-y-auto p-5 space-y-1 ${karaoke ? 'flex-1' : ''}`}
                style={{ maxHeight: karaoke ? 'calc(100vh - 120px)' : 320 }}
              >
                {lines.map((line, i) => {
                  const isActive = hasTimecodes && i === activeIdx;
                  const isPast   = hasTimecodes && i < activeIdx;
                  if (!line.text) return <div key={i} className="h-3" />;
                  return (
                    <motion.p
                      key={i}
                      ref={el => { lineRefs.current[i] = el; }}
                      animate={isActive ? { scale: 1.04 } : { scale: 1 }}
                      transition={{ duration: 0.2 }}
                      translate="no" className={`notranslate text-center leading-relaxed transition-all duration-300 select-text cursor-default ${
                        karaoke
                          ? isActive
                            ? 'text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-400'
                            : isPast
                              ? 'text-lg text-gray-600'
                              : 'text-xl text-gray-400'
                          : isActive
                            ? 'text-fuchsia-300 font-bold text-base'
                            : isPast
                              ? 'text-gray-600 text-sm'
                              : 'text-gray-300 text-sm hover:text-white'
                      }`}
                    >
                      <span translate="no" className="notranslate">{line.text}</span>
                    </motion.p>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview collapsed */}
      {!expanded && !karaoke && lyrics?.content && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full px-4 py-3 text-center text-sm text-gray-500 hover:text-fuchsia-400 transition-colors"
        >
          Afficher les paroles ↓
        </button>
      )}
    </div>
  );
};

export default LyricsPanel;
