import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Só para desenvolvimento SEM Docker (npm run dev): repassa /api ao backend
    // rodando na máquina. No Docker quem faz esse papel é o nginx (nginx.conf.template).
    proxy: { '/api': 'http://localhost:3001' },
  },
});
