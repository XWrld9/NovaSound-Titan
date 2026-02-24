import React, { lazy, Suspense } from 'react';
import { Route, Routes, HashRouter as Router } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { HelmetProvider } from 'react-helmet-async';
import { DialogProvider } from '@/components/ui/Dialog';
import { ToastProvider } from '@/components/ui/Toast';
import ScrollToTop from '@/components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoadingSpinner from '@/components/LoadingSpinner';
import InstallBanner from '@/components/InstallBanner';

// Pages chargées immédiatement (critiques)
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';

// Pages chargées à la demande (lazy)
const MusicUploadPage = lazy(() => import('@/pages/MusicUploadPage'));
const UserProfilePage = lazy(() => import('@/pages/UserProfilePage'));
const ExplorerPage = lazy(() => import('@/pages/ExplorerPage'));
const SongPage     = lazy(() => import('@/pages/SongPage'));
const NewsPage = lazy(() => import('@/pages/NewsPage'));
const ArtistProfilePage = lazy(() => import('@/pages/ArtistProfilePage'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('@/pages/TermsOfService'));
const CopyrightInfo = lazy(() => import('@/pages/CopyrightInfo'));
const ModerationPanel = lazy(() => import('@/pages/ModerationPanel'));

function App() {
  return (
    <HelmetProvider>
      <DialogProvider>
        <ToastProvider>
          <AuthProvider>
            <Router>
              <ScrollToTop />
              <InstallBanner />
              <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><LoadingSpinner /></div>}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route path="/explorer" element={<ExplorerPage />} />
                  <Route path="/news" element={<NewsPage />} />
                  <Route path="/artist/:id" element={<ArtistProfilePage />} />
                  <Route path="/song/:id" element={<SongPage />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/copyright" element={<CopyrightInfo />} />
                  <Route path="/upload" element={<ProtectedRoute><MusicUploadPage /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
                  <Route path="/moderation" element={<ProtectedRoute><ModerationPanel /></ProtectedRoute>} />
                </Routes>
              </Suspense>
            </Router>
          </AuthProvider>
        </ToastProvider>
      </DialogProvider>
    </HelmetProvider>
  );
}

export default App;
