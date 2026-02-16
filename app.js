/* app.js - NovaSound TITAN LUX (patched)
- Fixed: localStorage quota issues by moving blobs to IndexedDB
- Safe localStorage writes (setJSON)
- Blob storage: addMediaBlob / getMediaBlob / deleteMediaBlob
- Thumbnail capture from blob (no full base64 storage)
- Migration helper for old dataURLs -> IndexedDB
*/
(function () {
'use strict';

/* ---------- Utilities ---------- */
const $ = id => document.getElementById(id);

function uid(prefix = 'id') {
 return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function safeJSON(key, fallback = []) {
 try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; }
 catch (e) { return fallback; }
}

/**
* setJSON: safe writer for localStorage with quota handling.
* If quota exceeded, try to free space by removing non-essential keys (global songs),
* then retry once. Returns true if write succeeded.
*/
function setJSON(key, value) {
 try {
   localStorage.setItem(key, JSON.stringify(value));
   return true;
 } catch (e) {
   const isQuota = e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22);
   if (isQuota) {
     console.warn('localStorage quota exceeded while writing', key, e);
     // Strategy: remove the heaviest non-essential key and retry once.
     // Here we remove GLOBAL_SONGS_KEY to free space; adjust strategy as needed.
     try {
       localStorage.removeItem(GLOBAL_SONGS_KEY);
     } catch (remErr) { console.warn('Could not remove GLOBAL_SONGS_KEY', remErr); }
     try {
       localStorage.setItem(key, JSON.stringify(value));
       return true;
     } catch (err2) {
       console.error('Still cannot write to localStorage after cleanup', err2);
       alert('Impossible d\'enregistrer localement — espace de stockage insuffisant.');
       return false;
     }
   } else {
     console.error('localStorage write error', e);
     return false;
   }
 }
}

function mimeToExt(mime) {
 const map = {
   'audio/mpeg': 'mp3',
   'audio/mp4': 'm4a',
   'audio/wav': 'wav',
   'audio/x-wav': 'wav',
   'audio/ogg': 'ogg',
   'audio/webm': 'webm',
   'audio/aac': 'aac',
   'video/mp4': 'mp4',
   'video/webm': 'webm',
   'video/ogg': 'ogv',
   'video/quicktime': 'mov'
 };
 return map[mime] || (mime.split('/')[1] || 'bin');
}

/* ---------- File helpers ---------- */
function fileToDataURL(file) {
 return new Promise((resolve, reject) => {
   const reader = new FileReader();
   reader.onload = () => resolve(reader.result);
   reader.onerror = () => reject(new Error('Lecture du fichier échouée'));
   reader.readAsDataURL(file);
 });
}

// Capture thumbnail from a blob (no base64 needed)
function captureVideoThumbnailFromBlob(blob, seekTime = 1.0, width = 800) {
 return new Promise((resolve, reject) => {
   try {
     const url = URL.createObjectURL(blob);
     const video = document.createElement('video');
     video.src = url;
     video.muted = true;
     video.playsInline = true;
     video.preload = 'metadata';
     let cleaned = false;

     const cleanup = () => {
       if (cleaned) return;
       cleaned = true;
       try { video.removeAttribute('src'); } catch (e) {}
       try { URL.revokeObjectURL(url); } catch (e) {}
     };

     video.addEventListener('loadedmetadata', () => {
       // choose time (clamp to duration)
       let t = Math.min(seekTime, Math.max(0, video.duration / 2));
       const doSeek = () => {
         const onSeek = () => {
           try {
             const canvas = document.createElement('canvas');
             const vw = video.videoWidth || width;
             const vh = video.videoHeight || Math.round(width * 0.56);
             const aspect = vh / vw;
             canvas.width = width;
             canvas.height = Math.round(width * aspect);
             const ctx = canvas.getContext('2d');
             ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
             const img = canvas.toDataURL('image/png');
             video.removeEventListener('seeked', onSeek);
             cleanup();
             resolve(img);
           } catch (err) {
             video.removeEventListener('seeked', onSeek);
             cleanup();
             reject(err);
           }
         };
         video.addEventListener('seeked', onSeek);
         try { video.currentTime = t; } catch (e) {
           setTimeout(() => { try { video.currentTime = t; } catch (_) { /* ignore */ } }, 200);
         }
       };
       setTimeout(doSeek, 120);
     });

     video.addEventListener('error', (e) => {
       cleanup();
       reject(new Error('Impossible de lire la vidéo pour générer une miniature'));
     });
   } catch (err) {
     reject(err);
   }
 });
}

/* ---------- Storage keys & limits ---------- */
const ADMIN_EMAIL = 'admin@novasound.com';
const ADMIN_PASS = 'admin123';
const GLOBAL_SONGS_KEY = 'songs_global';
const NEWS_KEY = 'news_global';
const MAX_FILE_BYTES = 30 * 1024 * 1024; // 30 MB warning threshold for this demo (adjust as needed)

/* ===========================
  IndexedDB helpers (store blobs)
  =========================== */
const MEDIA_DB = 'NovaSound_MediaDB_v1';
const MEDIA_STORE = 'media_store';
let _db = null;

function openMediaDB() {
 return new Promise((resolve, reject) => {
   if (_db) return resolve(_db);
   const req = indexedDB.open(MEDIA_DB, 1);
   req.onupgradeneeded = (e) => {
     const db = e.target.result;
     if (!db.objectStoreNames.contains(MEDIA_STORE)) {
       db.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
     }
   };
   req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
   req.onerror = (e) => reject(e.target.error);
 });
}

function addMediaBlob(id, blob) {
 return openMediaDB().then(db => new Promise((res, rej) => {
   const tx = db.transaction(MEDIA_STORE, 'readwrite');
   tx.objectStore(MEDIA_STORE).put({ id, blob });
   tx.oncomplete = () => res();
   tx.onerror = (ev) => rej(ev.target.error);
 }));
}

function getMediaBlob(id) {
 return openMediaDB().then(db => new Promise((res, rej) => {
   const r = db.transaction(MEDIA_STORE, 'readonly').objectStore(MEDIA_STORE).get(id);
   r.onsuccess = () => res(r.result ? r.result.blob : null);
   r.onerror = (ev) => rej(ev.target.error);
 }));
}

function deleteMediaBlob(id) {
 return openMediaDB().then(db => new Promise((res, rej) => {
   const tx = db.transaction(MEDIA_STORE, 'readwrite');
   tx.objectStore(MEDIA_STORE).delete(id);
   tx.oncomplete = () => res();
   tx.onerror = (ev) => rej(ev.target.error);
 }));
}

/* ---------- Auth (register/login/logout) ---------- */
function handleRegister() {
 const name = $('regName')?.value?.trim();
 const email = $('regEmail')?.value?.trim().toLowerCase();
 const pass = $('regPass')?.value;
 if (!name || !email || !pass) { alert('Remplis tous les champs'); return; }
 const key = 'user_' + email;
 if (localStorage.getItem(key)) { alert('Utilisateur déjà existant'); return; }
 setJSON(key, { name, email, pass, photo: null });
 alert('Compte créé — connecte-toi');
 window.location.href = 'login.html';
}

function handleLogin() {
 const email = $('logEmail')?.value?.trim().toLowerCase();
 const pass = $('logPass')?.value;
 if (!email || !pass) { alert('Email et mot de passe requis'); return; }
 if (email === ADMIN_EMAIL && pass === ADMIN_PASS) {
   localStorage.setItem('currentUser', ADMIN_EMAIL);
   alert('Connecté en tant qu\'admin');
   window.location.href = 'index.html';
   return;
 }
 const raw = localStorage.getItem('user_' + email);
 if (!raw) { alert('Utilisateur non trouvé'); return; }
 const user = JSON.parse(raw);
 if (user.pass !== pass) { alert('Mot de passe incorrect'); return; }
 localStorage.setItem('currentUser', email);
 alert('Connecté !');
 window.location.href = 'index.html';
}

function logout() {
 localStorage.removeItem('currentUser');
 window.location.href = 'login.html';
}

/* ---------- Render user area (top-right) ---------- */
function renderUserArea() {
 const area = document.querySelector('.user-area');
 if (!area) return;
 area.innerHTML = '';
 const current = localStorage.getItem('currentUser') || null;
 if (!current) {
   const a1 = document.createElement('a'); a1.href = 'login.html'; a1.className = 'btn-ghost'; a1.textContent = 'Se connecter';
   const a2 = document.createElement('a'); a2.href = 'register.html'; a2.className = 'btn-ghost'; a2.textContent = "S'inscrire";
   area.appendChild(a1); area.appendChild(a2);
   return;
 }
 const profile = safeJSON('user_' + current, {});
 const wrap = document.createElement('div'); wrap.className = 'row';
 const img = document.createElement('img'); img.className = 'player-cover'; img.style.width = '40px'; img.style.height = '40px'; img.style.borderRadius = '8px';
 img.src = profile.photo || '';
 img.alt = profile.name || current;
 const nameDiv = document.createElement('div'); nameDiv.style.marginLeft = '8px';
 nameDiv.innerHTML = `<div style="font-weight:700">${profile.name || current}</div><div class="muted small">${current === ADMIN_EMAIL ? 'Admin' : 'Membre'}</div>`;
 const btnOut = document.createElement('button'); btnOut.className = 'btn-ghost'; btnOut.textContent = 'Déconnexion';
 btnOut.addEventListener('click', () => { logout(); });
 wrap.appendChild(img); wrap.appendChild(nameDiv); wrap.appendChild(btnOut);
 area.appendChild(wrap);
}

/* ---------- Navigation / SPA helpers ---------- */
window.showPage = function (pageId) {
 const protectedPages = ['upload', 'explorer', 'profile'];
 const current = localStorage.getItem('currentUser') || null;
 if (protectedPages.includes(pageId) && !current) {
   if (confirm('Tu dois être connecté. Aller à la page de connexion ?')) window.location.href = 'login.html';
   return;
 }
 document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
 const el = $(pageId);
 if (el) el.style.display = 'block';
 if (pageId === 'home') loadHome();
 if (pageId === 'explorer') loadExplorer();
 if (pageId === 'profile') loadProfile();
 if (pageId === 'news') loadNews();
};

/* ---------- Data helpers ---------- */
function loadGlobalSongs() { return safeJSON(GLOBAL_SONGS_KEY, []); }
function saveGlobalSongs(arr) { return setJSON(GLOBAL_SONGS_KEY, arr); }
function loadUserSongs(user) { return safeJSON('songs_user_' + user, []); }
function saveUserSongs(user, arr) { return setJSON('songs_user_' + user, arr); }

/* ---------- Upload (media + cover handling) ---------- */
async function handleUploadMediaWithCover() {
 const current = localStorage.getItem('currentUser') || null;
 if (!current) { alert('Connecte-toi pour publier'); return; }

 const artist = $('artist')?.value?.trim() || '';
 const title = $('title')?.value?.trim();
 const mediaInput = $('mediaFile') || $('audio') || $('audioFile');
 const coverInput = $('cover');

 if (!title) { alert('Le titre est requis'); return; }
 if (!mediaInput || !mediaInput.files || !mediaInput.files[0]) { alert('Sélectionne un fichier audio ou vidéo'); return; }

 const mediaFile = mediaInput.files[0];
 const coverFile = coverInput && coverInput.files && coverInput.files[0] ? coverInput.files[0] : null;

 // Warn on big files
 if (mediaFile.size > MAX_FILE_BYTES) {
   const ok = confirm(`Le fichier est volumineux (${Math.round(mediaFile.size / 1024 / 1024)} MB). Continuer (risque d'erreur de stockage) ?`);
   if (!ok) return;
 }

 const mime = mediaFile.type || '';
 const mediaType = mime.startsWith('video') ? 'video' : (mime.startsWith('audio') ? 'audio' : 'unknown');

 try {
   // Store media as blob in IndexedDB (fast, avoids localStorage quota)
   const mediaId = uid('media');
   await addMediaBlob(mediaId, mediaFile);

   // cover handling: small images stored inline (dataURL), large images stored as blob in IndexedDB
   let coverRef = '';
   if (coverFile) {
     if (!coverFile.type.startsWith('image/')) {
       console.warn('Fichier de couverture non image, ignoré');
     } else if (coverFile.size < 200 * 1024) {
       coverRef = await fileToDataURL(coverFile); // small inline cover
     } else {
       const coverId = mediaId + '_cover';
       await addMediaBlob(coverId, coverFile);
       coverRef = '__cover_blob__:' + coverId;
     }
   } else if (mediaType === 'video') {
     // Try to generate thumbnail (without storing full media as base64)
     try {
       const thumbData = await captureVideoThumbnailFromBlob(mediaFile, 1.0, 800);
       coverRef = thumbData || '';
     } catch (thumbErr) {
       console.warn('Impossible de générer la miniature vidéo :', thumbErr);
       coverRef = '';
     }
   }

   const ext = mimeToExt(mime);
   const song = {
     id: uid('song'),
     artist: artist || 'Artiste inconnu',
     title,
     owner: current,
     mediaType, // 'audio' or 'video'
     mime,
     ext,
     blobRef: mediaId,    // reference to IndexedDB blob (avoid storing dataURL)
     cover: coverRef || '',
     fav: false,
     date: new Date().toISOString()
   };

   // Save metadata (lightweight) only
   const global = loadGlobalSongs();
   global.push(song);
   saveGlobalSongs(global);

   const userSongs = loadUserSongs(current);
   userSongs.push(song);
   saveUserSongs(current, userSongs);

   alert('Publié avec succès !');

   // Reset form & previews (if exist)
   if (mediaInput) mediaInput.value = '';
   if (coverInput) coverInput.value = '';
   if ($('coverPreview')) $('coverPreview').src = '';
   if ($('audioPreview')) $('audioPreview').src = '';
   if ($('noCover')) $('noCover').style.display = 'block';
   if ($('noAudio')) $('noAudio').style.display = 'block';

   // Refresh views
   loadHome();
   loadExplorer();
 } catch (err) {
   console.error('Erreur upload:', err);
   alert('Erreur lors de l\'upload : ' + (err.message || 'voir console'));
 }
}

/* ---------- UI: make song card (loads blobs async) ---------- */
function makeSongCard(song, opts = { showOwner: false, showDelete: false }) {
 const div = document.createElement('div');
 div.className = 'card';

 // Left: cover / placeholder
 const left = document.createElement('div');
 left.style.minWidth = '120px';
 if (song.cover) {
   const img = document.createElement('img');
   img.style.width = '120px'; img.style.height = '120px'; img.style.objectFit = 'cover'; img.style.borderRadius = '8px';
   // cover may be inline dataURL or reference to blob
   if (String(song.cover).startsWith('__cover_blob__:')) {
     // will be replaced once blob is loaded
     const coverId = song.cover.split(':')[1];
     getMediaBlob(coverId).then(blob => {
       if (blob) img.src = URL.createObjectURL(blob);
     }).catch(e => console.warn('Erreur getMediaBlob cover', e));
   } else {
     img.src = song.cover;
   }
   left.appendChild(img);
 } else {
   const placeholder = document.createElement('div');
   placeholder.style.width = '120px'; placeholder.style.height = '120px'; placeholder.style.borderRadius = '8px';
   placeholder.style.background = 'linear-gradient(90deg,var(--accent),var(--accent-2))';
   left.appendChild(placeholder);
 }

 // Right: info + controls
 const right = document.createElement('div');
 right.style.flex = '1';

 const top = document.createElement('div');
 top.style.display = 'flex';
 top.style.justifyContent = 'space-between';

 const meta = document.createElement('div');
 const titleEl = document.createElement('div'); titleEl.style.fontWeight = '700'; titleEl.textContent = song.title;
 const artistEl = document.createElement('div'); artistEl.className = 'muted'; artistEl.textContent = `${song.artist}${opts.showOwner ? ' • ' + (song.owner || '?') : ''}`;
 meta.appendChild(titleEl); meta.appendChild(artistEl);

 const actions = document.createElement('div');
 actions.style.display = 'flex'; actions.style.flexDirection = 'column'; actions.style.gap = '8px';

 const btnPlay = document.createElement('button'); btnPlay.className = 'btn-ghost small'; btnPlay.textContent = '▶️';
 btnPlay.dataset.id = song.id; btnPlay.dataset.action = 'play';
 const btnDownload = document.createElement('button'); btnDownload.className = 'btn-ghost small'; btnDownload.textContent = '⬇';
 btnDownload.dataset.id = song.id; btnDownload.dataset.action = 'download';
 const btnFav = document.createElement('button'); btnFav.className = 'btn-ghost small'; btnFav.textContent = song.fav ? '❤️' : '🤍';
 btnFav.dataset.id = song.id; btnFav.dataset.action = 'fav';
 actions.appendChild(btnPlay); actions.appendChild(btnDownload); actions.appendChild(btnFav);

 if (opts.showDelete) {
   const btnDelete = document.createElement('button'); btnDelete.className = 'btn-ghost small'; btnDelete.textContent = '🗑';
   btnDelete.dataset.id = song.id; btnDelete.dataset.action = 'delete';
   actions.appendChild(btnDelete);
 }

 top.appendChild(meta); top.appendChild(actions);

 // Media element (audio or video) — load blob from IndexedDB and set ObjectURL
 const mediaWrap = document.createElement('div');
 mediaWrap.style.marginTop = '8px';
 if (song.mediaType === 'video') {
   const v = document.createElement('video'); v.controls = true; v.style.display = 'block'; v.style.width = '100%'; v.style.borderRadius = '8px';
   mediaWrap.appendChild(v);
   if (song.blobRef) {
     getMediaBlob(song.blobRef).then(blob => {
       if (blob) v.src = URL.createObjectURL(blob);
     }).catch(e => console.warn('Erreur getMediaBlob video', e));
   }
 } else {
   const a = document.createElement('audio'); a.controls = true; a.style.width = '100%';
   mediaWrap.appendChild(a);
   if (song.blobRef) {
     getMediaBlob(song.blobRef).then(blob => {
       if (blob) a.src = URL.createObjectURL(blob);
     }).catch(e => console.warn('Erreur getMediaBlob audio', e));
   }
 }

 const dateEl = document.createElement('div'); dateEl.className = 'muted small'; dateEl.style.marginTop = '8px';
 dateEl.textContent = `Publié : ${new Date(song.date).toLocaleString()}`;

 right.appendChild(top);
 right.appendChild(mediaWrap);
 right.appendChild(dateEl);

 // Assemble
 const container = document.createElement('div');
 container.style.display = 'flex'; container.style.gap = '12px';
 container.appendChild(left); container.appendChild(right);

 div.appendChild(container);

 // event delegation for the buttons inside this card
 div.querySelectorAll('button').forEach(b => {
   b.addEventListener('click', () => handleSongAction(b.dataset.action, b.dataset.id));
 });

 return div;
}

function renderGrid(containerId, songsArr, opts = {}) {
 const c = $(containerId);
 if (!c) return;
 c.innerHTML = '';
 if (!songsArr || !songsArr.length) {
   c.innerHTML = `<div class="card muted">Aucun morceau</div>`;
   return;
 }
 songsArr.slice().reverse().forEach(s => c.appendChild(makeSongCard(s, opts)));
}

/* ---------- Song actions (play / download / fav / delete) ---------- */
function handleSongAction(action, songId) {
 const global = loadGlobalSongs();
 const song = global.find(s => s.id === songId);
 if (!song) return;
 if (action === 'play') {
   // playing logic: set player footer and play
   const pa = $('playerAudio');
   if (pa) {
     if (song.blobRef) {
       getMediaBlob(song.blobRef).then(blob => {
         if (!blob) return alert('Fichier introuvable');
         pa.src = URL.createObjectURL(blob);
         pa.play().catch(() => {});
       }).catch(e => console.warn(e));
     } else if (song.data) {
       pa.src = song.data;
       pa.play().catch(() => {});
     } else {
       alert('Fichier introuvable');
     }
   }
   if ($('playerTitle')) $('playerTitle').textContent = song.title;
   if ($('playerArtist')) $('playerArtist').textContent = song.artist;
   if ($('playerCover')) {
     if (String(song.cover).startsWith('__cover_blob__:')) {
       const coverId = song.cover.split(':')[1];
       getMediaBlob(coverId).then(blob => { if (blob) $('playerCover').src = URL.createObjectURL(blob); }).catch(() => {});
     } else {
       $('playerCover').src = song.cover || '';
     }
   }
 } else if (action === 'download') {
   if (song.blobRef) {
     getMediaBlob(song.blobRef).then(blob => {
       if (!blob) { alert('Fichier introuvable'); return; }
       const url = URL.createObjectURL(blob);
       const a = document.createElement('a');
       a.href = url;
       a.download = `${(song.title || 'track').replace(/[^\w\-\.]/g, '_')}.${song.ext || 'bin'}`;
       document.body.appendChild(a);
       a.click();
       a.remove();
       URL.revokeObjectURL(url);
     }).catch(err => { console.error(err); alert('Erreur téléchargement'); });
   } else if (song.data) {
     const a = document.createElement('a'); a.href = song.data; a.download = `${(song.title || 'track').replace(/[^\w\-\.]/g, '_')}.${song.ext || 'bin'}`; a.click();
   } else {
     alert('Fichier introuvable');
   }
 } else if (action === 'fav') {
   global.forEach(s => { if (s.id === songId) s.fav = !s.fav; });
   saveGlobalSongs(global);
   // update user list if present
   if (song.owner) {
     const us = loadUserSongs(song.owner).map(s => s.id === songId ? Object.assign({}, s, { fav: !s.fav }) : s);
     saveUserSongs(song.owner, us);
   }
   loadHome();
 } else if (action === 'delete') {
   const current = localStorage.getItem('currentUser');
   if (current !== song.owner && current !== ADMIN_EMAIL) { alert('Tu n\'as pas les droits pour supprimer ce morceau.'); return; }

   // delete blob(s)
   if (song.blobRef) {
     deleteMediaBlob(song.blobRef).catch(e => console.warn('Erreur suppression blob', e));
   }
   if (song.cover && String(song.cover).startsWith('__cover_blob__:')) {
     const coverId = song.cover.split(':')[1];
     deleteMediaBlob(coverId).catch(e => console.warn('Erreur suppression cover blob', e));
   }

   const ng = global.filter(s => s.id !== songId);
   saveGlobalSongs(ng);
   if (song.owner) {
     const us = loadUserSongs(song.owner).filter(s => s.id !== songId);
     saveUserSongs(song.owner, us);
   }
   loadHome(); loadExplorer(); loadProfileContent();
 }
}

/* ---------- Page loaders ---------- */
function loadHome() {
 const songs = loadGlobalSongs();
 renderGrid('homeGrid', songs, { showOwner: true, showDelete: false });
}

function loadExplorer() {
 const current = localStorage.getItem('currentUser');
 if (!current) {
   const g = $('explorerGrid'); if (g) g.innerHTML = `<div class="card muted">Connecte-toi pour voir ta bibliothèque</div>`; return;
 }
 const songs = loadUserSongs(current);
 renderGrid('explorerGrid', songs, { showOwner: false, showDelete: true });
}

function loadProfile() {
 const current = localStorage.getItem('currentUser');
 if (!current) {
   const g = $('profileContent'); if (g) g.innerHTML = `<div class="card muted">Connecte-toi pour voir ton profil</div>`; return;
 }
 const p = safeJSON('user_' + current, {});
 if ($('profileEmailDisplay')) $('profileEmailDisplay').textContent = current;
 if ($('profileNameInput')) $('profileNameInput').value = p.name || '';
 if ($('profilePic')) $('profilePic').src = p.photo || '';
 loadProfileContent();
}

function loadProfileContent() {
 const current = localStorage.getItem('currentUser');
 if (!current) return;
 const songs = loadUserSongs(current);
 renderGrid('profileContent', songs, { showDelete: true });
}

/* ---------- Profile photo & name ---------- */
function uploadProfilePhoto(e) {
 const f = e.target.files[0];
 if (!f) return;
 if (!f.type.startsWith('image/')) { alert('Sélectionne une image'); return; }
 const r = new FileReader();
 r.onload = () => {
   const data = r.result;
   const current = localStorage.getItem('currentUser');
   if (!current) { alert('Connecte-toi'); return; }
   const u = safeJSON('user_' + current, {});
   u.photo = data;
   setJSON('user_' + current, u);
   if ($('profilePic')) $('profilePic').src = data;
   renderUserArea();
 };
 r.onerror = () => alert('Impossible de lire la photo');
 r.readAsDataURL(f);
}
window.uploadProfilePhoto = uploadProfilePhoto;

function saveProfileName() {
 const name = $('profileNameInput')?.value?.trim();
 const current = localStorage.getItem('currentUser');
 if (!current) { alert('Connecte-toi'); return; }
 const u = safeJSON('user_' + current, {});
 u.name = name;
 setJSON('user_' + current, u);
 alert('Profil mis à jour');
 renderUserArea();
}
window.saveProfileName = saveProfileName;

window.showLibrary = function () { showPage('profile'); loadProfileContent(); };
window.showPlaylist = function () { const all = loadGlobalSongs(); const favs = all.filter(s => s.fav); renderGrid('profileContent', favs, {}); };

/* ---------- News ---------- */
function addNews() {
 const title = $('newsTitle')?.value?.trim();
 const artist = $('newsArtist')?.value?.trim();
 const content = $('newsContent')?.value?.trim();
 if (!title || !content) return alert('Titre et contenu requis');
 const arr = safeJSON(NEWS_KEY, []);
 arr.push({ id: uid('news'), title, artist, content, date: new Date().toISOString(), author: localStorage.getItem('currentUser') || 'invité' });
 setJSON(NEWS_KEY, arr);
 if ($('newsTitle')) $('newsTitle').value = ''; if ($('newsArtist')) $('newsArtist').value = ''; if ($('newsContent')) $('newsContent').value = '';
 loadNews();
}

function loadNews() {
 const list = safeJSON(NEWS_KEY, []);
 const node = $('newsList'); if (!node) return; node.innerHTML = '';
 list.slice().reverse().forEach(n => {
   const d = document.createElement('div'); d.className = 'card';
   d.innerHTML = `<div style="display:flex;justify-content:space-between"><div><b>${n.title}</b><div class="muted small">${n.artist ? ('Artiste : ' + n.artist) : ''}</div></div><div class="muted small">${new Date(n.date).toLocaleString()}</div></div><p style="margin-top:10px">${n.content}</p>`;
   node.appendChild(d);
 });
}

/* ---------- Search ---------- */
function runSearch() {
 const q = ($('globalSearch')?.value || '').toLowerCase().trim();
 if (!q) { loadHome(); return; }
 const songs = loadGlobalSongs().filter(s => (s.title || '').toLowerCase().includes(q) || (s.artist || '').toLowerCase().includes(q));
 renderGrid('homeGrid', songs, { showOwner: true });
 showPage('home');
}
window.runSearch = runSearch;

/* ---------- Upload UI helpers: drag & drop, preview & validation ---------- */
function initUploadUI() {
 // elements might not exist on every page
 const coverDrop = $('coverDrop');
 const coverInput = $('cover');
 const coverBrowse = $('coverBrowse');
 const coverPreview = $('coverPreview');
 const noCover = $('noCover');

 const mediaDrop = $('audioDrop') || $('audioDrop'); // keep compatibility
 const mediaInput = $('mediaFile') || $('audio') || $('audioFile');
 const mediaBrowse = $('audioBrowse');
 const mediaPreview = $('audioPreview');
 const noMedia = $('noAudio');

 const btnClearUpload = $('btnClearUpload');

 function fileToDataURL_local(file) {
   return new Promise((res, rej) => {
     const r = new FileReader();
     r.onload = () => res(r.result);
     r.onerror = rej;
     r.readAsDataURL(file);
   });
 }

 // click on browse opens file dialog
 if (coverBrowse && coverInput) coverBrowse.addEventListener('click', e => { e.preventDefault(); coverInput.click(); });
 if (mediaBrowse && mediaInput) mediaBrowse.addEventListener('click', e => { e.preventDefault(); mediaInput.click(); });

 // preview image
 if (coverInput) coverInput.addEventListener('change', async () => {
   const f = coverInput.files[0];
   if (!f) { if (coverPreview) coverPreview.src = ''; if (noCover) noCover.style.display = 'block'; return; }
   if (!f.type.startsWith('image/')) { alert('Fichier de couverture non image'); coverInput.value = ''; return; }
   if (noCover) noCover.style.display = 'none';
   try { const data = await fileToDataURL_local(f); if (coverPreview) coverPreview.src = data; } catch (e) { console.warn(e); }
 });

 // preview media (audio/video)
 if (mediaInput) mediaInput.addEventListener('change', async () => {
   const f = mediaInput.files[0];
   if (!f) { if (mediaPreview) mediaPreview.src = ''; if (noMedia) noMedia.style.display = 'block'; return; }
   if (noMedia) noMedia.style.display = 'none';
   try {
     // show preview using objectURL (no base64)
     if (mediaPreview) mediaPreview.src = URL.createObjectURL(f);
   } catch (e) { console.warn(e); }
 });

 // set up dropzones
 function setupDropzone(dropEl, inputEl) {
   if (!dropEl || !inputEl) return;
   ['dragenter', 'dragover'].forEach(ev => dropEl.addEventListener(ev, e => { e.preventDefault(); dropEl.classList.add('dz-hover'); }));
   ['dragleave', 'drop'].forEach(ev => dropEl.addEventListener(ev, e => { e.preventDefault(); dropEl.classList.remove('dz-hover'); }));
   dropEl.addEventListener('drop', e => {
     const files = e.dataTransfer.files;
     if (files && files.length) {
       inputEl.files = files;
       const ev = new Event('change'); inputEl.dispatchEvent(ev);
     }
   });
   dropEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputEl.click(); } });
 }

 setupDropzone(coverDrop, coverInput);
 setupDropzone(mediaDrop, mediaInput);

 if (btnClearUpload) btnClearUpload.addEventListener('click', e => {
   e.preventDefault();
   if ($('artist')) $('artist').value = '';
   if ($('title')) $('title').value = '';
   if (coverInput) coverInput.value = '';
   if (mediaInput) mediaInput.value = '';
   if (coverPreview) coverPreview.src = '';
   if (mediaPreview) mediaPreview.src = '';
   if (noCover) noCover.style.display = 'block';
   if (noMedia) noMedia.style.display = 'block';
 });
}

/* ---------- News UI ---------- */
function initNewsUI() {
 const btnClearNews = $('btnClearNews');
 if (btnClearNews) btnClearNews.addEventListener('click', e => {
   e.preventDefault();
   if ($('newsTitle')) $('newsTitle').value = '';
   if ($('newsArtist')) $('newsArtist').value = '';
   if ($('newsContent')) $('newsContent').value = '';
 });
}

/* ---------- PWA registration & install prompt ---------- */
function registerServiceWorkerAndInstallPrompt() {
 if ('serviceWorker' in navigator) {
   navigator.serviceWorker.register('service-worker.js')
     .then(reg => console.log('SW enregistré', reg))
     .catch(err => console.warn('SW registration failed', err));
 }

 let deferredInstall = null;
 window.addEventListener('beforeinstallprompt', (e) => {
   e.preventDefault();
   deferredInstall = e;
   const btn = $('btnInstall');
   if (btn) {
     btn.style.display = 'inline-block';
     btn.addEventListener('click', async () => {
       btn.style.display = 'none';
       deferredInstall.prompt();
       const choice = await deferredInstall.userChoice;
       console.log('App install choice:', choice.outcome);
       deferredInstall = null;
     }, { once: true });
   }
 });

 window.addEventListener('appinstalled', () => {
   console.log('NovaSound installée');
   const btn = $('btnInstall'); if (btn) btn.style.display = 'none';
 });
}

/* ---------- Migration helper (optional) ----------
  Convert old songs with `.data` (dataURL) to IndexedDB blobs and replace with blobRef.
*/
async function migrateOldDataURLs() {
 try {
   const songs = loadGlobalSongs();
   let changed = false;
   for (const s of songs) {
     if (s.data && !s.blobRef) {
       try {
         // fetch the dataURL to obtain a blob without manual base64 decoding
         const res = await fetch(s.data);
         const blob = await res.blob();
         const id = uid('media');
         await addMediaBlob(id, blob);
         s.blobRef = id;
         delete s.data;
         changed = true;
       } catch (e) {
         console.warn('Migration failed for song', s.id, e);
       }
     }
   }
   if (changed) saveGlobalSongs(songs);
 } catch (e) { console.warn('Migration helper failed', e); }
}

/* ---------- Initialization on DOMContentLoaded ---------- */
document.addEventListener('DOMContentLoaded', async () => {
 // Auth buttons
 if ($('btnRegister')) $('btnRegister').addEventListener('click', handleRegister);
 if ($('btnLogin')) $('btnLogin').addEventListener('click', handleLogin);

 // Migrate any old dataURLs to IndexedDB before rendering
 try { await migrateOldDataURLs(); } catch (e) { /* swallow */ }

 // If index page exists, set up features
 if ($('home')) {
   // Nav
   document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => showPage(b.dataset.page)));
   // Search
   if ($('searchBtn')) $('searchBtn').addEventListener('click', runSearch);
   if ($('globalSearch')) $('globalSearch').addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });
   // User area
   renderUserArea();
   // Upload button
   const btnUpload = $('btnUpload');
   if (btnUpload) {
     // ensure previous handlers removed then attach our upload handler
     btnUpload.removeEventListener('click', handleUploadMediaWithCover);
     btnUpload.addEventListener('click', (e) => { e.preventDefault(); handleUploadMediaWithCover(); });
   }
   // News button
   if ($('btnAddNews')) $('btnAddNews').addEventListener('click', addNews);
   // Profile save/upload handlers
   if ($('profileUpload')) $('profileUpload').addEventListener('change', uploadProfilePhoto);
   if ($('btnSaveProfile')) $('btnSaveProfile').addEventListener('click', saveProfileName);
   // Player download (footer)
   if ($('btnDownload')) $('btnDownload').addEventListener('click', () => {
     const pa = $('playerAudio'); if (!pa || !pa.src) return alert('Aucune piste à télécharger');
     const a = document.createElement('a'); a.href = pa.src; a.download = 'track.' + (pa.src.split(';')[0].includes('audio') ? 'mp3' : 'bin'); a.click();
   });

   // init UI helpers & load content
   initUploadUI();
   initNewsUI();
   registerServiceWorkerAndInstallPrompt();
   showPage('home');
   loadHome();
   loadNews();
 }

 // Render user area on any page that has it
 renderUserArea();
});

/* expose some globals used by HTML */
window.showPage = window.showPage || function () { };
window.showLibrary = window.showLibrary || function () { };
window.showPlaylist = window.showPlaylist || function () { };
window.runSearch = window.runSearch || function () { };

})();