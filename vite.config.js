import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Az oldal saját domainen fut (szabadterem.hu), ezért a gyökérből szolgáljuk ki.
// Ha egyszer a <user>.github.io/<repo>/ címen kellene futnia: VITE_BASE=/szabadterem/
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
});
