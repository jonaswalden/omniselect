import assert from 'node:assert';
import { describe, test } from 'node:test';

import rolldownSelectors from '../../integrations/rolldown.js';
import rollupSelectors from '../../integrations/rollup.js';

describe('rolldown', () => {
  test('re-exports the rollup plugin', () => {
    assert.strictEqual(rolldownSelectors, rollupSelectors);
  });
});
