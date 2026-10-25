import { describe, expect, it } from 'vitest';
import type { LayerManifest } from '../src/layers/types.ts';
import { PLATFORM_LABELS, VALIDATION_HINTS, VALIDATION_LABELS } from '../src/labels.ts';
import { PLATFORMS, VALIDATION_LIBRARIES } from '../src/options.ts';
import { comboAvailability, directoryProblem, ormStep, selectStep } from '../src/wizard-choices.ts';

/** Only the planned layers matter: a combo is available unless one of its layers is planned. */
function plannedLayer(id: string, when: LayerManifest['when']): LayerManifest {
  return { id, status: 'planned', when };
}

const prismaPlanned = [plannedLayer('persistence/prisma/core', (o) => o.orm === 'prisma')];

describe('comboAvailability', () => {
  it('refuses to start when every combo still has a planned layer', () => {
    const layers = [plannedLayer('base', () => true)];

    expect(() => comboAvailability(layers)).toThrow('No project combination is available yet');
  });

  it('treats a partial choice as available while some ready combo still matches it', () => {
    const isAvailable = comboAvailability([
      plannedLayer('auth/nest', (o) => o.auth === 'nest' && o.orm === 'prisma'),
    ]);

    expect(isAvailable({ orm: 'prisma' })).toBe(true);
    expect(isAvailable({ orm: 'prisma', auth: 'nest' })).toBe(false);
  });

  it('takes the validation library into account', () => {
    const isAvailable = comboAvailability([
      plannedLayer('validation/zod', (o) => o.validation === 'zod'),
    ]);

    expect(isAvailable({ validation: 'zod' })).toBe(false);
    expect(isAvailable({ validation: 'class-validator' })).toBe(true);
  });
});

describe('selectStep', () => {
  it('disables a choice that no ready combo offers and preselects the first available one', () => {
    const isAvailable = comboAvailability([
      plannedLayer('platform/fastify', (o) => o.platform === 'fastify'),
    ]);

    const step = selectStep(PLATFORMS, PLATFORM_LABELS, (platform) => isAvailable({ platform }));

    expect(step).toEqual({
      options: [
        { value: 'fastify', label: 'Fastify (coming soon)', disabled: true },
        { value: 'express', label: 'Express' },
      ],
      initialValue: 'express',
    });
  });

  it('shows a hint next to each choice, disabled ones included', () => {
    const step = selectStep(
      VALIDATION_LIBRARIES,
      VALIDATION_LABELS,
      (validation) => validation !== 'zod',
      VALIDATION_HINTS,
    );

    expect(step).toEqual({
      options: [
        { value: 'zod', label: 'Zod (coming soon)', hint: VALIDATION_HINTS.zod, disabled: true },
        {
          value: 'class-validator',
          label: 'class-validator',
          hint: VALIDATION_HINTS['class-validator'],
        },
        { value: 'valibot', label: 'Valibot', hint: VALIDATION_HINTS.valibot },
        { value: 'arktype', label: 'ArkType', hint: VALIDATION_HINTS.arktype },
      ],
      initialValue: 'class-validator',
    });
  });
});

describe('ormStep', () => {
  it('offers the four SQL ORMs for PostgreSQL, Drizzle first', () => {
    const isAvailable = comboAvailability(prismaPlanned);

    const step = ormStep('postgres', (orm) => isAvailable({ database: 'postgres', orm }));

    expect(step).toEqual({
      kind: 'select',
      options: [
        { value: 'drizzle', label: 'Drizzle' },
        { value: 'prisma', label: 'Prisma 7 (coming soon)', disabled: true },
        { value: 'typeorm', label: 'TypeORM' },
        { value: 'mikroorm', label: 'MikroORM' },
      ],
      initialValue: 'drizzle',
    });
  });

  it('picks Mongoose for MongoDB without asking', () => {
    expect(ormStep('mongodb', () => true)).toEqual({
      kind: 'only',
      orm: 'mongoose',
      note: 'MongoDB uses Mongoose.',
    });
  });
});

describe('directoryProblem', () => {
  it('rejects a directory whose name is not a valid package name', () => {
    expect(directoryProblem('/work', 'apps/My API')).toBe(
      '"My API" can\'t be a package name: it contains capital letters',
    );
  });

  it('accepts a directory with a valid package name', () => {
    expect(directoryProblem('/work', '../nest-api')).toBeUndefined();
  });
});
