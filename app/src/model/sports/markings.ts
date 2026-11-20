import type { FieldSettings, Markings } from '../types';
import type { MarkingDef } from './types';

export function markingAvailable(defs: MarkingDef[], preset: string, key: string): boolean {
  const def = defs.find((d) => d.key === key);
  return !!def && !def.notIn?.includes(preset);
}

/** The markings that are drawn: known to the sport, turned on, and possible for the preset. */
export function effectiveMarkings(defs: MarkingDef[], field: Pick<FieldSettings, 'preset' | 'markings'>): Markings {
  const out: Markings = {};
  for (const d of defs) out[d.key] = markingAvailable(defs, field.preset, d.key) && (field.markings[d.key] ?? d.default);
  return out;
}

export function defaultMarkings(defs: MarkingDef[], preset: string): Markings {
  const out: Markings = {};
  for (const d of defs) out[d.key] = d.default && markingAvailable(defs, preset, d.key);
  return out;
}
