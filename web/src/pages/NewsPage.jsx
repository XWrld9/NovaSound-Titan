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
import { Newspaper, User, X, ChevronRight, Trash2 } from 'lucide-react';
import NewsShareButton from '@/components/NewsShareButton';
import NewsCommentSection from '@/components/NewsCommentSection';
import AdminConfirmDialog from '@/components/AdminConfirmDialog';

const ADMIN_EMAIL = 'eloadxfamily@gmail.com';

const NewsPage = () => {
  const { isAuthenticated, currentUser } = useAuth();
  const isAdmin = currentUser?.email === ADMIN_EMAIL;
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false });

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

  const handleDeleteNews = (newsId) => {
    setConfirmDialog({
      isOpen: true,
      type: 'danger',
      title: 'Supprimer l\'actualité',
      message: 'Supprimer cette actualité définitivement ?\n\nTous les commentaires associés seront également supprimés.',
      confirmText: 'Supprimer définitivement',
      onConfirm: async () => {
        setDeletingId(newsId);
        try {
          await supabase.from('news').delete().eq('id', newsId);
          setNews(prev => prev.filter(n => n.id !== newsId));
          if (selectedNews?.id === newsId) setSelectedNews(null);
        } catch (e) { console.error(e); }
        setDeletingId(null);
      },
    });
  };

  return (
    <>
      <Helmet>
        <title>Actualités - NovaSound TITAN LUX</title>
        <meta name="description" content="Actualités de la communauté NovaSound TITAN LUX" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-44 md:pb-32">
        <Header />

        <main className="flex-1 w-full max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8">

          {/* ── Titre ── */}
          <div className="flex items-center gap-2.5 mb-6 sm:mb-8">
            <div className="w-1 h-7 sm:h-8 bg-gradient-to-b from-fuchsia-500 to-purple-600 rounded-full flex-shrink-0" />
            <Newspaper className="w-6 h-6 sm:w-7 sm:h-7 text-fuchsia-400 flex-shrink-0" />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white leading-tight">
              Actualités
              <span className="hidden sm:inline"> de la communauté</span>
            </h1>
          </div>

          {isAuthenticated && (
            <div className="mb-6">
              <NewsForm onNewsCreated={fetchNews} />
            </div>
          )}

          {/* ── Liste ── */}
          <div className="space-y-4 sm:space-y-5">
            {loading ? (
              <div className="flex justify-center py-14">
                <div className="w-8 h-8 rounded-full border-2 border-fuchsia-500/30 border-t-fuchsia-500 animate-spin" />
              </div>
            ) : news.length > 0 ? (
              news.map((item, index) => (
                <motion.article
                  key={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="bg-gray-900 border border-fuchsia-500/20 rounded-2xl overflow-hidden hover:border-fuchsia-400/40 transition-all group"
                >
                  {/* Corps de la carte */}
                  <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4">
                    {/* Date */}
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-[11px] sm:text-xs text-fuchsia-400 font-medium bg-fuchsia-500/10 px-2 py-0.5 rounded-full border border-fuchsia-500/20">
                        {new Date(item.created_at || Date.now()).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                    </div>

                    {/* Titre */}
                    <h2 className="text-base sm:text-xl font-bold text-white mb-2.5 group-hover:text-fuchsia-300 transition-colors leading-snug">
                      {item.title}
                    </h2>

                    {/* Extrait */}
                    <p className="text-sm sm:text-base text-gray-300 leading-relaxed line-clamp-3 whitespace-pre-wrap">
                      {item.content}
                    </p>
                    {item.content?.length > 180 && (
                      <button
                        onClick={() => setSelectedNews(item)}
                        className="mt-2 text-xs sm:text-sm text-fuchsia-400 hover:text-fuchsia-300 font-medium flex items-center gap-1 transition-colors"
                      >
                        Lire la suite <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Footer carte — auteur + actions */}
                  <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-800/40 border-t border-gray-800">
                    {/* Auteur */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2.5">
                      {item.users?.avatar_url ? (
                        <img src={item.users.avatar_url} className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover flex-shrink-0" alt="" />
                      ) : (
                        <User className="w-3.5 h-3.5 flex-shrink-0" />
                      )}
                      <span className="font-medium text-gray-400 truncate max-w-[120px] sm:max-w-none">
                        {item.users?.username || 'Anonyme'}
                      </span>
                    </div>

                    {/* Actions — wrappent proprement sur mobile */}
                    <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
                      <NewsLikeButton
                        newsId={item.id}
                        initialLikes={item.likes_count || 0}
                        authorId={item.author_id}
                      />
                      <NewsShareButton news={item} />
                      <ReportButton contentType="news" contentId={item.id} />
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteNews(item.id)}
                          disabled={deletingId === item.id}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                          title="Supprimer"
                        >
                          {deletingId === item.id
                            ? <div className="w-3 h-3 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin" />
                            : <Trash2 className="w-3 h-3" />
                          }
                          <span className="hidden sm:inline">Supprimer</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Commentaires */}
                  <div className="px-4 sm:px-6 pb-4">
                    <NewsCommentSection
                      newsId={item.id}
                      newsAuthorId={item.author_id}
                    />
                  </div>
                </motion.article>
              ))
            ) : (
              <div className="text-center py-16 bg-gray-900/30 rounded-2xl border border-gray-800">
                <Newspaper className="w-10 h-10 text-fuchsia-600/30 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Aucune news pour l'instant.</p>
              </div>
            )}
          </div>
        </main>

        <Footer />
      </div>

      {/* ── Modal lecture complète ── */}
      <AnimatePresence>
        {selectedNews && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedNews(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed inset-x-0 bottom-0 sm:inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 pointer-events-none"
            >
              <div
                className="bg-gray-900 border border-fuchsia-500/30 rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-fuchsia-500/10 w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col pointer-events-auto"
                onClick={e => e.stopPropagation()}
              >
                {/* Handle mobile */}
                <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
                  <div className="w-10 h-1 rounded-full bg-gray-700" />
                </div>

                {/* Header modal */}
                <div className="flex items-start justify-between px-4 sm:px-6 py-3 sm:py-5 border-b border-gray-800 flex-shrink-0">
                  <div className="flex-1 pr-3 min-w-0">
                    <span className="text-[11px] sm:text-xs text-fuchsia-400 font-medium bg-fuchsia-500/10 px-2 py-0.5 rounded-full border border-fuchsia-500/20 inline-block mb-2">
                      {new Date(selectedNews.created_at || Date.now()).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </span>
                    <h2 className="text-lg sm:text-2xl font-bold text-white leading-tight break-words">
                      {selectedNews.title}
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedNews(null)}
                    className="flex-shrink-0 p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Contenu scrollable */}
                <div className="px-4 sm:px-6 py-4 sm:py-5 overflow-y-auto flex-1">
                  <p className="text-gray-300 leading-relaxed whitespace-pre-wrap text-sm sm:text-base">
                    {selectedNews.content}
                  </p>
                  <div className="mt-4">
                    <NewsCommentSection
                      newsId={selectedNews.id}
                      newsAuthorId={selectedNews.author_id}
                    />
                  </div>
                </div>

                {/* Footer modal */}
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-800 flex-shrink-0 bg-gray-800/30 rounded-b-2xl">
                  {/* Auteur */}
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2.5">
                    {selectedNews.users?.avatar_url ? (
                      <img src={selectedNews.users.avatar_url} className="w-5 h-5 rounded-full object-cover flex-shrink-0" alt="" />
                    ) : (
                      <User className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="font-medium text-gray-400 truncate">
                      {selectedNews.users?.username || 'Anonyme'}
                    </span>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center flex-wrap gap-2">
                    <NewsShareButton news={selectedNews} />
                    <NewsLikeButton
                      newsId={selectedNews.id}
                      initialLikes={selectedNews.likes_count || 0}
                      authorId={selectedNews.author_id}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AdminConfirmDialog
        isOpen={confirmDialog.isOpen}
        type={confirmDialog.type}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog({ isOpen: false })}
      />
    </>
  );
};

export default NewsPage;
