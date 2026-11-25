import type { SportDefinition } from '../types';
import { VOLLEYBALL_MARKINGS, VOLLEYBALL_PRESETS, drawVolleyballField, volleyballRunoff } from './field';
import { VOLLEYBALL_FORMATIONS } from './formations';

export const VOLLEYBALL: SportDefinition = {
  id: 'volleyball',
  name: 'Volleyball',
  presets: VOLLEYBALL_PRESETS,
  sizeLimits: { min: 6, max: 30 },
  runoff: volleyballRunoff,
  markings: VOLLEYBALL_MARKINGS,
  surface: { label: 'Court', color: '#2B7A78', lineColor: '#FFFFFF' },
  drawField: drawVolleyballField,
  formations: VOLLEYBALL_FORMATIONS,
  ballStyle: 'volleyball',
};
