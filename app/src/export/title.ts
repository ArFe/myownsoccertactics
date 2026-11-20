/** Size of the title band above an exported image, for an image `width` wide. */
export function titleBand(width: number): { height: number; fontSize: number; pad: number } {
  const fontSize = Math.round(Math.max(18, Math.min(56, width * 0.03)));
  return { height: Math.round(fontSize * 2), fontSize, pad: Math.round(fontSize * 0.8) };
}

/** The image with a dark band on top holding `title`. */
export function withTitle(image: HTMLCanvasElement, title: string): HTMLCanvasElement {
  const band = titleBand(image.width);
  const out = document.createElement('canvas');
  out.width = image.width;
  out.height = image.height + band.height;
  const ctx = out.getContext('2d');
  if (!ctx) return image;
  ctx.fillStyle = '#14301F';
  ctx.fillRect(0, 0, out.width, band.height);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${band.fontSize}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  let text = title.trim() || 'Board';
  // Shorten a name too long for the band.
  while (text.length > 1 && ctx.measureText(text).width > out.width - band.pad * 2) text = text.slice(0, -2) + '…';
  ctx.fillText(text, band.pad, band.height / 2);
  ctx.drawImage(image, 0, band.height);
  return out;
}
