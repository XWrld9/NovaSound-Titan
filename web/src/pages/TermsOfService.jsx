import React from 'react';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Scale, AlertTriangle, CheckCircle, Gavel, Shield, Music } from 'lucide-react';

const TermsOfService = () => {
  return (
    <>
      <Helmet>
        <title>Conditions d'Utilisation - NovaSound TITAN LUX</title>
        <meta name="description" content="Conditions d'utilisation de la plateforme NovaSound TITAN LUX" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
          <div className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-fuchsia-500 to-cyan-400 bg-clip-text text-transparent mb-4">
              Conditions d'Utilisation
            </h1>
            <p className="text-gray-400">Entrée en vigueur : 24 Février 2026</p>
          </div>

          <div className="space-y-8 text-gray-300 leading-relaxed">

            <section className="bg-gray-900/50 backdrop-blur-sm border border-fuchsia-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <CheckCircle className="w-8 h-8 text-fuchsia-400" />
                <h2 className="text-2xl font-bold text-white">1. Acceptation des Conditions</h2>
              </div>
              <p className="mb-4">
                En accédant à <strong className="text-white">NovaSound TITAN LUX</strong>, vous acceptez d'être lié par ces conditions d'utilisation, ainsi que toutes les lois et réglementations applicables dans votre pays de résidence.
              </p>
              <p>
                Si vous n'acceptez pas l'une de ces conditions, il vous est interdit d'utiliser la plateforme. L'utilisation continue du service vaut acceptation des présentes conditions.
              </p>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Scale className="w-8 h-8 text-cyan-400" />
                <h2 className="text-2xl font-bold text-white">2. Responsabilités de l'Utilisateur</h2>
              </div>
              <p className="mb-4">En tant qu'utilisateur de la plateforme, vous vous engagez à :</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-400">
                <li>Fournir des informations exactes et complètes lors de l'inscription.</li>
                <li>Maintenir la confidentialité de votre compte et de votre mot de passe.</li>
                <li>Ne pas utiliser le service à des fins illégales ou non autorisées.</li>
                <li>Ne pas harceler, abuser ou nuire à d'autres utilisateurs.</li>
                <li>Ne pas télécharger de contenu contenant des virus ou des codes malveillants.</li>
                <li>Ne pas tenter de contourner les mesures de sécurité de la plateforme.</li>
                <li>Respecter les droits d'auteur et la propriété intellectuelle des autres.</li>
              </ul>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-fuchsia-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Music className="w-8 h-8 text-fuchsia-400" />
                <h2 className="text-2xl font-bold text-white">3. Contenu Utilisateur</h2>
              </div>
              <p className="mb-4">
                En publiant du contenu (musiques, news, images) sur NovaSound, vous déclarez et garantissez que :
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-400">
                <li>Vous êtes l'auteur du contenu ou disposez des droits nécessaires pour le partager.</li>
                <li>Ce contenu ne viole aucun droit d'auteur, marque déposée ou autre droit de propriété intellectuelle.</li>
                <li>Ce contenu n'est pas illégal, diffamatoire, obscène ou offensant.</li>
              </ul>
              <p className="mt-4">
                Vous accordez à NovaSound une licence mondiale, non exclusive et gratuite pour afficher, stocker et diffuser ce contenu sur la plateforme. Vous conservez l'intégralité de vos droits sur votre contenu.
              </p>
              <p className="mt-3 text-gray-400">
                <strong className="text-white">Droit de modification et suppression :</strong> vous pouvez modifier ou supprimer votre contenu (musiques, news) à tout moment depuis votre profil.
              </p>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <AlertTriangle className="w-8 h-8 text-cyan-400" />
                <h2 className="text-2xl font-bold text-white">4. Propriété Intellectuelle de la Plateforme</h2>
              </div>
              <p>
                Le service lui-même (interface, code, design, logo, nom) est la propriété exclusive de <strong className="text-white">NovaSound TITAN LUX</strong> et de ses créateurs. Toute reproduction ou utilisation non autorisée est strictement interdite.
              </p>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-fuchsia-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="w-8 h-8 text-fuchsia-400" />
                <h2 className="text-2xl font-bold text-white">5. Modération et Signalements</h2>
              </div>
              <p className="mb-4">
                NovaSound dispose d'un système de modération pour maintenir un environnement sain et respectueux. Tout contenu signalé sera examiné par notre équipe.
              </p>
              <p>
                NovaSound se réserve le droit de supprimer tout contenu qui violerait ces conditions, sans obligation de notification préalable.
              </p>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Gavel className="w-8 h-8 text-cyan-400" />
                <h2 className="text-2xl font-bold text-white">6. Résiliation</h2>
              </div>
              <p className="mb-4">
                Nous pouvons suspendre ou supprimer votre accès immédiatement et sans préavis si vous violez ces conditions. Vous pouvez également demander la suppression de votre compte à tout moment en nous contactant.
              </p>
              <p>
                En cas de résiliation, vos données personnelles seront supprimées conformément à notre Politique de Confidentialité.
              </p>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-fuchsia-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <AlertTriangle className="w-8 h-8 text-fuchsia-400" />
                <h2 className="text-2xl font-bold text-white">7. Limitation de Responsabilité</h2>
              </div>
              <p>
                NovaSound TITAN LUX est une plateforme communautaire gratuite. Le service est fourni "en l'état" sans garantie d'aucune sorte. Nous ne saurions être tenus responsables de pertes de données, d'interruptions de service ou de tout dommage indirect lié à l'utilisation de la plateforme.
              </p>
            </section>

            <div className="text-center pt-8 border-t border-gray-800">
              <p className="text-gray-500 mb-2">Contact pour les questions juridiques :</p>
              <a href="mailto:eloadxfamily@gmail.com" className="text-cyan-400 hover:text-fuchsia-400 transition-colors font-semibold text-lg">
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

export default TermsOfService;
