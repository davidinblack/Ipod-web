# App Android (Trusted Web Activity)

- `twa-manifest.json`: nombre, paquete (`io.github.davidinblack.ipod`), colores, íconos y huella de la llave.
- `generate.mjs`: genera el proyecto Gradle con `@bubblewrap/core`.
- `sitio-raiz/`: contenido del repositorio `davidinblack.github.io` (assetlinks.json para pantalla completa).
- La compilación y la firma las hace el workflow **Compilar APK** (`.github/workflows/apk.yml`).
