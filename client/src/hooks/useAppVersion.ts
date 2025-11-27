import { useEffect } from 'react';

/**
 * Hook para verificar automaticamente se há uma nova versão do aplicativo
 * Verifica a cada 5 minutos se o index.html mudou
 * Se mudou, recarrega a página automaticamente para aplicar a atualização
 */
export function useAppVersion() {
  useEffect(() => {
    // Armazenar hash do index.html atual
    let currentHash: string | null = null;

    async function checkForUpdates() {
      try {
        // Fazer fetch do index.html com cache bypass
        const response = await fetch('/', {
          method: 'HEAD',
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });

        // Usar ETag ou Last-Modified como hash
        const etag = response.headers.get('etag');
        const lastModified = response.headers.get('last-modified');
        const newHash = etag || lastModified;

        if (!newHash) return;

        // Se é a primeira verificação, apenas armazenar o hash
        if (currentHash === null) {
          currentHash = newHash;
          return;
        }

        // Se o hash mudou, há uma nova versão disponível
        if (currentHash !== newHash) {
          console.log('Nova versão detectada, recarregando...');
          // Recarregar a página para aplicar a atualização
          window.location.reload();
        }
      } catch (error) {
        console.error('Erro ao verificar atualizações:', error);
      }
    }

    // Verificar imediatamente
    checkForUpdates();

    // Verificar a cada 5 minutos
    const interval = setInterval(checkForUpdates, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);
}
