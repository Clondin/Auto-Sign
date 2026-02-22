import { useEffect } from 'react';
import { isDesktop } from '../services/platform';

export function useTauriFileOpen(onFileOpen: (file: File) => void) {
  useEffect(() => {
    if (!isDesktop()) return;

    let unlisten: (() => void) | undefined;

    (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      const { readFile } = await import('@tauri-apps/plugin-fs');

      unlisten = await listen<string>('open-file', async (event) => {
        const filePath = event.payload;
        try {
          const contents = await readFile(filePath);
          const filename = filePath.split('/').pop() || 'document.pdf';
          const file = new File([contents], filename, { type: 'application/pdf' });
          onFileOpen(file);
        } catch (err) {
          console.error('Failed to read file from open-file event:', err);
        }
      });
    })();

    return () => {
      unlisten?.();
    };
  }, [onFileOpen]);
}
