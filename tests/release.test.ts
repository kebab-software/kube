import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { selectBuild, validateArtifacts, requiredArtifacts } = require('../.github/scripts/release-build.cjs');
const run = (overrides = {}) => ({ id: 1, run_number: 1, run_attempt: 1, head_branch: 'main', status: 'completed', conclusion: 'success', head_repository: { id: 123 }, event: 'push', ...overrides });
describe('release source selection', () => {
  it('selects the most recent successful trusted default-branch build', () => {
    const runs = [run(), run({ id: 2, run_number: 2 }), run({ id: 3, run_number: 3, conclusion: 'failure' }), run({ id: 4, run_number: 4, event: 'pull_request' }), run({ id: 5, run_number: 5, head_repository: { id: 999 } }), run({ id: 6, run_number: 6, head_branch: 'feature' })];
    expect(selectBuild(runs, 'main', 123).id).toBe(2);
  });
  it('rejects an incomplete run instead of publishing partial build output', () => {
    expect(() => selectBuild([run({ status: 'in_progress' })], 'main', 123)).toThrow();
  });
  it('requires every platform artifact to exist and be unexpired', () => {
    const artifacts = requiredArtifacts.map((name: string) => ({ name, size_in_bytes: 100, expired: false }));
    expect(() => validateArtifacts(artifacts)).not.toThrow();
    expect(() => validateArtifacts(artifacts.slice(1))).toThrow();
    expect(() => validateArtifacts(artifacts.map((a: object) => ({ ...a, expired: true })))).toThrow();
    expect(() => validateArtifacts([...artifacts, artifacts[0]])).toThrow();
  });
});
