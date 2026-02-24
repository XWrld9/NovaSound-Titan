import React from 'react';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Shield, Lock, Eye, FileText } from 'lucide-react';

const PrivacyPolicy = () => {
  return (
    <>
      <Helmet>
        <title>Politique de Confidentialité - NovaSound TITAN LUX</title>
        <meta name="description" content="Politique de confidentialité de NovaSound TITAN LUX" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
          <div className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-magenta-500 bg-clip-text text-transparent mb-4">
              Politique de Confidentialité
            </h1>
            <p className="text-gray-400">Dernière mise à jour : 19 Février 2026</p>
          </div>

          <div className="space-y-12 text-gray-300 leading-relaxed">
            <section className="bg-gray-900/50 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="w-8 h-8 text-cyan-400" />
                <h2 className="text-2xl font-bold text-white">1. Introduction</h2>
              </div>
              <p className="mb-4">
                Bienvenue sur NovaSound TITAN LUX. Nous prenons votre vie privée très au sérieux. Cette politique de confidentialité explique comment nous recueillons, utilisons, divulguons et protégeons vos informations lorsque vous utilisez notre plateforme de streaming musical.
              </p>
              <p>
                En accédant ou en utilisant notre service, vous acceptez les pratiques décrites dans cette politique.
              </p>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-magenta-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Eye className="w-8 h-8 text-magenta-500" />
                <h2 className="text-2xl font-bold text-white">2. Collecte des Données</h2>
              </div>
              <p className="mb-4">Nous collectons les types d'informations suivants :</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-400">
                <li><strong className="text-white">Informations de compte :</strong> Nom d'utilisateur, adresse email, mot de passe (crypté), et image de profil.</li>
                <li><strong className="text-white">Données d'utilisation :</strong> Historique d'écoute, interactions (likes, abonnements), et playlists créées.</li>
                <li><strong className="text-white">Contenu utilisateur :</strong> Fichiers audio, images de couverture et métadonnées associées que vous téléchargez.</li>
                <li><strong className="text-white">Données techniques :</strong> Adresse IP, type de navigateur, et informations sur l'appareil pour la sécurité et l'optimisation.</li>
              </ul>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <FileText className="w-8 h-8 text-cyan-400" />
                <h2 className="text-2xl font-bold text-white">3. Utilisation des Données</h2>
              </div>
              <p className="mb-4">Vos données sont utilisées pour :</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-400">
                <li>Fournir et maintenir notre service de streaming.</li>
                <li>Personnaliser votre expérience (recommandations musicales).</li>
                <li>Gérer votre compte et fournir un support client.</li>
                <li>Détecter et prévenir les activités frauduleuses.</li>
                <li>Communiquer avec vous concernant les mises à jour du service.</li>
              </ul>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-magenta-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Lock className="w-8 h-8 text-magenta-500" />
                <h2 className="text-2xl font-bold text-white">4. Sécurité et Droits</h2>
              </div>
              <p className="mb-4">
                Nous mettons en œuvre des mesures de sécurité robustes pour protéger vos données personnelles. Cependant, aucune méthode de transmission sur Internet n'est totalement sécurisée.
              </p>
              <p className="mb-4">
                Vous disposez des droits suivants concernant vos données :
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-400">
                <li>Droit d'accès et de rectification de vos données.</li>
                <li>Droit à l'effacement (droit à l'oubli).</li>
                <li>Droit de restreindre ou de vous opposer au traitement.</li>
                <li>Droit à la portabilité des données.</li>
              </ul>
            </section>

            <div className="text-center pt-8 border-t border-gray-800">
              <p className="text-gray-500 mb-4">Pour toute question concernant cette politique, contactez-nous à :</p>
              <a href="mailto:eloadxfamily@gmail.com" className="text-cyan-400 hover:text-magenta-500 transition-colors font-semibold text-lg">
                eloadxfamily@gmail.com
              </a>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default PrivacyPolicy;