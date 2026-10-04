import assert from 'node:assert';
import { describe, test } from 'node:test';

import webpackLoader from '../../integrations/webpack-loader.js';
import $ from '../../selectors.js';
import { ENTRY } from '../utils/fixture.js';

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
