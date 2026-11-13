import { defineConfig } from 'vite';

// The desktop app loads dist/index.html via file://. Relative asset paths are
// required so the renderer can load its JS and CSS inside the packaged app.
export default defineConfig({ base: './', build: { outDir: 'dist' } });
