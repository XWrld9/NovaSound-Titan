import React from 'react';
import { Route, Routes, HashRouter as Router } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { HelmetProvider } from 'react-helmet-async';
import { DialogProvider } from '@/components/ui/Dialog';
import { ToastContainer } from '@/components/ui/Toast';
import ScrollToTop from '@/components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import MusicUploadPage from '@/pages/MusicUploadPage';
import UserProfilePage from '@/pages/UserProfilePage';
import ExplorerPage from '@/pages/ExplorerPage';
import NewsPage from '@/pages/NewsPage';
import ArtistProfilePage from '@/pages/ArtistProfilePage';
import PrivacyPolicy from '@/pages/PrivacyPolicy.jsx';
import TermsOfService from '@/pages/TermsOfService.jsx';
import CopyrightInfo from '@/pages/CopyrightInfo.jsx';
import ModerationPanel from '@/pages/ModerationPanel.jsx';

function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <DialogProvider>
          <Router>
            <ScrollToTop />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/explorer" element={<ExplorerPage />} />
              <Route path="/news" element={<NewsPage />} />
              <Route path="/artist/:id" element={<ArtistProfilePage />} />
              <Route path="/song/:id" element={<ExplorerPage />} />
              
              {/* Legal Pages */}
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/copyright" element={<CopyrightInfo />} />
              
              <Route
                path="/upload"
                element={
                  <ProtectedRoute>
                    <MusicUploadPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <UserProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/moderation"
                element={
                  <ProtectedRoute>
                    <ModerationPanel />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Router>
          <ToastContainer />
        </DialogProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default App;