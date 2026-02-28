import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Music } from 'lucide-react';

const Footer = () => (
  <footer className="bg-gray-950 border-t border-cyan-500/20 mt-auto relative overflow-hidden">
    <div className="absolute top-0 left-1/4 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
    <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-fuchsia-500/5 rounded-full blur-3xl pointer-events-none" />

    <div className="container mx-auto px-4 py-10 relative z-10">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center md:text-left">

        {/* Marque */}
        <div className="flex flex-col items-center md:items-start space-y-3">
          <div className="flex items-center gap-2">
            <img
              src="https://horizons-cdn.hostinger.com/83c37f40-fa54-4cc6-8247-95b1353f3eba/a4885bba5290b1958f05bcdb82731c39.jpg"
              alt="Logo NovaSound"
              className="w-8 h-8 rounded-full border border-cyan-400"
            />
            <span className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent">
              NovaSound TITAN LUX
            </span>
          </div>
          <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
            La plateforme musicale nouvelle génération. Streamez, uploadez et connectez-vous avec des artistes du monde entier.
          </p>
        </div>

        {/* Découvrir */}
        <div className="flex flex-col items-center md:items-start">
          <h3 className="text-white font-semibold mb-4 border-b-2 border-cyan-500/30 pb-1 inline-block">Découvrir</h3>
          <ul className="space-y-3">
            {[
              { to: '/explorer', label: 'Explorer' },
              { to: '/news',     label: 'Actualités' },
              { to: '/upload',   label: 'Uploader un son' },
            ].map(({ to, label }) => (
              <li key={to}>
                <Link to={to} className="text-gray-400 hover:text-cyan-400 transition-colors text-sm">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Légal */}
        <div className="flex flex-col items-center md:items-start">
          <h3 className="text-white font-semibold mb-4 border-b-2 border-fuchsia-500/30 pb-1 inline-block">Légal</h3>
          <ul className="space-y-3">
            {[
              { to: '/privacy',   label: 'Politique de confidentialité' },
              { to: '/terms',     label: "Conditions d'utilisation" },
              { to: '/copyright', label: "Droits d'auteur" },
            ].map(({ to, label }) => (
              <li key={to}>
                <Link to={to} className="text-gray-400 text-sm hover:text-fuchsia-400 transition-colors">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div className="flex flex-col items-center md:items-start">
          <h3 className="text-white font-semibold mb-4">Contact</h3>
          <a
            href="mailto:eloadxfamily@gmail.com"
            className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gray-900 border border-cyan-500/20 text-gray-400 hover:text-cyan-400 hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(0,217,255,0.3)] transition-all group"
          >
            <Mail className="w-5 h-5 group-hover:animate-pulse" />
            <span className="text-sm font-medium">Nous contacter</span>
          </a>
        </div>
      </div>

      <div className="border-t border-gray-800 mt-10 pt-6 text-center">
        <p className="text-gray-500 text-sm font-mono">© 2026 NovaSound TITAN LUX — XWrld</p>
      </div>
    </div>
  </footer>
);

export default Footer;
