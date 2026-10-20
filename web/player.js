// player.js — reproducción, cola, aleatorio/repetir y Media Session
// (controles en pantalla bloqueada, notificación y botones de audífonos)

import { lib, getFile, getCoverBlob } from './library.js';

export const audio = new Audio();
audio.preload = 'auto';
audio.setAttribute('playsinline', '');
document.body.appendChild(audio); // un único <audio> en el DOM: Chrome lo mantiene vivo con la pantalla apagada

export const P = {
  queue: [], original: [], index: -1,
  shuffle: false, repeat: 'off', // off | one | all
  track: null, art: null,
};

const listeners = new Set();
export const onPlayer = (fn) => listeners.add(fn);
const emit = (type) => listeners.forEach((fn) => { try { fn(type); } catch (e) { console.error(e); } });

const ms = 'mediaSession' in navigator ? navigator.mediaSession : null;
const DEFAULT_ART = new URL('icons/icon-512.png', location.href).href;
let objURL = null, token = 0;

function shuffled(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- cola

export function playList(ids, start = 0, { shuffle = P.shuffle } = {}) {
  ids = ids.filter((id) => lib.byId.has(id));
  if (!ids.length) return;
  start = Math.min(Math.max(0, start), ids.length - 1);
  P.original = ids.slice();
  if (shuffle) {
    const first = ids[start];
    P.queue = [first, ...shuffled(ids.filter((_, i) => i !== start))];
    P.index = 0;
  } else {
    P.queue = ids.slice();
    P.index = start;
  }
  return loadIndex(P.index, true);
}

export function jump(i) {
  if (i >= 0 && i < P.queue.length) return loadIndex(i, true);
}

export function playNext(id) {
  if (!P.track) return playList([id], 0);
  P.queue.splice(P.index + 1, 0, id);
  P.original.push(id);
  emit('queue'); saveState();
}

async function loadIndex(i, autoplay, startAt = 0) {
  const my = ++token;
  // salta pistas que ya no existen
  while (i < P.queue.length && !lib.byId.has(P.queue[i])) P.queue.splice(i, 1);
  if (i >= P.queue.length) { stop(); return; }
  const t = lib.byId.get(P.queue[i]);
  P.index = i; P.track = t; P.art = null;

  let file;
  try { file = await getFile(t.id); }
  catch (e) { emit('error'); P.queue.splice(i, 1); return P.queue.length ? loadIndex(Math.min(i, P.queue.length - 1), autoplay) : stop(); }
  if (my !== token) return;

  if (objURL) URL.revokeObjectURL(objURL);
  objURL = URL.createObjectURL(file);
  audio.src = objURL;
  if (startAt > 0) audio.addEventListener('loadedmetadata', () => { audio.currentTime = Math.min(startAt, audio.duration || startAt); }, { once: true });

  emit('track');
  loadArt(t, my);
  if (autoplay) {
    try { await audio.play(); } catch (e) { console.warn('play', e); }
  }
  saveState();
}

function stop() {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  P.track = null; P.index = -1; P.queue = []; P.art = null;
  if (ms) { ms.metadata = null; ms.playbackState = 'none'; }
  emit('track'); saveState();
}

export function next(auto = false) {
  if (!P.track) return;
  if (auto && P.repeat === 'one') { audio.currentTime = 0; audio.play(); return; }
  let i = P.index + 1, play = auto || !audio.paused;
  if (i >= P.queue.length) {
    i = 0;
    if (P.repeat !== 'all') play = false; // fin de la lista: vuelve al inicio en pausa
  }
  loadIndex(i, play);
}

export function prev() {
  if (!P.track) return;
  if (audio.currentTime > 3 || P.index <= 0) { audio.currentTime = 0; return; }
  loadIndex(P.index - 1, !audio.paused);
}

export function toggle() {
  if (!P.track) return false;
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  return true;
}

export function seekBy(sec) {
  if (!P.track || !isFinite(audio.duration)) return;
  audio.currentTime = Math.max(0, Math.min(audio.duration - 0.25, audio.currentTime + sec));
  updatePosition();
}

export function setVolume(v) { audio.volume = Math.max(0, Math.min(1, v)); saveState(); }

export function setShuffle(on) {
  P.shuffle = on;
  if (P.track) {
    const curId = P.queue[P.index];
    if (on) { P.queue = [curId, ...shuffled(P.original.filter((id) => id !== curId))]; P.index = 0; }
    else { P.queue = P.original.slice(); P.index = Math.max(0, P.queue.indexOf(curId)); }
  }
  emit('queue'); saveState();
}

export function setRepeat(mode) { P.repeat = mode; saveState(); }

// ---------- portada y metadatos para la pantalla bloqueada

async function toDataURL(blob, size = 512) {
  const bmp = await createImageBitmap(blob);
  const s = Math.min(bmp.width, bmp.height);
  const c = document.createElement('canvas');
  c.width = c.height = Math.min(size, s);
  c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, c.width, c.height);
  bmp.close?.();
  return c.toDataURL('image/jpeg', 0.86);
}

async function loadArt(t, my) {
  const base = { title: t.title, artist: t.artist, album: t.album };
  if (ms) ms.metadata = new MediaMetadata({ ...base, artwork: [{ src: DEFAULT_ART, sizes: '512x512', type: 'image/png' }] });
  try {
    const blob = await getCoverBlob(t);
    if (!blob || my !== token) return;
    const url = await toDataURL(blob);
    if (my !== token) return;
    P.art = url;
    if (ms) ms.metadata = new MediaMetadata({ ...base, artwork: [{ src: url, sizes: '512x512', type: 'image/jpeg' }] });
    emit('art');
  } catch (e) { console.warn('art', e); }
}

let lastPos = 0;
function updatePosition() {
  if (!ms?.setPositionState || !isFinite(audio.duration) || audio.duration <= 0) return;
  try {
    ms.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate || 1, position: Math.min(audio.currentTime, audio.duration) });
  } catch {}
}

if (ms) {
  const h = (action, fn) => { try { ms.setActionHandler(action, fn); } catch {} };
  h('play', () => audio.play());
  h('pause', () => audio.pause());
  h('stop', () => audio.pause());
  h('previoustrack', () => prev());
  h('nexttrack', () => next());
  h('seekbackward', (d) => seekBy(-(d?.seekOffset || 10)));
  h('seekforward', (d) => seekBy(d?.seekOffset || 10));
  h('seekto', (d) => {
    if (d.fastSeek && 'fastSeek' in audio) audio.fastSeek(d.seekTime); else audio.currentTime = d.seekTime;
    updatePosition();
  });
}

// ---------- eventos del elemento de audio

audio.addEventListener('ended', () => next(true));
audio.addEventListener('play', () => { if (ms) ms.playbackState = 'playing'; emit('state'); });
audio.addEventListener('pause', () => { if (ms) ms.playbackState = 'paused'; emit('state'); saveState(); });
audio.addEventListener('loadedmetadata', () => { updatePosition(); emit('time'); });
audio.addEventListener('timeupdate', () => {
  emit('time');
  const now = Date.now();
  if (now - lastPos > 4000) { lastPos = now; updatePosition(); saveState(); }
});
audio.addEventListener('error', () => { if (audio.getAttribute('src')) emit('error'); });

// ---------- persistencia de la sesión

export function saveState() {
  try {
    localStorage.setItem('ipod.player', JSON.stringify({
      queue: P.queue, original: P.original, index: P.index,
      time: audio.currentTime || 0, shuffle: P.shuffle, repeat: P.repeat, volume: audio.volume,
    }));
  } catch {}
}

export async function restoreState() {
  let s;
  try { s = JSON.parse(localStorage.getItem('ipod.player') || 'null'); } catch { s = null; }
  if (!s) return;
  P.shuffle = !!s.shuffle;
  P.repeat = s.repeat || 'off';
  if (typeof s.volume === 'number') audio.volume = s.volume;
  const curId = s.queue?.[s.index];
  if (!curId || !lib.byId.has(curId) || P.track) return;
  P.queue = s.queue.filter((id) => lib.byId.has(id));
  P.original = (s.original || s.queue).filter((id) => lib.byId.has(id));
  await loadIndex(P.queue.indexOf(curId), false, s.time || 0);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) saveState(); });
