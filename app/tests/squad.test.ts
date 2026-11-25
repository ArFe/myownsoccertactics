import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createBoard, createSave } from '@/model/factory';
import { createSub } from '@/model/gameDay';
import { parseSave, serializeSave } from '@/model/persistence';
import { getSport } from '@/model/sports';
import {
  assignMember,
  createMember,
  fixNumberClashes,
  nextFreeNumber,
  parsePositions,
  parseSquadCsv,
  rolesOf,
} from '@/model/squad';
import { useSaveStore } from '@/stores/save';

describe('squad model', () => {
  it('reads positions written many ways', () => {
    expect(parsePositions('st/lw')).toEqual(['ST', 'LW']);
    expect(parsePositions(' CB, RB ;cb ')).toEqual(['CB', 'RB']);
    expect(parsePositions('')).toEqual([]);
  });

  it('offers the roles of the sport', () => {
    const roles = rolesOf(getSport('soccer'));
    expect(roles).toContain('GK');
    expect(new Set(roles).size).toBe(roles.length);
  });

  it('finds the lowest free number', () => {
    expect(nextFreeNumber([])).toBe(1);
    expect(nextFreeNumber([1, 2, 4])).toBe(3);
  });

  it('reads a CSV: header, quotes, and skips taken or bad numbers with the reason', () => {
    const squad = [createMember({ number: 9, name: 'Ariel' })];
    const csv = 'number,name,positions\n10,Jorge,CM/CDM\n9,Test,ST\n"11","Smith, Jr.",RW\n\nx,Bad,\n10,Again,\n';
    const { members, skipped } = parseSquadCsv(csv, squad);
    expect(members.map((m) => [m.number, m.name, m.positions])).toEqual([
      [10, 'Jorge', ['CM', 'CDM']],
      [11, 'Smith, Jr.', ['RW']],
    ]);
    expect(skipped).toEqual([
      { row: 3, reason: 'Number 9 is taken by Ariel.' },
      { row: 6, reason: '"x" is not a shirt number.' },
      { row: 7, reason: 'Number 10 is taken by Jorge.' },
    ]);
  });

  it('reads a CSV with no header', () => {
    expect(parseSquadCsv('1,Keller,GK', []).members).toMatchObject([{ number: 1, name: 'Keller', positions: ['GK'] }]);
  });

  it('putting a member in a spot gives whoever had that number the old one', () => {
    const board = createBoard();
    const home = board.players.filter((p) => p.team === 'home');
    const ariel = createMember({ number: 9, name: 'Ariel' });
    const spot = home.find((p) => p.number === 6)!;
    const nine = home.find((p) => p.number === 9)!;
    assignMember(board, spot, ariel);
    expect(spot).toMatchObject({ number: 9, name: 'Ariel', memberId: ariel.id });
    expect(nine.number).toBe(6);
    // Moving the member to another spot takes them out of the first.
    assignMember(board, nine, ariel);
    expect(nine).toMatchObject({ number: 9, memberId: ariel.id });
    expect(spot.number).toBe(6);
    expect(spot.memberId).toBeUndefined();
  });

  it('no two players of a team share a number; squad members keep theirs', () => {
    const board = createBoard();
    const home = board.players.filter((p) => p.team === 'home');
    const sub1 = createSub(board, home[9]!);
    const sub2 = { ...createSub(board, home[8]!), id: 'other', number: sub1.number };
    board.subs.push(sub1, sub2);
    home[0]!.number = 7;
    home[0]!.memberId = 'm1';
    fixNumberClashes(board);
    const numbers = [...home.map((p) => p.number), ...board.subs.map((s) => s.number)];
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(home[0]).toMatchObject({ number: 7, memberId: 'm1' });
    // The other team may use the same numbers.
    expect(board.players.filter((p) => p.team === 'away').some((p) => p.number === 7)).toBe(true);
  });
});

describe('squad in the save file', () => {
  it('round-trips, with links', () => {
    const save = createSave();
    const m = createMember({ number: 9, name: 'Ariel', positions: ['ST'] });
    save.squad = [m];
    const spot = save.boards[0]!.players[3]!;
    assignMember(save.boards[0]!, spot, m);
    const back = parseSave(serializeSave(save));
    expect(back.squad).toEqual([m]);
    expect(back.boards[0]!.players[3]).toMatchObject({ number: 9, name: 'Ariel', memberId: m.id });
  });

  it('a version 7 save upgrades with an empty squad', () => {
    const v7 = createSave() as unknown as Record<string, any>;
    v7.version = 7;
    delete v7.squad;
    const out = parseSave(JSON.stringify(v7));
    expect(out.squad).toEqual([]);
  });

  it('drops links to missing members and a member with a taken number', () => {
    const save = createSave() as unknown as Record<string, any>;
    save.squad = [
      { id: 'm1', number: 9, name: 'Ariel', positions: ['st', 3] },
      { id: 'm2', number: 9, name: 'Twin', positions: [] },
    ];
    save.boards[0].players[0].memberId = 'ghost';
    save.boards[0].players[1].memberId = 'm1';
    const out = parseSave(JSON.stringify(save));
    expect(out.squad).toEqual([{ id: 'm1', number: 9, name: 'Ariel', positions: ['ST'] }]);
    expect(out.boards[0]!.players[0]!.memberId).toBeUndefined();
    expect(out.boards[0]!.players[1]).toMatchObject({ memberId: 'm1', number: 9, name: 'Ariel' });
  });
});

describe('squad in the store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('adds members, refusing a taken number, and suggests the next free one', () => {
    const s = useSaveStore();
    expect(s.addMember({ number: 9, name: 'Ariel' })).toHaveProperty('id');
    expect(s.addMember({ number: 9, name: 'Test' })).toEqual({ error: 'Number 9 is taken by Ariel.' });
    expect(s.addMember({ number: 1.5, name: 'Half' })).toHaveProperty('error');
    s.addMember({ number: 1, name: 'Keller' });
    expect(s.nextSquadNumber).toBe(2);
    expect(s.save.squad).toHaveLength(2);
  });

  it('a member change shows on every board; deleting keeps the number and name', () => {
    const s = useSaveStore();
    const { id } = s.addMember({ number: 9, name: 'Ariel' }) as { id: string };
    const first = s.board.players.find((p) => p.team === 'home' && p.number === 6)!;
    s.assignMemberTo('player', first.id, id);
    s.addBoard('11v11');
    const second = s.board.players.find((p) => p.team === 'home' && p.number === 2)!;
    s.assignMemberTo('player', second.id, id);

    expect(s.updateMember(id, { number: 14, name: 'Ari' })).toBeNull();
    for (const b of s.save.boards) {
      expect(b.players.filter((p) => p.memberId === id)).toMatchObject([{ number: 14, name: 'Ari' }]);
      const home = b.players.filter((p) => p.team === 'home').map((p) => p.number);
      expect(new Set(home).size).toBe(home.length);
    }
    s.deleteMember(id);
    expect(s.save.squad).toEqual([]);
    expect(s.board.players.find((p) => p.id === second.id)).toMatchObject({ number: 14, name: 'Ari' });
    expect(s.board.players.find((p) => p.id === second.id)!.memberId).toBeUndefined();
    s.undo();
    expect(s.save.squad).toHaveLength(1);
    expect(s.board.players.find((p) => p.id === second.id)!.memberId).toBe(id);
  });

  it('refuses a number another player of the team has, and sends a member change to the squad', () => {
    const s = useSaveStore();
    const home = s.board.players.filter((p) => p.team === 'home');
    expect(s.updatePlayer(home[0]!.id, { number: home[1]!.number })).toMatch(/is taken/);
    expect(s.updatePlayer(home[0]!.id, { number: 30 })).toBeNull();
    const away = s.board.players.find((p) => p.team === 'away')!;
    expect(s.updatePlayer(away.id, { number: 30 })).toBeNull(); // another team

    const { id } = s.addMember({ number: 9, name: 'Ariel' }) as { id: string };
    s.assignMemberTo('player', home[2]!.id, id);
    s.updatePlayer(home[2]!.id, { name: 'Ariel F' });
    expect(s.save.squad[0]!.name).toBe('Ariel F');
  });

  it('a sub picked from the squad keeps the link through a swap', () => {
    const s = useSaveStore();
    const { id } = s.addMember({ number: 20, name: 'Ana' }) as { id: string };
    const nine = s.board.players.find((p) => p.team === 'home' && p.number === 9)!;
    const sub = s.addSub(nine.id, id)!;
    expect(s.board.subs[0]).toMatchObject({ number: 20, name: 'Ana', memberId: id });
    s.swapSub(sub);
    expect(s.board.players.find((p) => p.id === nine.id)).toMatchObject({ number: 20, memberId: id });
    expect(s.board.subs[0]!.memberId).toBeUndefined();
  });

  it('imports a CSV into the squad, and undo takes it back', () => {
    const s = useSaveStore();
    const r = s.importSquadCsv('1,Keller,GK\n9,Ariel,ST/LW\n9,Again,');
    expect(r.members).toHaveLength(2);
    expect(r.skipped).toHaveLength(1);
    expect(s.save.squad.map((m) => m.name)).toEqual(['Keller', 'Ariel']);
    s.undo();
    expect(s.save.squad).toEqual([]);
  });
});
