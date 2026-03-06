/**
 * NotFoundPage — NovaSound TITAN LUX
 * Page 404 affichée pour toute URL inconnue
 */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Search, Music, ArrowLeft } from 'lucide-react';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full"
      >
        {/* Icône */}
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 border border-white/10 flex items-center justify-center">
            <Music className="w-10 h-10 text-gray-600" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <span className="text-red-400 font-black text-sm">!</span>
          </div>
        </div>

        {/* Code erreur */}
        <h1 className="text-7xl font-black text-white mb-2 tracking-tight">
          4<span className="bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text text-transparent">0</span>4
        </h1>

        <h2 className="text-xl font-bold text-white mb-3">Page introuvable</h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          La page que tu cherches n'existe pas ou a été déplacée.<br />
          Retourne à l'accueil pour continuer l'écoute.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold hover:from-cyan-400 hover:to-cyan-500 transition-all shadow-lg shadow-cyan-500/25"
          >
            <Home className="w-4 h-4" />
            Retour à l'accueil
          </Link>
          <Link
            to="/explorer"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/[0.07] border border-white/[0.1] text-gray-300 hover:text-white hover:bg-white/[0.1] font-semibold transition-all"
          >
            <Search className="w-4 h-4" />
            Explorer
          </Link>
        </div>

        <button
          onClick={() => navigate(-1)}
          className="mt-4 flex items-center gap-1.5 text-gray-600 hover:text-gray-400 text-sm transition-colors mx-auto"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Page précédente
        </button>
      </motion.div>
    </div>
  );
};

export default NotFoundPage;
