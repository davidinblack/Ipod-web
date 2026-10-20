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
│   └── version.json     lo sella el workflow al publicar
├── .github/
│   ├── workflows/pages.yml     publica web/ en GitHub Pages
│   ├── workflows/youtube.yml   YouTube → MP3
│   └── scripts/yt_action.py
└── server/
    ├── server.py        sirve web/ y convierte enlaces de YouTube a MP3
    └── requirements.txt
```

## Cómo cumple cada requisito

| Requisito | Cómo se resuelve |
|---|---|
| Basada en HTML, envolvible después en una app Android | Toda la app es `web/`. Se instala como PWA hoy y mañana se empaqueta con TWA o Capacitor apuntando a la misma URL. |
| Actualizar sin descargar el HTML | El service worker pide siempre los archivos a la red (caché sólo sin conexión) y GitHub Pages / el servidor no lo cachean. Publicas cambios y el teléfono los recibe al abrir la app. Si la app estaba abierta, `version.json` hace aparecer **Actualizar app** en el menú principal. |
| Leer archivos de un directorio local | **Biblioteca › Elegir carpeta…** usa File System Access; la carpeta se recuerda y se recorre con subcarpetas. Si tu Chrome no ofrece el selector de carpetas, **Agregar archivos…** copia las canciones al almacenamiento privado de la app. |
| Descargar desde YouTube | **YouTube › Descargar canción…** o **Compartir › iPod** desde la app de YouTube. GitHub Actions (o tu servidor) usa yt-dlp + ffmpeg y entrega un MP3 con título, artista y la miniatura recortada en cuadrado como portada. Se guarda en `TuCarpeta/YouTube/` (o en el almacenamiento de la app). |
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

## Puesta en marcha (sin instalar nada)

La app vive en GitHub Pages y las descargas de YouTube las hace GitHub Actions.

### 1. Activar GitHub Pages (una sola vez)

Repositorio → **Settings › Pages › Build and deployment › Source: GitHub Actions**.
Luego **Actions › Publicar app › Run workflow** (o cualquier push que toque `web/`).
La app queda en **https://davidinblack.github.io/Ipod-web/** → ábrela en Chrome → ⋮ › **Instalar app**.

Cada push a `web/` vuelve a publicar y sella `version.json` solo; si la app estaba abierta aparece **Actualizar app**.

### 2. Token para las descargas (una sola vez)

1. github.com › Settings › Developer settings › **Fine-grained tokens › Generate new token**.
2. *Repository access*: **Only select repositories** → `Ipod-web`.
3. *Permissions*: **Actions: Read and write** y **Contents: Read and write**.
4. En la app: **Ajustes › Descargas YouTube** → Método **GitHub**, Repositorio `davidinblack/Ipod-web`,
   **Token** (pégalo) → **Probar conexión**.

El token se guarda sólo en ese teléfono y sólo da acceso a este repositorio; si lo pierdes, revócalo.

### Cómo funciona una descarga

1. La app lanza el workflow **Descargar de YouTube** con el enlace.
2. GitHub instala yt-dlp + ffmpeg, convierte a MP3 (160 kbps, máx. 70 min) con título, artista y portada,
   y lo deja en la rama `descargas`.
3. La app lo baja, lo guarda en tu carpeta (`YouTube/`) y lo borra de la rama. La rama se reescribe en un
   solo commit y se limpia sola a las 24 h, para no acumular música en el repositorio público.

Tarda 1–2 minutos por canción. También se puede lanzar a mano: **Actions › Descargar de YouTube › Run workflow**.

### Si YouTube bloquea a GitHub ("Sign in to confirm you're not a bot")

Exporta tus cookies de youtube.com en formato `cookies.txt` (con una extensión tipo *Get cookies.txt LOCALLY*;
mejor de una cuenta secundaria) y guárdalas en **Settings › Secrets and variables › Actions ›
New repository secret** con el nombre `YT_COOKIES`. Los secretos no aparecen en los registros.

### Alternativa: servidor propio

`server/server.py` sigue funcionando (Termux, PC o VPS). En la app elige Método **Servidor**.

```bash
pip install -U "yt-dlp[default]"      # además: ffmpeg y deno
python server/server.py               # http://localhost:8787
```

## Siguiente paso: app Android

- **TWA (recomendado):** con [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) o PWABuilder generas un APK que abre tu URL en Chrome a pantalla completa. Sigue cargando el HTML desde la red, así que las actualizaciones siguen llegando solas, y conserva Media Session, carpeta local y "Compartir".
- **Capacitor:** usa `server.url` con tu dominio para la misma idea. Te conviene si más adelante quieres plugins nativos (por ejemplo, leer toda la música del teléfono con MediaStore o un servicio en primer plano propio).

## Notas

- El selector de carpetas (File System Access) depende de la versión de Chrome en Android; la app lo detecta y, si no está, usa **Agregar archivos…**. Chrome puede volver a pedir permiso de la carpeta al reabrir la app: aparece **Permitir «Carpeta»** arriba del menú.
- Algunos fabricantes (Xiaomi, Huawei, Samsung con ahorro agresivo) cierran apps en segundo plano: excluye Chrome / la app de la optimización de batería si la música se corta.
- Descarga sólo contenido que tengas derecho a guardar; los términos de YouTube restringen la descarga de videos ajenos.
