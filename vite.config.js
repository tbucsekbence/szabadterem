import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages alatt az oldal a /<repo-név>/ útvonalon fut.
// Saját domainnél (pl. foglalas.performancestudio.hu) állítsd VITE_BASE=/ értékre.
export default defineConfig({
  base: process.env.VITE_BASE || '/szabadterem/',
  plugins: [react()],
});
