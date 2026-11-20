import type { SportDefinition } from '../types';
import { SOCCER_MARKINGS, SOCCER_PRESETS, drawSoccerField, soccerRunoff } from './field';
import { SOCCER_FORMATIONS } from './formations';

export const SOCCER: SportDefinition = {
  id: 'soccer',
  name: 'Soccer',
  presets: SOCCER_PRESETS,
  sizeLimits: { min: 20, max: 130 },
  runoff: soccerRunoff,
  markings: SOCCER_MARKINGS,
  surface: { label: 'Grass', color: '#2E7D43', lineColor: '#FFFFFF' },
  drawField: drawSoccerField,
  formations: SOCCER_FORMATIONS,
  ballStyle: 'soccer',
};
