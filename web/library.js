// library.js — biblioteca: carpeta local (File System Access), almacenamiento privado (OPFS) y metadatos

import { readTags, guessFromName, writeTags } from './id3.js';
export { isYouTube } from './id3.js';
import * as db from './db.js';

const AUDIO_RE = /\.(mp3|m4a|mp4|aac|ogg|oga|opus|flac|wav|weba|webm)$/i;
const COVER_RE = /^(cover|folder|front|album|albumart|artwork)\.(jpe?g|png|webp)$/i;

export const lib = {
  tracks: [],          // [{id,title,artist,album,track,hasPic,folder,name,src}]
  byId: new Map(),
  dir: null,           // FileSystemDirectoryHandle elegido por el usuario
  dirState: 'none',    // none | granted | prompt
  writable: false,
};

export const canPickDir = typeof window.showDirectoryPicker === 'function';
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
export const cmp = (a, b) => collator.compare(a || '', b || '');

const fileHandles = new Map();   // id -> FileSystemFileHandle
const parents = new Map();       // id -> carpeta contenedora
const folderCovers = new Map();  // "src:ruta/" -> handle de cover.jpg
const coverCache = new Map();    // id -> Blob|null
let overrides = {};              // id -> {title, artist, album} para archivos que no son MP3

// ---------- carpeta del usuario

export async function initLibrary() {
  try { lib.dir = (await db.kvGet('dirHandle')) || null; } catch { lib.dir = null; }
  await refreshDirState();
}

async function refreshDirState() {
  if (!lib.dir) { lib.dirState = 'none'; lib.writable = false; return; }
  const q = (mode) => lib.dir.queryPermission({ mode }).catch(() => 'denied');
  const rw = await q('readwrite');
  const r = rw === 'granted' ? rw : await q('read');
  lib.writable = rw === 'granted';
  lib.dirState = r === 'granted' ? 'granted' : 'prompt';
}

export async function requestDirAccess() {
  if (!lib.dir) return false;
  let p = await lib.dir.requestPermission({ mode: 'readwrite' }).catch(() => 'denied');
  if (p !== 'granted') p = await lib.dir.requestPermission({ mode: 'read' }).catch(() => 'denied');
  await refreshDirState();
  return lib.dirState === 'granted';
}

export async function pickDirectory() {
  let h;
  try { h = await window.showDirectoryPicker({ id: 'ipod-music', mode: 'readwrite', startIn: 'music' }); }
  catch (e) {
    if (e.name === 'AbortError') throw e;
    h = await window.showDirectoryPicker({ mode: 'read' });
  }
  lib.dir = h;
  await db.kvSet('dirHandle', h);
  await refreshDirState();
  return h;
}

// ---------- almacenamiento privado de la app (descargas y archivos importados)

async function opfsMusic() {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle('music', { create: true });
}

export const safeName = (n) => n.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 160) || 'audio.mp3';

async function writeFile(dir, name, blob) {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
  return fh;
}

/** Copia archivos elegidos con <input type=file> al almacenamiento de la app. */
export async function importFiles(files, onProgress) {
  const dir = await opfsMusic();
  const list = [...files].filter((f) => AUDIO_RE.test(f.name));
  for (let i = 0; i < list.length; i++) {
    await writeFile(dir, safeName(list[i].name), list[i]);
    onProgress?.(i + 1, list.length);
  }
  return list.length;
}

// ---------- escaneo

async function walk(dir, prefix, src, out, depth = 0) {
  for await (const [name, h] of dir.entries()) {
    if (name.startsWith('.')) continue;
    if (h.kind === 'directory') {
      if (depth < 10) await walk(h, `${prefix}${name}/`, src, out, depth + 1);
    } else if (AUDIO_RE.test(name)) {
      out.push({ id: `${src}:${prefix}${name}`, name, src, folder: `${src}:${prefix}`, handle: h, parent: dir });
    } else if (COVER_RE.test(name)) {
      const k = `${src}:${prefix}`;
      if (!folderCovers.has(k) || /^(cover|folder)/i.test(name)) folderCovers.set(k, h);
    }
  }
}

function makeMeta(id, file, tags, name) {
  const g = guessFromName(name);
  return {
    id, size: file.size, mtime: file.lastModified,
    title: tags.title || g.title || name,
    artist: tags.artist || tags.albumArtist || g.artist || 'Artista desconocido',
    album: tags.album || 'Álbum desconocido',
    track: parseInt(tags.track, 10) || 0,
    hasPic: !!tags.hasPicture,
    source: tags.source || '',
    v: 2,
  };
}

function setTracks(tracks) {
  tracks.sort((a, b) => cmp(a.title, b.title));
  lib.tracks = tracks;
  lib.byId = new Map(tracks.map((t) => [t.id, t]));
}

export async function scanLibrary(onProgress) {
  folderCovers.clear(); fileHandles.clear(); parents.clear(); coverCache.clear();
  await refreshDirState();
  const found = [];
  if (lib.dir && lib.dirState === 'granted') {
    try { await walk(lib.dir, '', 'dir', found); } catch (e) { console.warn('carpeta', e); }
  }
  try { await walk(await opfsMusic(), '', 'opfs', found); } catch (e) { console.warn('opfs', e); }

  const cache = new Map((await db.metaAll().catch(() => [])).map((m) => [m.id, m]));
  overrides = (await db.kvGet('overrides').catch(() => null)) || {};
  const tracks = [], dirty = [];
  for (let i = 0; i < found.length; i++) {
    const f = found[i];
    try {
      const file = await f.handle.getFile();
      let m = cache.get(f.id);
      if (!m || m.v !== 2 || m.size !== file.size || m.mtime !== file.lastModified) {
        m = makeMeta(f.id, file, await readTags(file), f.name);
        dirty.push(m);
      }
      fileHandles.set(f.id, f.handle);
      parents.set(f.id, f.parent);
      tracks.push({ ...m, ...(overrides[f.id] || {}), folder: f.folder, name: f.name, src: f.src });
    } catch (e) { console.warn('omitido', f.id, e); }
    if (i % 8 === 0 || i === found.length - 1) onProgress?.(i + 1, found.length);
  }
  if (dirty.length) await db.metaPutMany(dirty).catch(() => {});
  setTracks(tracks);
  return tracks.length;
}

// ---------- acceso

export async function getFile(id) {
  const h = fileHandles.get(id);
  if (!h) throw new Error('Archivo no disponible');
  return h.getFile();
}

export async function getCoverBlob(t) {
  if (coverCache.has(t.id)) return coverCache.get(t.id);
  let blob = null;
  try {
    blob = (await db.kvGet(`cover:${t.id}`).catch(() => null)) || null;
    if (!blob && t.hasPic) {
      const tags = await readTags(await getFile(t.id), { picture: true });
      if (tags.picture?.data?.length) blob = new Blob([tags.picture.data], { type: tags.picture.mime });
    }
    if (!blob) {
      const h = folderCovers.get(t.folder);
      if (h) blob = await h.getFile();
    }
  } catch (e) { console.warn('portada', e); }
  coverCache.set(t.id, blob);
  if (coverCache.size > 40) coverCache.delete(coverCache.keys().next().value);
  return blob;
}

// ---------- agrupaciones

export function artists() {
  const m = new Map();
  for (const t of lib.tracks) {
    if (!m.has(t.artist)) m.set(t.artist, []);
    m.get(t.artist).push(t.id);
  }
  return [...m].sort((a, b) => cmp(a[0], b[0]));
}

export function albums(artist) {
  const m = new Map();
  for (const t of lib.tracks) {
    if (artist && t.artist !== artist) continue;
    if (!m.has(t.album)) m.set(t.album, []);
    m.get(t.album).push(t);
  }
  return [...m]
    .map(([name, ts]) => [name, ts.sort((a, b) => (a.track - b.track) || cmp(a.title, b.title)).map((t) => t.id)])
    .sort((a, b) => cmp(a[0], b[0]));
}

// ---------- descargas y borrado

export async function saveDownload(blob, filename) {
  const name = safeName(filename);
  let dir = null, src = 'opfs', prefix = '';
  if (lib.dir && lib.writable) {
    try { dir = await lib.dir.getDirectoryHandle('YouTube', { create: true }); src = 'dir'; prefix = 'YouTube/'; }
    catch { dir = null; }
  }
  if (!dir) { dir = await opfsMusic(); src = 'opfs'; prefix = ''; }
  const fh = await writeFile(dir, name, blob);
  const file = await fh.getFile();
  const id = `${src}:${prefix}${name}`;
  const m = makeMeta(id, file, await readTags(file), name);
  await db.metaPutMany([m]).catch(() => {});
  fileHandles.set(id, fh);
  parents.set(id, dir);
  coverCache.delete(id);
  setTracks([...lib.tracks.filter((t) => t.id !== id), { ...m, folder: `${src}:${prefix}`, name, src }]);
  return lib.byId.get(id);
}

export const canDelete = (t) => t && (t.src === 'opfs' || lib.writable);

export async function deleteTrack(id) {
  const t = lib.byId.get(id);
  const parent = parents.get(id);
  if (!t || !parent) throw new Error('No se puede borrar');
  await parent.removeEntry(t.name);
  await db.metaDel(id).catch(() => {});
  fileHandles.delete(id); parents.delete(id); coverCache.delete(id);
  setTracks(lib.tracks.filter((x) => x.id !== id));
}

// ---------- edición (nombre de archivo, etiquetas y portada)

export const isMp3 = (t) => /\.mp3$/i.test(t?.name || '');
const extOf = (n) => (n.match(/\.[^.]+$/) || [''])[0];
export const baseName = (t) => t.name.replace(/\.[^.]+$/, '');

/** Portada guardada aparte (para M4A/FLAC… o miniaturas descargadas). blob=null la quita. */
export async function setCoverOverride(id, blob) {
  if (blob) await db.kvSet(`cover:${id}`, blob); else await db.kvDel(`cover:${id}`);
  coverCache.delete(id);
}

async function exists(dir, name) {
  try { await dir.getFileHandle(name); return true; } catch { return false; }
}

/**
 * Cambia título/artista/álbum, nombre de archivo y portada.
 * En MP3 todo se escribe dentro del archivo (ID3); en otros formatos se guarda aparte.
 * changes: { title, artist, album, filename (sin extensión), picture (undefined | null | {mime,data}) }
 * Devuelve { oldId, newId, track }.
 */
export async function editTrack(id, changes, { picBlob } = {}) {
  const t = lib.byId.get(id);
  const parent = parents.get(id), handle = fileHandles.get(id);
  if (!t || !parent || !handle) throw new Error('Archivo no disponible');
  if (!canDelete(t)) throw new Error('La carpeta no permite escribir. Vuelve a elegirla en Más.');

  const newName = changes.filename ? safeName(changes.filename.replace(/\.[^.]+$/, '') + extOf(t.name)) : t.name;
  const renamed = newName !== t.name;
  if (renamed && await exists(parent, newName)) throw new Error('Ya existe un archivo con ese nombre');

  const tagChanged = ['title', 'artist', 'album', 'source'].some((k) => changes[k] != null && changes[k] !== t[k]);
  const prefix = t.id.slice(t.src.length + 1, t.id.length - t.name.length);
  const newId = `${t.src}:${prefix}${newName}`;
  const file = await handle.getFile();
  let newHandle;

  if (isMp3(t) && (tagChanged || changes.picture !== undefined)) {
    const blob = await writeTags(file, changes);
    newHandle = await parent.getFileHandle(newName, { create: true });
    const w = await newHandle.createWritable();
    await w.write(blob);
    await w.close();
    if (renamed) await parent.removeEntry(t.name);
  } else if (renamed) {
    try {
      if (typeof handle.move !== 'function') throw new Error('sin move');
      await handle.move(newName);
      newHandle = await parent.getFileHandle(newName);
    } catch {
      newHandle = await parent.getFileHandle(newName, { create: true });
      const w = await newHandle.createWritable();
      await w.write(file);
      await w.close();
      await parent.removeEntry(t.name);
    }
  } else newHandle = handle;

  // datos guardados aparte (formatos sin ID3, portadas personalizadas)
  const ovr = { ...(overrides[id] || {}) };
  if (!isMp3(t)) for (const k of ['title', 'artist', 'album', 'source']) if (changes[k] != null) ovr[k] = changes[k];
  delete overrides[id];
  if (Object.keys(ovr).length) overrides[newId] = ovr;
  await db.kvSet('overrides', overrides).catch(() => {});
  const oldCover = await db.kvGet(`cover:${id}`).catch(() => null);
  if (renamed) await db.kvDel(`cover:${id}`).catch(() => {});
  if (!isMp3(t) && changes.picture !== undefined) await setCoverOverride(newId, picBlob || null);
  else if (isMp3(t) && changes.picture !== undefined) await setCoverOverride(newId, null);
  else if (renamed && oldCover) await db.kvSet(`cover:${newId}`, oldCover);

  const nf = await newHandle.getFile();
  const m = { ...makeMeta(newId, nf, await readTags(nf), newName), ...ovr };
  if (!isMp3(t) && oldCover && changes.picture === undefined) m.hasPic = t.hasPic;
  await db.metaDel(id).catch(() => {});
  await db.metaPutMany([m]).catch(() => {});
  fileHandles.delete(id); parents.delete(id); coverCache.delete(id); coverCache.delete(newId);
  fileHandles.set(newId, newHandle); parents.set(newId, parent);
  const track = { ...m, folder: t.folder, name: newName, src: t.src };
  setTracks([...lib.tracks.filter((x) => x.id !== id), track]);
  return { oldId: id, newId, track };
}
