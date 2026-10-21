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
  speaker: '<svg viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3zM15 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2zM17.8 5.7a9 9 0 0 1 0 12.6l-1.4-1.4a7 7 0 0 0 0-9.8z"/></svg>',
  pencil: '<svg viewBox="0 0 24 24"><path d="M15.5 4.5l4 4L8 20H4v-4zM17 3l1.5-1.5a1.4 1.4 0 0 1 2 0l2 2a1.4 1.4 0 0 1 0 2L21 7z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 2l5 5-1.4 1.4L13 5.8V15h-2V5.8L8.4 8.4 7 7zM4 12h3v2H6v6h12v-6h-1v-2h3v10H4z"/></svg>',
  load: '<svg viewBox="0 0 24 24"><path d="M11 3h2v9.2l2.6-2.6L17 11l-5 5-5-5 1.4-1.4 2.6 2.6zM4 15h2v4h12v-4h2v6H4z"/></svg>',
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
async function coverURL(t, size = 112) {
  const key = `${t.id}@${size}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const p = (async () => {
    const blob = await L.getCoverBlob(t);
    if (!blob) return null;
    const bmp = await createImageBitmap(blob);
    const s = Math.min(bmp.width, bmp.height), c = document.createElement('canvas');
    c.width = c.height = Math.min(size, s);
    c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, c.width, c.height);
    bmp.close?.();
    return new Promise((r) => c.toBlob((b) => r(b ? URL.createObjectURL(b) : null), 'image/jpeg', 0.86));
  })().catch(() => null);
  thumbCache.set(key, p);
  return p;
}
const thumbURL = (t) => coverURL(t, 112);
function forgetCovers(...ids) {
  for (const k of [...thumbCache.keys()]) if (ids.some((id) => k.startsWith(`${id}@`))) thumbCache.delete(k);
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
  const cls = ['row', r.dim ? 'pend' : '', r.sub ? 'two' : '', r.cover !== undefined ? 'album' : '', r.info ? 'info' : '', r.center ? 'center' : '', r.playing ? 'playing' : ''].join(' ');
  return `<div class="${cls}" data-i="${i}">`
    + (r.lead !== undefined ? `<span class="lead">${r.playing ? I.speaker : esc(r.lead ?? '')}</span>` : '')
    + (r.cover !== undefined ? `<div class="thumb" data-cover="${esc(r.cover || '')}">${I.note}</div>` : '')
    + (r.icon ? `<span class="ico">${r.icon}</span>` : '')
    + `<div class="txt"><div class="t">${esc(r.title)}</div>${r.sub ? `<div class="s">${esc(r.sub)}</div>` : ''}</div>`
    + (r.num != null ? `<span class="num">${esc(r.num)}</span>` : '')
    + (r.playing && r.lead === undefined ? `<span class="spk">${I.speaker}</span>` : '')
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
  el.classList.add('rowhost');
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
    const r = row && row.closest('.rowhost')?._rows?.[+row.dataset.i];
    if (!r || r.info) return;
    r.onTap?.(r, row);
  });
  el.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('.row[data-i]');
    const r = row && row.closest('.rowhost')?._rows?.[+row.dataset.i];
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

function playTracks(ids, i = 0, opts = {}) {
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
        playing: id === P.track?.id,
        onTap: () => playTracks(ids, ids.indexOf(id), { context: { type: 'list', title } }),
        onHold: () => songOptions(id, ctx),
      };
    };
    const head = ids.length > 1 ? [{
      title: 'Mezclar', icon: I.shuffle,
      onTap: () => playTracks(ids, Math.floor(Math.random() * ids.length), { shuffle: true, context: { type: 'list', title } }),
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
  }, { ...ctx, live: true });
}

function artistsView() {
  return view('Artistas', () => {
    const rows = L.artists().sort((a, b) => (a[0] === 'Artista desconocido') - (b[0] === 'Artista desconocido')).map(([name, ids]) => ({
      title: name, chev: true,
      onTap: () => {
        const al = L.albums(name);
        if (al.length === 1) push(albumDetail(al[0][0], name, 'Artistas'));
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
        onTap: () => push(albumDetail(name, artist)),
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
        { title: 'Cargar lista compartida…', icon: I.load, onTap: loadSharedList },
        { title: 'Agregadas recientemente', icon: I.clock, chev: true, onTap: () => push(recentDetail()) },
        ...playlists.map((p) => ({
          title: p.name, sub: `${p.tracks.filter((id) => lib.byId.has(id)).length} canciones${p.pending?.length ? ` · ${p.pending.length} pendientes` : ''}`, chev: true,
          onTap: () => push(playlistDetail(p)),
          onHold: () => playlistOptions(p),
        })),
      ],
    }],
  }));
}

// --- vista de álbum / lista: portada grande + canciones, con la que suena marcada

async function firstCover(ids, size) {
  for (const id of ids) {
    const t = lib.byId.get(id);
    if (!t) continue;
    const u = await coverURL(t, size);
    if (u) return u;
  }
  return null;
}

/**
 * def: { title, short, kind:'album'|'playlist'|'list', key, getIds(), cover(size) → url, subtitle, numbers, onEdit }
 */
function detailView(def) {
  return {
    title: def.title, short: def.short, live: true, detail: true,
    render(el) {
      const ids = def.getIds().filter((id) => lib.byId.has(id));
      const context = { type: def.kind, key: def.key, title: def.title };
      const cur = P.track?.id;
      el.classList.add('detail');
      el.innerHTML = `
        <div class="ld">
          <button class="ld-cover ph" aria-label="Portada">${I.note}</button>
          <div class="ld-meta">
            <div class="ld-title">${esc(def.title)}</div>
            ${def.subtitle ? `<div class="ld-sub">${esc(def.subtitle)}</div>` : ''}
            <div class="ld-count">${ids.length} ${ids.length === 1 ? 'canción' : 'canciones'}</div>
            <div class="ld-btns">
              <button class="ld-btn" data-a="play"${ids.length ? '' : ' disabled'}>${I.play}<span>Reproducir</span></button>
              <button class="ld-btn" data-a="shuffle"${ids.length > 1 ? '' : ' disabled'}>${I.shuffle}<span>Mezclar</span></button>
              ${def.onEdit ? `<button class="ld-btn" data-a="edit">${I.pencil}<span>Editar</span></button>` : ''}
              <button class="ld-btn" data-a="share"${ids.length || def.playlist?.pending?.length ? '' : ' disabled'}>${I.share}<span>Compartir</span></button>
              ${def.playlist?.pending?.some((x) => x.url) ? `<button class="ld-btn" data-a="dl">${I.load}<span>Bajar ${def.playlist.pending.filter((x) => x.url).length}</span></button>` : ''}
            </div>
          </div>
          <div class="ld-list"></div>
        </div>`;
      const list = el.querySelector('.ld-list');
      renderTable(list, {
        sections: [{
          rows: ids.map((id, i) => {
            const t = lib.byId.get(id);
            return {
              title: t.title,
              sub: def.kind === 'album' ? null : `${t.artist} — ${t.album}`,
              lead: def.numbers && t.track ? t.track : i + 1,
              playing: id === cur,
              onTap: () => playTracks(ids, i, { shuffle: false, context }),
              onHold: () => songOptions(id, def.kind === 'playlist' ? { playlist: def.playlist } : {}),
            };
          }),
        }, ...(def.playlist?.pending?.length ? [{
          title: 'Pendientes',
          rows: def.playlist.pending.map((x) => ({
            title: x.title, dim: true, lead: '↓',
            sub: busy.has(def.playlist.id) && x.url ? 'Descargando…' : x.error ? `Error: ${x.error}` : x.url ? `${x.artist} · toca para descargar` : `${x.artist} · sin enlace de YouTube`,
            onTap: () => (x.url ? downloadPending(def.playlist) : pendingOptions(def.playlist, x)),
            onHold: () => pendingOptions(def.playlist, x),
          })),
        }] : [])],
        empty: def.kind === 'playlist'
          ? '<b>Lista vacía</b>Mantén presionada una canción y elige «Añadir a una lista».'
          : '<b>Sin canciones</b>',
      });
      el.querySelector('.ld-btns').addEventListener('click', (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a === 'play') playTracks(ids, 0, { shuffle: false, context });
        else if (a === 'shuffle') playTracks(ids, Math.floor(Math.random() * ids.length), { shuffle: true, context });
        else if (a === 'edit') def.onEdit();
        else if (a === 'share') Promise.resolve(def.cover(300)).then((url) => shareList(def.title, ids, url, def.playlist?.pending || []));
        else if (a === 'dl') downloadPending(def.playlist);
      });
      const cov = el.querySelector('.ld-cover');
      cov.onclick = () => def.onEdit?.();
      Promise.resolve(def.cover(600)).then((url) => {
        if (!url || !cov.isConnected) return;
        cov.classList.remove('ph');
        cov.innerHTML = '';
        cov.style.backgroundImage = `url("${url}")`;
      });
      // deja visible la canción que suena
      const playing = list.querySelector('.row.playing');
      if (playing && !this._scrolled) { this._scrolled = true; requestAnimationFrame(() => playing.scrollIntoView({ block: 'nearest' })); }
    },
  };
}

const albumIds = (name, artist) => L.albums(artist).find((a) => a[0] === name)?.[1] || [];

function albumDetail(name, artist, short) {
  return detailView({
    title: name, short: short || (artist ? artist : 'Álbumes'), kind: 'album', key: `${artist || ''}\u0001${name}`, numbers: true,
    subtitle: artist || lib.byId.get(albumIds(name, artist)[0])?.artist,
    getIds: () => albumIds(name, artist),
    cover: (size) => firstCover(albumIds(name, artist).filter((id) => lib.byId.get(id)?.hasPic).concat(albumIds(name, artist)), size),
    onEdit: () => editAlbum(name, artist),
  });
}

function playlistDetail(p) {
  return detailView({
    title: p.name, short: 'Listas', kind: 'playlist', key: p.id, playlist: p, subtitle: 'Lista de reproducción',
    getIds: () => p.tracks,
    cover: (size) => p.image || firstCover(p.tracks, size),
    onEdit: () => editPlaylist(p),
  });
}

function recentDetail() {
  return detailView({
    title: 'Agregadas recientemente', short: 'Listas', kind: 'list', key: 'recent', subtitle: 'Lista automática',
    getIds: recentIds, cover: (size) => firstCover(recentIds(), size),
  });
}

/** Portada del contexto de reproducción (álbum o lista) para «Ahora suena». */
function contextCover(size = 200) {
  const c = P.context;
  if (c?.type === 'playlist') {
    const p = playlists.find((x) => x.id === c.key);
    if (p) return Promise.resolve(p.image || firstCover(p.tracks, size));
  }
  return P.track ? coverURL(P.track, size) : Promise.resolve(null);
}

// --- editor (canción, álbum, lista)

const imgPick = h('<input type="file" accept="image/*" hidden>');
document.body.appendChild(imgPick);

function pickImage() {
  return new Promise((resolve) => {
    imgPick.value = '';
    const done = () => { imgPick.onchange = imgPick.oncancel = null; resolve(imgPick.files?.[0] || null); };
    imgPick.onchange = done;
    imgPick.oncancel = done;
    imgPick.click();
  });
}

/** Recorta al centro en cuadrado (máx. 800 px) y devuelve JPEG listo para incrustar. */
async function prepareImage(file) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height), size = Math.min(800, s);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  bmp.close?.();
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
  return { blob, mime: 'image/jpeg', data: new Uint8Array(await blob.arrayBuffer()), url: URL.createObjectURL(blob) };
}

const blobToDataURL = (blob) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });

/**
 * Hoja de edición a pantalla completa.
 * opts: { title, cover (url|null), fields:[{key,label,value,suffix,placeholder}], note }
 * → null si se cancela, o { values, picture } (picture: undefined sin cambios · null quitar · {blob,mime,data})
 */
function editor({ title, cover, fields, note, imageNote }) {
  return new Promise((resolve) => {
    let picture;
    const el = h(`<div class="ed">
      <header class="navbar ed-bar">
        <button class="ed-btn" data-a="cancel">Cancelar</button>
        <h1>${esc(title)}</h1>
        <button class="ed-btn main" data-a="save">Guardar</button>
      </header>
      <div class="ed-body">
        <div class="ed-cover">
          <button class="ed-img${cover ? '' : ' ph'}" data-a="pick">${cover ? '' : I.note}</button>
          <div class="ed-imgbtns">
            <button class="ed-small" data-a="pick">Cambiar imagen…</button>
            <button class="ed-small" data-a="clear">Quitar imagen</button>
          </div>
        </div>
        ${imageNote ? `<div class="g-note">${esc(imageNote)}</div>` : ''}
        <div class="group">
          ${fields.map((f) => `<label class="row ed-row"><span class="ed-l">${esc(f.label)}</span>
            <input data-k="${f.key}" value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder || '')}" autocomplete="off" autocapitalize="sentences" spellcheck="false">
            ${f.suffix ? `<span class="ed-suf">${esc(f.suffix)}</span>` : ''}</label>`).join('')}
        </div>
        ${note ? `<div class="g-note">${esc(note)}</div>` : ''}
      </div>
    </div>`);
    const img = el.querySelector('.ed-img');
    if (cover) img.style.backgroundImage = `url("${cover}")`;
    const close = (result) => { el.classList.add('closing'); setTimeout(() => el.remove(), 250); resolve(result); };
    el.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'cancel') close(null);
      else if (a === 'save') {
        const values = {};
        el.querySelectorAll('input[data-k]').forEach((i) => { values[i.dataset.k] = i.value.trim(); });
        close({ values, picture });
      } else if (a === 'pick') {
        const f = await pickImage();
        if (!f) return;
        try {
          picture = await prepareImage(f);
          img.classList.remove('ph'); img.innerHTML = '';
          img.style.backgroundImage = `url("${picture.url}")`;
        } catch { toast('No se pudo abrir la imagen'); }
      } else if (a === 'clear') {
        picture = null;
        img.classList.add('ph'); img.style.backgroundImage = ''; img.innerHTML = I.note;
      }
    });
    layer.appendChild(el);
  });
}

function migrateId(oldId, newId) {
  if (oldId === newId) return;
  playlists.forEach((p) => { p.tracks = p.tracks.map((x) => (x === oldId ? newId : x)); });
}

async function editSong(id) {
  const t = lib.byId.get(id);
  if (!t) return;
  if (!L.canDelete(t)) {
    await alertBox({ title: 'Sólo lectura', message: 'No hay permiso para modificar esta carpeta. Vuelve a elegirla en Más › Biblioteca.' });
    return;
  }
  const ext = (t.name.match(/\.[^.]+$/) || [''])[0];
  const r = await editor({
    title: 'Editar canción', cover: await coverURL(t, 600),
    fields: [
      { key: 'title', label: 'Título', value: t.title },
      { key: 'artist', label: 'Artista', value: t.artist },
      { key: 'album', label: 'Álbum', value: t.album },
      { key: 'filename', label: 'Archivo', value: L.baseName(t), suffix: ext },
      { key: 'source', label: 'YouTube', value: t.source || '', placeholder: 'https://youtu.be/… (para compartir)' },
    ],
    note: L.isMp3(t) ? 'Los cambios se guardan dentro del archivo MP3.' : 'En este formato el título y la imagen se guardan en la app; el nombre del archivo sí se cambia.',
  });
  if (!r) return;
  const changes = {};
  for (const k of ['title', 'artist', 'album']) if (r.values[k] && r.values[k] !== t[k]) changes[k] = r.values[k];
  if (r.values.filename && r.values.filename !== L.baseName(t)) changes.filename = r.values.filename;
  if ((r.values.source || '') !== (t.source || '')) {
    if (r.values.source && !L.isYouTube(r.values.source)) { await alertBox({ title: 'Enlace no válido', message: 'El campo YouTube debe ser un enlace de youtube.com o youtu.be.' }); return; }
    changes.source = r.values.source;
  }
  if (r.picture !== undefined) changes.picture = r.picture ? { mime: r.picture.mime, data: r.picture.data } : null;
  if (!Object.keys(changes).length) return;
  const hud = progressHud('Guardando…');
  hud.set(0.4);
  const isCur = P.track?.id === id, wasPlaying = isCur && !audio.paused;
  try {
    if (isCur) audio.pause();
    const { oldId, newId } = await L.editTrack(id, changes, { picBlob: r.picture?.blob });
    migrateId(oldId, newId);
    savePlaylists();
    forgetCovers(oldId, newId);
    await PL.replaceId(oldId, newId, wasPlaying);
    hud.close();
    toast('Guardado');
  } catch (e) {
    hud.close();
    if (wasPlaying) audio.play().catch(() => {});
    await alertBox({ title: 'No se pudo guardar', message: e.message });
  }
  refreshAll();
}

async function editAlbum(name, artist) {
  const ids = albumIds(name, artist);
  if (!ids.length) return;
  const locked = ids.filter((id) => !L.canDelete(lib.byId.get(id)));
  if (locked.length) {
    await alertBox({ title: 'Sólo lectura', message: 'No hay permiso para modificar esta carpeta. Vuelve a elegirla en Más › Biblioteca.' });
    return;
  }
  const r = await editor({
    title: 'Editar álbum', cover: await firstCover(ids, 600),
    fields: [{ key: 'album', label: 'Álbum', value: name }],
    imageNote: `La imagen y el nombre se aplican a las ${ids.length} canciones del álbum.`,
  });
  if (!r) return;
  const changes = {};
  if (r.values.album && r.values.album !== name) changes.album = r.values.album;
  if (r.picture !== undefined) changes.picture = r.picture ? { mime: r.picture.mime, data: r.picture.data } : null;
  if (!Object.keys(changes).length) return;
  const hud = progressHud('Guardando álbum…');
  const curIn = ids.includes(P.track?.id), wasPlaying = curIn && !audio.paused;
  if (curIn) audio.pause();
  let fails = 0;
  for (let i = 0; i < ids.length; i++) {
    hud.set(i / ids.length, null, lib.byId.get(ids[i])?.title || '');
    try {
      const { oldId, newId } = await L.editTrack(ids[i], changes, { picBlob: r.picture?.blob });
      migrateId(oldId, newId);
      forgetCovers(oldId, newId);
      await PL.replaceId(oldId, newId, wasPlaying);
    } catch (e) { fails++; console.warn(e); }
  }
  savePlaylists();
  hud.close();
  toast(fails ? `Guardado (${fails} con error)` : 'Álbum guardado');
  if (changes.album && top().detail) {
    stack()[stack().length - 1] = albumDetail(changes.album, artist, top().short);
    showTop();
  }
  refreshAll();
}

async function editPlaylist(p) {
  const r = await editor({
    title: 'Editar lista', cover: p.image || await firstCover(p.tracks, 600),
    fields: [{ key: 'name', label: 'Nombre', value: p.name }],
    imageNote: 'Si no eliges una imagen se usa la portada de la primera canción.',
  });
  if (!r) return;
  if (r.values.name) p.name = r.values.name;
  if (r.picture === null) delete p.image;
  else if (r.picture) p.image = await blobToDataURL(r.picture.blob);
  playlists.sort((a, b) => L.cmp(a.name, b.name));
  savePlaylists();
  if (top().detail) { stack()[stack().length - 1] = playlistDetail(p); showTop(); }
  refreshAll();
  if (P.context?.key === p.id) { P.context.title = p.name; syncNow(); }
}

// --- compartir y cargar listas (archivo con los enlaces de YouTube)

const LIST_TYPE = 'ipod-web-lista';
const appURL = () => location.origin + location.pathname.replace(/index\.html$/, '');

const normKey = (s) => NORM(String(s || '').toLowerCase())
  .replace(/\(.*?\)|\[.*?\]/g, ' ')
  .replace(/\b(official|oficial|video|audio|lyrics?|letra|hd|hq|remaster(ed)?)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ').trim();
const ytId = (u) => String(u || '').match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/)?.[1] || null;

async function imageForShare(url) {
  if (!url) return null;
  try {
    const bmp = await createImageBitmap(await (await fetch(url)).blob());
    const s = Math.min(bmp.width, bmp.height), c = document.createElement('canvas');
    c.width = c.height = Math.min(300, s);
    c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  } catch { return null; }
}

/** Crea el archivo de la lista y abre el menú Compartir de Android (WhatsApp, Bluetooth, Quick Share…). */
async function shareList(name, ids, coverUrl, pending = []) {
  const tracks = ids.map((id) => lib.byId.get(id)).filter(Boolean)
    .map((t) => ({ title: t.title, artist: t.artist, album: t.album, url: t.source || '' }));
  tracks.push(...pending.map((x) => ({ title: x.title, artist: x.artist, album: x.album || '', url: x.url || '' })));
  if (!tracks.length) { toast('La lista está vacía'); return; }
  const data = { type: LIST_TYPE, version: 1, name, created: new Date().toISOString(), app: appURL(), image: await imageForShare(coverUrl), tracks };
  const noUrl = tracks.filter((t) => !t.url).length;
  const fname = `${L.safeName(name).replace(/\.+$/, '')}.lista.txt`;
  const file = new File([JSON.stringify(data, null, 1)], fname, { type: 'text/plain' });
  const text = `Lista «${name}» (${tracks.length} canciones) para iPod Web.\nÁbrela en la app: Listas › Cargar lista compartida.\n${appURL()}`;
  if (noUrl) {
    const r = await alertBox({
      title: 'Algunas no tienen enlace',
      message: `${noUrl} de ${tracks.length} canciones no tienen enlace de YouTube; tu familia sólo podrá emparejarlas si ya las tiene. Puedes agregar el enlace en Editar canción.`,
      buttons: [{ label: 'Cancelar', value: false }, { label: 'Compartir', main: true, value: true }],
    });
    if (!r.value) return;
  }
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name, text }); return; }
  } catch (e) { if (e.name === 'AbortError') return; console.warn(e); }
  // sin menú Compartir (computadora): se descarga el archivo
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = fname;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Archivo guardado en Descargas', 2200);
}

const listPick = h('<input type="file" accept=".txt,.json,text/plain,application/json" hidden>');
document.body.appendChild(listPick);

function pickListFile() {
  return new Promise((resolve) => {
    listPick.value = '';
    const done = () => { listPick.onchange = listPick.oncancel = null; resolve(listPick.files?.[0] || null); };
    listPick.onchange = done;
    listPick.oncancel = done;
    listPick.click();
  });
}

/** Busca cada canción en la biblioteca: primero por enlace, luego por título y artista. */
function matchTrack(item) {
  const id = ytId(item.url);
  if (id) {
    const t = lib.tracks.find((x) => ytId(x.source) === id);
    if (t) return t;
  }
  const kt = normKey(item.title), ka = normKey(item.artist);
  if (!kt) return null;
  const same = lib.tracks.filter((x) => normKey(x.title) === kt);
  return same.find((x) => normKey(x.artist) === ka) || (same.length === 1 ? same[0] : null);
}

async function loadSharedList() {
  const f = await pickListFile();
  if (!f) return;
  let data;
  try { data = JSON.parse(await f.text()); } catch { data = null; }
  if (!data || data.type !== LIST_TYPE || !Array.isArray(data.tracks)) {
    await alertBox({ title: 'Archivo no válido', message: 'Elige un archivo .lista.txt creado con «Compartir» en iPod Web.' });
    return;
  }
  let name = String(data.name || 'Lista compartida').slice(0, 80);
  const existing = playlists.find((p) => p.name === name);
  let p;
  if (existing) {
    const v = await actionSheet(`Ya tienes una lista «${name}»`, [
      { label: 'Actualizarla con la nueva', value: 'merge' },
      { label: 'Crear otra lista', value: 'new' },
    ]);
    if (!v) return;
    if (v === 'merge') p = existing;
    else { let n = 2; while (playlists.some((x) => x.name === `${name} ${n}`)) n++; name = `${name} ${n}`; }
  }
  p ||= createPlaylist(name);
  if (data.image && !p.image) p.image = data.image;

  const have = new Set(p.tracks);
  const pending = (p.pending ||= []);
  let matched = 0, toDownload = 0, noLink = 0;
  data.tracks.forEach((item, pos) => {
    const t = matchTrack(item);
    if (t) {
      matched++;
      if (!have.has(t.id)) { p.tracks.splice(Math.min(pos, p.tracks.length), 0, t.id); have.add(t.id); }
    } else if (!pending.some((x) => (x.url && x.url === item.url) || (normKey(x.title) === normKey(item.title) && normKey(x.artist) === normKey(item.artist)))) {
      pending.push({ title: String(item.title || '—'), artist: String(item.artist || ''), album: String(item.album || ''), url: L.isYouTube(item.url) ? item.url : '', pos });
      if (L.isYouTube(item.url)) toDownload++; else noLink++;
    }
  });
  savePlaylists();
  if (tab !== 'playlists') selectTab('playlists');
  stack().length = 1;
  push(playlistDetail(p));

  const lines = [`${matched} ya estaban en tu teléfono.`];
  if (toDownload) lines.push(`${toDownload} se pueden descargar de YouTube.`);
  if (noLink) lines.push(`${noLink} no traen enlace (quedan como pendientes).`);
  const r = await alertBox({
    title: `«${p.name}» cargada`, message: lines.join('\n'),
    buttons: toDownload
      ? [{ label: 'Después', value: false }, { label: `Descargar ${toDownload}`, main: true, value: true }]
      : [{ label: 'OK', main: true, value: false }],
  });
  if (r.value) downloadPending(p);
}

// --- descarga de canciones pendientes de una lista

const busy = new Set(); // listas descargando ahora

async function downloadOne(url, prog) {
  const { blob, filename, cover } = settings.mode === 'github' ? await ghDownload(url, prog) : await serverDownload(url, prog);
  prog.set(0.97, 'Guardando…');
  let t = await L.saveDownload(blob, filename);
  // guarda el enlace de origen y, si falta, la portada dentro del MP3
  const changes = {};
  if (L.isMp3(t) && !t.source) changes.source = url;
  let coverData = null;
  if (cover && L.isMp3(t) && !t.hasPic) { coverData = new Uint8Array(await cover.arrayBuffer()); changes.picture = { mime: 'image/jpeg', data: coverData }; }
  try {
    if (Object.keys(changes).length) t = (await L.editTrack(t.id, changes)).track;
    if (cover && !L.isMp3(t)) await L.setCoverOverride(t.id, cover);
    if (!L.isMp3(t)) await L.editTrack(t.id, { source: url });
  } catch (e) { console.warn('etiquetas', e); }
  return t;
}

async function downloadPending(p) {
  if (busy.has(p.id)) { toast('Ya se está descargando'); return; }
  const items = (p.pending || []).filter((x) => x.url);
  if (!items.length) { toast('No hay canciones con enlace para descargar'); return; }
  busy.add(p.id);
  const hud = progressHud(`Descargando para «${p.name}»…`, { hideable: true });
  const prog = new Map();
  let done = 0, fails = 0;
  const update = () => {
    const part = [...prog.values()].reduce((a, b) => a + b, 0);
    hud.set((done + part) / items.length, `Descargando ${Math.min(done + prog.size, items.length)} de ${items.length}`, `${done} terminadas · ${fails} con error`);
  };
  const work = items.slice();
  const worker = async () => {
    while (work.length) {
      const item = work.shift();
      const shim = { set: (pct) => { prog.set(item, pct || 0); update(); } };
      try {
        // si mientras tanto ya apareció en la biblioteca, no se descarga
        const t = matchTrack(item) || await downloadOne(item.url, shim);
        if (!p.tracks.includes(t.id)) p.tracks.splice(Math.min(item.pos ?? p.tracks.length, p.tracks.length), 0, t.id);
        p.pending = p.pending.filter((x) => x !== item);
        done++;
      } catch (e) {
        fails++;
        item.error = e.message;
        console.warn('pendiente', item.title, e);
      }
      prog.delete(item);
      savePlaylists();
      update();
      if (top()?.detail) refresh();
    }
  };
  await Promise.all([worker(), worker()]); // dos a la vez
  busy.delete(p.id);
  hud.close();
  refreshAll();
  const msg = fails ? `${done} descargadas, ${fails} con error.\n${items.find((x) => x.error)?.error || ''}` : `${done} canciones descargadas.`;
  if (hud.hidden || !fails) toast(`«${p.name}»: ${done} descargadas${fails ? `, ${fails} con error` : ''}`, 2600);
  else await alertBox({ title: `«${p.name}»`, message: msg });
}

async function pendingOptions(p, item) {
  const opts = [];
  if (item.url) opts.push({ label: 'Descargar las pendientes', value: 'all' });
  opts.push({ label: 'Agregar enlace de YouTube…', value: 'url' }, { label: 'Quitar de la lista', value: 'remove', red: true });
  const v = await actionSheet(`${item.title}${item.artist ? ` — ${item.artist}` : ''}`, opts);
  if (v === 'all') downloadPending(p);
  else if (v === 'url') {
    const u = await prompt('Enlace de YouTube', { value: item.url, placeholder: 'https://youtu.be/…' });
    if (u == null) return;
    if (u && !L.isYouTube(u)) { toast('No parece un enlace de YouTube', 2000); return; }
    item.url = u; delete item.error; savePlaylists(); refresh();
  } else if (v === 'remove') {
    p.pending = p.pending.filter((x) => x !== item); savePlaylists(); refresh();
  }
}

// --- acciones

async function songOptions(id, ctx = {}) {
  const t = lib.byId.get(id);
  if (!t) return;
  const opts = [
    { label: 'Editar canción…', value: 'edit' },
    { label: 'Reproducir a continuación', value: 'next' },
    { label: 'Añadir a una lista…', value: 'add' },
  ];
  if (ctx.playlist) opts.push({ label: 'Quitar de esta lista', value: 'remove' });
  if (L.canDelete(t)) opts.push({ label: 'Eliminar archivo', value: 'delete', red: true });
  const a = await actionSheet(`${t.title} — ${t.artist}`, opts);
  if (a === 'edit') await editSong(id);
  else if (a === 'next') { PL.playNext(id); toast('A continuación'); updateNav(); }
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
    { label: 'Editar nombre e imagen…', value: 'edit' },
    { label: 'Eliminar lista', value: 'delete', red: true },
  ]);
  const ids = p.tracks.filter((id) => lib.byId.has(id));
  if (a === 'shuffle' && ids.length) playTracks(ids, Math.floor(Math.random() * ids.length), { shuffle: true, context: { type: 'playlist', key: p.id, title: p.name } });
  else if (a === 'edit') await editPlaylist(p); else if (a === 'delete') {
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
  let cover = null;
  if (st.cover) { try { cover = await (await api(`/api/jobs/${job.id}/cover`)).blob(); } catch {} }
  api(`/api/jobs/${job.id}`, { method: 'DELETE' }).catch(() => {});
  return { blob, cover, filename: filenameFrom(res) || `${st.title || 'audio'}.mp3` };
}

// GitHub Actions (.github/workflows/youtube.yml)
const RAW = 'application/vnd.github.raw+json';
const OBJ = 'application/vnd.github.object+json';

async function gh(path, opts = {}, accept = 'application/vnd.github+json') {
  if (!settings.repo) throw new Error('Falta el repositorio (Más › Configurar descargas)');
  if (!settings.ghToken) throw new Error('Falta el token de GitHub (Más › Configurar descargas)');
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
  let cover = null;
  if (meta.cover) {
    try { cover = new Blob([await (await gh(`/contents/${id}.jpg?ref=descargas`, {}, RAW)).arrayBuffer()], { type: 'image/jpeg' }); } catch {}
  }
  ghCleanup(id);
  return { blob: new Blob([buf], { type: 'audio/mpeg' }), cover, filename: meta.filename || `${meta.title || 'audio'}.mp3` };
}

// borra lo recogido de la rama (si falla, el workflow lo limpia a las 24 h)
async function ghCleanup(id) {
  for (const ext of ['mp3', 'jpg', 'json']) {
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
    const t = await downloadOne(url, s);
    s.close();
    refreshAll();
    const r = await alertBox({
      title: 'Descarga lista', message: `${t.title} — ${t.artist}`,
      buttons: [{ label: 'Reproducir', main: true, value: 'play' }, { label: 'Editar nombre e imagen…', value: 'edit' }, { label: 'Añadir a lista…', value: 'add' }, { label: 'OK', value: 'ok' }],
    });
    if (r.value === 'play') playTracks([t.id], 0, { context: { type: 'list', title: 'Descargas' } });
    else if (r.value === 'edit') editSong(t.id);
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
  now.classList.remove('show-q');
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
  if (!now.classList.contains('show-q')) { flip.className = 'np-flip'; flip.style.backgroundImage = P.art ? `url("${P.art}")` : ''; if (!P.art) flip.classList.add('list'); }
  else { flip.className = 'np-flip list'; flip.style.backgroundImage = ''; }
  syncPlay();
  syncTime();
  syncModes();
  if (queueVisible()) renderQueue();
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

const queueVisible = () => now.classList.contains('show-q') || now.classList.contains('land');

// la lista que está sonando, con su portada y la canción actual marcada
function renderQueue() {
  const q = $('#npQueue');
  const c = P.context;
  const title = c?.title || 'Cola de reproducción';
  const kind = c?.type === 'album' ? 'Álbum' : c?.type === 'playlist' ? 'Lista' : '';
  q.innerHTML = `<div class="q-head">
      <div class="q-cover">${I.note}</div>
      <div class="q-meta"><div class="q-k">${kind}</div><div class="q-t">${esc(title)}</div><div class="q-s">${P.queue.length} canciones${P.shuffle ? ' · aleatorio' : ''}</div></div>
      <button class="q-edit" data-a="edit" aria-label="Editar">${I.pencil}</button>
    </div>`
    + P.queue.map((id, i) => {
      const t = lib.byId.get(id);
      return t ? `<div class="q-row${i === P.index ? ' cur' : ''}" data-q="${i}"><span class="n">${i === P.index ? I.speaker : i + 1}</span><div class="x"><div>${esc(t.title)}</div><div class="a">${esc(t.artist)}</div></div></div>` : '';
    }).join('');
  contextCover(200).then((url) => {
    const cov = q.querySelector('.q-cover');
    if (url && cov) { cov.innerHTML = ''; cov.style.backgroundImage = `url("${url}")`; }
  });
  const cur = q.querySelector('.cur');
  if (cur) requestAnimationFrame(() => { q.scrollTop = cur.offsetTop - q.clientHeight / 2 + cur.offsetHeight / 2; });
}

async function editFromNow() {
  if (!P.track) return;
  const c = P.context, opts = [{ label: 'Editar canción…', value: 'song' }];
  if (c?.type === 'album' || (!c && P.track)) opts.push({ label: 'Editar álbum…', value: 'album' });
  if (c?.type === 'playlist') opts.push({ label: 'Editar lista…', value: 'playlist' });
  const v = await actionSheet(P.track.title, opts);
  if (v === 'song') editSong(P.track.id);
  else if (v === 'album') {
    const [artist, name] = c?.type === 'album' ? c.key.split('\u0001') : ['', P.track.album];
    editAlbum(name, artist || undefined);
  } else if (v === 'playlist') {
    const p = playlists.find((x) => x.id === c.key);
    if (p) editPlaylist(p);
  }
}

$('#npBack').onclick = () => closeNow();
$('#navNow').onclick = openNow;
$('#npPlay').onclick = () => PL.toggle();
$('#npPrev').onclick = () => PL.prev();
$('#npNext').onclick = () => PL.next();
npArt.onclick = () => { const s = $('#npScrub'); s.hidden = !s.hidden; };
$('#npFlip').onclick = () => {
  now.classList.toggle('show-q');
  syncNow();
};
$('#npQueue').addEventListener('click', (e) => {
  if (e.target.closest('[data-a="edit"]')) { editFromNow(); return; }
  const r = e.target.closest('[data-q]');
  if (r) PL.jump(+r.dataset.q);
});
npArt.addEventListener('contextmenu', (e) => { e.preventDefault(); if (P.track) songOptions(P.track.id); });

// horizontal: portada a la izquierda, lista a la derecha
const landMQ = matchMedia('(orientation: landscape) and (max-height: 600px), (orientation: landscape) and (min-width: 700px)');
function syncLand() {
  now.classList.toggle('land', landMQ.matches);
  if (now.classList.contains('open') && queueVisible()) renderQueue();
}
landMQ.addEventListener('change', syncLand);
syncLand();
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
  if (type === 'queue' && queueVisible()) renderQueue();
  syncNow();
  updateNav();
  if (type === 'track' && top()?.live) refresh();
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
