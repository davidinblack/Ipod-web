// app.js — interfaz estilo iPod: pila de pantallas, rueda, menús, listas y descargas

import * as L from './library.js';
import { lib } from './library.js';
import * as PL from './player.js';
import { P, audio } from './player.js';
import * as db from './db.js';

const $ = (s) => document.querySelector(s);
const view = $('#view');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (s) => {
  if (!isFinite(s) || s < 0) s = 0;
  s = Math.floor(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`;
};

// ---------------------------------------------------------------- ajustes y listas

const settings = Object.assign({ server: '', token: '', haptics: true },
  JSON.parse(localStorage.getItem('ipod.settings') || '{}'));
const saveSettings = () => localStorage.setItem('ipod.settings', JSON.stringify(settings));

let playlists = [];
const savePlaylists = () => db.kvSet('playlists', playlists).catch(() => {});
let gen = 0; // sube cuando cambia la biblioteca o las listas → los menús se recalculan

const haptic = (ms = 4) => { if (settings.haptics) navigator.vibrate?.(ms); };

// ---------------------------------------------------------------- pila de pantallas

const stack = [];
const cur = () => stack[stack.length - 1];
let ROWS = 7;

function push(s) { s.sel ??= 0; s.top ??= 0; stack.push(s); render(); }
function pop() { if (stack.length > 1) { stack.pop().onExit?.(); render(); } }
function replaceTop(s) { if (stack.length > 1) stack.pop(); push(s); }
function goRoot() { stack.length = 1; render(); }

const menu = (title, items, extra = {}) => ({ type: 'menu', title, items: typeof items === 'function' ? items : () => items, ...extra });

function layout() {
  const h = view.clientHeight || 300;
  ROWS = Math.max(5, Math.round(h / 33));
  document.documentElement.style.setProperty('--row-h', `${h / ROWS}px`);
}

function render() {
  const s = cur();
  if (!s) return;
  $('#barTitle').textContent = s.title;
  view.className = `view ${s.type}`;
  ({ menu: renderMenu, now: renderNow, input: renderInput, progress: renderProgress })[s.type](s);
}

// ---------------------------------------------------------------- menús

function renderMenu(s) {
  if (!s._items || s.dynamic || s._gen !== gen) { s._items = s.items(); s._gen = gen; }
  const items = s._items;
  if (!items.length) { view.innerHTML = `<div class="empty">${esc(s.empty || 'Vacío')}</div>`; return; }

  s.sel = clamp(s.sel, 0, items.length - 1);
  if (s.sel < s.top) s.top = s.sel;
  if (s.sel >= s.top + ROWS) s.top = s.sel - ROWS + 1;
  s.top = clamp(s.top, 0, Math.max(0, items.length - ROWS));

  let html = '<ul class="menu">';
  for (let i = s.top; i < Math.min(items.length, s.top + ROWS); i++) {
    const it = items[i];
    html += `<li data-i="${i}" class="${i === s.sel ? 'sel' : ''}${it.info ? ' info' : ''}">`
      + `<span class="lab"><span>${esc(it.label)}</span></span>`
      + (it.value != null ? `<span class="val">${esc(it.value)}</span>` : '')
      + (it.arrow ? '<span class="arr"></span>' : '')
      + '</li>';
  }
  html += '</ul>';
  if (items.length > ROWS) {
    const h = (ROWS / items.length) * 100, t = (s.top / items.length) * 100;
    html += `<div class="sb"><i style="top:${t}%;height:${h}%"></i></div>`;
  }
  view.innerHTML = html;
  view.classList.toggle('has-sb', items.length > ROWS);

  // texto largo seleccionado → se desplaza como en el iPod
  const lab = view.querySelector('li.sel .lab');
  const inner = lab?.firstElementChild;
  if (inner && inner.scrollWidth > lab.clientWidth + 2) {
    const d = inner.scrollWidth - lab.clientWidth + 8;
    lab.style.setProperty('--d', `${d}px`);
    lab.style.setProperty('--t', `${Math.max(4, d / 28)}s`);
    lab.classList.add('run');
  }
}

function moveSel(s, delta) {
  const n = s._items?.length || 0;
  if (!n) return;
  const next = clamp(s.sel + delta, 0, n - 1);
  if (next !== s.sel) { s.sel = next; renderMenu(s); haptic(); }
}

// ---------------------------------------------------------------- reproduciendo

const NOTE = '<svg viewBox="0 0 24 24"><path d="M9 3v11.6A3.5 3.5 0 1 0 11 18V8h7V3z"/></svg>';
const SPK0 = '<svg viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3z"/></svg>';
const SPK1 = '<svg viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3zM15 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2zM17.8 5.7a9 9 0 0 1 0 12.6l-1.4-1.4a7 7 0 0 0 0-9.8z"/></svg>';

const nowScreen = () => ({ type: 'now', title: 'Reproduciendo', mode: 'progress' });
function openNow() { if (cur().type !== 'now') push(nowScreen()); }

function renderNow(s) {
  const t = P.track;
  if (!t) { view.innerHTML = '<div class="empty">Nada en reproducción</div>'; return; }
  view.innerHTML = `
    <div class="np">
      <div class="np-count">${P.index + 1} de ${P.queue.length}</div>
      <div class="np-main">
        <div class="np-art">${P.art ? `<img src="${P.art}" alt="">` : NOTE}</div>
        <div class="np-text">
          <div class="np-t">${esc(t.title)}</div>
          <div class="np-a">${esc(t.artist)}</div>
          <div class="np-al">${esc(t.album)}</div>
        </div>
      </div>
      <div class="np-bar" id="npBar"></div>
    </div>`;
  updateNowBar();
}

function updateNowBar() {
  const bar = $('#npBar');
  const s = cur();
  if (!bar || s.type !== 'now') return;
  if (s.mode === 'volume') {
    bar.innerHTML = `<div class="vol">${SPK0}<div class="track"><div class="fill" style="width:${audio.volume * 100}%"></div></div>${SPK1}</div>`;
    return;
  }
  const d = audio.duration || 0, c = audio.currentTime || 0, pct = d ? (c / d) * 100 : 0;
  bar.innerHTML = `<div class="track"><div class="fill" style="width:${pct}%"></div>${s.mode === 'scrub' ? `<div class="dia" style="left:${pct}%"></div>` : ''}</div>`
    + `<div class="times"><span>${fmt(c)}</span><span>-${fmt(d - c)}</span></div>`;
}

let modeTimer;
function setNowMode(s, mode, ms) {
  s.mode = mode;
  clearTimeout(modeTimer);
  if (ms) modeTimer = setTimeout(() => { s.mode = 'progress'; updateNowBar(); }, ms);
  updateNowBar();
}

// ---------------------------------------------------------------- entrada de texto y progreso

function inputScreen(o) { return { type: 'input', value: '', error: '', ...o }; }

function renderInput(s) {
  view.innerHTML = `
    <form class="form" autocomplete="off">
      <label for="inp">${esc(s.label)}</label>
      <input id="inp" type="${s.secret ? 'password' : 'text'}" placeholder="${esc(s.placeholder || '')}"
        value="${esc(s.value)}" autocapitalize="off" spellcheck="false" enterkeyhint="done">
      <div class="err">${esc(s.error)}</div>
      <div class="btns">${s.paste ? '<button type="button" data-a="paste">Pegar</button>' : ''}<button type="submit">Aceptar</button></div>
      <div class="hint">● Aceptar · MENU Cancelar</div>
    </form>`;
  const inp = $('#inp');
  inp.addEventListener('input', () => { s.value = inp.value; });
  view.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); submitInput(s); });
  view.querySelector('[data-a="paste"]')?.addEventListener('click', async () => {
    try { s.value = (await navigator.clipboard.readText()).trim(); inp.value = s.value; }
    catch { s.error = 'Mantén presionado el campo y elige Pegar'; render(); }
  });
  if (!s.value) setTimeout(() => inp.focus(), 60);
}

async function submitInput(s) {
  $('#inp')?.blur();
  const r = await s.onSubmit(s.value.trim());
  if (typeof r === 'string') { s.error = r; if (cur() === s) render(); }
}

const progressScreen = (title, text) => ({ type: 'progress', title, text, sub: '', pct: 0 });

function renderProgress(s) {
  view.innerHTML = `
    <div class="prog">
      <div class="ttl">${esc(s.text)}</div>
      <div class="track"><div class="fill" style="width:${s.pct * 100}%"></div></div>
      <div class="sub">${esc(s.sub)}</div>
    </div>`;
}

function setProgress(s, pct, text, sub) {
  s.pct = clamp(pct, 0, 1);
  if (text != null) s.text = text;
  if (sub != null) s.sub = sub;
  if (cur() === s) renderProgress(s);
}

let toastTimer;
function toast(msg, ms = 1800) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

// ---------------------------------------------------------------- menús de la app

function mainMenu() {
  return menu('iPod', () => {
    const it = [];
    if (updateAvailable) it.push({ label: 'Actualizar app', value: updateAvailable, action: () => location.reload() });
    if (lib.dir && lib.dirState === 'prompt') it.push({ label: `Permitir «${lib.dir.name}»`, action: grantAccess });
    if (!lib.tracks.length) it.push({ label: 'Agregar música', arrow: true, action: () => push(libraryMenu()) });
    it.push(
      { label: 'Listas', arrow: true, action: () => push(playlistsMenu()) },
      { label: 'Explorar', arrow: true, action: () => push(browseMenu()) },
      { label: 'Mezclar canciones', action: shuffleAll },
      { label: 'YouTube', arrow: true, action: () => push(youtubeMenu()) },
      { label: 'Biblioteca', arrow: true, action: () => push(libraryMenu()) },
      { label: 'Ajustes', arrow: true, action: () => push(settingsMenu()) },
    );
    if (P.track) it.push({ label: 'Reproduciendo', arrow: true, action: openNow });
    return it;
  }, { dynamic: true });
}

function browseMenu() {
  return menu('Explorar', [
    { label: 'Artistas', arrow: true, action: () => push(artistsMenu()) },
    { label: 'Álbumes', arrow: true, action: () => push(albumsMenu()) },
    { label: 'Canciones', arrow: true, action: () => push(songsMenu('Canciones', () => lib.tracks.map((t) => t.id))) },
  ]);
}

function artistsMenu() {
  return menu('Artistas', () => L.artists().map(([name, ids]) => ({
    label: name, arrow: true,
    action: () => push(albumsMenu(name)),
    hold: () => push(addToPlaylistMenu(ids)),
  })), { empty: 'Sin artistas' });
}

function albumsMenu(artist) {
  return menu(artist || 'Álbumes', () => {
    const al = L.albums(artist);
    const it = al.map(([name, ids]) => ({
      label: name, arrow: true,
      action: () => push(songsMenu(name, () => L.albums(artist).find((a) => a[0] === name)?.[1] || [])),
      hold: () => push(addToPlaylistMenu(ids)),
    }));
    if (artist && al.length > 1) {
      const all = al.flatMap((a) => a[1]);
      it.unshift({ label: 'Todas', arrow: true, action: () => push(songsMenu(artist, () => al.flatMap((a) => a[1]))), hold: () => push(addToPlaylistMenu(all)) });
    }
    return it;
  }, { empty: 'Sin álbumes' });
}

function songsMenu(title, getIds, ctx = {}) {
  return menu(title, () => {
    const ids = getIds();
    return ids.map((id, i) => ({
      label: lib.byId.get(id)?.title || '—',
      action: () => { PL.playList(ids, i); openNow(); },
      hold: () => push(songOptions(id, ctx)),
    }));
  }, { empty: ctx.playlist ? 'Lista vacía.\nMantén ● sobre una canción para añadirla.' : 'Sin canciones' });
}

function songOptions(id, ctx = {}) {
  const t = lib.byId.get(id);
  return menu(t?.title || 'Opciones', () => {
    const it = [
      { label: 'Reproducir siguiente', action: () => { PL.playNext(id); toast('A continuación'); pop(); } },
      { label: 'Añadir a lista…', arrow: true, action: () => replaceTop(addToPlaylistMenu([id])) },
    ];
    if (ctx.playlist) it.push({ label: 'Quitar de la lista', action: () => {
      ctx.playlist.tracks = ctx.playlist.tracks.filter((x) => x !== id);
      savePlaylists(); gen++; toast('Quitada'); pop();
    } });
    if (L.canDelete(t)) it.push({ label: 'Eliminar archivo', arrow: true, action: () => push(confirmMenu('¿Eliminar archivo?', async () => {
      try {
        await L.deleteTrack(id);
        playlists.forEach((p) => { p.tracks = p.tracks.filter((x) => x !== id); });
        savePlaylists(); gen++;
        toast('Eliminado');
      } catch (e) { toast(e.message); }
      pop(); pop();
    })) });
    it.push({ label: t?.artist || '', info: true }, { label: t?.album || '', info: true });
    return it;
  });
}

function confirmMenu(title, onYes) {
  return menu(title, [{ label: 'Cancelar', action: pop }, { label: 'Sí, continuar', action: onYes }]);
}

// --- listas de reproducción

function newPlaylist(name) {
  const p = { id: `pl${Date.now().toString(36)}`, name, tracks: [] };
  playlists.push(p);
  playlists.sort((a, b) => L.cmp(a.name, b.name));
  return p;
}

function addToPlaylist(p, ids) {
  const set = new Set(p.tracks);
  let n = 0;
  ids.forEach((id) => { if (!set.has(id)) { p.tracks.push(id); set.add(id); n++; } });
  savePlaylists(); gen++;
  return n;
}

function addToPlaylistMenu(ids) {
  return menu('Añadir a…', () => [
    { label: 'Nueva lista…', arrow: true, action: () => replaceTop(inputScreen({
      title: 'Nueva lista', label: 'Nombre de la lista', placeholder: 'Mi lista',
      onSubmit: (name) => {
        if (!name) return 'Escribe un nombre';
        const p = newPlaylist(name);
        addToPlaylist(p, ids);
        pop(); toast(`Añadido a ${name}`);
      },
    })) },
    ...playlists.map((p) => ({
      label: p.name, value: String(p.tracks.length),
      action: () => { const n = addToPlaylist(p, ids); pop(); toast(n ? `Añadido a ${p.name}` : 'Ya estaba en la lista'); },
    })),
  ]);
}

function playlistsMenu() {
  return menu('Listas', () => [
    { label: 'Nueva lista…', arrow: true, action: () => push(inputScreen({
      title: 'Nueva lista', label: 'Nombre de la lista', placeholder: 'Mi lista',
      onSubmit: (name) => { if (!name) return 'Escribe un nombre'; newPlaylist(name); savePlaylists(); gen++; pop(); },
    })) },
    ...playlists.map((p) => ({
      label: p.name, arrow: true,
      action: () => push(songsMenu(p.name, () => p.tracks.filter((id) => lib.byId.has(id)), { playlist: p })),
      hold: () => push(playlistOptions(p)),
    })),
  ], { dynamic: true });
}

function playlistOptions(p) {
  const ids = () => p.tracks.filter((id) => lib.byId.has(id));
  return menu(p.name, [
    { label: 'Reproducir', action: () => { if (ids().length) { PL.playList(ids(), 0, { shuffle: false }); replaceTop(nowScreen()); } } },
    { label: 'Mezclar', action: () => { if (ids().length) { PL.playList(ids(), Math.floor(Math.random() * ids().length), { shuffle: true }); replaceTop(nowScreen()); } } },
    { label: 'Cambiar nombre…', arrow: true, action: () => replaceTop(inputScreen({
      title: 'Cambiar nombre', label: 'Nombre de la lista', value: p.name,
      onSubmit: (name) => { if (!name) return 'Escribe un nombre'; p.name = name; savePlaylists(); gen++; pop(); },
    })) },
    { label: 'Eliminar lista', arrow: true, action: () => replaceTop(confirmMenu(`¿Eliminar «${p.name}»?`, () => {
      playlists = playlists.filter((x) => x !== p); savePlaylists(); gen++; pop(); toast('Lista eliminada');
    })) },
  ]);
}

function shuffleAll() {
  if (!lib.tracks.length) { toast('Biblioteca vacía'); return; }
  const ids = lib.tracks.map((t) => t.id);
  PL.playList(ids, Math.floor(Math.random() * ids.length), { shuffle: true });
  openNow();
}

// --- biblioteca

function libraryMenu() {
  return menu('Biblioteca', () => {
    const it = [];
    if (lib.dir) {
      it.push(lib.dirState === 'granted'
        ? { label: 'Carpeta', value: lib.dir.name, info: true }
        : { label: `Permitir «${lib.dir.name}»`, action: grantAccess });
    }
    if (L.canPickDir) it.push({ label: lib.dir ? 'Cambiar carpeta…' : 'Elegir carpeta…', action: pickDir });
    it.push(
      { label: 'Agregar archivos…', action: () => $('#filePick').click() },
      { label: 'Reescanear', action: rescan },
      { label: 'Canciones', value: String(lib.tracks.length), info: true },
    );
    return it;
  }, { dynamic: true });
}

async function pickDir() {
  try { await L.pickDirectory(); await rescan(); }
  catch (e) { if (e.name !== 'AbortError') toast('No se pudo abrir la carpeta'); }
}

async function grantAccess() {
  if (await L.requestDirAccess()) await rescan();
  else toast('Permiso denegado');
}

async function rescan() {
  const s = progressScreen('Biblioteca', 'Leyendo música…');
  push(s);
  try {
    const n = await L.scanLibrary((i, total) => setProgress(s, i / total, null, `${i} de ${total}`));
    gen++;
    if (cur() === s) pop();
    toast(`${n} canciones`);
    if (!P.track) await PL.restoreState();
  } catch (e) {
    if (cur() === s) pop();
    toast('Error al leer la biblioteca');
    console.error(e);
  }
  render();
}

$('#filePick').addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files?.length) return;
  const s = progressScreen('Biblioteca', 'Copiando archivos…');
  push(s);
  try { await L.importFiles(files, (i, n) => setProgress(s, i / n, null, `${i} de ${n}`)); }
  catch (err) { toast('No se pudieron copiar'); console.error(err); }
  e.target.value = '';
  if (cur() === s) pop();
  await rescan();
});

// --- ajustes

const REPEAT = { off: 'No', one: 'Una', all: 'Todas' };

function settingsMenu() {
  return menu('Ajustes', () => [
    { label: 'Aleatorio', value: P.shuffle ? 'Sí' : 'No', action: () => { PL.setShuffle(!P.shuffle); render(); } },
    { label: 'Repetir', value: REPEAT[P.repeat], action: () => { PL.setRepeat({ off: 'one', one: 'all', all: 'off' }[P.repeat]); render(); } },
    { label: 'Clicker (vibración)', value: settings.haptics ? 'Sí' : 'No', action: () => { settings.haptics = !settings.haptics; saveSettings(); render(); } },
    { label: 'Servidor YouTube', arrow: true, action: () => push(serverMenu()) },
    { label: 'Acerca de', arrow: true, action: () => push(aboutMenu()) },
  ], { dynamic: true });
}

function aboutMenu() {
  return menu('Acerca de', () => [
    { label: 'Canciones', value: String(lib.tracks.length), info: true },
    { label: 'Listas', value: String(playlists.length), info: true },
    { label: 'Versión', value: bootVersion || '—', info: true },
    { label: 'Buscar actualización', action: async () => { await checkVersion(); toast(updateAvailable ? `Nueva: ${updateAvailable}` : 'Estás al día'); } },
  ], { dynamic: true });
}

// --- YouTube

const apiBase = () => (settings.server || location.origin).replace(/\/+$/, '');

async function api(path, opts = {}) {
  const headers = { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(settings.token ? { 'X-Token': settings.token } : {}) };
  let res;
  try { res = await fetch(apiBase() + path, { ...opts, headers, cache: 'no-store' }); }
  catch { throw new Error('Sin conexión con el servidor'); }
  if (res.status === 401) throw new Error('Clave del servidor incorrecta');
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try { msg = (await res.json()).error || msg; } catch {}
    if (res.status === 404 && path === '/api/health') msg = 'Configura el servidor en Ajustes';
    throw new Error(msg);
  }
  return res;
}

function serverMenu() {
  return menu('Servidor', () => [
    { label: 'Dirección', value: settings.server || 'Este sitio', arrow: true, action: () => push(inputScreen({
      title: 'Servidor', label: 'URL del servidor (vacío = este sitio)', placeholder: 'http://localhost:8787', value: settings.server,
      onSubmit: (v) => {
        if (v && !/^https?:\/\//i.test(v)) return 'Debe empezar con http:// o https://';
        settings.server = v; saveSettings(); pop();
      },
    })) },
    { label: 'Clave', value: settings.token ? '••••' : 'Ninguna', arrow: true, action: () => push(inputScreen({
      title: 'Clave', label: 'Clave del servidor (IPOD_TOKEN)', secret: true, value: settings.token,
      onSubmit: (v) => { settings.token = v; saveSettings(); pop(); },
    })) },
    { label: 'Probar conexión', action: async () => {
      try { const h = await (await api('/api/health')).json(); toast(`Conectado ✓ (yt-dlp ${h.ytdlp || '?'})`, 2500); }
      catch (e) { toast(e.message, 2500); }
    } },
  ], { dynamic: true });
}

function youtubeMenu() {
  return menu('YouTube', [
    { label: 'Descargar canción…', arrow: true, action: () => askUrl() },
    { label: 'Servidor', arrow: true, action: () => push(serverMenu()) },
    { label: 'Tip: comparte desde YouTube', info: true },
  ]);
}

function extractYouTube(text) {
  const m = String(text || '').match(/https?:\/\/(?:[\w-]+\.)?(?:youtube\.com|youtu\.be)\/[^\s"'<>]+/i);
  return m ? m[0] : null;
}

function askUrl(initial = '') {
  push(inputScreen({
    title: 'YouTube', label: 'Enlace de YouTube', placeholder: 'https://youtu.be/…', value: initial, paste: true,
    onSubmit: (v) => {
      const url = extractYouTube(v);
      if (!url) return 'No parece un enlace de YouTube';
      startDownload(url, true);
    },
  }));
}

function filenameFrom(res) {
  const cd = res.headers.get('Content-Disposition') || '';
  const star = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) { try { return decodeURIComponent(star[1]); } catch {} }
  return cd.match(/filename="?([^";]+)"?/i)?.[1] || null;
}

async function startDownload(url, replace) {
  const s = progressScreen('Descargando', 'Conectando…');
  if (replace) replaceTop(s); else push(s);
  try {
    await api('/api/health');
    const job = await (await api('/api/jobs', { method: 'POST', body: JSON.stringify({ url }) })).json();
    const labels = { queued: 'En cola…', downloading: 'Descargando…', converting: 'Convirtiendo a MP3…' };
    let st;
    for (;;) {
      await sleep(900);
      st = await (await api(`/api/jobs/${job.id}`)).json();
      if (st.status === 'error') throw new Error(st.error || 'Falló la descarga');
      setProgress(s, (st.progress || 0) / 100 * 0.92, labels[st.stage] || 'Procesando…', st.title || '');
      if (st.status === 'done') break;
    }
    setProgress(s, 0.95, 'Guardando…');
    const res = await api(`/api/jobs/${job.id}/file`);
    const blob = await res.blob();
    const t = await L.saveDownload(blob, filenameFrom(res) || `${st.title || 'audio'}.mp3`);
    api(`/api/jobs/${job.id}`, { method: 'DELETE' }).catch(() => {});
    gen++;
    const done = menu('Listo', [
      { label: t.title, info: true },
      { label: 'Reproducir ahora', action: () => { PL.playList([t.id], 0); replaceTop(nowScreen()); } },
      { label: 'Añadir a lista…', arrow: true, action: () => push(addToPlaylistMenu([t.id])) },
      { label: 'Descargar otra…', arrow: true, action: () => { pop(); askUrl(); } },
    ]);
    if (cur() === s) replaceTop(done); else toast(`Descargada: ${t.title}`, 2500);
  } catch (e) {
    const err = menu('Error', [
      { label: e.message, info: true },
      { label: 'Reintentar', action: () => startDownload(url, true) },
      { label: 'Servidor…', arrow: true, action: () => push(serverMenu()) },
    ]);
    if (cur() === s) replaceTop(err); else toast(e.message, 2500);
  }
}

// --- compartir desde la app de YouTube (Web Share Target)

function handleShare() {
  const q = new URLSearchParams(location.search);
  const url = extractYouTube(`${q.get('url') || ''} ${q.get('text') || ''} ${q.get('title') || ''}`);
  if (q.has('url') || q.has('text')) history.replaceState(null, '', location.pathname);
  if (url) { goRoot(); push(youtubeMenu()); startDownload(url, false); }
}

// --- actualizaciones (la app se carga siempre desde la red; esto avisa si cambió mientras estaba abierta)

let bootVersion = null, updateAvailable = null;
async function checkVersion() {
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    const { version } = await r.json();
    if (!bootVersion) bootVersion = version;
    else if (version !== bootVersion && version !== updateAvailable) { updateAvailable = version; gen++; if (stack.length === 1) render(); }
  } catch {}
}

// ---------------------------------------------------------------- acciones de los botones

function select() {
  const s = cur();
  haptic(6);
  if (s.type === 'menu') s._items?.[s.sel]?.action?.(s._items[s.sel]);
  else if (s.type === 'now') setNowMode(s, s.mode === 'scrub' ? 'progress' : 'scrub', s.mode === 'scrub' ? 0 : 5000);
  else if (s.type === 'input') submitInput(s);
}

function hold() {
  const s = cur();
  haptic(18);
  if (s.type === 'menu') {
    const it = s._items?.[s.sel];
    if (it?.hold) it.hold(it);
  } else if (s.type === 'now' && P.track) {
    push(songOptions(P.track.id));
  }
}

function pressMenu() {
  const s = cur();
  if (s.type === 'now' && s.mode !== 'progress') { setNowMode(s, 'progress'); return; }
  pop();
}

function scroll(dir, fast) {
  const s = cur();
  if (s.type === 'menu') moveSel(s, dir * (fast ? 3 : 1));
  else if (s.type === 'now' && P.track) {
    if (s.mode === 'scrub') { PL.seekBy(dir * (fast ? 8 : 3)); setNowMode(s, 'scrub', 5000); }
    else { PL.setVolume(audio.volume + dir * 0.04); setNowMode(s, 'volume', 1600); }
    haptic(3);
  }
}

function button(zone) {
  haptic(8);
  if (zone === 'menu') pressMenu();
  else if (zone === 'play') { if (!PL.toggle()) toast('Elige una canción'); }
  else if (zone === 'next') PL.next();
  else if (zone === 'prev') PL.prev();
}

// ---------------------------------------------------------------- rueda táctil

function setupWheel() {
  const wheel = $('#wheel'), center = $('#center');
  const zoneOf = (a) => {
    const d = (a * 180) / Math.PI;
    if (d >= -135 && d < -45) return 'menu';
    if (d >= -45 && d < 45) return 'next';
    if (d >= 45 && d < 135) return 'play';
    return 'prev';
  };
  let g = null;

  wheel.addEventListener('pointerdown', (e) => {
    if (e.target === center) return;
    wheel.setPointerCapture(e.pointerId);
    const r = wheel.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const a = Math.atan2(e.clientY - cy, e.clientX - cx);
    g = { cx, cy, last: a, acc: 0, moved: false, x: e.clientX, y: e.clientY, zone: zoneOf(a), holding: false, lastTick: 0 };
    wheel.classList.add(`p-${g.zone}`);
    g.timer = setTimeout(() => startHold(g), 480);
  });

  wheel.addEventListener('pointermove', (e) => {
    if (!g || g.holding) return;
    const a = Math.atan2(e.clientY - g.cy, e.clientX - g.cx);
    let d = a - g.last;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    g.last = a;
    if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 9) {
      g.moved = true;
      clearTimeout(g.timer);
      wheel.classList.remove(`p-${g.zone}`);
    }
    if (!g.moved) return;
    g.acc += d;
    const step = Math.PI / 12; // 15° por "clic"
    while (Math.abs(g.acc) >= step) {
      const dir = Math.sign(g.acc);
      g.acc -= dir * step;
      const now = performance.now();
      scroll(dir, now - g.lastTick < 40);
      g.lastTick = now;
    }
  });

  const end = (e) => {
    if (!g) return;
    clearTimeout(g.timer);
    clearInterval(g.seek);
    wheel.classList.remove(`p-${g.zone}`);
    if (!g.moved && !g.holding && e.type === 'pointerup') button(g.zone);
    g = null;
  };
  wheel.addEventListener('pointerup', end);
  wheel.addEventListener('pointercancel', end);

  function startHold(st) {
    st.holding = true;
    haptic(14);
    if (st.zone === 'menu') { goRoot(); return; }
    if ((st.zone === 'next' || st.zone === 'prev') && P.track) {
      const dir = st.zone === 'next' ? 1 : -1;
      let n = 0;
      const tick = () => { PL.seekBy(dir * (n++ < 8 ? 3 : 10)); if (cur().type === 'now') updateNowBar(); };
      tick();
      st.seek = setInterval(tick, 220);
    }
  }

  // botón central: toque = seleccionar, mantener = opciones
  let ct = null;
  center.addEventListener('pointerdown', (e) => {
    center.setPointerCapture(e.pointerId);
    center.classList.add('down');
    ct = { held: false, timer: setTimeout(() => { ct.held = true; hold(); }, 550) };
  });
  const cEnd = (e) => {
    center.classList.remove('down');
    if (!ct) return;
    clearTimeout(ct.timer);
    if (!ct.held && e.type === 'pointerup') select();
    ct = null;
  };
  center.addEventListener('pointerup', cEnd);
  center.addEventListener('pointercancel', cEnd);
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input')) e.preventDefault(); });

  // tocar directamente una fila del menú también funciona
  view.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-i]');
    const s = cur();
    if (!li || s.type !== 'menu') return;
    s.sel = +li.dataset.i;
    renderMenu(s);
    select();
  });
  let lp;
  view.addEventListener('pointerdown', (e) => {
    const li = e.target.closest('li[data-i]');
    if (!li) return;
    lp = setTimeout(() => { const s = cur(); if (s.type === 'menu') { s.sel = +li.dataset.i; renderMenu(s); hold(); lp = 'done'; } }, 600);
  });
  ['pointerup', 'pointercancel', 'pointermove'].forEach((t) => view.addEventListener(t, (e) => {
    if (t === 'pointermove' && Math.abs(e.movementY) < 4) return;
    if (lp !== 'done') clearTimeout(lp);
  }));
  view.addEventListener('click', (e) => { if (lp === 'done') { e.stopImmediatePropagation(); lp = null; } }, true);
}

// teclado (para probar en la computadora)
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') pop(); return; }
  const k = e.key;
  if (k === 'ArrowDown') scroll(1);
  else if (k === 'ArrowUp') scroll(-1);
  else if (k === 'ArrowRight') PL.next();
  else if (k === 'ArrowLeft') PL.prev();
  else if (k === 'Enter') select();
  else if (k === 'Escape' || k === 'Backspace') pressMenu();
  else if (k === ' ') PL.toggle();
  else if (k === 'h') hold();
  else return;
  e.preventDefault();
});

// ---------------------------------------------------------------- estado del reproductor → interfaz

function updateBarIcon() {
  const el = $('#barIcon');
  el.className = `bar-icon${P.track ? (audio.paused ? ' pause' : ' play') : ''}`;
}

PL.onPlayer((type) => {
  const s = cur();
  if (type === 'time') { if (s?.type === 'now') updateNowBar(); return; }
  if (type === 'state') { updateBarIcon(); return; }
  if (type === 'error') { toast('No se pudo leer el archivo'); return; }
  updateBarIcon();
  if (s?.type === 'now') renderNow(s);
  else if (type === 'track' && stack.length === 1) render();
});

function setupBattery() {
  const el = $('#batt');
  navigator.getBattery?.().then((b) => {
    const up = () => { el.style.setProperty('--lvl', b.level); el.classList.toggle('chg', b.charging && b.level < 1); };
    up();
    b.addEventListener('levelchange', up);
    b.addEventListener('chargingchange', up);
  }).catch(() => {});
}

// ---------------------------------------------------------------- arranque

async function boot() {
  layout();
  push(mainMenu());
  setupWheel();
  setupBattery();
  new ResizeObserver(() => { layout(); render(); }).observe(view);

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
  navigator.storage?.persist?.().catch(() => {});
  checkVersion();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });

  try { playlists = (await db.kvGet('playlists')) || []; } catch { playlists = []; }
  await L.initLibrary();

  const s = progressScreen('iPod', 'Cargando biblioteca…');
  push(s);
  try { await L.scanLibrary((i, n) => setProgress(s, i / n, null, `${i} de ${n}`)); }
  catch (e) { console.error(e); }
  if (cur() === s) pop();
  gen++;
  await PL.restoreState().catch(() => {});
  render();
  updateBarIcon();
  handleShare();
}

boot();
