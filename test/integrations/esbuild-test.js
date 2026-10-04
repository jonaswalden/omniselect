import assert from 'node:assert';
import path from 'node:path';
import { describe, test } from 'node:test';

import * as esbuild from 'esbuild';

import esbuildSelectors from '../../integrations/esbuild.js';
import $ from '../../selectors.js';
import { DYNAMIC, ENTRY, fixture } from '../utils/fixture.js';
import { js } from '../utils/syntax-template-literals.js';

// 'selectors' is marked external, so a residual import resolves to nothing
// rather than failing the build. A fully inlined file never reaches resolution
// at all — the import is gone before the bundler looks for it.
describe('esbuild', () => {
  async function bundle (entry, { plugin, sourcemap = false } = {}) {
    const result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      format: 'esm',
      sourcemap,
      // esbuild only emits a separate .map when it knows where output goes.
      outdir: path.join(path.dirname(entry), 'dist'),
      external: ['selectors'],
      plugins: [plugin ?? esbuildSelectors()],
    });
    return result.outputFiles;
  }

  test('inlines through a real build', async () => {
    const file = await fixture({ 'entry.js': ENTRY });
    const [out] = await bundle(file('entry.js'));

    assert.match(out.text, new RegExp(`getElementsByClassName\\("${$.list.item}"\\)`));
    assert.doesNotMatch(out.text, /selectors/);
  });

  test('picks the loader from the extension', async () => {
    const file = await fixture({
      'entry.jsx': js`
        import $ from 'selectors';

        export const El = () => <li className={$.list.item} />;
      `,
    });

    const [out] = await bundle(file('entry.jsx'));

    assert.match(out.text, new RegExp(`className: "${$.list.item}"`));
    assert.doesNotMatch(out.text, /selectors/);
  });

  test('handles TypeScript', async () => {
    const file = await fixture({
      'entry.ts': js`
        import $ from 'selectors';

        export const el = <HTMLElement>document.querySelector('.' + $.list);
      `,
    });

    const [out] = await bundle(file('entry.ts'));

    assert.match(out.text, new RegExp(`"\\.${$.list}"`));
  });

  test('leaves the import in place for a chain it cannot resolve', async () => {
    const file = await fixture({ 'entry.js': DYNAMIC });
    const [out] = await bundle(file('entry.js'));

    assert.match(out.text, /from ['"]selectors['"]/);
  });

  test('carries a sourcemap through the load hook', async () => {
    const file = await fixture({ 'entry.js': ENTRY });
    const outputs = await bundle(file('entry.js'), { sourcemap: true });
    const map = outputs.find((out) => out.path.endsWith('.map'));

    assert.ok(map, 'expected a .map output');
    assert.ok(JSON.parse(map.text).mappings.length > 0);
  });
});
