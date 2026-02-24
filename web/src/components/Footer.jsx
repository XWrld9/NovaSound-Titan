import React from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
const Footer = () => {
  return <footer className="bg-gray-950 border-t border-cyan-500/20 mt-auto relative overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-0 left-1/4 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-magenta-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center md:text-left">
          {/* Brand */}
          <div className="space-y-4 flex flex-col items-center md:items-start">
            <div className="flex items-center gap-2">
              <img src="https://horizons-cdn.hostinger.com/83c37f40-fa54-4cc6-8247-95b1353f3eba/a4885bba5290b1958f05bcdb82731c39.jpg" alt="NovaSound Logo" className="w-8 h-8 rounded-full border border-cyan-400" />
              <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-magenta-500 bg-clip-text text-transparent">
                NovaSound TITAN LUX
              </span>
            </div>
            <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
              The ultimate next-gen music streaming platform. Experience high-fidelity audio and connect with artists worldwide.
            </p>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col items-center md:items-start">
            <h3 className="text-white font-semibold mb-4 border-b-2 border-cyan-500/30 pb-1 inline-block">Discover</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/explorer" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm flex items-center gap-2">
                  <span className="w-1 h-1 bg-cyan-500 rounded-full opacity-0 hover:opacity-100 transition-opacity" />
                  Explorer
                </Link>
              </li>
              <li>
                <Link to="/news" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm flex items-center gap-2">
                  <span className="w-1 h-1 bg-cyan-500 rounded-full opacity-0 hover:opacity-100 transition-opacity" />
                  News & Updates
                </Link>
              </li>
              <li>
                <Link to="/upload" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm flex items-center gap-2">
                  <span className="w-1 h-1 bg-cyan-500 rounded-full opacity-0 hover:opacity-100 transition-opacity" />
                  Uploader
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="flex flex-col items-center md:items-start">
            <h3 className="text-white font-semibold mb-4 border-b-2 border-magenta-500/30 pb-1 inline-block">Legal</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/privacy" className="text-gray-400 text-sm cursor-pointer hover:text-magenta-400 transition-colors">
                  Politique de Confidentialité
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-gray-400 text-sm cursor-pointer hover:text-magenta-400 transition-colors">
                  Conditions d'Utilisation
                </Link>
              </li>
              <li>
                <Link to="/copyright" className="text-gray-400 text-sm cursor-pointer hover:text-magenta-400 transition-colors">
                  Droits d'Auteur
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="flex flex-col items-center md:items-start">
            <h3 className="text-white font-semibold mb-4">Contact</h3>
            <div className="flex items-center gap-3">
              <a href="mailto:eloadxfamily@gmail.com" className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gray-900 border border-cyan-500/20 text-gray-400 hover:text-cyan-400 hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(0,217,255,0.3)] transition-all duration-300 group">
                <Mail className="w-5 h-5 group-hover:animate-pulse" />
                <span className="font-medium">Nous Contacter</span>
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 text-center">
          <p className="text-gray-500 text-sm font-mono">© 2026 NovaSound TITAN LUX - XWrld</p>
        </div>
      </div>
    </footer>;
};
export default Footer;