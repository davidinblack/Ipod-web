// Genera el proyecto Android (Trusted Web Activity) a partir de twa-manifest.json.
// Uso: node generate.mjs <carpeta-destino>   (variables: VERSION_NAME, VERSION_CODE)
import { readFile } from 'node:fs/promises';
import { TwaGenerator, TwaManifest, ConsoleLog } from '@bubblewrap/core';

const out = process.argv[2] || 'build-android';
const json = JSON.parse(await readFile(new URL('./twa-manifest.json', import.meta.url), 'utf8'));
if (process.env.VERSION_NAME) json.appVersion = process.env.VERSION_NAME;
if (process.env.VERSION_CODE) json.appVersionCode = Number(process.env.VERSION_CODE);
const manifest = new TwaManifest(json);
const errors = manifest.validate?.();
if (errors) throw new Error(errors);
await new TwaGenerator().createTwaProject(out, manifest, new ConsoleLog('twa'));
console.log(`Proyecto generado en ${out} — ${json.packageId} v${json.appVersion} (${json.appVersionCode})`);
