import { describe, expect, it } from 'vitest';
import { createBoard } from '@/model/factory';
import { applyPositions, capturePositions, setSides, setTeamSize, targetOptions } from '@/model/positions';
import type { Board } from '@/model/types';

const team = (b: Board, side: 'home' | 'away') => b.players.filter((p) => p.team === side);

describe('saved positions', () => {
  it('saves positions as fractions of the field', () => {
    const b = createBoard('soccer', '11v11');
    team(b, 'home')[0]!.x = 52.5;
    team(b, 'home')[0]!.y = 17;
    const set = capturePositions(b, ['home'], 'Shape');
    expect(setSides(set)).toEqual(['home']);
    expect(set.away).toBeUndefined();
    expect(set.home![0]).toMatchObject({ fx: 0.5, fy: 0.25, role: 'GK' });
    expect(setTeamSize(set)).toBe(11);
  });

  it('fits a set onto a field of another size', () => {
    const from = createBoard('soccer', '11v11');
    team(from, 'home')[0]!.x = 52.5;
    const set = capturePositions(from, ['home', 'away'], 'Shape');
    const to = createBoard('soccer', '11v11');
    to.field.length = 80;
    to.field.width = 50;
    to.field.preset = 'custom';
    applyPositions(to, set, [{ from: 'home', to: 'home' }], { withNames: false, withBall: false, runoff: 4 });
    expect(team(to, 'home')[0]!.x).toBeCloseTo(40);
  });

  it('turns a home set around when it is loaded onto the away team', () => {
    const b = createBoard('soccer', '11v11');
    const gk = team(b, 'home')[0]!;
    gk.x = 10;
    gk.y = 20;
    const set = capturePositions(b, ['home'], 'Shape');
    applyPositions(b, set, [{ from: 'home', to: 'away' }], { withNames: false, withBall: false, runoff: 4 });
    expect(team(b, 'away')[0]).toMatchObject({ x: 95, y: 48 });
    // The home team is not touched.
    expect(team(b, 'home')[0]).toMatchObject({ x: 10, y: 20 });
  });

  it('keeps the board names unless asked to use the saved ones', () => {
    const src = createBoard('soccer', '11v11');
    team(src, 'home')[0]!.name = 'Keller';
    team(src, 'home')[0]!.number = 13;
    const set = capturePositions(src, ['home'], 'Shape');

    const b = createBoard('soccer', '11v11');
    team(b, 'home')[0]!.name = 'Novak';
    const id = team(b, 'home')[0]!.id;
    applyPositions(b, set, [{ from: 'home', to: 'home' }], { withNames: false, withBall: false, runoff: 4 });
    expect(team(b, 'home')[0]).toMatchObject({ id, name: 'Novak', number: 1 });
    applyPositions(b, set, [{ from: 'home', to: 'home' }], { withNames: true, withBall: false, runoff: 4 });
    expect(team(b, 'home')[0]).toMatchObject({ id, name: 'Keller', number: 13 });
    expect(b.teams.home.formation).toBe('Shape');
  });

  it('grows or shrinks a team to the size of the set', () => {
    const eleven = capturePositions(createBoard('soccer', '11v11'), ['home'], 'Big');
    const b = createBoard('soccer', '7v7');
    team(b, 'home')[0]!.name = 'Keller';
    applyPositions(b, eleven, [{ from: 'home', to: 'home' }], { withNames: false, withBall: false, runoff: 3 });
    expect(team(b, 'home')).toHaveLength(11);
    expect(team(b, 'home')[0]!.name).toBe('Keller');
    expect(team(b, 'away')).toHaveLength(7);
  });

  it('keeps loaded players on the field and its run-off', () => {
    const b = createBoard('soccer', '11v11');
    const set = capturePositions(b, ['home'], 'Far');
    set.home![0]!.fx = 1.5;
    applyPositions(b, set, [{ from: 'home', to: 'home' }], { withNames: false, withBall: false, runoff: 4 });
    expect(team(b, 'home')[0]!.x).toBe(109);
  });

  it('saves the ball with the set, unless asked not to or it is hidden', () => {
    const b = createBoard('soccer', '11v11');
    b.ball = { x: 94, y: 34, visible: true };
    expect(capturePositions(b, ['home'], 'Penalty').ball).toEqual({ fx: 0.8952, fy: 0.5 });
    expect(capturePositions(b, ['home'], 'Penalty', false).ball).toBeUndefined();
    b.ball.visible = false;
    expect(capturePositions(b, ['home'], 'Penalty').ball).toBeUndefined();
  });

  it('moves the ball when loading, and turns it with the team', () => {
    const src = createBoard('soccer', '11v11');
    src.ball = { x: 99.5, y: 0.5, visible: true }; // corner kick
    const set = capturePositions(src, ['home'], 'Corner');

    const b = createBoard('soccer', '11v11');
    b.ball.visible = false;
    applyPositions(b, set, [{ from: 'home', to: 'home' }], { withNames: false, withBall: true, runoff: 4 });
    expect(b.ball).toEqual({ x: 99.5, y: 0.5, visible: true });

    applyPositions(b, set, [{ from: 'home', to: 'away' }], { withNames: false, withBall: true, runoff: 4 });
    expect(b.ball).toEqual({ x: 5.5, y: 67.5, visible: true });

    b.ball = { x: 50, y: 30, visible: true };
    applyPositions(b, set, [{ from: 'home', to: 'home' }], { withNames: false, withBall: false, runoff: 4 });
    expect(b.ball).toEqual({ x: 50, y: 30, visible: true });
  });

  it('offers both, one team, or either team as targets', () => {
    const b = createBoard('soccer', '11v11');
    expect(targetOptions(capturePositions(b, ['home', 'away'], 'x')).map((o) => o.id)).toEqual(['both', 'home', 'away']);
    const away = targetOptions(capturePositions(b, ['away'], 'x'));
    expect(away.map((o) => o.id)).toEqual(['home', 'away']);
    expect(away[0]!.targets).toEqual([{ from: 'away', to: 'home' }]);
  });
});
