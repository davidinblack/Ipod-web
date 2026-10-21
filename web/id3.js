// id3.js — lector ligero de etiquetas ID3v2.2 / 2.3 / 2.4 (+ ID3v1) con portada (APIC/PIC)

const TEXT = {
  TIT2: 'title', TT2: 'title',
  TPE1: 'artist', TP1: 'artist',
  TPE2: 'albumArtist', TP2: 'albumArtist',
  TALB: 'album', TAL: 'album',
  TRCK: 'track', TRK: 'track',
};

const YT_URL = /https?:\/\/(?:[\w-]+\.)?(?:youtube\.com|youtu\.be)\/[^\s"'<>\u0000]+/i;
export const isYouTube = (u) => YT_URL.test(String(u || ''));

const syncsafe = (b, o) => ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
const u32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

function unsync(b) {
  const out = new Uint8Array(b.length);
  let j = 0;
  for (let i = 0; i < b.length; i++) {
    out[j++] = b[i];
    if (b[i] === 0xff && b[i + 1] === 0x00) i++;
  }
  return out.subarray(0, j);
}

function decode(bytes, enc) {
  let label = 'windows-1252';
  if (enc === 3) label = 'utf-8';
  else if (enc === 2) label = 'utf-16be';
  else if (enc === 1) {
    if (bytes[0] === 0xfe && bytes[1] === 0xff) { label = 'utf-16be'; bytes = bytes.subarray(2); }
    else if (bytes[0] === 0xff && bytes[1] === 0xfe) { label = 'utf-16le'; bytes = bytes.subarray(2); }
    else label = 'utf-16le';
  }
  try {
    return new TextDecoder(label).decode(bytes).split('\0')[0].trim();
  } catch { return ''; }
}

// decodifica todo el marco (descripción + valor), con los separadores como espacios
function decodeAll(bytes, enc) {
  const label = enc === 3 ? 'utf-8' : enc === 2 ? 'utf-16be' : enc === 1 ? 'utf-16le' : 'windows-1252';
  try { return new TextDecoder(label).decode(bytes).replace(/[\u0000\ufeff\ufffe]/g, ' '); } catch { return ''; }
}

// posición justo después del terminador de cadena según la codificación
function afterTerminator(b, p, enc) {
  if (enc === 1 || enc === 2) {
    for (; p + 1 < b.length; p += 2) if (b[p] === 0 && b[p + 1] === 0) return p + 2;
    return b.length;
  }
  const i = b.indexOf(0, p);
  return i < 0 ? b.length : i + 1;
}

function parsePicture(d, ver) {
  const enc = d[0];
  let p, mime;
  if (ver === 2) {
    const fmt = String.fromCharCode(d[1], d[2], d[3]).toLowerCase();
    mime = fmt === 'png' ? 'image/png' : 'image/jpeg';
    p = 4;
  } else {
    const e = d.indexOf(0, 1);
    mime = new TextDecoder('windows-1252').decode(d.subarray(1, e)).toLowerCase() || 'image/jpeg';
    if (!mime.includes('/')) mime = 'image/' + mime;
    if (mime === 'image/jpg') mime = 'image/jpeg';
    p = e + 1;
  }
  const type = d[p++];
  p = afterTerminator(d, p, enc);
  return { type, mime, data: d.slice(p) };
}

function parseFrames(buf, ver, flags, out, wantPicture) {
  let pos = 0;
  if (flags & 0x40) pos = ver === 3 ? u32(buf, 0) + 4 : ver === 4 ? syncsafe(buf, 0) : 0;
  const idLen = ver === 2 ? 3 : 4;
  const hdr = ver === 2 ? 6 : 10;

  while (pos + hdr <= buf.length) {
    const id = String.fromCharCode(...buf.subarray(pos, pos + idLen));
    if (!/^[A-Z0-9]{3,4}$/.test(id)) break; // relleno o fin
    const size = ver === 2 ? (buf[pos + 3] << 16) | (buf[pos + 4] << 8) | buf[pos + 5]
      : ver === 4 ? syncsafe(buf, pos + 4) : u32(buf, pos + 4);
    const fflags = ver === 2 ? 0 : (buf[pos + 8] << 8) | buf[pos + 9];
    const start = pos + hdr, end = start + size;
    if (size <= 0 || end > buf.length) break;
    pos = end;

    let d = buf.subarray(start, end);
    if (ver === 4) {
      if (fflags & 0x000c) continue;           // comprimido / cifrado
      if (fflags & 0x0001) d = d.subarray(4);  // indicador de longitud
      if (fflags & 0x0002) d = unsync(d);
    } else if (ver === 3 && (fflags & 0x00c0)) continue;

    if (TEXT[id]) {
      if (!out[TEXT[id]]) out[TEXT[id]] = decode(d.subarray(1), d[0]);
    } else if (!out.source && (id === 'WOAS' || id === 'WOAF' || id === 'WXXX' || id === 'COMM' || id === 'TXXX' || id === 'WAS' || id === 'COM' || id === 'TXX' || id === 'WXX')) {
      // enlace de origen (YouTube): lo escriben esta app (WOAS) o yt-dlp/ffmpeg (comentario / purl)
      const txt = (id[0] === 'W' && id !== 'WXXX' && id !== 'WXX') ? decode(d, 0) : decodeAll(d.subarray(1), d[0]);
      const m = txt.match(YT_URL);
      if (m) out.source = m[0];
    } else if (id === 'APIC' || id === 'PIC') {
      out.hasPicture = true;
      if (wantPicture) {
        const pic = parsePicture(d, ver);
        if (!out.picture || (pic.type === 3 && out.picture.type !== 3)) out.picture = pic;
      }
    }
  }
}

async function readV1(file, out) {
  if (file.size < 128) return;
  const b = new Uint8Array(await file.slice(file.size - 128).arrayBuffer());
  if (b[0] !== 0x54 || b[1] !== 0x41 || b[2] !== 0x47) return; // "TAG"
  const s = (a, z) => new TextDecoder('windows-1252').decode(b.subarray(a, z)).replace(/\0.*$/, '').trim();
  out.title ||= s(3, 33);
  out.artist ||= s(33, 63);
  out.album ||= s(63, 93);
}

/**
 * Lee etiquetas del archivo.
 * picture=false sólo detecta si hay portada (rápido, para el escaneo).
 */
export async function readTags(file, { picture = false } = {}) {
  const out = {};
  try {
    const h = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    if (h[0] === 0x49 && h[1] === 0x44 && h[2] === 0x33) { // "ID3"
      const ver = h[3], flags = h[5];
      const size = syncsafe(h, 6);
      const limit = picture ? size : Math.min(size, 384 * 1024);
      let buf = new Uint8Array(await file.slice(10, 10 + limit).arrayBuffer());
      if ((flags & 0x80) && ver < 4) buf = unsync(buf);
      parseFrames(buf, ver, flags, out, picture);
      // si cortamos el tag antes de ver una portada, asumimos que puede haberla
      if (!picture && size > limit && !out.hasPicture) out.hasPicture = true;
    }
    if (!out.title || !out.artist) await readV1(file, out);
  } catch (e) {
    console.warn('ID3', file.name, e);
  }
  return out;
}

/** "01 - Artista - Título.mp3" → { artist, title } */
export function guessFromName(name) {
  const base = name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').replace(/^\d{1,3}[\s.\-]+/, '').trim();
  const i = base.indexOf(' - ');
  return i > 0 ? { artist: base.slice(0, i).trim(), title: base.slice(i + 3).trim() } : { title: base };
}

// ---------------------------------------------------------------- escritura (ID3v2.3)

const REPLACED = new Set(['TIT2', 'TPE1', 'TALB', 'TRCK', 'TT2', 'TP1', 'TAL', 'TRK', 'APIC', 'PIC', 'WOAS']);

function frame(id, data) {
  const f = new Uint8Array(10 + data.length);
  f.set([...id].map((c) => c.charCodeAt(0)), 0);
  const n = data.length;
  f.set([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255], 4);
  f.set(data, 10);
  return f;
}

function textFrame(id, text) {
  // codificación 1 (UTF-16 con BOM) para acentos y ñ
  const s = String(text);
  const d = new Uint8Array(3 + s.length * 2 + 2);
  d[0] = 1; d[1] = 0xff; d[2] = 0xfe;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); d[3 + i * 2] = c & 255; d[4 + i * 2] = c >> 8; }
  return frame(id, d);
}

function pictureFrame({ mime = 'image/jpeg', data }) {
  const m = new TextEncoder().encode(mime);
  const d = new Uint8Array(1 + m.length + 1 + 1 + 1 + data.length);
  let p = 0;
  d[p++] = 0;               // latin-1
  d.set(m, p); p += m.length;
  d[p++] = 0;
  d[p++] = 3;               // portada (frente)
  d[p++] = 0;               // descripción vacía
  d.set(data, p);
  return frame('APIC', d);
}

/**
 * Devuelve un Blob con el MP3 y una etiqueta ID3v2.3 nueva.
 * values: { title, artist, album, track, picture }
 *   picture: undefined = conservar la actual · null = quitarla · { mime, data:Uint8Array } = reemplazar
 * Se conservan los demás marcos (comentarios, año, letra…) cuando la etiqueta original es v2.3.
 */
export async function writeTags(file, values) {
  const old = await readTags(file, { picture: values.picture === undefined });
  const merged = {
    title: values.title ?? old.title, artist: values.artist ?? old.artist,
    album: values.album ?? old.album, track: values.track ?? old.track,
    source: values.source ?? old.source,
  };
  let audioStart = 0;
  const keep = [];
  const h = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (h[0] === 0x49 && h[1] === 0x44 && h[2] === 0x33) {
    const ver = h[3], flags = h[5], size = syncsafe(h, 6);
    audioStart = 10 + size + ((flags & 0x10) ? 10 : 0);
    if (ver === 3 && !(flags & 0x80) && !(flags & 0x40)) {
      const buf = new Uint8Array(await file.slice(10, 10 + size).arrayBuffer());
      let pos = 0;
      while (pos + 10 <= buf.length) {
        const id = String.fromCharCode(...buf.subarray(pos, pos + 4));
        if (!/^[A-Z0-9]{4}$/.test(id)) break;
        const n = u32(buf, pos + 4);
        if (n <= 0 || pos + 10 + n > buf.length) break;
        if (!REPLACED.has(id)) keep.push(buf.slice(pos, pos + 10 + n));
        pos += 10 + n;
      }
    }
  }
  // algunos archivos traen relleno o basura antes del primer cuadro MPEG; se respeta tal cual

  const frames = [];
  if (merged.title) frames.push(textFrame('TIT2', merged.title));
  if (merged.artist) frames.push(textFrame('TPE1', merged.artist));
  if (merged.album) frames.push(textFrame('TALB', merged.album));
  if (merged.track) frames.push(textFrame('TRCK', merged.track));
  if (merged.source) frames.push(frame('WOAS', new TextEncoder().encode(merged.source.replace(/[^\x20-\x7e]/g, ''))));
  frames.push(...keep);
  const pic = values.picture === undefined ? old.picture : values.picture;
  if (pic?.data?.length) frames.push(pictureFrame(pic));

  const padding = 512;
  const body = frames.reduce((n, f) => n + f.length, 0) + padding;
  const tag = new Uint8Array(10 + body);
  tag.set([0x49, 0x44, 0x33, 3, 0, 0, (body >>> 21) & 127, (body >>> 14) & 127, (body >>> 7) & 127, body & 127]);
  let p = 10;
  for (const f of frames) { tag.set(f, p); p += f.length; }
  return new Blob([tag, file.slice(audioStart)], { type: 'audio/mpeg' });
}
