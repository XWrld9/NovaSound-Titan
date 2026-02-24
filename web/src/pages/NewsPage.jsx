import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import NewsForm from '@/components/NewsForm';
import ReportButton from '@/components/ReportButton';
import { useAuth } from '@/contexts/AuthContext';
import { Newspaper, Calendar, User } from 'lucide-react';
import NewsLikeButton from '@/components/NewsLikeButton';

const NewsPage = () => {
  const { isAuthenticated } = useAuth();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase
        .from('news')
        .select('*, users:author_id(username)')
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

      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex items-center gap-3 mb-8">
            <Newspaper className="w-8 h-8 text-magenta-500" />
            <h1 className="text-3xl font-bold text-white">Community News</h1>
          </div>

          {isAuthenticated && (
            <NewsForm onNewsCreated={fetchNews} />
          )}

          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading updates...</div>
            ) : news.length > 0 ? (
              news.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-xl p-6 hover:border-magenta-500/30 transition-all"
                >
                  <h2 className="text-2xl font-bold text-white mb-3">{item.title}</h2>
                  <p className="text-gray-300 mb-4 whitespace-pre-wrap leading-relaxed">{item.content}</p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 border-t border-gray-800 pt-4">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {item.users?.username || 'Anonymous'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(item.created_at || Date.now()).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <NewsLikeButton
                        newsId={item.id}
                        initialLikes={item.likes_count || 0}
                        authorId={item.author_id}
                      />
                      <ReportButton 
                        contentType="news" 
                        contentId={item.id}
                      />
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-12 bg-gray-900/30 rounded-xl border border-gray-800">
                <p className="text-gray-400">No news updates yet.</p>
              </div>
            )}
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default NewsPage;