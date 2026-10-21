# iPod Web — reproductor estilo iPod touch

App web instalable (PWA) para Android que imita la app «iPod» del iPod touch / iPhone original:
barra azul, pestañas negras (Listas, Artistas, Canciones, Álbumes, Más), listas con índice A–Z
y la pantalla «Ahora suena» con la portada grande y su reflejo.

> La versión anterior con rueda (iPod clásico) quedó guardada en la rama `clickwheel`.

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
| Actualizar sin descargar el HTML | El service worker pide siempre los archivos a la red (caché sólo sin conexión) y GitHub Pages / el servidor no lo cachean. Publicas cambios y el teléfono los recibe al abrir la app. Si la app estaba abierta, `version.json` hace que te ofrezca **Actualizar**. |
| Leer archivos de un directorio local | **Más › Elegir carpeta de música…** usa File System Access; la carpeta se recuerda y se recorre con subcarpetas. Si tu Chrome no ofrece el selector de carpetas, **Agregar archivos…** copia las canciones al almacenamiento privado de la app. |
| Descargar desde YouTube | **Más › Descargar canción…** o **Compartir › iPod** desde la app de YouTube. GitHub Actions (o tu servidor) usa yt-dlp + ffmpeg y entrega un MP3 con título, artista y la miniatura recortada en cuadrado como portada. Se guarda en `TuCarpeta/YouTube/` (o en el almacenamiento de la app). |
| Música con la pantalla apagada | Un único `<audio>` + Media Session: Chrome mantiene la reproducción en segundo plano y avanza de canción sola. |
| Listas de reproducción | **Listas › Nueva lista…**. Mantén presionada una canción, álbum o artista → **Añadir a una lista…** |
| Controles con la pantalla bloqueada | Media Session publica título, artista, álbum y portada; Android muestra la tarjeta con anterior / pausa / siguiente y barra de posición. |
| Audífonos | Los botones del audífono pasan por Media Session: 1 toque pausa/reanuda, 2 toques siguiente, 3 toques anterior (según el audífono). |

## Controles

| Dónde | Gesto | Qué hace |
|---|---|---|
| Listas | Tocar | Abrir / reproducir |
| Listas | Mantener presionado | Reproducir a continuación, añadir a lista, quitar, eliminar archivo |
| Listas | Arrastrar sobre el índice A–Z | Saltar a la letra |
| Barra de pestañas | Tocar la pestaña activa | Volver al inicio de esa pestaña |
| Ahora suena | Tocar la portada | Mostrar barra de posición, repetir y aleatorio |
| Ahora suena | Deslizar la portada ← / → | Siguiente / anterior |
| Ahora suena | Mantener presionada la portada | Opciones de la canción (editar, añadir a lista…) |
| Ahora suena | Botón de la esquina | Ver la lista que suena con su portada y la canción actual marcada; ✎ para editar |
| Álbum / lista | Reproducir · Mezclar · Editar | Editar cambia el nombre y la imagen (del álbum: se aplica a todas sus canciones) |
| Ahora suena | Botón ‹ o «atrás» de Android | Volver a las listas |

**Modo horizontal:** en «Ahora suena» y en las vistas de álbum o lista, la portada queda a la izquierda y las canciones a la derecha.

**Editar una canción** (mantener presionada › Editar canción…, o ✎ en «Ahora suena»): título, artista, álbum,
nombre del archivo e imagen. En MP3 los cambios se escriben dentro del archivo (etiquetas ID3), así que se ven
también en otros reproductores. En otros formatos el nombre del archivo cambia y el título/imagen se guardan en la app.
La imagen se recorta en cuadrado a 800 px.

En la computadora: espacio (pausa), ← / → (anterior / siguiente) y Esc (volver).

Las portadas salen de la etiqueta ID3 del MP3, o de un `cover.jpg` / `folder.jpg` en la misma carpeta (útil para M4A/FLAC).

## Compartir listas con la familia

1. Abre una lista o un álbum y toca **Compartir**. Se crea un archivo `Nombre.lista.txt` con el nombre, la imagen
   y, por cada canción, título, artista, álbum y **enlace de YouTube**. Mándalo por WhatsApp, Bluetooth, Quick Share o correo.
2. Quien lo recibe abre la app → **Listas › Cargar lista compartida…** y elige el archivo.
   - Las canciones que ya tiene se emparejan solas (por enlace, o por título y artista).
   - Las que faltan quedan como **Pendientes**; con **Bajar** se descargan de YouTube (dos a la vez) y se acomodan
     en su lugar dentro de la lista.
   - Si ya tenía una lista con ese nombre, puede actualizarla o crear otra.
3. Las canciones descargadas guardan su enlace dentro del MP3 (marco ID3 `WOAS`), así se pueden volver a compartir.
   Para canciones que no vinieron de YouTube, agrega el enlace en **Editar canción › YouTube**.

Para descargar, cada teléfono necesita las descargas configuradas (**Más › Configurar descargas**). Pueden usar todos
este mismo repositorio con un token propio cada quien, o el mismo token (sólo da acceso a este repositorio).

## Puesta en marcha (sin instalar nada)

La app vive en GitHub Pages y las descargas de YouTube las hace GitHub Actions.

### 1. Activar GitHub Pages (una sola vez)

Repositorio → **Settings › Pages › Build and deployment › Source: GitHub Actions**.
Luego **Actions › Publicar app › Run workflow** (o cualquier push que toque `web/`).
La app queda en **https://davidinblack.github.io/Ipod-web/** → ábrela en Chrome → ⋮ › **Instalar app**.

Cada push a `web/` vuelve a publicar y sella `version.json` solo; si la app estaba abierta te ofrece **Actualizar**.

### 2. Token para las descargas (una sola vez)

1. github.com › Settings › Developer settings › **Fine-grained tokens › Generate new token**.
2. *Repository access*: **Only select repositories** → `Ipod-web`.
3. *Permissions*: **Actions: Read and write** y **Contents: Read and write**.
4. En la app: **Más › Configurar descargas** → Método **GitHub**, Repositorio `davidinblack/Ipod-web`,
   **Token** (pégalo) → **Probar conexión**.

El token se guarda sólo en ese teléfono y sólo da acceso a este repositorio; si lo pierdes, revócalo.

### Cómo funciona una descarga

1. La app lanza el workflow **Descargar de YouTube** con el enlace.
2. GitHub instala yt-dlp + ffmpeg, convierte a MP3 (160 kbps, máx. 70 min) con título y artista,
   recorta la miniatura del video en cuadrado, la incrusta como portada y deja el MP3 y la imagen (`.jpg`)
   en la rama `descargas`.
3. La app baja ambos, guarda el MP3 en tu carpeta (`YouTube/`) con la imagen incluida y los borra de la rama.
   Al terminar te ofrece **Editar nombre e imagen…** por si quieres corregir el título o usar otra portada. La rama se reescribe en un
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

- El selector de carpetas (File System Access) depende de la versión de Chrome en Android; la app lo detecta y, si no está, usa **Agregar archivos…**. Chrome puede volver a pedir permiso de la carpeta al reabrir la app: la app te pregunta al abrir para volver a dar permiso.
- Algunos fabricantes (Xiaomi, Huawei, Samsung con ahorro agresivo) cierran apps en segundo plano: excluye Chrome / la app de la optimización de batería si la música se corta.
- Descarga sólo contenido que tengas derecho a guardar; los términos de YouTube restringen la descarga de videos ajenos.
