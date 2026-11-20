import { defaultMarkings, effectiveMarkings, markingAvailable } from './sports/markings';
import type { FieldPresetDef, SportDefinition } from './sports/types';
import { CUSTOM_PRESET, type FieldSettings, type Markings } from './types';

export function presetDef(sport: SportDefinition, presetId: string): FieldPresetDef | undefined {
  return sport.presets.find((p) => p.id === presetId);
}

export function defaultPreset(sport: SportDefinition): FieldPresetDef {
  return sport.presets[0]!;
}

export function isKnownPreset(sport: SportDefinition, presetId: string): boolean {
  return presetId === CUSTOM_PRESET || !!presetDef(sport, presetId);
}

export function createField(sport: SportDefinition, presetId = defaultPreset(sport).id): FieldSettings {
  const p = presetDef(sport, presetId) ?? defaultPreset(sport);
  return {
    preset: p.id,
    length: p.length,
    width: p.width,
    orientation: 'horizontal',
    surfaceColor: sport.surface.color,
    lineColor: sport.surface.lineColor,
    markings: defaultMarkings(sport.markings, p.id),
  };
}

export function clampSize(sport: SportDefinition, value: number): number {
  const { min, max } = sport.sizeLimits;
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** The preset's label, e.g. "11v11", or "Custom". */
export function presetLabel(sport: SportDefinition, presetId: string): string {
  return presetDef(sport, presetId)?.label ?? 'Custom';
}

/** Short label for the field, e.g. "11v11 · 105 × 68 m" or "Custom · 80 × 50 m". */
export function fieldLabel(sport: SportDefinition, field: FieldSettings): string {
  return `${presetLabel(sport, field.preset)} · ${field.length} × ${field.width} m`;
}

export function sportMarkingAvailable(sport: SportDefinition, preset: string, key: string): boolean {
  return markingAvailable(sport.markings, preset, key);
}

export function sportEffectiveMarkings(sport: SportDefinition, field: FieldSettings): Markings {
  return effectiveMarkings(sport.markings, field);
}
