/**
 * Property-based tests for the Team of the Community of the Month domain module
 * (`domain/teamOfMonth.ts`).
 *
 * Coverage (per the design's testing table): P16.
 * Each property lives in its own `describe` block so additional properties can
 * be appended independently without touching the existing blocks.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildTeamOfMonth, type Formation } from './teamOfMonth';
import type { GameScore, Player, Position } from '../types/domain';

const POSITIONS: readonly Position[] = [
  'Goalkeeper',
  'Defender',
  'Midfielder',
  'Attacker',
];

/** A player with only the fields relevant to selection; others are filler. */
const playerArb = (id: string): fc.Arbitrary<Player> =>
  fc.record({
    name: fc.string({ minLength: 1, maxLength: 8 }),
    position: fc.constantFrom(...POSITIONS),
  }).map(({ name, position }) => ({
    id,
    name,
    position,
    number: null,
    nationality: null,
    photo: null,
  }));

/** A squad of unique-id players. */
const playersArb: fc.Arbitrary<Player[]> = fc
  .integer({ min: 0, max: 12 })
  .chain((count) =>
    fc.tuple(
      ...Array.from({ length: count }, (_unused, index) =>
        playerArb(`p${index}`),
      ),
    ),
  )
  .map((players) => players as Player[]);

/** A GameScore referencing one of the given player ids (or an unknown id). */
const scoresArb = (playerIds: string[]): fc.Arbitrary<GameScore[]> => {
  const idArb =
    playerIds.length > 0
      ? fc.oneof(fc.constantFrom(...playerIds), fc.constant('unknown'))
      : fc.constant('unknown');
  return fc.array(
    fc.record({
      playerId: idArb,
      fixtureId: fc.constantFrom('f1', 'f2', 'f3'),
      score: fc
        .integer({ min: 0, max: 20 })
        .map((n) => n / 2), // [0,10] step 0.5
    }).map(({ playerId, fixtureId, score }) => ({
      fixtureId,
      playerId,
      playerName: playerId,
      username: 'u',
      score,
      homeTeam: 'H',
      awayTeam: 'A',
      fixtureDate: '2024-01-01',
      createdAt: '2024-01-01',
    })),
    { maxLength: 40 },
  );
};

/** An arbitrary formation with per-position slot counts. */
const formationArb: fc.Arbitrary<Formation> = fc
  .record({
    Goalkeeper: fc.integer({ min: 0, max: 3 }),
    Defender: fc.integer({ min: 0, max: 5 }),
    Midfielder: fc.integer({ min: 0, max: 5 }),
    Attacker: fc.integer({ min: 0, max: 5 }),
  })
  .map((counts) => ({ name: 'gen', counts }));

/** Bundles a squad with scores that reference it, plus a formation. */
const scenarioArb: fc.Arbitrary<{
  players: Player[];
  scores: GameScore[];
  formation: Formation;
}> = playersArb.chain((players) =>
  fc.record({
    players: fc.constant(players),
    scores: scoresArb(players.map((p) => p.id)),
    formation: formationArb,
  }),
);

describe('Property 16: Seleção do Time da Comunidade do Mês respeita a Posição', () => {
  // Para todo conjunto de Notas_de_Jogo do período e qualquer formação, cada
  // vaga preenchida por buildTeamOfMonth é ocupada por um Jogador cuja Posição
  // corresponde à Posição exigida pela vaga.
  // Validates: Requirements 25.2, 25.3
  it('every filled slot holds a player whose position equals the slot requiredPosition', () => {
    fc.assert(
      fc.property(scenarioArb, ({ players, scores, formation }) => {
        const team = buildTeamOfMonth(scores, players, formation);
        for (const slot of team) {
          if (slot.player !== null) {
            expect(slot.player.position).toBe(slot.requiredPosition);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
