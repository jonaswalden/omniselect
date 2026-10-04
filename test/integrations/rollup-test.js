import assert from 'node:assert';
import { describe, test } from 'node:test';

import { rollup } from 'rollup';

import rollupSelectors from '../../integrations/rollup.js';
import $ from '../../selectors.js';
import { DYNAMIC, ENTRY, fixture } from '../utils/fixture.js';
import { js } from '../utils/syntax-template-literals.js';

// 'selectors' is marked external, so a residual import resolves to nothing
// rather than failing the build. A fully inlined file never reaches resolution
// at all — the import is gone before the bundler looks for it.
describe('rollup', () => {
  async function bundle (entry, plugin = rollupSelectors()) {
    const build = await rollup({ input: entry, external: ['selectors'], plugins: [plugin] });
    const { output } = await build.generate({ format: 'esm', sourcemap: true });
    return output[0];
  }

  test('inlines through a real build', async () => {
    const file = await fixture({ 'entry.js': ENTRY });
    const { code } = await bundle(file('entry.js'));

    assert.match(code, new RegExp(`getElementsByClassName\\("${$.list.item}"\\)`));
    assert.doesNotMatch(code, /selectors/);
  });

  test('inlines across a module boundary', async () => {
    const file = await fixture({
      'entry.js': js`
        import { row } from './row.js';

        export const rows = document.getElementsByClassName(row);
      `,
      'row.js': js`
        import $ from 'selectors';

        export const row = $.list.item;
      `,
    });

    const { code } = await bundle(file('entry.js'));

    assert.match(code, new RegExp(`"${$.list.item}"`));
    assert.doesNotMatch(code, /selectors/);
  });

  test('leaves the import in place for a chain it cannot resolve', async () => {
    const file = await fixture({ 'entry.js': DYNAMIC });
    const { code } = await bundle(file('entry.js'));

    assert.match(code, /from ['"]selectors['"]/);
  });

  test('produces a bundle sourcemap', async () => {
    const file = await fixture({ 'entry.js': ENTRY });
    const { map } = await bundle(file('entry.js'));

    assert.strictEqual(map.version, 3);
    assert.ok(map.mappings.length > 0);
  });

  test('reports what it inlined', async () => {
    const file = await fixture({ 'entry.js': ENTRY });
    const reports = [];

    await bundle(file('entry.js'), rollupSelectors({ onReport: (r) => reports.push(r) }));

    assert.strictEqual(reports.length, 1);
    assert.deepStrictEqual(reports[0].inlined, [
      { chain: '$.list.item', value: String($.list.item) },
    ]);
  });
});
