import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import NewsForm from '@/components/NewsForm';
import ReportButton from '@/components/ReportButton';
import NewsLikeButton from '@/components/NewsLikeButton';
import { useAuth } from '@/contexts/AuthContext';
import { Newspaper, User, X, ChevronRight, Pencil, Trash2, Check, AlertCircle } from 'lucide-react';

const NewsPage = () => {
  const { isAuthenticated, currentUser } = useAuth();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState(null);

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete confirm state
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => { fetchNews(); }, []);

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase
        .from('news')
        .select('*, users:author_id(username, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setNews(data || []);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditContent(item.content);
    setEditError('');
    setDeletingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditContent('');
    setEditError('');
  };

  const handleUpdate = async (item) => {
    if (!editTitle.trim() || !editContent.trim()) {
      setEditError('Le titre et le contenu sont requis.');
      return;
    }
    setEditLoading(true);
    setEditError('');
    try {
      const { error } = await supabase
        .from('news')
        .update({ title: editTitle.trim(), content: editContent.trim() })
        .eq('id', item.id)
        .eq('author_id', currentUser.id);
      if (error) throw error;
      setNews(prev => prev.map(n =>
        n.id === item.id ? { ...n, title: editTitle.trim(), content: editContent.trim() } : n
      ));
      if (selectedNews?.id === item.id) {
        setSelectedNews(prev => ({ ...prev, title: editTitle.trim(), content: editContent.trim() }));
      }
      cancelEdit();
    } catch (err) {
      setEditError(err.message || 'Erreur lors de la mise à jour.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase
        .from('news')
        .delete()
        .eq('id', id)
        .eq('author_id', currentUser.id);
      if (error) throw error;
      setNews(prev => prev.filter(n => n.id !== id));
      if (selectedNews?.id === id) setSelectedNews(null);
    } catch (err) {
      console.error('Error deleting news:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const isAuthor = (item) => currentUser && item.author_id === currentUser.id;

  return (
    <>
      <Helmet>
        <title>Actualités - NovaSound TITAN LUX</title>
        <meta name="description" content="Dernières actualités et mises à jour de la communauté NovaSound" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1 h-8 bg-gradient-to-b from-fuchsia-500 to-purple-600 rounded-full" />
            <Newspaper className="w-8 h-8 text-fuchsia-400" />
            <h1 className="text-3xl font-bold text-white">Actualités de la communauté</h1>
          </div>

          {isAuthenticated && (
            <NewsForm onNewsCreated={fetchNews} />
          )}

          <div className="space-y-5 mt-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 rounded-full border-2 border-fuchsia-500/30 border-t-fuchsia-500 animate-spin mx-auto" />
              </div>
            ) : news.length > 0 ? (
              news.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="bg-gray-900 border border-fuchsia-500/20 rounded-2xl overflow-hidden hover:border-fuchsia-400/50 transition-all group"
                >
                  <div className="px-6 pt-5 pb-4">
                    {/* Top row : date + actions auteur */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-fuchsia-400 font-medium bg-fuchsia-500/10 px-2 py-0.5 rounded-full border border-fuchsia-500/20">
                        {new Date(item.created_at || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>

                      {isAuthor(item) && editingId !== item.id && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1.5 text-gray-400 hover:text-fuchsia-400 hover:bg-fuchsia-500/10 rounded-lg transition-colors"
                            title="Modifier cette news"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {deletingId === item.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-red-400 ml-1">Confirmer ?</span>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="px-2 py-1 text-xs bg-red-500/20 border border-red-500/40 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                              >
                                Oui
                              </button>
                              <button
                                onClick={() => setDeletingId(null)}
                                className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
                              >
                                Non
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletingId(item.id)}
                              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Supprimer cette news"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Mode édition inline */}
                    {editingId === item.id ? (
                      <div className="space-y-3">
                        {editError && (
                          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {editError}
                          </div>
                        )}
                        <input
                          type="text"
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800 border border-fuchsia-500/40 rounded-lg text-white text-lg font-bold focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400 transition-all"
                          placeholder="Titre"
                        />
                        <textarea
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          rows={5}
                          className="w-full px-3 py-2 bg-gray-800 border border-fuchsia-500/40 rounded-lg text-gray-300 focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400 transition-all resize-none"
                          placeholder="Contenu"
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() => handleUpdate(item)}
                            disabled={editLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg transition-colors disabled:opacity-60"
                          >
                            <Check className="w-4 h-4" />
                            {editLoading ? 'Enregistrement...' : 'Enregistrer'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h2 className="text-xl font-bold text-white mb-3 group-hover:text-fuchsia-300 transition-colors">
                          {item.title}
                        </h2>
                        <p className="text-gray-300 leading-relaxed line-clamp-4 whitespace-pre-wrap">
                          {item.content}
                        </p>
                        {item.content?.length > 200 && (
                          <button
                            onClick={() => setSelectedNews(item)}
                            className="mt-2 text-sm text-fuchsia-400 hover:text-fuchsia-300 font-medium flex items-center gap-1 transition-colors"
                          >
                            Lire la suite <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Footer card — masqué en mode édition */}
                  {editingId !== item.id && (
                    <div className="flex items-center justify-between px-6 py-3 bg-gray-800/40 border-t border-gray-800">
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1.5">
                          {item.users?.avatar_url ? (
                            <img src={item.users.avatar_url} className="w-5 h-5 rounded-full object-cover" alt="" />
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                          <span className="font-medium text-gray-400">{item.users?.username || 'Anonyme'}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <NewsLikeButton
                          newsId={item.id}
                          initialLikes={item.likes_count || 0}
                          authorId={item.author_id}
                        />
                        <ReportButton contentType="news" contentId={item.id} />
                      </div>
                    </div>
                  )}
                </motion.div>
              ))
            ) : (
              <div className="text-center py-16 bg-gray-900/30 rounded-2xl border border-gray-800">
                <Newspaper className="w-12 h-12 text-fuchsia-600/30 mx-auto mb-3" />
                <p className="text-gray-400">Aucune news pour l'instant.</p>
              </div>
            )}
          </div>
        </main>

        <Footer />
      </div>

      {/* Modal lecture complète */}
      <AnimatePresence>
        {selectedNews && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedNews(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="bg-gray-900 border border-fuchsia-500/30 rounded-2xl shadow-2xl shadow-fuchsia-500/10 w-full max-w-2xl max-h-[85vh] flex flex-col pointer-events-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-start justify-between p-6 border-b border-gray-800 flex-shrink-0">
                  <div className="flex-1 pr-4">
                    <span className="text-xs text-fuchsia-400 font-medium bg-fuchsia-500/10 px-2 py-0.5 rounded-full border border-fuchsia-500/20 inline-block mb-2">
                      {new Date(selectedNews.created_at || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                    <h2 className="text-2xl font-bold text-white leading-tight">{selectedNews.title}</h2>
                  </div>
                  <button
                    onClick={() => setSelectedNews(null)}
                    className="flex-shrink-0 p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                  <p className="text-gray-300 leading-relaxed whitespace-pre-wrap text-base">
                    {selectedNews.content}
                  </p>
                </div>

                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 flex-shrink-0 bg-gray-800/30 rounded-b-2xl">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    {selectedNews.users?.avatar_url ? (
                      <img src={selectedNews.users.avatar_url} className="w-6 h-6 rounded-full object-cover" alt="" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                    <span className="font-medium text-gray-400">{selectedNews.users?.username || 'Anonyme'}</span>
                  </div>
                  <NewsLikeButton
                    newsId={selectedNews.id}
                    initialLikes={selectedNews.likes_count || 0}
                    authorId={selectedNews.author_id}
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default NewsPage;
