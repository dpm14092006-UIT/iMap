import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const cwd = fileURLToPath(new URL('../../../../', import.meta.url));
const eslint = new ESLint({ cwd });

describe('architecture rules enforce the documented dependency direction', () => {
  it.each([
    ['apps/web/src/shared/probe.ts', '../features/navigation/types'],
    ['apps/web/src/features/navigation/domain/probe.ts', '../../../app/layout/AppShell'],
    ['apps/web/src/features/navigation/domain/probe.ts', 'react'],
    ['apps/api/src/modules/navigation/domain/probe.ts', '../application/ports/RoadGraphSource.js'],
    [
      'apps/api/src/modules/navigation/application/probe.ts',
      '../infrastructure/comparison/SignedRouteComparison.js',
    ],
    [
      'apps/api/src/modules/navigation/presentation/probe.ts',
      '../infrastructure/comparison/SignedRouteComparison.js',
    ],
    ['apps/api/src/modules/navigation/infrastructure/probe.ts', '../presentation/RouteController.js'],
  ])('blocks %s from importing %s', async (filePath, specifier) => {
    const [result] = await eslint.lintText(`export { forbidden } from '${specifier}';`, { filePath });
    expect(result?.messages.map((message) => message.ruleId)).toContain('no-restricted-imports');
  });

  it.each([
    ['apps/web/src/app/probe.ts', '../features/navigation/types'],
    ['apps/web/src/features/navigation/domain/probe.ts', '../../../shared/geo/distance'],
    ['apps/api/src/modules/navigation/presentation/probe.ts', '../application/use-cases/FindPathUseCase.js'],
  ])('allows %s to import %s', async (filePath, specifier) => {
    const [result] = await eslint.lintText(`export { allowed } from '${specifier}';`, { filePath });
    expect(result?.messages.filter((message) => message.ruleId === 'no-restricted-imports')).toEqual([]);
  });
});
