import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
var tunnelAllowedHosts = ['.loca.lt', '.trycloudflare.com'];
export default defineConfig({
    base: './',
    plugins: [react()],
    server: {
        allowedHosts: tunnelAllowedHosts,
    },
    preview: {
        allowedHosts: tunnelAllowedHosts,
    },
});
