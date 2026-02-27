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
import { Newspaper, Calendar, User, X, ChevronRight } from 'lucide-react';
import NewsShareButton from '@/components/NewsShareButton';

const NewsPage = () => {
  const { isAuthenticated } = useAuth();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState(null);

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

  return (
    <>
      <Helmet>
        <title>News - NovaSound TITAN LUX</title>
        <meta name="description" content="Latest updates and news from the NovaSound community" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-24 md:pb-32">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
          {/* Titre */}
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
                  {/* Header card */}
                  <div className="px-6 pt-5 pb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-fuchsia-400 font-medium bg-fuchsia-500/10 px-2 py-0.5 rounded-full border border-fuchsia-500/20">
                        {new Date(item.created_at || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white mb-3 group-hover:text-fuchsia-300 transition-colors">
                      {item.title}
                    </h2>
                    {/* Contenu — tronqué avec bouton "Lire la suite" */}
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
                  </div>

                  {/* Footer card */}
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
                {/* Header modal */}
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

                {/* Contenu scrollable */}
                <div className="p-6 overflow-y-auto flex-1">
                  <p className="text-gray-300 leading-relaxed whitespace-pre-wrap text-base">
                    {selectedNews.content}
                  </p>
                </div>

                {/* Footer modal */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 flex-shrink-0 bg-gray-800/30 rounded-b-2xl">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    {selectedNews.users?.avatar_url ? (
                      <img src={selectedNews.users.avatar_url} className="w-6 h-6 rounded-full object-cover" alt="" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                    <span className="font-medium text-gray-400">{selectedNews.users?.username || 'Anonyme'}</span>
                  </div>
                  <div className="flex items-center gap-2">
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
    </>
  );
};

export default NewsPage;
