import assert from 'node:assert';
import { describe, test } from 'node:test';

import viteSelectors from '../../integrations/vite.js';
import $ from '../../selectors.js';
import { ENTRY } from '../utils/fixture.js';

describe('vite', () => {
  test('is the rollup plugin, ordered before the bundler transforms', () => {
    const plugin = viteSelectors();

    assert.strictEqual(plugin.name, 'omniselect');
    assert.strictEqual(plugin.enforce, 'pre');
    assert.strictEqual(typeof plugin.transform, 'function');
  });

  test('transforms through the hook Vite calls', async () => {
    const { code } = await viteSelectors().transform(ENTRY, '/app/entry.js');

    assert.match(code, new RegExp(`getElementsByClassName\\("${$.list.item}"\\)`));
  });

  test('declines a file it has nothing to do with', async () => {
    assert.strictEqual(await viteSelectors().transform('find(a.b);', '/app/entry.js'), null);
    assert.strictEqual(await viteSelectors().transform(ENTRY, '/app/entry.css'), null);
  });
});
