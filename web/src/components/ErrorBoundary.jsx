import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Si erreur persistante, recharger la page
    if ((window.__ebResets || 0) >= 1) {
      window.location.reload();
    } else {
      window.__ebResets = (window.__ebResets || 0) + 1;
      setTimeout(() => { window.__ebResets = 0; }, 5000);
    }
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Compatible HashRouter
    window.location.hash = '#/';
    setTimeout(() => window.location.reload(), 50);
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>

            <h1 className="text-2xl font-bold text-white mb-4">
              Oups, une erreur est survenue
            </h1>

            <p className="text-gray-400 mb-6">
              Nous sommes désolés, quelque chose s'est mal passé.
              Nos équipes ont été notifiées et travaillent à résoudre le problème.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-cyan-400 cursor-pointer mb-2">
                  Détails techniques (dev uniquement)
                </summary>
                <div className="bg-gray-800 rounded-lg p-4 mt-2 overflow-auto max-h-40">
                  <pre className="text-xs text-red-400 font-mono">
                    {this.state.error.toString()}
                  </pre>
                  {this.state.errorInfo && (
                    <pre className="text-xs text-gray-400 font-mono mt-2">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={this.handleReset}
                className="bg-cyan-500 hover:bg-cyan-600 cursor-pointer"
                type="button"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Réessayer
              </Button>

              <Button
                variant="outline"
                onClick={this.handleGoHome}
                className="border-gray-600 text-gray-300 hover:bg-gray-800 cursor-pointer"
                type="button"
              >
                <Home className="w-4 h-4 mr-2" />
                Accueil
              </Button>
            </div>

            <div className="mt-6 text-xs text-gray-500">
              Si le problème persiste, contactez le support ou rechargez la page.
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
