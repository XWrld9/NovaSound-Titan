import React from 'react';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Scale, AlertTriangle, CheckCircle, Gavel } from 'lucide-react';

const TermsOfService = () => {
  return (
    <>
      <Helmet>
        <title>Conditions d'Utilisation - NovaSound TITAN LUX</title>
        <meta name="description" content="Conditions d'utilisation de la plateforme NovaSound TITAN LUX" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-24 md:pb-32">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
          <div className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-fuchsia-500 to-cyan-400 bg-clip-text text-transparent mb-4">
              Conditions d'Utilisation
            </h1>
            <p className="text-gray-400">Entrée en vigueur : 19 Février 2026</p>
          </div>

          <div className="space-y-12 text-gray-300 leading-relaxed">
            <section className="bg-gray-900/50 backdrop-blur-sm border border-fuchsia-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <CheckCircle className="w-8 h-8 text-fuchsia-500" />
                <h2 className="text-2xl font-bold text-white">1. Acceptation des Conditions</h2>
              </div>
              <p>
                En accédant à NovaSound TITAN LUX, vous acceptez d'être lié par ces conditions d'utilisation, toutes les lois et réglementations applicables, et acceptez que vous êtes responsable du respect des lois locales applicables. Si vous n'êtes pas d'accord avec l'une de ces conditions, il vous est interdit d'utiliser ou d'accéder à ce site.
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
              </ul>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-fuchsia-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <AlertTriangle className="w-8 h-8 text-fuchsia-500" />
                <h2 className="text-2xl font-bold text-white">3. Propriété Intellectuelle</h2>
              </div>
              <p className="mb-4">
                Le service et son contenu original (à l'exclusion du contenu fourni par les utilisateurs), ses fonctionnalités et ses fonctionnalités sont et resteront la propriété exclusive de NovaSound TITAN LUX et de ses concédants de licence.
              </p>
              <p>
                En téléchargeant du contenu (musique, images), vous déclarez posséder les droits nécessaires ou avoir l'autorisation de partager ce contenu. Vous accordez à NovaSound une licence mondiale, non exclusive pour diffuser ce contenu sur la plateforme.
              </p>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Gavel className="w-8 h-8 text-cyan-400" />
                <h2 className="text-2xl font-bold text-white">4. Résiliation</h2>
              </div>
              <p>
                Nous pouvons résilier ou suspendre votre compte immédiatement, sans préavis ni responsabilité, pour quelque raison que ce soit, y compris, sans s'y limiter, si vous violez les Conditions.
              </p>
            </section>

            <div className="text-center pt-8 border-t border-gray-800">
              <p className="text-gray-500 mb-4">Contact pour les questions juridiques :</p>
              <a href="mailto:eloadxfamily@gmail.com" className="text-cyan-400 hover:text-fuchsia-500 transition-colors font-semibold text-lg">
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