// The bundler adapters, exercised through real builds where a real build is
// cheap, and through the documented interface where it is not.

import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';

import * as esbuild from 'esbuild';
import { rollup } from 'rollup';

import esbuildSelectors from '../esbuild.js';
import rollupSelectors from '../rollup.js';
import rolldownSelectors from '../rolldown.js';
import viteSelectors from '../vite.js';
import webpackLoader from '../webpack-loader.js';
import { clean, matches } from '../transform.js';
import $ from '../selectors.js';
import { js } from './dedent.js';

const directories = [];
after(() => Promise.all(directories.map((dir) => fs.rm(dir, { recursive: true, force: true }))));

async function fixture (files) {
  // esbuild stamps the entry's path into the bundle, so the fixture directory
  // must not contain the word the assertions search for.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fixture-'));
  directories.push(dir);

  for (const [name, contents] of Object.entries(files)) {
    await fs.writeFile(path.join(dir, name), contents);
  }

  return (name) => path.join(dir, name);
}

const ENTRY = js`
  import $ from 'selectors';

  export const rows = document.getElementsByClassName($.list.item);
`;

const DYNAMIC = js`
  import $ from 'selectors';

  export const pick = (key) => $.list[key];
`;

describe('file filtering', () => {
  test('includes source files and skips everything else', () => {
    for (const id of ['a.js', 'a.mjs', 'a.cjs', 'a.jsx', 'a.ts', 'a.mts', 'a.tsx']) {
      assert.ok(matches(`/app/${id}`), id);
    }

    for (const id of ['a.css', 'a.json', 'a.svg', 'a.vue']) {
      assert.ok(!matches(`/app/${id}`), id);
    }

    assert.ok(!matches('/app/node_modules/dep/index.js'));
  });

  test('ignores the query string a bundler appends to a module id', () => {
    assert.ok(matches('/app/a.jsx?v=abc123'));
    assert.ok(!matches('/app/a.css?direct'));
    assert.strictEqual(clean('/app/a.jsx?v=abc123'), '/app/a.jsx');
  });

  test('takes an include and exclude override', () => {
    assert.ok(matches('/app/a.vue', { include: /\.vue$/ }));
    assert.ok(!matches('/app/vendor/a.js', { exclude: /vendor/ }));
  });
});

// Both bundlers mark 'selectors' external, so a residual import resolves to
// nothing rather than failing the build. A fully inlined file never reaches
// resolution at all — the import is gone before the bundler looks for it.
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

  test('rolldown re-exports the same plugin', () => {
    assert.strictEqual(rolldownSelectors, rollupSelectors);
  });
});

describe('vite', () => {
  test('is the rollup plugin, ordered before the bundler transforms', () => {
    const plugin = viteSelectors();

    assert.strictEqual(plugin.name, 'selectors');
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

describe('webpack loader', () => {
  function context (resourcePath, options = {}) {
    const calls = [];
    return {
      resourcePath,
      calls,
      getOptions: () => options,
      cacheable () {},
      callback (...args) { calls.push(args); },
    };
  }

  test('inlines and passes the sourcemap on', () => {
    const loader = context('/app/entry.js');
    webpackLoader.call(loader, ENTRY, undefined, undefined);

    const [[error, code, map]] = loader.calls;
    assert.strictEqual(error, null);
    assert.match(code, new RegExp(`getElementsByClassName\\("${$.list.item}"\\)`));
    assert.strictEqual(map.version, 3);
  });

  test('passes a file it has nothing to do with straight through', () => {
    const loader = context('/app/entry.js');
    webpackLoader.call(loader, 'find(a.b);', 'MAP', 'META');

    assert.deepStrictEqual(loader.calls, [[null, 'find(a.b);', 'MAP', 'META']]);
  });

  test('passes an excluded file straight through', () => {
    const loader = context('/app/node_modules/dep/index.js');
    webpackLoader.call(loader, ENTRY, 'MAP', 'META');

    assert.deepStrictEqual(loader.calls, [[null, ENTRY, 'MAP', 'META']]);
  });

  test('takes options from the rule', () => {
    const reports = [];
    const loader = context('/app/entry.js', { onReport: (r) => reports.push(r) });
    webpackLoader.call(loader, ENTRY, undefined, undefined);

    assert.strictEqual(reports[0].id, '/app/entry.js');
    assert.deepStrictEqual(reports[0].inlined, [
      { chain: '$.list.item', value: String($.list.item) },
    ]);
  });
});
