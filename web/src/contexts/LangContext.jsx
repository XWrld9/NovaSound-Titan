/**
 * LangContext — NovaSound TITAN LUX V200000
 * Traduction complète FR / EN — tout le site, PWA inclus
 * Usage : const { t, lang, setLang } = useLang()
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

const FR = {
  /* ── Navigation ───────────────────────────────── */
  home: 'Accueil', explore: 'Explorer', trending: 'Tendances',
  live: 'Live', artists: 'Artistes', news: 'Actualités',
  chat: 'Chat', leaderboard: 'Classement', local: 'Hors-ligne',
  upload: 'Publier', profile: 'Mon profil', playlists: 'Mes playlists',
  stats: 'Statistiques', messages: 'Messages', notifications: 'Notifications',
  admin: 'Admin', moderation: 'Modération', logout: 'Déconnexion',
  login: 'Connexion', signup: "S'inscrire", search: 'Rechercher…',
  install: "Installer l'app", settings: 'Paramètres',

  /* ── Actions génériques ────────────────────────── */
  play: 'Lire', pause: 'Pause', stop: 'Arrêter', next: 'Suivant',
  previous: 'Précédent', shuffle: 'Aléatoire', repeat: 'Répéter',
  share: 'Partager', like: 'Aimer', unlike: "Je n'aime plus",
  comment: 'Commenter', follow: 'Suivre', unfollow: 'Ne plus suivre',
  save: 'Enregistrer', cancel: 'Annuler', delete: 'Supprimer',
  edit: 'Modifier', close: 'Fermer', seeAll: 'Voir tout',
  confirm: 'Confirmer', send: 'Envoyer', add: 'Ajouter',
  remove: 'Retirer', download: 'Télécharger', report: 'Signaler',
  repost: 'Reposter', copy: 'Copier', open: 'Ouvrir',
  create: 'Créer', loading: 'Chargement…', retry: 'Réessayer',

  /* ── États ─────────────────────────────────────── */
  online: 'En ligne', offline: 'Hors ligne',
  noResults: 'Aucun résultat', empty: 'Aucun contenu',
  error: 'Une erreur est survenue', success: 'Succès',
  saved: 'Enregistré', deleted: 'Supprimé', copied: 'Copié !',

  /* ── Auth ──────────────────────────────────────── */
  emailPlaceholder: 'Adresse e-mail', passwordPlaceholder: 'Mot de passe',
  usernamePlaceholder: "Nom d'utilisateur", loginTitle: 'Connexion',
  signupTitle: 'Créer un compte', forgotPassword: 'Mot de passe oublié ?',
  noAccount: "Pas de compte ?", hasAccount: 'Déjà un compte ?',
  orContinueWith: 'Ou continuer avec', googleLogin: 'Continuer avec Google',

  /* ── HomePage ──────────────────────────────────── */
  heroTitle: 'La musique africaine sans limites',
  heroSub: 'Découvre, partage et vis la musique en temps réel',
  discoverMusic: 'Découvrir la musique', liveNow: 'Lives en cours',
  newReleases: 'Nouvelles sorties', featured: 'À la une',
  recommended: 'Recommandés', trending: 'Tendances', recentlyPlayed: 'Récemment joué',
  topArtists: 'Top artistes', topSongs: 'Top sons',

  /* ── Player ────────────────────────────────────── */
  nowPlaying: 'En lecture', queue: 'File d\'attente', addToQueue: 'Ajouter à la file',
  addToPlaylist: 'Ajouter à une playlist', speed: 'Vitesse',
  quality: 'Qualité', volume: 'Volume', mute: 'Couper le son',
  sleepTimer: 'Minuterie', lyrics: 'Paroles', relatedSongs: 'Sons similaires',

  /* ── Songs ─────────────────────────────────────── */
  plays: 'écoutes', likes: "j'aimes", comments: 'commentaires',
  reposts: 'reposts', duration: 'Durée', genre: 'Genre',
  mood: 'Humeur', uploadedBy: 'Par', uploadedOn: 'Le',
  listenNow: 'Écouter', addToFavorites: 'Favoris',

  /* ── Upload ────────────────────────────────────── */
  uploadTitle: 'Publier un son', dragDrop: 'Glisse ton fichier ici',
  orClickToSelect: 'ou clique pour sélectionner', songTitle: 'Titre',
  artistName: 'Artiste', albumName: 'Album', coverImage: 'Pochette',
  audioFile: 'Fichier audio', publishing: 'Publication en cours…',
  published: 'Publié avec succès !',

  /* ── Live Rooms ────────────────────────────────── */
  liveRoom: 'Salle Live', startLive: 'Démarrer un live',
  joinLive: 'Rejoindre', leaveRoom: 'Quitter', noLive: 'Aucun live en cours',
  createRoom: 'Créer une salle', roomName: 'Nom de la salle',
  privateRoom: 'Salle privée', publicRoom: 'Salle publique',
  participants: 'participants', host: 'Hôte', pauseLive: 'Mettre en pause',
  resumeLive: 'Reprendre', paused: 'En pause', shareInChat: 'Partager dans le chat',
  typeMessage: 'Tape ton message…', reactions: 'Réactions',
  liveEnded: 'Le live est terminé', joined: 'a rejoint', left: 'a quitté',

  /* ── Leaderboard ────────────────────────────────── */
  hallOfFame: 'Hall of Fame', topListeners: 'Top Auditeurs',
  topArtists2: 'Top Artistes', topSongs2: 'Top Sons',
  topStreaks: 'Top Séries', daysListened: 'j. écoutés',
  daysInRow: 'j. de suite', record: 'record', total: 'total',
  myRank: 'Ma position', notRanked: 'Non classé', ranked: 'Classé',

  /* ── Chat ──────────────────────────────────────── */
  globalChat: 'Chat Global', writeMessage: 'Écrire un message…',
  noMessages: 'Aucun message', typeToChat: 'Commence la conversation !',
  isTyping: 'est en train d\'écrire…',

  /* ── Playlists ──────────────────────────────────── */
  myPlaylists: 'Mes playlists', createPlaylist: 'Créer une playlist',
  playlistName: 'Nom de la playlist', noPlaylists: 'Aucune playlist',
  songsInPlaylist: 'son(s) dans cette playlist', emptyPlaylist: 'Playlist vide',

  /* ── Profile ────────────────────────────────────── */
  followers: 'abonnés', following: 'abonnements', bio: 'Bio',
  editProfile: 'Modifier le profil', mySongs: 'Mes sons',
  myReposts: 'Mes reposts', liveNowBadge: 'EN LIVE',

  /* ── Local Player ────────────────────────────────── */
  localPlayer: 'Lecteur Local', offlineMode: '100% hors-ligne',
  addFiles: 'Ajouter des fichiers', addFolder: 'Ajouter un dossier',
  noFiles: 'Aucun fichier audio', dropFiles: 'Glisse tes fichiers ici',
  player_section: 'Lecteur', files_section: 'Fichiers', playlists_section: 'Playlists',
  restoring: 'Restauration…', needReload: 'À recharger',

  /* ── Notifications ────────────────────────────────── */
  allNotifs: 'Toutes', unread: 'Non lues', markAllRead: 'Tout marquer lu',
  noNotifs: 'Aucune notification',
  notif_like: 'a aimé ton son', notif_follow: 'te suit maintenant',
  notif_comment: 'a commenté', notif_live: 'est en live',
  notif_new_song: 'a publié un nouveau son',

  /* ── Misc ───────────────────────────────────────── */
  darkMode: 'Mode sombre', language: 'Langue',
  french: 'Français', english: 'English',
  privacyPolicy: 'Politique de confidentialité',
  termsOfService: 'Conditions d\'utilisation',
  copyright: 'Droits d\'auteur', about: 'À propos',
  version: 'Version', comingSoon: 'Bientôt disponible',
  noInternet: 'Pas de connexion internet',
  reconnecting: 'Reconnexion…', connected: 'Connecté',
};

const EN = {
  /* ── Navigation ───────────────────────────────── */
  home: 'Home', explore: 'Explore', trending: 'Trending',
  live: 'Live', artists: 'Artists', news: 'News',
  chat: 'Chat', leaderboard: 'Leaderboard', local: 'Offline',
  upload: 'Upload', profile: 'My profile', playlists: 'My playlists',
  stats: 'Statistics', messages: 'Messages', notifications: 'Notifications',
  admin: 'Admin', moderation: 'Moderation', logout: 'Log out',
  login: 'Log in', signup: 'Sign up', search: 'Search…',
  install: 'Install app', settings: 'Settings',

  /* ── Actions génériques ────────────────────────── */
  play: 'Play', pause: 'Pause', stop: 'Stop', next: 'Next',
  previous: 'Previous', shuffle: 'Shuffle', repeat: 'Repeat',
  share: 'Share', like: 'Like', unlike: 'Unlike',
  comment: 'Comment', follow: 'Follow', unfollow: 'Unfollow',
  save: 'Save', cancel: 'Cancel', delete: 'Delete',
  edit: 'Edit', close: 'Close', seeAll: 'See all',
  confirm: 'Confirm', send: 'Send', add: 'Add',
  remove: 'Remove', download: 'Download', report: 'Report',
  repost: 'Repost', copy: 'Copy', open: 'Open',
  create: 'Create', loading: 'Loading…', retry: 'Retry',

  /* ── États ─────────────────────────────────────── */
  online: 'Online', offline: 'Offline',
  noResults: 'No results', empty: 'No content',
  error: 'Something went wrong', success: 'Success',
  saved: 'Saved', deleted: 'Deleted', copied: 'Copied!',

  /* ── Auth ──────────────────────────────────────── */
  emailPlaceholder: 'Email address', passwordPlaceholder: 'Password',
  usernamePlaceholder: 'Username', loginTitle: 'Log in',
  signupTitle: 'Create account', forgotPassword: 'Forgot password?',
  noAccount: 'No account?', hasAccount: 'Already have an account?',
  orContinueWith: 'Or continue with', googleLogin: 'Continue with Google',

  /* ── HomePage ──────────────────────────────────── */
  heroTitle: 'African music without limits',
  heroSub: 'Discover, share and live music in real time',
  discoverMusic: 'Discover music', liveNow: 'Live now',
  newReleases: 'New releases', featured: 'Featured',
  recommended: 'Recommended', recentlyPlayed: 'Recently played',
  topArtists: 'Top artists', topSongs: 'Top songs',

  /* ── Player ────────────────────────────────────── */
  nowPlaying: 'Now playing', queue: 'Queue', addToQueue: 'Add to queue',
  addToPlaylist: 'Add to playlist', speed: 'Speed',
  quality: 'Quality', volume: 'Volume', mute: 'Mute',
  sleepTimer: 'Sleep timer', lyrics: 'Lyrics', relatedSongs: 'Related songs',

  /* ── Songs ─────────────────────────────────────── */
  plays: 'plays', likes: 'likes', comments: 'comments',
  reposts: 'reposts', duration: 'Duration', genre: 'Genre',
  mood: 'Mood', uploadedBy: 'By', uploadedOn: 'On',
  listenNow: 'Listen', addToFavorites: 'Favourites',

  /* ── Upload ────────────────────────────────────── */
  uploadTitle: 'Upload a track', dragDrop: 'Drag your file here',
  orClickToSelect: 'or click to select', songTitle: 'Title',
  artistName: 'Artist', albumName: 'Album', coverImage: 'Cover',
  audioFile: 'Audio file', publishing: 'Publishing…',
  published: 'Published successfully!',

  /* ── Live Rooms ────────────────────────────────── */
  liveRoom: 'Live Room', startLive: 'Start a live',
  joinLive: 'Join', leaveRoom: 'Leave', noLive: 'No live session',
  createRoom: 'Create room', roomName: 'Room name',
  privateRoom: 'Private room', publicRoom: 'Public room',
  participants: 'participants', host: 'Host', pauseLive: 'Pause',
  resumeLive: 'Resume', paused: 'Paused', shareInChat: 'Share in chat',
  typeMessage: 'Type your message…', reactions: 'Reactions',
  liveEnded: 'Live has ended', joined: 'joined', left: 'left',

  /* ── Leaderboard ────────────────────────────────── */
  hallOfFame: 'Hall of Fame', topListeners: 'Top Listeners',
  topArtists2: 'Top Artists', topSongs2: 'Top Songs',
  topStreaks: 'Top Streaks', daysListened: 'd. listened',
  daysInRow: 'd. in a row', record: 'record', total: 'total',
  myRank: 'My rank', notRanked: 'Not ranked', ranked: 'Ranked',

  /* ── Chat ──────────────────────────────────────── */
  globalChat: 'Global Chat', writeMessage: 'Write a message…',
  noMessages: 'No messages', typeToChat: 'Start the conversation!',
  isTyping: 'is typing…',

  /* ── Playlists ──────────────────────────────────── */
  myPlaylists: 'My playlists', createPlaylist: 'Create playlist',
  playlistName: 'Playlist name', noPlaylists: 'No playlists',
  songsInPlaylist: 'song(s) in this playlist', emptyPlaylist: 'Empty playlist',

  /* ── Profile ────────────────────────────────────── */
  followers: 'followers', following: 'following', bio: 'Bio',
  editProfile: 'Edit profile', mySongs: 'My songs',
  myReposts: 'My reposts', liveNowBadge: 'LIVE',

  /* ── Local Player ────────────────────────────────── */
  localPlayer: 'Offline Player', offlineMode: '100% offline',
  addFiles: 'Add files', addFolder: 'Add folder',
  noFiles: 'No audio files', dropFiles: 'Drop your files here',
  player_section: 'Player', files_section: 'Files', playlists_section: 'Playlists',
  restoring: 'Restoring…', needReload: 'Needs reload',

  /* ── Notifications ────────────────────────────────── */
  allNotifs: 'All', unread: 'Unread', markAllRead: 'Mark all read',
  noNotifs: 'No notifications',
  notif_like: 'liked your track', notif_follow: 'is now following you',
  notif_comment: 'commented', notif_live: 'is live',
  notif_new_song: 'published a new track',

  /* ── Misc ───────────────────────────────────────── */
  darkMode: 'Dark mode', language: 'Language',
  french: 'Français', english: 'English',
  privacyPolicy: 'Privacy policy',
  termsOfService: 'Terms of service',
  copyright: 'Copyright', about: 'About',
  version: 'Version', comingSoon: 'Coming soon',
  noInternet: 'No internet connection',
  reconnecting: 'Reconnecting…', connected: 'Connected',
};

const LangContext = createContext(null);

export const LangProvider = ({ children }) => {
  const getInitial = () => {
    try { return localStorage.getItem('ns_lang') === 'en' ? 'en' : 'fr'; } catch { return 'fr'; }
  };
  const [lang, setLangState] = useState(getInitial);

  const setLang = useCallback((l) => {
    setLangState(l);
    try { localStorage.setItem('ns_lang', l); } catch {}
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'fr' ? 'en' : 'fr');
  }, [lang, setLang]);

  const t = useCallback((key, fallback) => {
    const dict = lang === 'en' ? EN : FR;
    return dict[key] ?? (fallback !== undefined ? fallback : key);
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used inside LangProvider');
  return ctx;
};

export default LangContext;
