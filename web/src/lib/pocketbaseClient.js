import PocketBase from 'pocketbase';

// Configuration pour le déploiement sur Vercel
const getBaseUrl = () => {
  // En production sur Vercel
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return 'https://novasound-pocketbase.fly.dev'; // URL de votre PocketBase déployé
  }
  // En développement local
  return 'http://127.0.0.1:8090';
};

const pb = new PocketBase(getBaseUrl());

// Auto-détection de l'environnement
if (typeof window !== 'undefined') {
  // Client-side only
  pb.autoCancellation(false);
}

export default pb;
