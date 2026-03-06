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
import { OnlineProvider, useOnline } from '@/contexts/OnlineContext';
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
const MusicUploadPage   = lazy(() => impor'@/pages/MusicUploadPage');
const UserProfilePage   = lazy(() => impor'@/pages/UserProfilePage');
const ExplorerPage      = lazy(() => impor'@/pages/ExplorerPage');
const SongPage          = lazy(() => impor'@/pages/SongPage');
const NewsPage          = lazy(() => impor'@/pages/NewsPage');
const ArtistProfilePage = lazy(() => impor'@/pages/ArtistProfilePage');
const PrivacyPolicy     = lazy(() => impor'@/pages/PrivacyPolicy');
const TermsOfService    = lazy(() => impor'@/pages/TermsOfService');
const CopyrightInfo     = lazy(() => impor'@/pages/CopyrightInfo');
const ModerationPanel   = lazy(() => impor'@/pages/ModerationPanel');
const AuthCallbackPage  = lazy(() => impor'@/pages/AuthCallbackPage');
const TrendingPage      = lazy(() => impor'@/pages/TrendingPage');
const PlaylistPage      = lazy(() => impor'@/pages/PlaylistPage');
const MyPlaylistsPage   = lazy(() => impor'@/pages/MyPlaylistsPage');
const ChatPage          = lazy(() => impor'@/pages/ChatPage');
const MessagesPage      = lazy(() => impor'@/pages/MessagesPage');
const ArtistStatsPage   = lazy(() => impor'@/pages/ArtistStatsPage');
const SearchPage        = lazy(() => impor'@/pages/SearchPage');
const LiveRoomPage      = lazy(() => impor'@/pages/LiveRoomPage');
const LeaderboardPage   = lazy(() => impor'@/pages/LeaderboardPage');
const LocalPlayerPage   = lazy(() => impor'@/pages/LocalPlayerPage');
const AdminPanel        = lazy(() => impor'@/pages/AdminPanel');
const ResetPasswordPage = lazy(() => impor'@/pages/ResetPasswordPage');
const ArtistsPage       = lazy(() => impor'@/pages/ArtistsPage');
const NotificationsPage = lazy(() => impor'@/pages/NotificationsPage');

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
const OfflineRedirect = () => {
  const { isOnline } = useOnline();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Pages accessibles sans connexion
    const OFFLINE_OK = ['/local-player', '/login', '/signup', '/privacy', '/terms', '/copyright', '/auth', '/reset-password'];
    const isOfflineOk = OFFLINE_OK.some(p => location.pathname === p || location.pathname.startsWith(p + '/'));

    if (!isOnline && !isOfflineOk) {
      navigate('/local-player', { replace: true });
    }
  }, [isOnline, location.pathname, navigate]);

  // Aussi vérifier au montage initial (cas : ouverture directe hors-ligne)
  useEffect(() => {
    if (!navigator.onLine) {
      const OFFLINE_OK = ['/local-player', '/login', '/signup', '/privacy', '/terms', '/copyright', '/auth', '/reset-password'];
      const isOfflineOk = OFFLINE_OK.some(p => location.pathname === p || location.pathname.startsWith(p + '/'));
      if (!isOfflineOk) navigate('/local-player', { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};

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
                          <Route path="/reset-password"  element={<ResetPasswordPage />} />
                          <Route path="/artists"          element={<ArtistsPage />} />
                          <Route path="/notifications"   element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
                        </Routes>
                      </Suspense>
                      </ErrorBoundary>
                      {/* Player global — persiste pendant toute la navigation */}
                      <ErrorBoundary fallback={null}>
                        <GlobalPlayer />
                      </ErrorBoundary>
                      {/* Bottom nav mobile — masqué sur /local-player (lecteur standalone) */}
                      <BottomNavConditional />
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
