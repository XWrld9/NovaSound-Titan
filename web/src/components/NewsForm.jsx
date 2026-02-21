import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Send, AlertCircle, CheckCircle } from 'lucide-react';

const NewsForm = ({ onNewsCreated }) => {
  const { currentUser } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const data = {
        title,
        content,
        author_id: currentUser.id,
        likes_count: 0,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('news')
        .insert(data);
      if (error) throw error;

      setSuccess('News posted successfully!');
      setTitle('');
      setContent('');
      if (onNewsCreated) onNewsCreated();
    } catch (err) {
      console.error('Error posting news:', err);
      setError(err.message || 'Failed to post news');
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl border border-magenta-500/30 rounded-xl p-6 mb-8">
      <h3 className="text-xl font-bold text-white mb-4">Post News Update</h3>
      
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

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="News Headline"
            required
            className="w-full px-4 py-2 bg-gray-950/50 border border-magenta-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-magenta-400 focus:ring-1 focus:ring-magenta-400 transition-all"
          />
        </div>
        <div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's happening?"
            required
            rows={3}
            className="w-full px-4 py-2 bg-gray-950/50 border border-magenta-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-magenta-400 focus:ring-1 focus:ring-magenta-400 transition-all resize-none"
          />
        </div>
        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={loading}
            className="bg-magenta-600 hover:bg-magenta-700 text-white"
          >
            {loading ? 'Posting...' : 'Post News'}
            <Send className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default NewsForm;