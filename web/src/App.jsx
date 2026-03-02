import React, { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, HashRouter as Router, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { NotificationToast } from '@/components/NotificationBell';
import { PlayerProvider, usePlayer } from '@/contexts/PlayerContext';
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
import { OnlineProvider } from '@/contexts/OnlineContext';
import OfflineBanner from '@/components/OfflineBanner';
import InstallBanner from '@/components/InstallBanner';
import AudioPlayer from '@/components/AudioPlayer';
import OnboardingToast from '@/components/OnboardingToast';
import BottomNav from '@/components/BottomNav';

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
const LiveRoomPage      = lazy(() => import('@/pages/LiveRoomPage'));
const LeaderboardPage   = lazy(() => import('@/pages/LeaderboardPage'));
const LocalPlayerPage   = lazy(() => import('@/pages/LocalPlayerPage'));
const AdminPanel        = lazy(() => import('@/pages/AdminPanel'));

/* ── Player global — monté UNE SEULE FOIS, survit à toute navigation ── */
const GlobalPlayer = () => {
  const { currentSong, playlist, isVisible, handleNext, handlePrevious, closePlayer, shouldAutoPlay, resetAutoPlay } = usePlayer();
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

// ── Redirect hors-ligne → /local-player ──────────────────────────────────────
import { useOnline } from '@/contexts/OnlineContext';
const OfflineRedirect = () => {
  const { isOnline } = useOnline();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const ONLINE_ONLY = ['/upload', '/profile', '/messages', '/stats', '/moderation', '/chat', '/live', '/playlists'];
    const OFFLINE_OK  = ['/local-player', '/login', '/signup', '/privacy', '/terms', '/copyright'];
    const isOnlineOnlyPage = ONLINE_ONLY.some(p => location.pathname.startsWith(p));
    const isOfflineOk      = OFFLINE_OK.some(p => location.pathname.startsWith(p));

    if (!isOnline) {
      // Rediriger vers le lecteur local depuis les pages online-only ET depuis la page d'accueil
      if (isOnlineOnlyPage || (!isOfflineOk && (location.pathname === '/' || location.pathname === ''))) {
        navigate('/local-player', { replace: true });
      }
    }
  }, [isOnline, location.pathname, navigate]);

  return null;
};

function App() {
  return (
    <HelmetProvider>
      <DialogProvider>
        <ToastProvider>
          <OnlineProvider><AuthProvider>
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
                          <Route path="/playlists"       element={<ProtectedRoute><MyPlaylistsPage /></ProtectedRoute>} />
                          <Route path="/chat" element={<ChatPage />} />
                          <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
                          <Route path="/stats"           element={<ProtectedRoute><ArtistStatsPage /></ProtectedRoute>} />
                          <Route path="/moderation"      element={<ProtectedRoute><ModerationPanel /></ProtectedRoute>} />
                          <Route path="/auth/callback"   element={<AuthCallbackPage />} />
                          <Route path="/live"            element={<LiveRoomPage />} />
                          <Route path="/live/:roomId"    element={<LiveRoomPage />} />
                          <Route path="/leaderboard"     element={<LeaderboardPage />} />
                          <Route path="/local-player"    element={<LocalPlayerPage />} />
                          <Route path="/admin"           element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
                        </Routes>
                      </Suspense>
                      </ErrorBoundary>
                      {/* Player global — persiste pendant toute la navigation */}
                      <ErrorBoundary fallback={null}>
                        <GlobalPlayer />
                      </ErrorBoundary>
                      {/* Bottom nav mobile — v70 */}
                      <BottomNav />
                      <OnboardingToast />
                    </Router>
                    </NotificationProvider>
                  </MessageProvider>
                </ChatProvider>
              </PlaylistProvider>
            </PlayerProvider>
          </AuthProvider></OnlineProvider>
        </ToastProvider>
      </DialogProvider>
    </HelmetProvider>
  );
}

export default App;
