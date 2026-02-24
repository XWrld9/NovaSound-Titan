import React from 'react';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Copyright, Flag, AlertCircle, Mail, Shield, Music } from 'lucide-react';

const CopyrightInfo = () => {
  return (
    <>
      <Helmet>
        <title>Droits d'Auteur - NovaSound TITAN LUX</title>
        <meta name="description" content="Informations sur les droits d'auteur et DMCA pour NovaSound TITAN LUX" />
      </Helmet>

      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Header />

        <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
          <div className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent mb-4">
              Droits d'Auteur
            </h1>
            <p className="text-gray-400">Protection de la propriété intellectuelle</p>
          </div>

          <div className="space-y-8 text-gray-300 leading-relaxed">

            <section className="bg-gray-900/50 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Copyright className="w-8 h-8 text-cyan-400" />
                <h2 className="text-2xl font-bold text-white">Avis de Copyright</h2>
              </div>
              <p className="mb-4">
                Tous les éléments de la plateforme <strong className="text-white">NovaSound TITAN LUX</strong> (interface, design, code, logo, nom, textes) sont la propriété exclusive de leurs auteurs et sont protégés par les lois internationales sur le droit d'auteur.
              </p>
              <p>
                Le contenu créatif (musiques, images, news) publié par les utilisateurs reste la propriété intellectuelle exclusive de leurs auteurs respectifs. NovaSound ne revendique aucun droit de propriété sur le contenu uploadé par les utilisateurs.
              </p>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-fuchsia-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Music className="w-8 h-8 text-fuchsia-400" />
                <h2 className="text-2xl font-bold text-white">Responsabilité des Artistes</h2>
              </div>
              <p className="mb-4">
                En uploadant du contenu sur NovaSound, chaque artiste déclare sur l'honneur :
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-400">
                <li>Être l'auteur ou le détenteur des droits du contenu uploadé.</li>
                <li>Disposer des droits sur les samples, beats, et éléments tiers intégrés dans leurs créations.</li>
                <li>Ne pas uploader de contenu sous copyright appartenant à des tiers sans autorisation.</li>
              </ul>
              <p className="mt-4 text-gray-400">
                Tout manquement à ces engagements est de la seule responsabilité de l'utilisateur concerné. NovaSound ne saurait être tenu responsable des violations commises par ses utilisateurs.
              </p>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Flag className="w-8 h-8 text-cyan-400" />
                <h2 className="text-2xl font-bold text-white">Politique DMCA & Signalement</h2>
              </div>
              <p className="mb-4">
                Si vous pensez que votre œuvre protégée a été publiée sur NovaSound sans votre autorisation, vous pouvez nous adresser un avis de violation. Cet avis doit inclure :
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-400">
                <li>Votre identité et coordonnées complètes (nom, email, adresse).</li>
                <li>Une description précise de l'œuvre protégée dont vous revendiquez les droits.</li>
                <li>L'URL ou la localisation exacte du contenu litigieux sur NovaSound.</li>
                <li>Une déclaration indiquant que vous croyez, de bonne foi, que l'utilisation n'est pas autorisée.</li>
                <li>Une déclaration sur l'honneur de l'exactitude de vos informations.</li>
                <li>Votre signature électronique ou physique.</li>
              </ul>
              <p className="mt-4 text-gray-400">
                À réception d'un avis valide, nous traiterons votre demande dans les meilleurs délais et retirerons le contenu si la violation est avérée.
              </p>
              <div className="mt-4 p-4 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-xl">
                <p className="text-fuchsia-300 text-sm">
                  ⚠️ <strong>Attention :</strong> Tout signalement frauduleux ou abusif peut engager votre responsabilité légale.
                </p>
              </div>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-fuchsia-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <AlertCircle className="w-8 h-8 text-fuchsia-400" />
                <h2 className="text-2xl font-bold text-white">Utilisation Équitable (Fair Use)</h2>
              </div>
              <p className="mb-4">
                Certaines utilisations d'œuvres protégées peuvent être considérées comme "utilisation équitable" (Fair Use) dans le cadre de la critique musicale, du commentaire, de l'enseignement ou de la recherche.
              </p>
              <p>
                NovaSound soutient les principes de l'utilisation équitable et de la création artistique libre. Cependant, nous nous réservons le droit de retirer tout contenu faisant l'objet d'un litige en attendant sa résolution.
              </p>
            </section>

            <section className="bg-gray-900/50 backdrop-blur-sm border border-cyan-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="w-8 h-8 text-cyan-400" />
                <h2 className="text-2xl font-bold text-white">Protection des Créateurs</h2>
              </div>
              <p>
                NovaSound TITAN LUX a été conçu pour les artistes. Nous croyons fermement que chaque créateur mérite que son travail soit respecté. C'est pourquoi nous encourageons tous les utilisateurs à ne partager que du contenu original ou pour lequel ils disposent des droits nécessaires.
              </p>
            </section>

            <div className="text-center pt-8 border-t border-gray-800">
              <div className="flex flex-col items-center gap-4">
                <Mail className="w-12 h-12 text-fuchsia-400" />
                <h3 className="text-xl font-bold text-white">Signaler une violation de droits d'auteur</h3>
                <p className="text-gray-500 max-w-md">
                  Envoyez tous les avis de violation du droit d'auteur à l'adresse suivante. Nous traiterons votre demande dans les meilleurs délais.
                </p>
                <a href="mailto:eloadxfamily@gmail.com" className="text-cyan-400 hover:text-fuchsia-400 transition-colors font-semibold text-lg">
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
