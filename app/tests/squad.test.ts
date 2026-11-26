import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createBoard, createSave } from '@/model/factory';
import { createSub } from '@/model/gameDay';
import { parseSave, serializeSave } from '@/model/persistence';
import { getSport } from '@/model/sports';
import {
  assignMember,
  createMember,
  ensureSquad,
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
    const squad = [
      createMember({ sport: 'soccer', number: 9, name: 'Ariel' }),
      createMember({ sport: 'soccer', number: 4, name: '' }),
    ];
    const csv = 'number,name,positions\n10,Jorge,CM/CDM\n9,Test,ST\n"11","Smith, Jr.",RW\n\nx,Bad,\n10,Again,\n4,Four,\n';
    const { members, skipped } = parseSquadCsv(csv, squad, 'soccer');
    // A member with no name yet (4) does not take the number: the row fills them in.
    expect(members.map((m) => [m.sport, m.number, m.name, m.positions])).toEqual([
      ['soccer', 10, 'Jorge', ['CM', 'CDM']],
      ['soccer', 11, 'Smith, Jr.', ['RW']],
      ['soccer', 4, 'Four', []],
    ]);
    expect(skipped).toEqual([
      { row: 3, reason: 'Number 9 is taken by Ariel.' },
      { row: 6, reason: '"x" is not a shirt number.' },
      { row: 7, reason: 'Number 10 is taken by Jorge.' },
    ]);
  });

  it('reads a CSV with no header', () => {
    expect(parseSquadCsv('1,Keller,GK', [], 'volleyball').members).toMatchObject([
      { sport: 'volleyball', number: 1, name: 'Keller', positions: ['GK'] },
    ]);
  });

  it('putting a member in a spot swaps with whoever had that member or number', () => {
    const board = createBoard();
    const home = board.players.filter((p) => p.team === 'home');
    const ariel = createMember({ sport: 'soccer', number: 9, name: 'Ariel' });
    const spot = home.find((p) => p.number === 6)!;
    const nine = home.find((p) => p.number === 9)!;
    assignMember(board, spot, ariel);
    expect(spot).toMatchObject({ number: 9, name: 'Ariel', memberId: ariel.id });
    expect(nine.number).toBe(6);
    // Moving the member to another spot takes them out of the first.
    assignMember(board, nine, ariel);
    expect(nine).toMatchObject({ number: 9, memberId: ariel.id });
    expect(spot).toMatchObject({ number: 6, name: '' });
    expect(spot.memberId).toBeUndefined();
  });

  it('no two players of a team share a number, except one member on the bench for several players', () => {
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

    // One member, a sub for two players, keeps one number.
    const ana = { ...createSub(board, home[5]!), id: 'a1', number: 30, memberId: 'ana' };
    const ana2 = { ...createSub(board, home[6]!), id: 'a2', number: 30, memberId: 'ana' };
    // ...but not twice for the same player.
    const ana3 = { ...createSub(board, home[6]!), id: 'a3', number: 30, memberId: 'ana' };
    board.subs.push(ana, ana2, ana3);
    fixNumberClashes(board);
    expect([ana.number, ana2.number]).toEqual([30, 30]);
    expect(ana3.number).not.toBe(30);
    expect(ana3.memberId).toBeUndefined();
  });

  it('makes every player of our team a squad member, with no name, and links no one else', () => {
    const save = createSave();
    ensureSquad(save);
    const b = save.boards[0]!;
    const home = b.players.filter((p) => p.team === 'home');
    expect(save.squad).toHaveLength(home.length);
    for (const p of home) {
      const m = save.squad.find((x) => x.id === p.memberId)!;
      expect(m).toMatchObject({ sport: 'soccer', number: p.number, name: '', positions: [] });
    }
    expect(b.players.filter((p) => p.team === 'away').every((p) => !p.memberId)).toBe(true);
    // Running it again changes nothing.
    const before = JSON.stringify(save);
    ensureSquad(save);
    expect(JSON.stringify(save)).toBe(before);
  });
});

describe('squad in the save file', () => {
  it('round-trips, with links', () => {
    const save = createSave();
    const m = createMember({ sport: 'soccer', number: 9, name: 'Ariel', positions: ['ST'] });
    save.squad = [m];
    const spot = save.boards[0]!.players[3]!;
    assignMember(save.boards[0]!, spot, m);
    ensureSquad(save);
    const back = parseSave(serializeSave(save));
    expect(back.squad).toEqual(save.squad);
    expect(back.boards[0]!.players[3]).toMatchObject({ number: 9, name: 'Ariel', memberId: m.id });
  });

  it('a version 7 save upgrades: our team becomes squad members', () => {
    const v7 = createSave() as unknown as Record<string, any>;
    v7.version = 7;
    delete v7.squad;
    v7.boards[0].players[0].name = 'Kept';
    const out = parseSave(JSON.stringify(v7));
    expect(out.squad).toHaveLength(11);
    expect(out.squad.find((m) => m.id === out.boards[0]!.players[0]!.memberId)).toMatchObject({ name: 'Kept' });
  });

  it('a version 9 squad goes to soccer; a volleyball board gets its own members, with the names it had', () => {
    const save = createSave() as unknown as Record<string, any>;
    save.version = 9;
    const volley = createBoard('volleyball');
    save.boards.push(volley);
    save.squad = [{ id: 'm1', number: 1, name: 'Ariel', positions: [] }];
    save.boards[0].players.find((p: any) => p.team === 'home' && p.number === 1).memberId = 'm1';
    const vOne = volley.players.find((p) => p.team === 'home' && p.number === 1)!;
    Object.assign(vOne, { memberId: 'm1', name: 'Ariel' });
    const out = parseSave(JSON.stringify(save));
    const soccer = out.squad.filter((m) => m.sport === 'soccer');
    const vb = out.squad.filter((m) => m.sport === 'volleyball');
    expect(soccer.find((m) => m.id === 'm1')).toMatchObject({ number: 1, name: 'Ariel' });
    expect(vb).toHaveLength(volley.players.filter((p) => p.team === 'home').length);
    const vbOne = out.boards[1]!.players.find((p) => p.id === vOne.id)!;
    expect(vbOne.memberId).not.toBe('m1');
    expect(vb.find((m) => m.id === vbOne.memberId)).toMatchObject({ number: 1, name: 'Ariel' });
  });

  it('drops links to missing members and a member with a taken number', () => {
    const save = createSave() as unknown as Record<string, any>;
    save.squad = [
      { id: 'm1', sport: 'soccer', number: 9, name: 'Ariel', positions: ['st', 3] },
      { id: 'm2', sport: 'soccer', number: 9, name: 'Twin', positions: [] },
    ];
    save.boards[0].players[0].memberId = 'ghost';
    save.boards[0].players[1].memberId = 'm1';
    const out = parseSave(JSON.stringify(save));
    expect(out.squad[0]).toEqual({ id: 'm1', sport: 'soccer', number: 9, name: 'Ariel', positions: ['ST'] });
    expect(out.squad.some((m) => m.id === 'm2')).toBe(false);
    expect(out.boards[0]!.players[0]!.memberId).not.toBe('ghost');
    expect(out.boards[0]!.players[1]).toMatchObject({ memberId: 'm1', number: 9, name: 'Ariel' });
  });
});

describe('squad in the store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  const homeAt = (s: ReturnType<typeof useSaveStore>, n: number) =>
    s.board.players.find((p) => p.team === 'home' && p.number === n)!;

  it('a new save already has our team in the squad, with no names', () => {
    const s = useSaveStore();
    expect(s.sportSquad.map((m) => m.number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(s.sportSquad.every((m) => m.name === '')).toBe(true);
    expect(s.nextSquadNumber).toBe(1);
  });

  it('adding a player with a blank member number fills that member in, on every board', () => {
    const s = useSaveStore();
    s.addBoard('11v11');
    const blank = homeAt(s, 9).memberId;
    const r = s.addMember({ number: 9, name: 'Ariel', positions: ['ST'] });
    expect(r).toEqual({ id: blank });
    for (const b of s.save.boards) {
      expect(b.players.find((p) => p.team === 'home' && p.number === 9)).toMatchObject({ name: 'Ariel', memberId: blank });
      expect(b.players.find((p) => p.team === 'away' && p.number === 9)!.memberId).toBeUndefined();
    }
    expect(s.addMember({ number: 9, name: 'Test' })).toEqual({ error: 'Number 9 is taken by Ariel.' });
    expect(s.addMember({ number: 1.5, name: 'Half' })).toHaveProperty('error');
    expect(s.nextSquadNumber).toBe(1);
    expect(s.addMember({ number: 20, name: 'New' })).toHaveProperty('id');
    expect(s.sportSquad).toHaveLength(12);
    s.undo();
    s.undo();
    expect(homeAt(s, 9).name).toBe('');
  });

  it('a member change shows on every board; deleting leaves a new member with no name', () => {
    const s = useSaveStore();
    const { id } = s.addMember({ number: 9, name: 'Ariel' }) as { id: string };
    const first = homeAt(s, 6);
    s.assignMemberTo('player', first.id, id);
    expect(first).toMatchObject({ number: 9, name: 'Ariel' });
    expect(homeAt(s, 6).name).toBe('');
    s.addBoard('11v11');
    // A new board has the same members by number.
    expect(homeAt(s, 9)).toMatchObject({ name: 'Ariel', memberId: id });
    const second = homeAt(s, 9);

    expect(s.updateMember(id, { number: 14, name: 'Ari' })).toBeNull();
    for (const b of s.save.boards) {
      expect(b.players.filter((p) => p.memberId === id)).toMatchObject([{ number: 14, name: 'Ari' }]);
      const home = b.players.filter((p) => p.team === 'home').map((p) => p.number);
      expect(new Set(home).size).toBe(home.length);
    }
    s.deleteMember(id);
    expect(s.sportSquad.some((m) => m.id === id)).toBe(false);
    const after = s.board.players.find((p) => p.id === second.id)!;
    expect(after).toMatchObject({ number: 14, name: '' });
    expect(s.sportSquad.find((m) => m.id === after.memberId)).toMatchObject({ number: 14, name: '' });
    s.undo();
    expect(s.board.players.find((p) => p.id === second.id)!.memberId).toBe(id);
  });

  it('a new number on a spot puts that member there, or a new one; a name goes to the squad', () => {
    const s = useSaveStore();
    const home = s.board.players.filter((p) => p.team === 'home');
    expect(s.updatePlayer(home[0]!.id, { number: home[1]!.number })).toMatch(/is taken/);
    const was = home[0]!.memberId;
    expect(s.updatePlayer(home[0]!.id, { number: 30 })).toBeNull();
    expect(home[0]!.memberId).not.toBe(was);
    expect(s.sportSquad.find((m) => m.id === home[0]!.memberId)).toMatchObject({ number: 30, name: '' });
    const away = s.board.players.find((p) => p.team === 'away')!;
    expect(s.updatePlayer(away.id, { number: 30 })).toBeNull(); // another team
    expect(away.memberId).toBeUndefined();

    s.addMember({ number: 40, name: 'Forty' });
    expect(s.updatePlayer(home[2]!.id, { number: 40 })).toBeNull();
    expect(home[2]).toMatchObject({ number: 40, name: 'Forty' });
    s.updatePlayer(home[2]!.id, { name: 'Forty F' });
    expect(s.sportSquad.find((m) => m.number === 40)!.name).toBe('Forty F');
  });

  it('switching our team links the other team and unlinks the first', () => {
    const s = useSaveStore();
    s.setGameDayTeam('away');
    expect(s.board.players.filter((p) => p.team === 'away').every((p) => p.memberId)).toBe(true);
    expect(s.board.players.filter((p) => p.team === 'home').every((p) => !p.memberId)).toBe(true);
  });

  it('one bench player can be a sub for several players, at different times or none', () => {
    const s = useSaveStore();
    const { id } = s.addMember({ number: 20, name: 'Ana' }) as { id: string };
    const nine = homeAt(s, 9);
    const seven = homeAt(s, 7);
    s.addWave();
    const wave = s.board.waves[0]!.id;
    const a = s.addSub(nine.id, id)!;
    const b = s.addSub(seven.id, id)!;
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    // Not twice for the same player.
    expect(s.addSub(nine.id, id)).toBeNull();
    s.updateSub(a, { waveId: wave });
    expect(s.board.subs).toMatchObject([
      { number: 20, name: 'Ana', memberId: id, replaces: nine.id, waveId: wave },
      { number: 20, name: 'Ana', memberId: id, replaces: seven.id, waveId: null },
    ]);
    // Moving one plan onto a player the other already covers is refused.
    s.updateSub(b, { replaces: nine.id });
    expect(s.board.subs.find((x) => x.id === b)!.replaces).toBe(seven.id);

    // On the field, Ana's other plan goes; the player coming off goes to the bench.
    s.swapSub(a);
    expect(s.board.players.find((p) => p.id === nine.id)).toMatchObject({ number: 20, memberId: id });
    expect(s.board.subs).toHaveLength(1);
    expect(s.board.subs[0]).toMatchObject({ number: 9, replaces: nine.id });
    expect(s.board.subs[0]!.memberId).not.toBe(id);
    s.undo();
    expect(s.board.subs).toHaveLength(2);
  });

  it('imports a CSV into the squad, and undo takes it back', () => {
    const s = useSaveStore();
    const r = s.importSquadCsv('1,Keller,GK\n9,Ariel,ST/LW\n9,Again,\n30,Thirty,');
    expect(r.members).toHaveLength(3);
    expect(r.skipped).toHaveLength(1);
    expect(homeAt(s, 1).name).toBe('Keller');
    expect(s.sportSquad.filter((m) => m.name).map((m) => m.name).sort()).toEqual(['Ariel', 'Keller', 'Thirty']);
    expect(s.sportSquad).toHaveLength(12);
    s.undo();
    expect(s.sportSquad.every((m) => m.name === '')).toBe(true);
  });

  it('a new sub never takes over a nameless player on the field', () => {
    const s = useSaveStore();
    expect(s.nextSquadNumber).toBe(1);
    // Everyone in the squad counts, nameless players too.
    expect(s.nextUnusedNumber).toBe(12);
    expect(s.addMember({ number: 1, name: 'Ana' }, { fillBlank: false })).toEqual({ error: 'Number 1 is taken.' });
    expect(homeAt(s, 1).name).toBe('');
    const r = s.addMember({ number: 12, name: 'Ana' }, { fillBlank: false });
    expect(r).toHaveProperty('id');
    expect(s.nextUnusedNumber).toBe(13);
  });

  it('each sport has its own squad', () => {
    const s = useSaveStore();
    s.addMember({ number: 1, name: 'Keeper' });
    s.openSport('volleyball');
    expect(s.sportSquad.length).toBeGreaterThan(0);
    expect(s.sportSquad.every((m) => m.sport === 'volleyball' && m.name === '')).toBe(true);
    expect(s.addMember({ number: 1, name: 'Setter' })).toHaveProperty('id');
    expect(homeAt(s, 1).name).toBe('Setter');
    s.openSport('soccer');
    expect(homeAt(s, 1).name).toBe('Keeper');
  });
});
