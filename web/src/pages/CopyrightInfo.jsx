import React from 'react';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Copyright, Flag, AlertCircle, Mail } from 'lucide-react';

const CopyrightInfo = () => {
  return (
    <>
      <Helmet>
        <title>Droits d'Auteur - NovaSound TITAN LUX</title>
        <meta name="description" content="Informations sur les droits d'auteur et DMCA pour NovaSound TITAN LUX" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col pb-24 md:pb-32">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
          <div className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-magenta-500 bg-clip-text text-transparent mb-4">
              Informations sur les Droits d'Auteur
            </h1>
            <p className="text-gray-400">Protection de la propriété intellectuelle</p>
          </div>

          <div className="space-y-12 text-gray-300 leading-relaxed">
            <section className="bg-gray-900/50 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Copyright className="w-8 h-8 text-cyan-400" />
                <h2 className="text-2xl font-bold text-white">Avis de Copyright</h2>
              </div>
              <p>
                Tous les droits sont réservés. Le contenu de cette plateforme, y compris mais sans s'y limiter, le texte, les graphiques, les images, les logos et le code logiciel, est la propriété de NovaSound TITAN LUX ou de ses fournisseurs de contenu et est protégé par les lois internationales sur le droit d'auteur.
              </p>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-magenta-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Flag className="w-8 h-8 text-magenta-500" />
                <h2 className="text-2xl font-bold text-white">Politique DMCA</h2>
              </div>
              <p className="mb-4">
                NovaSound respecte la propriété intellectuelle d'autrui. Si vous pensez que votre travail a été copié d'une manière qui constitue une violation du droit d'auteur, veuillez nous fournir les informations suivantes :
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-400">
                <li>Une signature physique ou électronique du propriétaire du droit d'auteur.</li>
                <li>Une description de l'œuvre protégée par le droit d'auteur que vous prétendez avoir été violée.</li>
                <li>Une description de l'endroit où le matériel que vous prétendez enfreindre se trouve sur le site.</li>
                <li>Votre adresse, numéro de téléphone et adresse e-mail.</li>
                <li>Une déclaration de votre part indiquant que vous croyez de bonne foi que l'utilisation contestée n'est pas autorisée par le propriétaire du droit d'auteur, son agent ou la loi.</li>
              </ul>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <AlertCircle className="w-8 h-8 text-cyan-400" />
                <h2 className="text-2xl font-bold text-white">Utilisation Équitable (Fair Use)</h2>
              </div>
              <p>
                Certaines utilisations de matériel protégé par le droit d'auteur peuvent être considérées comme une "utilisation équitable" (Fair Use) à des fins telles que la critique, le commentaire, le reportage, l'enseignement, l'érudition et la recherche. NovaSound soutient les principes de l'utilisation équitable, mais se réserve le droit de retirer tout contenu en cas de litige.
              </p>
            </section>

            <div className="text-center pt-8 border-t border-gray-800">
              <div className="flex flex-col items-center gap-4">
                <Mail className="w-12 h-12 text-magenta-500" />
                <h3 className="text-xl font-bold text-white">Signaler une infraction</h3>
                <p className="text-gray-500">
                  Veuillez envoyer tous les avis de violation du droit d'auteur à :
                </p>
                <a href="mailto:eloadxfamily@gmail.com" className="text-cyan-400 hover:text-magenta-500 transition-colors font-semibold text-lg">
                  eloadxfamily@gmail.com
                </a>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default CopyrightInfo;