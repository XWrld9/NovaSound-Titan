import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Send, AlertCircle, CheckCircle, AtSign, X } from 'lucide-react';
import { notifyAll, notifyUser } from '@/lib/notifUtils';

const NewsForm = ({ onNewsCreated }) => {
  const { currentUser } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Tag system ──────────────────────────────────────────────────
  const [tagQuery, setTagQuery] = useState('');
  const [tagResults, setTagResults] = useState([]);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [tagMode, setTagMode] = useState(null); // 'all' | 'user'
  const [tagCursorPos, setTagCursorPos] = useState(0);
  const contentRef = useRef(null);
  const tagMenuRef = useRef(null);

  // Detect @mention as user types
  const handleContentChange = useCallback(async (e) => {
    const val = e.target.value;
    setContent(val);
    const pos = e.target.selectionStart;
    setTagCursorPos(pos);

    // Find @word before cursor
    const textBefore = val.slice(0, pos);
    const match = textBefore.match(/@(\w*)$/);
    if (match) {
      const query = match[1];
      if (query === '') {
        // Show "tag everyone" option
        setTagQuery('');
        setTagResults([]);
        setShowTagMenu(true);
        setTagMode('all');
      } else {
        setTagQuery(query);
        setTagMode('user');
        // Search users
        try {
          const { data } = await supabase
            .from('users')
            .select('id, username, avatar_url')
            .ilike('username', `%${query}%`)
            .limit(8);
          setTagResults(data || []);
          setShowTagMenu(true);
        } catch { setTagResults([]); }
      }
    } else {
      setShowTagMenu(false);
      setTagQuery('');
    }
  }, []);

  const insertTag = useCallback((username) => {
    const pos = tagCursorPos;
    const textBefore = content.slice(0, pos);
    const match = textBefore.match(/@(\w*)$/);
    if (!match) return;
    const start = pos - match[0].length;
    const newContent = content.slice(0, start) + `@${username} ` + content.slice(pos);
    setContent(newContent);
    setShowTagMenu(false);
    setTagResults([]);
    setTimeout(() => {
      if (contentRef.current) {
        const newPos = start + username.length + 2;
        contentRef.current.setSelectionRange(newPos, newPos);
        contentRef.current.focus();
      }
    }, 0);
  }, [content, tagCursorPos]);

  const insertTagAll = useCallback(() => {
    const pos = tagCursorPos;
    const textBefore = content.slice(0, pos);
    const match = textBefore.match(/@(\w*)$/);
    if (!match) return;
    const start = pos - match[0].length;
    const newContent = content.slice(0, start) + `@everyone ` + content.slice(pos);
    setContent(newContent);
    setShowTagMenu(false);
    setTimeout(() => {
      if (contentRef.current) {
        const newPos = start + '@everyone '.length;
        contentRef.current.setSelectionRange(newPos, newPos);
        contentRef.current.focus();
      }
    }, 0);
  }, [content, tagCursorPos]);

  // Close tag menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (tagMenuRef.current && !tagMenuRef.current.contains(e.target)) setShowTagMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { error } = await supabase
        .from('news')
        .insert({
          title,
          content,
          author_id: currentUser.id,
          likes_count: 0,
          created_at: new Date().toISOString()
        });
      if (error) throw error;

      setSuccess('Actualité publiée avec succès !');
      const publisherName = currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'Quelqu\'un';
      const iconUrl = currentUser.user_metadata?.avatar_url || currentUser.avatar_url || '/icon-192.png';

      // ── Notifications @tags ───────────────────────────────────────────
      const hasEveryoneTag = /@everyone\b/i.test(content);
      const mentionMatches = [...content.matchAll(/@(\w+)/g)]
        .map(m => m[1].toLowerCase())
        .filter(u => u !== 'everyone');

      if (hasEveryoneTag) {
        // Notifier TOUS les utilisateurs
        notifyAll(supabase, {
          type:     'news',
          title:    `📰 ${publisherName} a publié une actualité`,
          body:     title.slice(0, 120),
          url:      '/news',
          icon_url: iconUrl,
          metadata: { senderId: currentUser.id, senderName: publisherName },
        }, [currentUser.id]).catch(() => {});
      } else if (mentionMatches.length > 0) {
        // Notifier chaque @username mentionné
        (async () => {
          for (const username of [...new Set(mentionMatches)]) {
            try {
              const { data: user } = await supabase
                .from('users').select('id').ilike('username', username).maybeSingle();
              if (user?.id && user.id !== currentUser.id) {
                notifyUser(supabase, user.id, {
                  type:     'mention',
                  title:    `📣 ${publisherName} t'a mentionné dans une actualité`,
                  body:     title.slice(0, 120),
                  url:      '/news',
                  icon_url: iconUrl,
                  metadata: { senderId: currentUser.id, senderName: publisherName },
                }).catch(() => {});
              }
            } catch {}
          }
        })();
      }

      setTitle('');
      setContent('');
      if (onNewsCreated) onNewsCreated();
    } catch (err) {
      console.error('Error posting news:', err);
      setError(err.message || 'Échec de la publication');
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return null;

  // Render content with highlighted @mentions
  const renderPreviewContent = () => {
    if (!content) return null;
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, i) =>
      part.startsWith('@')
        ? <span key={i} className="text-fuchsia-400 font-semibold">{part}</span>
        : part
    );
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-fuchsia-500/30 rounded-xl p-6 mb-8">
      <h3 className="text-xl font-bold text-white mb-4">Publier une actualité</h3>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4 flex items-center gap-2 text-green-400 text-sm">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de l'actualité"
            required
            className="w-full px-4 py-2 bg-gray-950/50 border border-fuchsia-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400 transition-all"
          />
        </div>

        {/* Textarea avec tag system */}
        <div className="relative" ref={tagMenuRef}>
          <textarea
            ref={contentRef}
            value={content}
            onChange={handleContentChange}
            placeholder={"Quoi de neuf ? Utilise @ pour mentionner quelqu'un ou @everyone pour tout le monde"}
            required
            rows={3}
            className="w-full px-4 py-2 bg-gray-950/50 border border-fuchsia-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400 transition-all resize-none"
          />

          {/* Hint tag */}
          <div className="flex items-center gap-1.5 mt-1">
            <AtSign className="w-3 h-3 text-fuchsia-500/60" />
            <span className="text-[11px] text-gray-600">Tape <span className="text-fuchsia-400 font-semibold">@</span> pour taguer quelqu'un, <span className="text-fuchsia-400 font-semibold">@everyone</span> pour tous</span>
          </div>

          {/* Dropdown tag */}
          {showTagMenu && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-gray-900 border border-fuchsia-500/30 rounded-xl shadow-2xl shadow-fuchsia-500/10 overflow-hidden max-h-56 overflow-y-auto">
              {/* Option tag everyone */}
              {(tagMode === 'all' || tagQuery === '' || tagQuery.toLowerCase().startsWith('e')) && (
                <button
                  type="button"
                  onClick={insertTagAll}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-fuchsia-500/10 transition-colors text-left border-b border-white/[0.06]"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                    <AtSign className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold">@everyone</p>
                    <p className="text-gray-500 text-xs">Notifie tous les membres</p>
                  </div>
                </button>
              )}
              {/* Users results */}
              {tagResults.map(user => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => insertTag(user.username)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-fuchsia-500/10 transition-colors text-left"
                >
                  {user.avatar_url
                    ? <img src={user.avatar_url} alt={user.username} className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-white/10" />
                    : <div className="w-8 h-8 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center flex-shrink-0"><span className="text-xs text-gray-400">{(user.username || '?')[0].toUpperCase()}</span></div>
                  }
                  <p className="text-white text-sm font-semibold">@{user.username}</p>
                </button>
              ))}
              {tagMode === 'user' && tagResults.length === 0 && tagQuery && (
                <p className="text-gray-600 text-xs text-center py-3">Aucun utilisateur trouvé</p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={loading || !title.trim() || !content.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-all text-sm"
          >
            {loading ? 'Publication...' : 'Publier'}
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewsForm;