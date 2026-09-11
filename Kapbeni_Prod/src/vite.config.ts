import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Die Versionsnummer steht genau einmal: in /opt/kapbeni/VERSION. deploy.sh
// erhoeht sie vor dem Bauen, hier wird sie ins Bundle gebacken. So koennen
// Fusszeile und Admin nicht auseinanderlaufen — beide lesen dieselbe Datei.
// Faellt die Datei weg (z. B. beim Bauen ausserhalb des Servers), steht dort
// "dev" statt einer erfundenen Nummer.
function version(): string {
  for (const p of [resolve(__dirname, '../../VERSION'), resolve(__dirname, '../VERSION')]) {
    try { const v = readFileSync(p, 'utf8').trim(); if (v) return v } catch { /* naechster Pfad */ }
  }
  return 'dev'
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version()),
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
