import { describe, expect, it } from 'vitest';
import { dataUrlToBlob, fileSlug, stampedName, timeStamp, uniqueNames } from '@/export/download';
import { hexToRgba, toColorInput } from '@/utils/color';

describe('file names', () => {
  it('stamp downloads with the local date and time, to the second', () => {
    const at = new Date(2026, 0, 5, 9, 4, 3); // 5 Jan 2026, 09:04:03 local
    expect(timeStamp(at)).toBe('2026-01-05_09-04-03');
    expect(stampedName('build-up', 'png', at)).toBe('build-up_2026-01-05_09-04-03.png');
    expect(stampedName('my-tactics', 'tactics.json', at)).toBe('my-tactics_2026-01-05_09-04-03.tactics.json');
  });

  it('makes safe slugs', () => {
    expect(fileSlug('Build-up vs 4-4-2')).toBe('build-up-vs-4-4-2');
    expect(fileSlug('Ataque São Paulo!')).toBe('ataque-sao-paulo');
    expect(fileSlug('***')).toBe('tactics');
    expect(fileSlug('', 'board')).toBe('board');
  });

  it('makes names unique inside a zip', () => {
    expect(uniqueNames(['a', 'b', 'a', 'a'])).toEqual(['a', 'b', 'a-2', 'a-3']);
  });

  it('turns a data URL into a blob', async () => {
    const blob = dataUrlToBlob('data:text/plain;base64,aGk=');
    expect(blob.type).toBe('text/plain');
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(blob);
    });
    expect(text).toBe('hi');
  });
});

describe('colours', () => {
  it('converts hex to rgba', () => {
    expect(hexToRgba('#EF4444', 0.25)).toBe('rgba(239, 68, 68, 0.25)');
    expect(hexToRgba('#fff', 2)).toBe('rgba(255, 255, 255, 1)');
  });

  it('makes values a colour input accepts', () => {
    expect(toColorInput('#ABC')).toBe('#aabbcc');
    expect(toColorInput('#11223344')).toBe('#112233');
  });
});
