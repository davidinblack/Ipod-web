# iPod Web — reproductor estilo iPod 1.ª generación

App web instalable (PWA) que funciona como un iPod clásico en Android: LCD monocromo,
rueda táctil con MENU / ⏮ / ⏭ / ▶❚❚ y botón central, y portadas de las canciones.

```
ipod/
├── web/                 ← la app (HTML/CSS/JS, sin dependencias ni compilación)
│   ├── index.html  styles.css  app.js
│   ├── player.js        reproducción, cola, Media Session
│   ├── library.js       carpeta local, almacenamiento privado, metadatos
│   ├── id3.js           lector de etiquetas ID3 y portadas
│   ├── db.js            IndexedDB
│   ├── sw.js            service worker (actualización automática)
│   ├── manifest.webmanifest   instalación + "Compartir" desde YouTube
│   └── version.json     súbelo de versión al publicar cambios
└── server/
    ├── server.py        sirve web/ y convierte enlaces de YouTube a MP3
    └── requirements.txt
```

## Cómo cumple cada requisito

| Requisito | Cómo se resuelve |
|---|---|
| Basada en HTML, envolvible después en una app Android | Toda la app es `web/`. Se instala como PWA hoy y mañana se empaqueta con TWA o Capacitor apuntando a la misma URL. |
| Actualizar sin descargar el HTML | El service worker pide siempre los archivos a la red (caché sólo sin conexión) y el servidor manda `Cache-Control: no-cache`. Publicas cambios y el teléfono los recibe al abrir la app. Si la app estaba abierta, `version.json` hace aparecer **Actualizar app** en el menú principal. |
| Leer archivos de un directorio local | **Biblioteca › Elegir carpeta…** usa File System Access; la carpeta se recuerda y se recorre con subcarpetas. Si tu Chrome no ofrece el selector de carpetas, **Agregar archivos…** copia las canciones al almacenamiento privado de la app. |
| Descargar desde YouTube | **YouTube › Descargar canción…** o **Compartir › iPod** desde la app de YouTube. El servidor usa yt-dlp + ffmpeg y entrega un MP3 con título, artista y la miniatura recortada en cuadrado como portada. Se guarda en `TuCarpeta/YouTube/` (o en el almacenamiento de la app). |
| Música con la pantalla apagada | Un único `<audio>` + Media Session: Chrome mantiene la reproducción en segundo plano y avanza de canción sola. |
| Listas de reproducción | **Listas › Nueva lista…**. Mantén presionado ● sobre una canción, álbum o artista → **Añadir a lista…** |
| Controles con la pantalla bloqueada | Media Session publica título, artista, álbum y portada; Android muestra la tarjeta con anterior / pausa / siguiente y barra de posición. |
| Audífonos | Los botones del audífono pasan por Media Session: 1 toque pausa/reanuda, 2 toques siguiente, 3 toques anterior (según el audífono). |

## Controles

| Gesto | Menús | Reproduciendo |
|---|---|---|
| Girar la rueda | Mover selección (rápido = salta de 3 en 3) | Volumen |
| ● toque | Elegir | Modo búsqueda (la rueda adelanta/atrasa) |
| ● mantener | Opciones: reproducir siguiente, añadir a lista, quitar, eliminar archivo | Opciones de la canción actual |
| MENU | Volver | Volver |
| MENU mantener | Ir al menú principal | |
| ⏮ / ⏭ toque | Canción anterior / siguiente | |
| ⏮ / ⏭ mantener | Retroceder / adelantar dentro de la canción | |
| ▶❚❚ | Reproducir / pausa | |

También puedes tocar directamente las filas del LCD. En la computadora: flechas, Enter, Esc, espacio y **h** (mantener).

Las portadas salen de la etiqueta ID3 del MP3, o de un `cover.jpg` / `folder.jpg` en la misma carpeta (útil para M4A/FLAC).

## Puesta en marcha

### Opción A — todo en el teléfono con Termux (sin computadora)

```bash
pkg install python ffmpeg git
pip install -U yt-dlp
git clone <tu-repo> ipod && cd ipod/server
python server.py
```

Abre **http://localhost:8787** en Chrome → menú ⋮ → **Instalar app**.
`localhost` cuenta como sitio seguro, así que funcionan el service worker y la carpeta local.

### Opción B — app publicada en internet + servidor de descargas aparte (recomendada para actualizar sin tocar el teléfono)

1. Publica `web/` en cualquier hosting HTTPS estático (GitHub Pages, Netlify, Cloudflare Pages).
2. Corre `server/server.py` en tu PC, un VPS o Termux.
   Si es accesible desde internet, ponle clave: `IPOD_TOKEN=algo-largo python server.py`
   y sírvelo con HTTPS (Caddy o Cloudflare Tunnel), porque una página HTTPS no puede llamar a `http://` salvo `localhost`.
3. En la app: **Ajustes › Servidor YouTube › Dirección** y **Clave** → **Probar conexión**.

Para publicar una actualización: sube los archivos nuevos y cambia `version.json`. Nada más.

## Siguiente paso: app Android

- **TWA (recomendado):** con [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) o PWABuilder generas un APK que abre tu URL en Chrome a pantalla completa. Sigue cargando el HTML desde la red, así que las actualizaciones siguen llegando solas, y conserva Media Session, carpeta local y "Compartir".
- **Capacitor:** usa `server.url` con tu dominio para la misma idea. Te conviene si más adelante quieres plugins nativos (por ejemplo, leer toda la música del teléfono con MediaStore o un servicio en primer plano propio).

## Notas

- El selector de carpetas (File System Access) depende de la versión de Chrome en Android; la app lo detecta y, si no está, usa **Agregar archivos…**. Chrome puede volver a pedir permiso de la carpeta al reabrir la app: aparece **Permitir «Carpeta»** arriba del menú.
- Algunos fabricantes (Xiaomi, Huawei, Samsung con ahorro agresivo) cierran apps en segundo plano: excluye Chrome / la app de la optimización de batería si la música se corta.
- Descarga sólo contenido que tengas derecho a guardar; los términos de YouTube restringen la descarga de videos ajenos.
