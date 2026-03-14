/**
 * FloatingUploadButton — NovaSound TITAN LUX
 * Bouton flottant "Uploader un son" — coin inférieur droit
 * Visible sur toutes les pages sauf /upload, /local-player, /live/:id
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const FloatingUploadButton = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // Masqué si non connecté ou sur ces pages
  if (!isAuthenticated) return null;
  const hide = ['/upload', '/local-player', '/local-player-native'];
  if (hide.includes(location.pathname)) return null;
  if (location.pathname.startsWith('/live/')) return null;

  // Desktop uniquement — ≥ 768px
  if (typeof window !== 'undefined' && window.innerWidth < 768) return null;

  return (
    <Link
      to="/upload"
      className="upload-floating group"
      title="Uploader un son"
      aria-label="Uploader un son"
    >
      <Upload className="w-5 h-5 text-white flex-shrink-0 transition-transform group-hover:scale-110" />
      <span className="upload-floating-label">Uploader</span>
    </Link>
  );
};

export default FloatingUploadButton;
