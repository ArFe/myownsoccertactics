/** Turns a name into a safe file name: "Build-up vs 4-4-2" -> "build-up-vs-4-4-2". */
export function fileSlug(name: string, fallback = 'tactics'): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || fallback;
}

/**
 * Local date and time for file names, to the second, so two downloads never
 * overwrite each other and sort in order: "2026-11-19_23-45-07".
 */
export function timeStamp(date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}` +
    `_${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`
  );
}

/** "build-up" + "png" -> "build-up_2026-11-19_23-45-07.png". */
export function stampedName(base: string, ext: string, date = new Date()): string {
  return `${base}_${timeStamp(date)}.${ext}`;
}

/** Makes unique names inside one zip: a.png, a-2.png, a-3.png. */
export function uniqueNames(names: string[]): string[] {
  const used = new Map<string, number>();
  return names.map((n) => {
    const count = (used.get(n) ?? 0) + 1;
    used.set(n, count);
    return count === 1 ? n : `${n}-${count}`;
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body = ''] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head ?? '')?.[1] ?? 'application/octet-stream';
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
