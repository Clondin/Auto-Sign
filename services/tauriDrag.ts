import { isDesktop } from './platform';

async function writeBlobToTempFile(blob: Blob, filename: string): Promise<string> {
  const { writeFile, mkdir, tempDir } = await import('@tauri-apps/plugin-fs');
  const dir = (await tempDir()) + 'autosign';
  try {
    await mkdir(dir, { recursive: true });
  } catch {
    // directory may already exist
  }
  const filePath = dir + '/' + filename;
  const buffer = new Uint8Array(await blob.arrayBuffer());
  await writeFile(filePath, buffer);
  return filePath;
}

async function createDragIcon(): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  // Draw a simple PDF icon
  ctx.fillStyle = '#e0e7ff';
  ctx.beginPath();
  ctx.roundRect(8, 4, 48, 56, 6);
  ctx.fill();

  ctx.fillStyle = '#6366f1';
  ctx.beginPath();
  ctx.roundRect(8, 4, 48, 56, 6);
  ctx.stroke();

  ctx.fillStyle = '#6366f1';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PDF', 32, 38);

  const dataUrl = canvas.toDataURL('image/png');
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return writeBlobToTempFile(blob, 'drag-icon.png');
}

let cachedIconPath: string | null = null;

export async function startNativeDrag(signedBlob: Blob, filename: string): Promise<void> {
  if (!isDesktop()) return;

  const { startDrag } = await import('@crabnebula/tauri-plugin-drag');

  const filePath = await writeBlobToTempFile(signedBlob, filename);

  if (!cachedIconPath) {
    cachedIconPath = await createDragIcon();
  }

  await startDrag({ item: [filePath], icon: cachedIconPath });
}
