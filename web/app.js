// app.js — interfaz estilo iPod touch (app "iPod" de iPhone OS 1–2)

import * as L from './library.js';
import { lib } from './library.js';
import * as PL from './player.js';
import { P, audio } from './player.js';
import * as db from './db.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (s) => {
  if (!isFinite(s) || s < 0) s = 0;
  s = Math.floor(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`;
};
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

// ---------------------------------------------------------------- iconos

const I = {
  note: '<svg viewBox="0 0 24 24"><path d="M9 3v11.6A3.5 3.5 0 1 0 11 18V8h7V3z"/></svg>',
  tabPlaylists: '<svg viewBox="0 0 30 30"><path d="M3 6h15v3H3zm0 6h15v3H3zm0 6h10v3H3zm19-12h3v13.2a3.8 3.8 0 1 1-3-3.7z"/></svg>',
  tabArtists: '<svg viewBox="0 0 30 30"><path d="M15 3a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 13.5c6 0 10.5 3 10.5 7.5v3h-21v-3c0-4.5 4.5-7.5 10.5-7.5z"/></svg>',
  tabSongs: '<svg viewBox="0 0 30 30"><path d="M11 4h15v17.5a4 4 0 1 1-3-3.9V9.5h-9v14a4 4 0 1 1-3-3.9z"/></svg>',
  tabAlbums: '<svg viewBox="0 0 30 30"><path d="M8 3h19v19H8zM3 8h3v19h19v3H3z"/><circle cx="17.5" cy="12.5" r="5" fill="#000" opacity=".45"/></svg>',
  tabMore: '<svg viewBox="0 0 30 30"><circle cx="6" cy="15" r="3"/><circle cx="15" cy="15" r="3"/><circle cx="24" cy="15" r="3"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24"><path d="M17 3l4 4-4 4V8h-2.2l-8 9H3v-2.6h2.6l8-9H17zm0 10l4 4-4 4v-3h-3.4l-2.4-2.7 1.7-1.9 1.9 2H17zM3 6.4h3.8l2.4 2.7-1.7 1.9L5.6 9H3z"/></svg>',
  repeat: '<svg viewBox="0 0 24 24"><path d="M7 7h10V4l4 4-4 4V9H7v3H5V9a2 2 0 0 1 2-2zm10 10H7v3l-4-4 4-4v3h10v-3h2v3a2 2 0 0 1-2 2z"/></svg>',
  prev: '<svg viewBox="0 0 36 24"><path d="M3 2h4v20H3zM20 2v20L7 12zm14 0v20L21 12z"/></svg>',
  next: '<svg viewBox="0 0 36 24"><path d="M2 2v20l13-10zm14 0v20l13-10zm13 0h4v20h-4z"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M5 2l17 10L5 22z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M4 2h6v20H4zm10 0h6v20h-6z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M10.5 3h3v7.5H21v3h-7.5V21h-3v-7.5H3v-3h7.5z"/></svg>',
  yt: '<svg viewBox="0 0 24 24"><path d="M12 3v11.2l4.2-4.2 2.1 2.1L12 18.4l-6.3-6.3L7.8 10l4.2 4.2V3zM4 19h16v2H4z"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M2 5h8l2 2h10v13H2z"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path d="M10 2h4l.6 2.8 1.9.8 2.4-1.6 2.8 2.8-1.6 2.4.8 1.9L23 10v4l-2.8.6-.8 1.9 1.6 2.4-2.8 2.8-2.4-1.6-1.9.8L14 23h-4l-.6-2.8-1.9-.8-2.4 1.6-2.8-2.8 1.6-2.4-.8-1.9L1 14v-4l2.8-.6.8-1.9L3 5.1 5.8 2.3l2.4 1.6 1.9-.8zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 4v7l5 3 1-1.7-4-2.4V6z"/></svg>',
};

// ---------------------------------------------------------------- ajustes y listas

const onPages = location.hostname.endsWith('.github.io');
function defaultRepo() {
  const repo = location.pathname.split('/').filter(Boolean)[0];
  return onPages && repo ? `${location.hostname.split('.')[0]}/${repo}` : 'davidinblack/Ipod-web';
}
const settings = Object.assign({ server: '', token: '', mode: onPages ? 'github' : 'server', repo: defaultRepo(), ghToken: '' },
  JSON.parse(localStorage.getItem('ipod.settings') || '{}'));
const saveSettings = () => localStorage.setItem('ipod.settings', JSON.stringify(settings));

let playlists = [];
const savePlaylists = () => db.kvSet('playlists', playlists).catch(() => {});

// ---------------------------------------------------------------- capa de diálogos

const layer = $('#layer');

function toast(msg, ms = 1600) {
  const el = h(`<div class="hud">${esc(msg)}</div>`);
  layer.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/** Alerta estilo iPhone OS. buttons: [{label, main, value}] → resuelve {value, input} */
function alertBox({ title = '', message = '', input = null, buttons = [{ label: 'OK', main: true, value: true }] }) {
  return new Promise((resolve) => {
    const dim = h('<div class="dim"></div>');
    const box = h(`<div class="alert${input ? ' has-input' : ''}">
      ${title ? `<h2>${esc(title)}</h2>` : ''}${message ? `<p>${esc(message)}</p>` : ''}
      ${input ? `<input type="${input.secret ? 'password' : 'text'}" placeholder="${esc(input.placeholder || '')}" value="${esc(input.value || '')}" autocapitalize="off" autocomplete="off" spellcheck="false" enterkeyhint="done">` : ''}
      <div class="btns${buttons.length > 2 ? ' stack' : ''}"></div></div>`);
    const inp = box.querySelector('input');
    const close = (value) => { dim.remove(); box.remove(); resolve({ value, input: inp ? inp.value.trim() : null }); };
    buttons.forEach((b) => {
      const el = h(`<button class="abtn${b.main ? ' main' : ''}">${esc(b.label)}</button>`);
      el.onclick = async () => {
        if (b.onTap) { await b.onTap(inp); return; }
        close(b.value);
      };
      box.querySelector('.btns').appendChild(el);
    });
    if (inp) {
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') close(buttons.find((b) => b.main)?.value ?? true); });
      setTimeout(() => inp.focus(), 80);
    }
    layer.append(dim, box);
  });
}

/** Hoja de acciones. options: [{label, red, value}] → value o null */
function actionSheet(title, options) {
  return new Promise((resolve) => {
    const dim = h('<div class="dim"></div>');
    const sh = h(`<div class="sheet">${title ? `<div class="st">${esc(title)}</div>` : ''}</div>`);
    const close = (v) => { dim.remove(); sh.remove(); resolve(v); };
    options.forEach((o) => {
      const b = h(`<button class="sbtn${o.red ? ' red' : ''}">${esc(o.label)}</button>`);
      b.onclick = () => close(o.value);
      sh.appendChild(b);
    });
    const c = h('<button class="sbtn cancel">Cancelar</button>');
    c.onclick = () => close(null);
    sh.appendChild(c);
    dim.onclick = () => close(null);
    layer.append(dim, sh);
  });
}

async function prompt(title, opts = {}) {
  const r = await alertBox({
    title, message: opts.message, input: { value: opts.value, placeholder: opts.placeholder, secret: opts.secret },
    buttons: [{ label: 'Cancelar', value: false }, { label: opts.ok || 'OK', main: true, value: true }],
  });
  return r.value ? r.input : null;
}

/** HUD de progreso (descargas, escaneo). */
function progressHud(title, { hideable = false } = {}) {
  const dim = h('<div class="dim"></div>');
  const el = h(`<div class="hud prog"><div class="ht"></div><div class="hs"></div><div class="bar"><i></i></div>
    ${hideable ? '<button class="abtn">Ocultar</button>' : ''}</div>`);
  const s = {
    hidden: false, title,
    set(pct, text, sub) {
      if (text != null) el.querySelector('.ht').textContent = text;
      if (sub != null) el.querySelector('.hs').textContent = sub;
      el.querySelector('.bar i').style.width = `${clamp(pct, 0, 1) * 100}%`;
    },
    close() { dim.remove(); el.remove(); },
  };
  el.querySelector('.abtn')?.addEventListener('click', () => { s.hidden = true; s.close(); toast('La descarga sigue en segundo plano', 2000); });
  s.set(0, title, '');
  layer.append(dim, el);
  return s;
}
const setProgress = (s, pct, text, sub) => s.set(pct, text, sub);

// ---------------------------------------------------------------- tablas

const NORM = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^(the|el|la|los|las)\s+/i, '');
const letterOf = (s) => { const c = NORM(s).charAt(0).toUpperCase(); return c >= 'A' && c <= 'Z' ? c : '#'; };

function sectionize(rows, keyFn) {
  const map = new Map();
  for (const r of rows) {
    const k = letterOf(keyFn(r));
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return [...map].sort((a, b) => (a[0] === '#') - (b[0] === '#') || a[0].localeCompare(b[0])).map(([title, rows]) => ({ title, rows }));
}

// miniaturas de portadas (se cargan cuando entran en pantalla)
const thumbCache = new Map();
async function thumbURL(t) {
  if (thumbCache.has(t.id)) return thumbCache.get(t.id);
  const p = (async () => {
    const blob = await L.getCoverBlob(t);
    if (!blob) return null;
    const bmp = await createImageBitmap(blob);
    const s = Math.min(bmp.width, bmp.height), c = document.createElement('canvas');
    c.width = c.height = 112;
    c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 112, 112);
    bmp.close?.();
    return new Promise((r) => c.toBlob((b) => r(b ? URL.createObjectURL(b) : null), 'image/jpeg', 0.85));
  })().catch(() => null);
  thumbCache.set(t.id, p);
  return p;
}
const thumbIO = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    thumbIO.unobserve(e.target);
    const t = lib.byId.get(e.target.dataset.cover);
    if (!t) continue;
    thumbURL(t).then((url) => {
      if (!url) return;
      const img = h(`<img class="thumb" alt="" src="${url}">`);
      e.target.replaceWith(img);
    });
  }
}, { rootMargin: '200px' });

function rowHTML(r, i) {
  const cls = ['row', r.sub ? 'two' : '', r.cover !== undefined ? 'album' : '', r.info ? 'info' : '', r.center ? 'center' : ''].join(' ');
  return `<div class="${cls}" data-i="${i}">`
    + (r.cover !== undefined ? `<div class="thumb" data-cover="${esc(r.cover || '')}">${I.note}</div>` : '')
    + (r.icon ? `<span class="ico">${r.icon}</span>` : '')
    + `<div class="txt"><div class="t">${esc(r.title)}</div>${r.sub ? `<div class="s">${esc(r.sub)}</div>` : ''}</div>`
    + (r.num != null ? `<span class="num">${esc(r.num)}</span>` : '')
    + (r.value != null ? `<span class="val">${esc(r.value)}</span>` : '')
    + (r.toggle != null ? `<span class="switch${r.toggle ? ' on' : ''}"><b><i></i></b></span>` : '')
    + (r.chev ? '<span class="chev"></span>' : '')
    + '</div>';
}

/**
 * def: { sections:[{title, rows}], grouped, indexed, empty, footer }
 * row: { title, sub, cover, icon, value, num, toggle, chev, info, center, onTap, onHold }
 */
function renderTable(el, def) {
  const rows = [];
  let html = '';
  const total = def.sections.reduce((n, s) => n + s.rows.length, 0);
  if (!total && def.empty) {
    el.innerHTML = `<div class="empty">${def.empty}</div>`;
    return;
  }
  for (const s of def.sections) {
    if (def.grouped) {
      if (s.title) html += `<div class="g-title">${esc(s.title)}</div>`;
      html += '<div class="group">';
      s.rows.forEach((r) => { html += rowHTML(r, rows.length); rows.push(r); });
      html += '</div>';
      if (s.note) html += `<div class="g-note">${esc(s.note)}</div>`;
    } else {
      if (s.title) html += `<div class="sec-h" data-sec="${esc(s.title)}">${esc(s.title)}</div>`;
      s.rows.forEach((r) => { html += rowHTML(r, rows.length); rows.push(r); });
    }
  }
  if (def.footer) html += `<div class="footer-count">${esc(def.footer)}</div>`;
  el.innerHTML = `<div class="table${def.indexed ? ' indexed' : ''}">${html}</div>`;
  el.classList.toggle('grouped', !!def.grouped);
  el._rows = rows;
  el.querySelectorAll('[data-cover]').forEach((n) => { if (n.dataset.cover) thumbIO.observe(n); });

  if (def.indexed && total > 14) {
    const secs = def.sections.map((s) => s.title).filter(Boolean);
    const idx = h(`<div class="index">${secs.map((s) => `<span>${esc(s)}</span>`).join('')}</div>`);
    const jump = (y) => {
      const r = idx.getBoundingClientRect();
      const k = secs[clamp(Math.floor(((y - r.top) / r.height) * secs.length), 0, secs.length - 1)];
      const sec = el.querySelector(`.sec-h[data-sec="${CSS.escape(k)}"]`);
      if (sec) el.scrollTop = sec.offsetTop;
    };
    idx.addEventListener('pointerdown', (e) => { idx.setPointerCapture(e.pointerId); idx.classList.add('active'); jump(e.clientY); });
    idx.addEventListener('pointermove', (e) => { if (idx.classList.contains('active')) jump(e.clientY); });
    const end = () => idx.classList.remove('active');
    idx.addEventListener('pointerup', end);
    idx.addEventListener('pointercancel', end);
    el.appendChild(idx);
  }
}

// toque y pulsación larga en filas (delegado)
function bindRows(el) {
  let held = false;
  el.addEventListener('click', (e) => {
    if (held) { held = false; return; }
    const row = e.target.closest('.row[data-i]');
    const r = row && el._rows?.[+row.dataset.i];
    if (!r || r.info) return;
    r.onTap?.(r, row);
  });
  el.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('.row[data-i]');
    const r = row && el._rows?.[+row.dataset.i];
    e.preventDefault();
    if (!r?.onHold) return;
    held = true;
    setTimeout(() => { held = false; }, 700);
    navigator.vibrate?.(12);
    row.classList.add('hl');
    Promise.resolve(r.onHold(r)).finally(() => row.classList.remove('hl'));
  });
}

// ---------------------------------------------------------------- navegación por pestañas

const TABS = [
  { id: 'playlists', label: 'Listas', icon: I.tabPlaylists, root: () => playlistsView() },
  { id: 'artists', label: 'Artistas', icon: I.tabArtists, root: () => artistsView() },
  { id: 'songs', label: 'Canciones', icon: I.tabSongs, root: () => songsView('Canciones', () => lib.tracks.map((t) => t.id)) },
  { id: 'albums', label: 'Álbumes', icon: I.tabAlbums, root: () => albumsView() },
  { id: 'more', label: 'Más', icon: I.tabMore, root: () => moreView() },
];
const stacks = {};
let tab = localStorage.getItem('ipod.tab') || 'songs';
const views = $('#views');

const stack = () => stacks[tab];
const top = () => stack()[stack().length - 1];

function mount(v, anim) {
  const el = document.createElement('div');
  el.className = 'view';
  bindRows(el);
  v.el = el;
  v.render(el);
  if (v.scroll) el.scrollTop = v.scroll;
  if (anim) el.classList.add(anim);
  views.appendChild(el);
  return el;
}

function showTop(anim) {
  const old = [...views.children];
  const v = top();
  mount(v, anim);
  for (const o of old) {
    if (anim) {
      o.classList.add(anim === 'in-right' ? 'out-left' : 'out-right');
      setTimeout(() => o.remove(), 330);
    } else o.remove();
  }
  updateNav();
}

function push(v) {
  const cur = top();
  if (cur?.el) cur.scroll = cur.el.scrollTop;
  stack().push(v);
  showTop('in-right');
}

function pop() {
  if (stack().length < 2) return;
  stack().pop();
  showTop('in-left');
}

function refresh() {
  const v = top();
  if (!v?.el) return;
  const sc = v.el.scrollTop;
  v.render(v.el);
  v.el.scrollTop = sc;
  updateNav();
}

function refreshAll() {
  for (const t of TABS) stacks[t.id]?.forEach((v) => { v.scroll = 0; });
  refresh();
}

function selectTab(id) {
  if (id === tab) {
    if (stack().length > 1) { stack().length = 1; showTop('in-left'); }
    else top().el?.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const cur = top();
  if (cur?.el) cur.scroll = cur.el.scrollTop;
  tab = id;
  localStorage.setItem('ipod.tab', id);
  stacks[id] ||= [TABS.find((t) => t.id === id).root()];
  showTop();
  renderTabbar();
}

function renderTabbar() {
  const bar = $('#tabbar');
  bar.innerHTML = TABS.map((t) => `<button class="tab${t.id === tab ? ' on' : ''}" data-tab="${t.id}">${t.icon}<span>${t.label}</span></button>`).join('')
    + '<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="tabGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9f3ff"/><stop offset=".5" stop-color="#5aa5f5"/><stop offset=".51" stop-color="#2f80e7"/><stop offset="1" stop-color="#7cc2ff"/></linearGradient></defs></svg>';
}

function updateNav() {
  const s = stack(), v = top();
  $('#navTitle').textContent = v.title;
  const back = $('#navBack');
  back.hidden = s.length < 2;
  if (s.length > 1) back.firstElementChild.textContent = s[s.length - 2].short || s[s.length - 2].title;
  $('#navNow').hidden = !P.track;
}

// ---------------------------------------------------------------- vistas

const view = (title, build, extra = {}) => ({
  title, ...extra,
  render(el) { renderTable(el, build()); },
});

function playTracks(ids, i = 0, opts) {
  if (!ids.length) return;
  PL.playList(ids, i, opts);
  openNow();
}

function songsView(title, getIds, ctx = {}) {
  return view(title, () => {
    const ids = getIds().filter((id) => lib.byId.has(id));
    const songRow = (id) => {
      const t = lib.byId.get(id);
      return {
        title: t.title, sub: ctx.album ? null : `${t.artist}${ctx.artist ? '' : ` — ${t.album}`}`,
        num: ctx.album && t.track ? t.track : null,
        onTap: () => playTracks(ids, ids.indexOf(id)),
        onHold: () => songOptions(id, ctx),
      };
    };
    const head = ids.length > 1 ? [{
      title: 'Mezclar', icon: I.shuffle,
      onTap: () => playTracks(ids, Math.floor(Math.random() * ids.length), { shuffle: true }),
    }] : [];
    const big = !ctx.album && !ctx.playlist && ids.length > 14;
    const rows = ids.map(songRow);
    return {
      indexed: big,
      sections: big ? [{ rows: head }, ...sectionize(rows, (r) => r.title)] : [{ rows: [...head, ...rows] }],
      empty: ctx.playlist
        ? '<b>Lista vacía</b>Mantén presionada una canción en Canciones, Artistas o Álbumes y elige «Añadir a lista».'
        : '<b>No hay música</b>Ve a Más › Biblioteca para elegir tu carpeta de música o agregar archivos.',
      footer: ids.length > 4 ? `${ids.length} canciones` : null,
    };
  }, ctx);
}

function artistsView() {
  return view('Artistas', () => {
    const rows = L.artists().sort((a, b) => (a[0] === 'Artista desconocido') - (b[0] === 'Artista desconocido')).map(([name, ids]) => ({
      title: name, chev: true,
      onTap: () => {
        const al = L.albums(name);
        if (al.length === 1) push(songsView(al[0][0], () => L.albums(name)[0]?.[1] || [], { album: al[0][0], artist: name, short: name }));
        else push(albumsView(name));
      },
      onHold: () => addToPlaylist(ids),
    }));
    return {
      indexed: true, sections: rows.length > 14 ? sectionize(rows, (r) => r.title) : [{ rows }],
      empty: '<b>No hay artistas</b>Agrega música en Más › Biblioteca.',
    };
  });
}

function albumsView(artist) {
  return view(artist || 'Álbumes', () => {
    const al = L.albums(artist).sort((a, b) => (a[0] === 'Álbum desconocido') - (b[0] === 'Álbum desconocido'));
    const rows = al.map(([name, ids]) => {
      const first = lib.byId.get(ids[0]);
      return {
        title: name, sub: artist ? `${ids.length} canciones` : first?.artist, cover: ids.find((id) => lib.byId.get(id)?.hasPic) || ids[0], chev: true,
        onTap: () => push(songsView(name, () => L.albums(artist).find((a) => a[0] === name)?.[1] || [], { album: name, artist })),
        onHold: () => addToPlaylist(ids),
      };
    });
    if (artist && al.length > 1) {
      const all = al.flatMap((a) => a[1]);
      rows.unshift({ title: 'Todas las canciones', chev: true, onTap: () => push(songsView(artist, () => L.albums(artist).flatMap((a) => a[1]), { artist })), onHold: () => addToPlaylist(all) });
    }
    return {
      indexed: !artist, sections: !artist && rows.length > 14 ? sectionize(rows, (r) => r.title) : [{ rows }],
      empty: '<b>No hay álbumes</b>Agrega música en Más › Biblioteca.',
    };
  }, { short: artist ? 'Artistas' : undefined });
}

function recentIds() {
  return [...lib.tracks].sort((a, b) => (b.mtime || 0) - (a.mtime || 0)).slice(0, 25).map((t) => t.id);
}

function playlistsView() {
  return view('Listas', () => ({
    sections: [{
      rows: [
        { title: 'Nueva lista…', icon: I.plus, onTap: newPlaylistFlow },
        { title: 'Agregadas recientemente', icon: I.clock, chev: true, onTap: () => push(songsView('Recientes', recentIds, { short: 'Listas' })) },
        ...playlists.map((p) => ({
          title: p.name, sub: `${p.tracks.filter((id) => lib.byId.has(id)).length} canciones`, chev: true,
          onTap: () => push(songsView(p.name, () => p.tracks, { playlist: p })),
          onHold: () => playlistOptions(p),
        })),
      ],
    }],
  }));
}

// --- acciones

async function songOptions(id, ctx = {}) {
  const t = lib.byId.get(id);
  if (!t) return;
  const opts = [
    { label: 'Reproducir a continuación', value: 'next' },
    { label: 'Añadir a una lista…', value: 'add' },
  ];
  if (ctx.playlist) opts.push({ label: 'Quitar de esta lista', value: 'remove' });
  if (L.canDelete(t)) opts.push({ label: 'Eliminar archivo', value: 'delete', red: true });
  const a = await actionSheet(`${t.title} — ${t.artist}`, opts);
  if (a === 'next') { PL.playNext(id); toast('A continuación'); updateNav(); }
  else if (a === 'add') await addToPlaylist([id]);
  else if (a === 'remove') {
    ctx.playlist.tracks = ctx.playlist.tracks.filter((x) => x !== id);
    savePlaylists(); refresh();
  } else if (a === 'delete') {
    const r = await alertBox({ title: '¿Eliminar archivo?', message: `«${t.title}» se borrará de tu teléfono.`, buttons: [{ label: 'Cancelar', value: false }, { label: 'Eliminar', main: true, value: true }] });
    if (!r.value) return;
    try {
      await L.deleteTrack(id);
      playlists.forEach((p) => { p.tracks = p.tracks.filter((x) => x !== id); });
      savePlaylists(); refreshAll(); toast('Eliminado');
    } catch (e) { toast(e.message); }
  }
}

function addIds(p, ids) {
  const set = new Set(p.tracks);
  let n = 0;
  ids.forEach((id) => { if (!set.has(id)) { p.tracks.push(id); set.add(id); n++; } });
  savePlaylists();
  return n;
}

function createPlaylist(name) {
  const p = { id: `pl${Date.now().toString(36)}`, name, tracks: [] };
  playlists.push(p);
  playlists.sort((a, b) => L.cmp(a.name, b.name));
  savePlaylists();
  return p;
}

async function newPlaylistFlow() {
  const name = await prompt('Nueva lista', { message: 'Escribe un nombre para la lista.', placeholder: 'Mi lista', ok: 'Guardar' });
  if (!name) return;
  createPlaylist(name);
  refresh();
}

async function addToPlaylist(ids) {
  const opts = [{ label: 'Nueva lista…', value: '__new' }, ...playlists.map((p) => ({ label: p.name, value: p.id }))];
  const v = await actionSheet(ids.length > 1 ? `Añadir ${ids.length} canciones a…` : 'Añadir a…', opts);
  if (!v) return;
  let p;
  if (v === '__new') {
    const name = await prompt('Nueva lista', { placeholder: 'Mi lista', ok: 'Guardar' });
    if (!name) return;
    p = createPlaylist(name);
  } else p = playlists.find((x) => x.id === v);
  const n = addIds(p, ids);
  toast(n ? `Añadido a «${p.name}»` : 'Ya estaba en la lista');
  refresh();
}

async function playlistOptions(p) {
  const a = await actionSheet(p.name, [
    { label: 'Mezclar', value: 'shuffle' },
    { label: 'Cambiar nombre…', value: 'rename' },
    { label: 'Eliminar lista', value: 'delete', red: true },
  ]);
  const ids = p.tracks.filter((id) => lib.byId.has(id));
  if (a === 'shuffle' && ids.length) playTracks(ids, Math.floor(Math.random() * ids.length), { shuffle: true });
  else if (a === 'rename') {
    const name = await prompt('Cambiar nombre', { value: p.name, ok: 'Guardar' });
    if (name) { p.name = name; savePlaylists(); refresh(); }
  } else if (a === 'delete') {
    const r = await alertBox({ title: `¿Eliminar «${p.name}»?`, message: 'Las canciones no se borran.', buttons: [{ label: 'Cancelar', value: false }, { label: 'Eliminar', main: true, value: true }] });
    if (r.value) { playlists = playlists.filter((x) => x !== p); savePlaylists(); refresh(); }
  }
}

// --- Más

const REPEAT = { off: 'No', one: 'Una', all: 'Todas' };

function moreView() {
  return view('Más', () => {
    const libRows = [];
    if (lib.dir) {
      libRows.push(lib.dirState === 'granted'
        ? { title: 'Carpeta', value: lib.dir.name, info: true }
        : { title: `Permitir «${lib.dir.name}»`, center: true, onTap: grantAccess });
    }
    if (L.canPickDir) libRows.push({ title: lib.dir ? 'Cambiar carpeta…' : 'Elegir carpeta de música…', icon: I.folder, onTap: pickDir });
    libRows.push(
      { title: 'Agregar archivos…', icon: I.plus, onTap: () => $('#filePick').click() },
      { title: 'Volver a leer la biblioteca', icon: I.clock, onTap: rescan },
    );
    const sections = [];
    if (updateAvailable) sections.push({ rows: [{ title: 'Actualizar la app', center: true, onTap: () => location.reload() }], note: `Versión nueva: ${updateAvailable}` });
    sections.push(
      { title: 'YouTube', rows: [
        { title: 'Descargar canción…', icon: I.yt, onTap: () => askUrl() },
        { title: 'Configurar descargas', icon: I.gear, chev: true, onTap: () => push(downloadsView()) },
      ], note: 'También puedes usar Compartir › iPod desde la app de YouTube.' },
      { title: 'Biblioteca', rows: libRows, note: `${lib.tracks.length} canciones · ${playlists.length} listas` },
      { title: 'Reproducción', rows: [
        { title: 'Aleatorio', toggle: P.shuffle, onTap: () => { PL.setShuffle(!P.shuffle); refresh(); syncNow(); } },
        { title: 'Repetir', value: REPEAT[P.repeat], chev: true, onTap: async () => {
          const v = await actionSheet('Repetir', [{ label: 'No', value: 'off' }, { label: 'Una canción', value: 'one' }, { label: 'Todas', value: 'all' }]);
          if (v) { PL.setRepeat(v); refresh(); syncNow(); }
        } },
      ] },
      { title: 'Acerca de', rows: [
        { title: 'Versión', value: bootVersion || '—', info: true },
        { title: 'Buscar actualización', onTap: async () => { await checkVersion(); toast(updateAvailable ? `Nueva versión: ${updateAvailable}` : 'Estás al día'); refresh(); } },
      ] },
    );
    return { grouped: true, sections };
  });
}

function downloadsView() {
  return view('Descargas', () => {
    const gh = settings.mode === 'github';
    const rows = gh ? [
      { title: 'Repositorio', value: settings.repo || '—', chev: true, onTap: async () => {
        let v = await prompt('Repositorio', { message: 'usuario/repositorio', value: settings.repo, placeholder: 'davidinblack/Ipod-web' });
        if (v == null) return;
        v = v.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$|\/+$/g, '');
        if (!/^[\w.-]+\/[\w.-]+$/.test(v)) { toast('Formato: usuario/repositorio', 2200); return; }
        settings.repo = v; saveSettings(); refresh();
      } },
      { title: 'Token', value: settings.ghToken ? '••••••' : 'Falta', chev: true, onTap: async () => {
        const v = await prompt('Token de GitHub', { message: 'Fine-grained token con Actions y Contents en lectura y escritura.', value: settings.ghToken, placeholder: 'github_pat_…', secret: true });
        if (v == null) return;
        settings.ghToken = v; saveSettings(); refresh();
      } },
    ] : [
      { title: 'Dirección', value: settings.server || 'Este sitio', chev: true, onTap: async () => {
        const v = await prompt('Servidor', { message: 'Vacío = este sitio', value: settings.server, placeholder: 'http://localhost:8787' });
        if (v == null) return;
        if (v && !/^https?:\/\//i.test(v)) { toast('Debe empezar con http:// o https://', 2200); return; }
        settings.server = v; saveSettings(); refresh();
      } },
      { title: 'Clave', value: settings.token ? '••••••' : 'Ninguna', chev: true, onTap: async () => {
        const v = await prompt('Clave del servidor', { value: settings.token, secret: true });
        if (v == null) return;
        settings.token = v; saveSettings(); refresh();
      } },
    ];
    return {
      grouped: true,
      sections: [
        { title: 'Método', rows: [
          { title: 'GitHub Actions', value: gh ? '✓' : '', onTap: () => { settings.mode = 'github'; saveSettings(); refresh(); } },
          { title: 'Servidor propio', value: gh ? '' : '✓', onTap: () => { settings.mode = 'server'; saveSettings(); refresh(); } },
        ], note: gh ? 'GitHub convierte el video en 1–2 minutos. No necesitas instalar nada.' : 'Usa server/server.py en tu PC, Termux o un VPS.' },
        { rows },
        { rows: [{ title: 'Probar conexión', center: true, onTap: testConnection }] },
      ],
    };
  }, { short: 'Más' });
}

// ---------------------------------------------------------------- biblioteca

async function pickDir() {
  try { await L.pickDirectory(); await rescan(); }
  catch (e) { if (e.name !== 'AbortError') toast('No se pudo abrir la carpeta'); }
}

async function grantAccess() {
  if (await L.requestDirAccess()) await rescan();
  else toast('Permiso denegado');
}

async function rescan() {
  const s = progressHud('Leyendo música…');
  try {
    const n = await L.scanLibrary((i, total) => s.set(i / total, null, `${i} de ${total}`));
    s.close();
    toast(`${n} canciones`);
    if (!P.track) await PL.restoreState();
  } catch (e) {
    s.close();
    toast('Error al leer la biblioteca');
    console.error(e);
  }
  thumbCache.clear();
  refreshAll();
}

$('#filePick').addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files?.length) return;
  const s = progressHud('Copiando archivos…');
  try { await L.importFiles(files, (i, n) => s.set(i / n, null, `${i} de ${n}`)); }
  catch (err) { toast('No se pudieron copiar'); console.error(err); }
  e.target.value = '';
  s.close();
  await rescan();
});

// --- YouTube: dos formas de convertir — GitHub Actions (sin instalar nada) o un servidor propio

const extractYouTube = (text) => String(text || '').match(/https?:\/\/(?:[\w-]+\.)?(?:youtube\.com|youtu\.be)\/[^\s"'<>]+/i)?.[0] || null;

// servidor propio (server/server.py)
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
    if (res.status === 404 && path === '/api/health') msg = 'No hay servidor aquí. Usa GitHub en Ajustes › Descargas';
    throw new Error(msg);
  }
  return res;
}

function filenameFrom(res) {
  const cd = res.headers.get('Content-Disposition') || '';
  const star = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) { try { return decodeURIComponent(star[1]); } catch {} }
  return cd.match(/filename="?([^";]+)"?/i)?.[1] || null;
}

async function serverDownload(url, s) {
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
  api(`/api/jobs/${job.id}`, { method: 'DELETE' }).catch(() => {});
  return { blob, filename: filenameFrom(res) || `${st.title || 'audio'}.mp3` };
}

// GitHub Actions (.github/workflows/youtube.yml)
const RAW = 'application/vnd.github.raw+json';
const OBJ = 'application/vnd.github.object+json';

async function gh(path, opts = {}, accept = 'application/vnd.github+json') {
  if (!settings.repo) throw new Error('Falta el repositorio (Ajustes › Descargas)');
  if (!settings.ghToken) throw new Error('Falta el token de GitHub (Ajustes › Descargas)');
  let res;
  try {
    res = await fetch(`https://api.github.com/repos/${settings.repo}${path}`, {
      ...opts, cache: 'no-store',
      headers: {
        Accept: accept, Authorization: `Bearer ${settings.ghToken}`, 'X-GitHub-Api-Version': '2022-11-28',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch { throw new Error('Sin conexión con GitHub'); }
  if (res.ok) return res;
  let msg = '';
  try { msg = (await res.json()).message || ''; } catch {}
  const e = new Error(
    res.status === 401 ? 'Token de GitHub inválido o vencido'
      : /rate limit/i.test(msg) ? 'Límite de GitHub; espera unos minutos'
        : res.status === 404 ? 'No encontrado: revisa el repo y los permisos del token'
          : res.status === 403 ? 'El token no tiene permiso (Actions y Contents: lectura y escritura)'
            : `GitHub ${res.status}${msg ? `: ${msg}` : ''}`);
  e.status = res.status;
  throw e;
}

async function ghDownload(url, s) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  setProgress(s, 0.03, 'Enviando a GitHub…', '');
  await gh('/actions/workflows/youtube.yml/dispatches', {
    method: 'POST', body: JSON.stringify({ ref: 'main', inputs: { url, id } }),
  });
  const t0 = Date.now();
  let run = null;
  for (;;) {
    await sleep(3000);
    if (Date.now() - t0 > 20 * 60e3) throw new Error('GitHub tardó demasiado');
    if (!run) {
      const r = await (await gh('/actions/runs?event=workflow_dispatch&per_page=20')).json();
      run = (r.workflow_runs || []).find((x) => (x.display_title || x.name) === `yt ${id}`) || null;
      if (!run) { setProgress(s, 0.05, 'Esperando a GitHub…'); continue; }
    } else {
      run = await (await gh(`/actions/runs/${run.id}`)).json();
    }
    if (run.status === 'completed') break;
    if (run.status !== 'in_progress') { setProgress(s, 0.07, 'En cola en GitHub…'); continue; }
    try {
      const steps = (await (await gh(`/actions/runs/${run.id}/jobs`)).json()).jobs?.[0]?.steps || [];
      const done = steps.filter((x) => x.status === 'completed').length;
      const now = steps.find((x) => x.status === 'in_progress')?.name || '';
      setProgress(s, 0.1 + 0.75 * (steps.length ? done / steps.length : 0),
        /MP3/.test(now) ? 'Descargando y convirtiendo…' : 'Preparando en GitHub…');
    } catch {}
  }

  setProgress(s, 0.88, 'Recogiendo el MP3…');
  let meta;
  try { meta = await (await gh(`/contents/${id}.json?ref=descargas`, {}, RAW)).json(); }
  catch { throw new Error(run.conclusion === 'success' ? 'No apareció el MP3 en la rama descargas' : 'Falló en GitHub (revisa la pestaña Actions)'); }
  if (meta.status !== 'done') { ghCleanup(id); throw new Error(meta.error || 'Falló la descarga'); }
  if (meta.title) setProgress(s, 0.9, null, meta.title);
  const buf = await (await gh(`/contents/${id}.mp3?ref=descargas`, {}, RAW)).arrayBuffer();
  ghCleanup(id);
  return { blob: new Blob([buf], { type: 'audio/mpeg' }), filename: meta.filename || `${meta.title || 'audio'}.mp3` };
}

// borra lo recogido de la rama (si falla, el workflow lo limpia a las 24 h)
async function ghCleanup(id) {
  for (const ext of ['mp3', 'json']) {
    try {
      const { sha } = await (await gh(`/contents/${id}.${ext}?ref=descargas`, {}, OBJ)).json();
      await gh(`/contents/${id}.${ext}`, { method: 'DELETE', body: JSON.stringify({ message: `recogida ${id}`, sha, branch: 'descargas' }) });
    } catch {}
  }
}

async function testConnection() {
  try {
    if (settings.mode === 'github') {
      await gh('/actions/workflows/youtube.yml');
      toast('GitHub conectado ✓', 2500);
    } else {
      const h = await (await api('/api/health')).json();
      toast(`Conectado ✓ (yt-dlp ${h.ytdlp || '?'})`, 2500);
    }
  } catch (e) { toast(e.message, 3000); }
}


async function askUrl(initial = '') {
  const r = await alertBox({
    title: 'Descargar de YouTube', message: 'Pega el enlace del video.',
    input: { value: initial, placeholder: 'https://youtu.be/…' },
    buttons: [
      { label: 'Pegar', onTap: async (inp) => {
        try { inp.value = (await navigator.clipboard.readText()).trim(); }
        catch { toast('Mantén presionado el campo y elige Pegar', 2200); }
      } },
      { label: 'Cancelar', value: false },
      { label: 'Descargar', main: true, value: true },
    ],
  });
  if (!r.value) return;
  const url = extractYouTube(r.input);
  if (!url) { await alertBox({ title: 'Enlace no válido', message: 'No parece un enlace de YouTube.' }); return; }
  startDownload(url);
}

async function startDownload(url) {
  const s = progressHud('Conectando…', { hideable: true });
  try {
    const { blob, filename } = settings.mode === 'github' ? await ghDownload(url, s) : await serverDownload(url, s);
    s.set(0.97, 'Guardando…');
    const t = await L.saveDownload(blob, filename);
    s.close();
    refreshAll();
    const r = await alertBox({
      title: 'Descarga lista', message: `${t.title} — ${t.artist}`,
      buttons: [{ label: 'Reproducir', main: true, value: 'play' }, { label: 'Añadir a lista…', value: 'add' }, { label: 'OK', value: 'ok' }],
    });
    if (r.value === 'play') playTracks([t.id], 0);
    else if (r.value === 'add') addToPlaylist([t.id]);
  } catch (e) {
    s.close();
    const r = await alertBox({
      title: 'No se pudo descargar', message: e.message,
      buttons: [{ label: 'Configurar', value: 'cfg' }, { label: 'Reintentar', main: true, value: 'retry' }, { label: 'Cerrar', value: false }],
    });
    if (r.value === 'retry') startDownload(url);
    else if (r.value === 'cfg') { if (tab !== 'more') selectTab('more'); push(downloadsView()); }
  }
}

// compartir desde la app de YouTube (Web Share Target)
function handleShare() {
  const q = new URLSearchParams(location.search);
  const url = extractYouTube(`${q.get('url') || ''} ${q.get('text') || ''} ${q.get('title') || ''}`);
  if (q.has('url') || q.has('text')) history.replaceState(null, '', location.pathname);
  if (url) startDownload(url);
}

// actualizaciones: la app se carga siempre desde la red; esto avisa si cambió mientras estaba abierta
let bootVersion = null, updateAvailable = null;
async function checkVersion() {
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    const { version } = await r.json();
    if (!bootVersion) bootVersion = version;
    else if (version !== bootVersion && version !== updateAvailable) {
      updateAvailable = version;
      const a = await alertBox({ title: 'Nueva versión', message: 'Hay una actualización de la app.', buttons: [{ label: 'Después', value: false }, { label: 'Actualizar', main: true, value: true }] });
      if (a.value) location.reload();
    }
  } catch {}
}

// ---------------------------------------------------------------- Reproduciendo

const now = $('#now');
const npArt = $('#npArt'), npSeek = $('#npSeek'), npVol = $('#npVol');
let seeking = false;

$('#npPrev').innerHTML = I.prev;
$('#npNext').innerHTML = I.next;
$('#npRepeat').innerHTML = I.repeat;
$('#npShuffle').innerHTML = I.shuffle;

function openNow() {
  if (!P.track) return;
  syncNow();
  now.classList.add('open');
  now.setAttribute('aria-hidden', 'false');
  history.pushState({ now: 1 }, '');
}
function closeNow(fromHistory) {
  if (!now.classList.contains('open')) return;
  now.classList.remove('open');
  now.setAttribute('aria-hidden', 'true');
  $('#npQueue').hidden = true;
  if (!fromHistory && history.state?.now) history.back();
  updateNav();
}
window.addEventListener('popstate', () => closeNow(true));

function syncNow() {
  const t = P.track;
  if (!t) { closeNow(); return; }
  $('#npArtist').textContent = t.artist;
  $('#npTitle').textContent = t.title;
  $('#npAlbum').textContent = t.album;
  if (P.art) { npArt.className = 'np-art'; npArt.innerHTML = ''; npArt.style.backgroundImage = `url("${P.art}")`; }
  else { npArt.className = 'np-art ph'; npArt.style.backgroundImage = ''; npArt.innerHTML = I.note; }
  const flip = $('#npFlip');
  if ($('#npQueue').hidden) { flip.className = 'np-flip'; flip.style.backgroundImage = P.art ? `url("${P.art}")` : ''; if (!P.art) flip.classList.add('list'); }
  else { flip.className = 'np-flip list'; flip.style.backgroundImage = ''; }
  syncPlay();
  syncTime();
  syncModes();
  if (!$('#npQueue').hidden) renderQueue();
}

function syncPlay() { $('#npPlay').innerHTML = audio.paused ? I.play : I.pause; }

function setFill(input) { input.style.setProperty('--p', `${(input.value - input.min) / (input.max - input.min) * 100}%`); }

function syncTime() {
  const d = audio.duration || 0, c = audio.currentTime || 0;
  $('#npCur').textContent = fmt(c);
  $('#npLeft').textContent = `-${fmt(d - c)}`;
  if (!seeking) { npSeek.value = d ? Math.round((c / d) * 1000) : 0; setFill(npSeek); }
}

function syncModes() {
  const rep = $('#npRepeat');
  rep.classList.toggle('on', P.repeat !== 'off');
  rep.querySelector('b')?.remove();
  if (P.repeat === 'one') rep.insertAdjacentHTML('beforeend', '<b>1</b>');
  $('#npShuffle').classList.toggle('on', P.shuffle);
  npVol.value = Math.round(audio.volume * 100);
  setFill(npVol);
}

function renderQueue() {
  const q = $('#npQueue');
  q.innerHTML = P.queue.map((id, i) => {
    const t = lib.byId.get(id);
    return t ? `<div class="q-row${i === P.index ? ' cur' : ''}" data-q="${i}"><span class="n">${i + 1}</span><div class="x"><div>${esc(t.title)}</div><div class="a">${esc(t.artist)}</div></div></div>` : '';
  }).join('');
  q.querySelector('.cur')?.scrollIntoView({ block: 'center' });
}

$('#npBack').onclick = () => closeNow();
$('#navNow').onclick = openNow;
$('#npPlay').onclick = () => PL.toggle();
$('#npPrev').onclick = () => PL.prev();
$('#npNext').onclick = () => PL.next();
npArt.onclick = () => { const s = $('#npScrub'); s.hidden = !s.hidden; };
$('#npFlip').onclick = () => {
  const q = $('#npQueue');
  q.hidden = !q.hidden;
  if (!q.hidden) renderQueue();
  syncNow();
};
$('#npQueue').addEventListener('click', (e) => {
  const r = e.target.closest('[data-q]');
  if (r) PL.jump(+r.dataset.q);
});
$('#npRepeat').onclick = () => { PL.setRepeat({ off: 'all', all: 'one', one: 'off' }[P.repeat]); syncModes(); };
$('#npShuffle').onclick = () => { PL.setShuffle(!P.shuffle); syncModes(); toast(P.shuffle ? 'Aleatorio: Sí' : 'Aleatorio: No', 1100); };
npSeek.addEventListener('input', () => {
  seeking = true;
  setFill(npSeek);
  const d = audio.duration || 0;
  $('#npCur').textContent = fmt((npSeek.value / 1000) * d);
  $('#npLeft').textContent = `-${fmt(d - (npSeek.value / 1000) * d)}`;
});
npSeek.addEventListener('change', () => {
  if (isFinite(audio.duration)) audio.currentTime = (npSeek.value / 1000) * audio.duration;
  seeking = false;
});
npVol.addEventListener('input', () => { PL.setVolume(npVol.value / 100); setFill(npVol); });

// deslizar a izquierda/derecha sobre la portada cambia de canción
(() => {
  let x0 = null;
  npArt.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  npArt.addEventListener('pointerup', (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 70) { (dx < 0 ? PL.next : PL.prev)(); }
  });
})();

PL.onPlayer((type) => {
  if (type === 'time') { if (now.classList.contains('open')) syncTime(); return; }
  if (type === 'state') { syncPlay(); return; }
  if (type === 'error') { toast('No se pudo leer el archivo'); return; }
  if (type === 'queue' && !$('#npQueue').hidden) renderQueue();
  syncNow();
  updateNav();
});

// teclado (para probar en computadora)
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
  if (e.key === ' ') { PL.toggle(); e.preventDefault(); }
  else if (e.key === 'ArrowRight') PL.next();
  else if (e.key === 'ArrowLeft') PL.prev();
  else if (e.key === 'Escape') { if (now.classList.contains('open')) closeNow(); else pop(); }
});

// ---------------------------------------------------------------- arranque

$('#navBack').onclick = pop;
$('#tabbar').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (b) selectTab(b.dataset.tab);
});

async function boot() {
  if (!TABS.some((t) => t.id === tab)) tab = 'songs';
  stacks[tab] = [TABS.find((t) => t.id === tab).root()];
  renderTabbar();

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
  navigator.storage?.persist?.().catch(() => {});
  checkVersion();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });

  try { playlists = (await db.kvGet('playlists')) || []; } catch { playlists = []; }
  await L.initLibrary();
  showTop();

  let hud = null;
  const t0 = setTimeout(() => { hud = progressHud('Cargando biblioteca…'); }, 400);
  try { await L.scanLibrary((i, n) => hud?.set(i / n, null, `${i} de ${n}`)); }
  catch (e) { console.error(e); }
  clearTimeout(t0);
  hud?.close();
  await PL.restoreState().catch(() => {});
  refreshAll();
  if (lib.dir && lib.dirState === 'prompt') {
    const r = await alertBox({ title: 'Permiso de carpeta', message: `Toca Permitir para volver a leer «${lib.dir.name}».`, buttons: [{ label: 'Ahora no', value: false }, { label: 'Permitir', main: true, value: true }] });
    if (r.value) await grantAccess();
  }
  handleShare();
}

boot();
