import React from 'react';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Shield, Lock, Eye, FileText, UserCheck, Trash2 } from 'lucide-react';

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
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent mb-4">
              Politique de Confidentialité
            </h1>
            <p className="text-gray-400">Dernière mise à jour : 24 Février 2026</p>
          </div>

          <div className="space-y-8 text-gray-300 leading-relaxed">

            <section className="bg-gray-900/50 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="w-8 h-8 text-cyan-400" />
                <h2 className="text-2xl font-bold text-white">1. Introduction</h2>
              </div>
              <p className="mb-4">
                Bienvenue sur <strong className="text-white">NovaSound TITAN LUX</strong>. Nous prenons votre vie privée très au sérieux. Cette politique de confidentialité explique comment nous recueillons, utilisons, divulguons et protégeons vos informations lorsque vous utilisez notre plateforme musicale.
              </p>
              <p>
                En accédant ou en utilisant notre service, vous acceptez les pratiques décrites dans cette politique. Si vous n'acceptez pas ces termes, veuillez ne pas utiliser la plateforme.
              </p>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-fuchsia-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Eye className="w-8 h-8 text-fuchsia-400" />
                <h2 className="text-2xl font-bold text-white">2. Données Collectées</h2>
              </div>
              <p className="mb-4">Nous collectons uniquement les données nécessaires au fonctionnement de la plateforme :</p>
              <ul className="list-disc pl-6 space-y-3 text-gray-400">
                <li><strong className="text-white">Informations de compte :</strong> nom d'utilisateur, adresse email, mot de passe (chiffré via Supabase Auth), et photo de profil.</li>
                <li><strong className="text-white">Données d'utilisation :</strong> morceaux écoutés, likes, abonnements (follows) et interactions sur la plateforme.</li>
                <li><strong className="text-white">Contenu uploadé :</strong> fichiers audio, pochettes d'albums, news et métadonnées associées.</li>
                <li><strong className="text-white">Données techniques :</strong> adresse IP, type de navigateur et informations sur l'appareil, utilisées uniquement à des fins de sécurité et d'optimisation.</li>
              </ul>
              <p className="mt-4 text-sm text-gray-500">
                Nous ne collectons aucune donnée de paiement — la plateforme est entièrement gratuite.
              </p>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <FileText className="w-8 h-8 text-cyan-400" />
                <h2 className="text-2xl font-bold text-white">3. Utilisation des Données</h2>
              </div>
              <p className="mb-4">Vos données sont utilisées exclusivement pour :</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-400">
                <li>Fournir, maintenir et améliorer notre service de streaming.</li>
                <li>Gérer votre compte et authentifier vos connexions.</li>
                <li>Afficher votre contenu (musiques, news, profil) aux autres utilisateurs.</li>
                <li>Détecter et prévenir les activités frauduleuses ou abusives.</li>
                <li>Vous envoyer des notifications importantes liées à votre compte.</li>
              </ul>
              <p className="mt-4 text-gray-500 text-sm">
                Nous ne vendons, ne louons et ne partageons jamais vos données personnelles avec des tiers à des fins commerciales.
              </p>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-fuchsia-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <UserCheck className="w-8 h-8 text-fuchsia-400" />
                <h2 className="text-2xl font-bold text-white">4. Vos Droits</h2>
              </div>
              <p className="mb-4">
                Conformément au RGPD et aux réglementations applicables, vous disposez des droits suivants :
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-400">
                <li><strong className="text-white">Droit d'accès :</strong> obtenir une copie de vos données personnelles.</li>
                <li><strong className="text-white">Droit de rectification :</strong> corriger des informations inexactes via votre profil.</li>
                <li><strong className="text-white">Droit à l'effacement :</strong> demander la suppression de votre compte et de vos données.</li>
                <li><strong className="text-white">Droit d'opposition :</strong> vous opposer à certains traitements de vos données.</li>
                <li><strong className="text-white">Droit à la portabilité :</strong> récupérer vos données dans un format lisible.</li>
              </ul>
              <p className="mt-4 text-gray-400">
                Pour exercer l'un de ces droits, contactez-nous à l'adresse ci-dessous. Nous répondrons dans un délai de 30 jours.
              </p>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Lock className="w-8 h-8 text-cyan-400" />
                <h2 className="text-2xl font-bold text-white">5. Sécurité</h2>
              </div>
              <p className="mb-4">
                Nous mettons en œuvre des mesures de sécurité robustes pour protéger vos données :
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-400">
                <li>Authentification sécurisée via <strong className="text-white">Supabase Auth</strong> avec flow PKCE.</li>
                <li>Row Level Security (RLS) sur toutes les tables — vous ne pouvez accéder qu'à vos propres données sensibles.</li>
                <li>Mots de passe chiffrés — nous ne stockons jamais votre mot de passe en clair.</li>
                <li>Communications chiffrées via HTTPS/TLS.</li>
              </ul>
              <p className="mt-4 text-gray-500 text-sm">
                Cependant, aucune méthode de transmission sur Internet n'est totalement infaillible. En cas de violation de données, nous vous informerons dans les délais légaux requis.
              </p>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-fuchsia-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Trash2 className="w-8 h-8 text-fuchsia-400" />
                <h2 className="text-2xl font-bold text-white">6. Conservation et Suppression</h2>
              </div>
              <p className="mb-4">
                Vos données sont conservées tant que votre compte est actif. Vous pouvez à tout moment :
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-400">
                <li>Modifier ou supprimer vos musiques, news et contenu uploadé depuis votre profil.</li>
                <li>Demander la suppression complète de votre compte en nous contactant par email.</li>
              </ul>
              <p className="mt-4 text-gray-400">
                En cas de suppression de compte, vos données personnelles sont effacées sous 30 jours, à l'exception des données conservées pour des obligations légales.
              </p>
            </section>

            <div className="text-center pt-8 border-t border-gray-800">
              <p className="text-gray-500 mb-2">Pour toute question concernant cette politique :</p>
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

export default PrivacyPolicy;
