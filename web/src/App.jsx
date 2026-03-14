import React, { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, HashRouter as Router, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { NotificationToast } from '@/components/NotificationBell';
import { PlayerProvider, usePlayer } from '@/contexts/PlayerContext';
import { PlayerTimeProvider } from '@/contexts/PlayerTimeContext';
import { PlaylistProvider } from '@/contexts/PlaylistContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { MessageProvider } from '@/contexts/MessageContext';
import { HelmetProvider } from 'react-helmet-async';
import { DialogProvider } from '@/components/ui/Dialog';
import { ToastProvider } from '@/components/ui/Toast';
import ScrollToTop from '@/components/ScrollToTop';
import ErrorBoundary from '@/components/ErrorBoundary';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoadingSpinner from '@/components/LoadingSpinner';
import { OnlineProvider, useOnline } from '@/contexts/OnlineContext';
import OfflineBanner from '@/components/OfflineBanner';
import InstallBanner from '@/components/InstallBanner';
import AudioPlayer from '@/components/AudioPlayer';
import OnboardingToast from '@/components/OnboardingToast';
import BottomNav from '@/components/BottomNav';
import FloatingUploadButton from '@/components/FloatingUploadButton';

// Pages chargées immédiatement (critiques)
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';

// Pages chargées à la demande (lazy)
const MusicUploadPage   = lazy(() => import('@/pages/MusicUploadPage'));
const UserProfilePage   = lazy(() => import('@/pages/UserProfilePage'));
const ExplorerPage      = lazy(() => import('@/pages/ExplorerPage'));
const SongPage          = lazy(() => import('@/pages/SongPage'));
const NewsPage          = lazy(() => import('@/pages/NewsPage'));
const ArtistProfilePage = lazy(() => import('@/pages/ArtistProfilePage'));
const PrivacyPolicy     = lazy(() => import('@/pages/PrivacyPolicy'));
const TermsOfService    = lazy(() => import('@/pages/TermsOfService'));
const CopyrightInfo     = lazy(() => import('@/pages/CopyrightInfo'));
const ModerationPanel   = lazy(() => import('@/pages/ModerationPanel'));
const AuthCallbackPage  = lazy(() => import('@/pages/AuthCallbackPage'));
const TrendingPage      = lazy(() => import('@/pages/TrendingPage'));
const PlaylistPage      = lazy(() => import('@/pages/PlaylistPage'));
const MyPlaylistsPage   = lazy(() => import('@/pages/MyPlaylistsPage'));
const ChatPage          = lazy(() => import('@/pages/ChatPage'));
const MessagesPage      = lazy(() => import('@/pages/MessagesPage'));
const ArtistStatsPage   = lazy(() => import('@/pages/ArtistStatsPage'));
const SearchPage        = lazy(() => import('@/pages/SearchPage'));
const LiveListPage      = lazy(() => import('@/pages/LiveListPage'));
const LiveRoomPage      = lazy(() => import('@/pages/LiveRoomPage'));
const LeaderboardPage   = lazy(() => import('@/pages/LeaderboardPage'));
const LocalPlayerPage   = lazy(() => import('@/pages/LocalPlayerPage'));
const LocalPlayerPageNative = lazy(() => import('@/pages/LocalPlayerPageNative'));
const AdminPanel        = lazy(() => import('@/pages/AdminPanel'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const ArtistsPage       = lazy(() => import('@/pages/ArtistsPage'));
const NotFoundPage      = lazy(() => import('@/pages/NotFoundPage'));
const NotificationsPage  = lazy(() => import('@/pages/NotificationsPage'));

/* ── Player global — monté UNE SEULE FOIS, survit à toute navigation ── */
const GlobalPlayer = () => {
  const {
    currentSong, playlist, isVisible,
    handleNext, handlePrevious, closePlayer,
    shouldAutoPlay, resetAutoPlay,
    playSong, loadSavedState,
  } = usePlayer();

  // ── Écouter les actions venant du widget Android ──────────────────
  useEffect(() => {
    if (!navigator.serviceWorker) return;
    const handler = (e) => {
      if (e.data?.type === 'WIDGET_ACTION' && e.data?.event) {
        window.dispatchEvent(new CustomEvent(e.data.event));
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  // ── Restaurer la dernière lecture au démarrage ──────────────────
  useEffect(() => {
    if (currentSong) return; // déjà une song en cours → pas besoin de restaurer
    const restore = async () => {
      try {
        const state = await loadSavedState?.();
        if (state?.song?.id) {
          // Restaurer silencieusement sans autoplay (l'utilisateur reprend manuellement)
          playSong?.(state.song, state.playlist || [state.song], { autoPlay: false });
        }
      } catch (_) {}
    };
    // Délai court pour laisser l'app s'initialiser
    const t = setTimeout(restore, 1200);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isVisible || !currentSong) return null;
  return (
    <AudioPlayer
      currentSong={currentSong}
      playlist={playlist}
      onNext={handleNext}
      onPrevious={handlePrevious}
      onClose={closePlayer}
      shouldAutoPlay={shouldAutoPlay}
      resetAutoPlay={resetAutoPlay}
    />
  );
};

// ── Composant vide — la redirection offline est gérée par OfflineBanner (overlay) ──
// L'utilisateur décide lui-même d'entrer dans le lecteur local après 1 minute d'offline
const OfflineRedirect = () => null;

/* ── BottomNav masqué sur /local-player et /live/:roomId ──────────────────── */
const BottomNavConditional = () => {
  const location = useLocation();
  // Masqué sur le lecteur local standalone ET dans les salles live (immersion totale)
  if (location.pathname === '/local-player') return null;
  if (location.pathname.startsWith('/live/')) return null;
  return <BottomNav />;
};

function App() {
  return (
    <HelmetProvider>
      <DialogProvider>
        <ToastProvider>
          <OnlineProvider><AuthProvider>
            <PlayerTimeProvider>
            <PlayerProvider>
              <PlaylistProvider>
                <ChatProvider>
                  <MessageProvider>
                    <NotificationProvider>
                      <Router>
                      <NotificationToast />
                      <ScrollToTop />
                      <OfflineRedirect />
                      <OfflineBanner />
                      <InstallBanner />
                      <ErrorBoundary>
                      <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><LoadingSpinner /></div>}>
                        <Routes>
                          <Route path="/"               element={<HomePage />} />
                          <Route path="/login"           element={<LoginPage />} />
                          <Route path="/signup"          element={<SignupPage />} />
                          <Route path="/search"          element={<SearchPage />} />
                          <Route path="/explorer"        element={<ExplorerPage />} />
                          <Route path="/news"            element={<NewsPage />} />
                          <Route path="/trending"        element={<TrendingPage />} />
                          <Route path="/artist/:id"      element={<ArtistProfilePage />} />
                          <Route path="/song/:id"        element={<SongPage />} />
                          <Route path="/playlist/:id"    element={<PlaylistPage />} />
                          <Route path="/privacy"         element={<PrivacyPolicy />} />
                          <Route path="/terms"           element={<TermsOfService />} />
                          <Route path="/copyright"       element={<CopyrightInfo />} />
                          <Route path="/upload"          element={<ProtectedRoute><MusicUploadPage /></ProtectedRoute>} />
                          <Route path="/profile"         element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
                          {/* ✅ FIX: /profile/:id (liens deep notif follow) → ArtistProfilePage */}
                          <Route path="/profile/:id"     element={<ArtistProfilePage />} />
                          <Route path="/playlists"       element={<ProtectedRoute><MyPlaylistsPage /></ProtectedRoute>} />
                          <Route path="/chat" element={<ChatPage />} />
                          <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
                          <Route path="/stats"           element={<ProtectedRoute><ArtistStatsPage /></ProtectedRoute>} />
                          <Route path="/moderation"      element={<ProtectedRoute><ModerationPanel /></ProtectedRoute>} />
                          <Route path="/auth/callback"   element={<AuthCallbackPage />} />
                          <Route path="/live"            element={<LiveListPage />} />
                          <Route path="/live/:roomId"    element={<LiveRoomPage />} />
                          <Route path="/leaderboard"     element={<LeaderboardPage />} />
                          <Route path="/local-player"    element={<LocalPlayerPage />} />
                          <Route path="/local-player-native" element={<LocalPlayerPageNative />} />
                          <Route path="/admin"           element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
                          <Route path="/reset-password"  element={<ResetPasswordPage />} />
                          <Route path="/artists"          element={<ArtistsPage />} />
                          <Route path="/notifications"   element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
                          <Route path="*"               element={<NotFoundPage />} />
                        </Routes>
                      </Suspense>
                      </ErrorBoundary>
                      {/* Player global — persiste pendant toute la navigation */}
                      <ErrorBoundary fallback={null}>
                        <GlobalPlayer />
                      </ErrorBoundary>
                      {/* Bottom nav mobile — masqué sur /local-player (lecteur standalone) */}
                      <BottomNavConditional />
                      <FloatingUploadButton />
                      <OnboardingToast />
                    </Router>
                    </NotificationProvider>
                  </MessageProvider>
                </ChatProvider>
              </PlaylistProvider>
            </PlayerProvider>
            </PlayerTimeProvider>
          </AuthProvider></OnlineProvider>
        </ToastProvider>
      </DialogProvider>
    </HelmetProvider>
  );
}

export default App;
