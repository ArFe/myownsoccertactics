/** The site named on every downloaded image, GIF and video. */
export const SITE = 'myowntactics.ca';

/**
 * Where the site name goes: small and faint, in the bottom-right corner of
 * the field area (above any bench, so it never covers the subs' legend).
 * `width` and `height` are the field area's size in pixels.
 */
export function watermark(width: number, height: number) {
  const fontSize = Math.round(Math.max(11, Math.min(22, width * 0.013)));
  const pad = Math.round(fontSize * 0.6);
  return {
    text: SITE,
    x: 0,
    width: width - pad,
    y: height - pad - fontSize,
    align: 'right' as const,
    fontSize,
    fontStyle: '600',
    fill: '#FFFFFF',
    opacity: 0.6,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowBlur: Math.max(2, fontSize * 0.2),
    listening: false,
  };
}
