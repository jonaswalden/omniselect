import assert from 'node:assert';
import { describe, test } from 'node:test';

import transformSource from '../transform.js';
import $, { $q } from '../selectors.js';
import { js } from './dedent.js';

function transform (source, { filename = 'a.jsx', ...options } = {}) {
  return transformSource(source, filename, options);
}

function reasons (residual) {
  return residual.map((entry) => entry.reason);
}

describe('transform', () => {
  test('inlines a chain as its class name', () => {
    const { code } = transform(js`
      import $ from 'selectors';

      find($.list.item);
    `);

    assert.match(code, new RegExp(`find\\("${$.list.item}"\\)`));
  });

  test('drops the import once every reference is inlined', () => {
    const { code } = transform(js`
      import $ from 'selectors';

      find($.list);
    `);

    assert.doesNotMatch(code, /selectors/);
  });

  test('inlines named exports, including aliased ones', () => {
    const { code } = transform(js`
      import { $n, $q as q } from 'selectors';

      find($n.list, q.list);
    `);

    assert.match(code, new RegExp(`find\\("${$.list}", "\\${$q.list}"\\)`));
  });

  test('inlines inside JSX and template literals', () => {
    const { code } = transform(js`
      import $ from 'selectors';

      const el = <li className={$.list.item} />;
      const sel = \`.\${$.list}\`;
    `);

    assert.match(code, new RegExp(`className=\\{"${$.list.item}"\\}`));
    assert.match(code, new RegExp('`\\.\\$\\{"' + $.list + '"\\}`'));
  });

  test('does not touch a shadowed binding', () => {
    const { code } = transform(js`
      import $ from 'selectors';

      function render ($) {
        return $.list;
      }

      find($.list);
    `);

    assert.match(code, /function render \(\$\) \{\n  return \$\.list;/);
    assert.match(code, new RegExp(`find\\("${$.list}"\\)`));

    // A shadowed reference belongs to some other binding, so it places no
    // demand on the import and the import still goes.
    assert.doesNotMatch(code, /from ['"]selectors['"]/);
  });

  test('leaves chains mentioned in comments and strings alone', () => {
    const { code } = transform(js`
      import $ from 'selectors';

      // $.list.item is the row
      const doc = "$.list.item";

      find($.list);
    `);

    assert.match(code, /\$\.list\.item is the row/);
    assert.match(code, /"\$\.list\.item"/);
  });

  test('ends a chain at toString and valueOf', () => {
    const { code } = transform(js`
      import $ from 'selectors';

      find($.list.toString(), $.list.item.valueOf());
    `);

    assert.match(code, new RegExp(`"${$.list}"\\.toString\\(\\)`));
    assert.match(code, new RegExp(`"${$.list.item}"\\.valueOf\\(\\)`));
  });

  test('ignores imports from other modules', () => {
    assert.strictEqual(transform(js`
      import $ from 'jquery';

      find($.list);
    `), null);
  });

  test('takes the module specifier as an option', () => {
    const { code } = transform(js`
      import $ from '../../selectors.js';

      find($.list);
    `, { source: '../../selectors.js' });

    assert.match(code, new RegExp(`find\\("${$.list}"\\)`));
  });

  test('reports what it inlined', () => {
    const { inlined } = transform(js`
      import $ from 'selectors';

      find($.list.item);
    `);

    assert.deepStrictEqual(inlined, [
      { chain: '$.list.item', value: String($.list.item) },
    ]);
  });

  describe('chains it cannot resolve', () => {
    test('keeps a computed segment and its import', () => {
      const { code, residual } = transform(js`
        import $ from 'selectors';

        find($.list.item, $.list[key]);
      `);

      assert.match(code, /import \$ from 'selectors'/);
      assert.match(code, /find\("[^"]+", \$\.list\[key\]\)/);
      assert.deepStrictEqual(reasons(residual), ['dynamic']);
    });

    test('resolves a computed segment that is a string literal', () => {
      const { code } = transform(js`
        import $ from 'selectors';

        find($['list'].item);
      `);

      assert.match(code, new RegExp(`find\\("${$.list.item}"\\)`));
    });

    test('keeps the root when it is passed as a value', () => {
      const { code } = transform(js`
        import $ from 'selectors';

        find($, $.list);
      `);

      assert.match(code, /import \$ from 'selectors'/);
      assert.match(code, new RegExp(`find\\(\\$, "${$.list}"\\)`));
    });

    test('keeps the import for one root while inlining the other', () => {
      const { code } = transform(js`
        import $n, { $q } from 'selectors';

        find($n.list, $q[key]);
      `);

      assert.match(code, /import \{ \$q \} from 'selectors';/);
      assert.match(code, new RegExp(`find\\("${$.list}", \\$q\\[key\\]\\)`));
    });

    test('keeps a reassigned root', () => {
      const { code, residual } = transform(js`
        import $n, { $q } from 'selectors';

        other = $n.list;
        $n = fallback;
        find($q.list);
      `);

      assert.match(code, /import \$n from 'selectors';/);
      assert.match(code, /other = \$n\.list/);
      assert.match(code, new RegExp(`find\\("\\${$q.list}"\\)`));
      assert.deepStrictEqual(reasons(residual), ['reassigned']);
    });

    test('keeps a namespace import', () => {
      const { code, residual } = transform(js`
        import * as selectors from 'selectors';
        import $ from 'selectors';

        find(selectors.$n.list, $.list);
      `);

      assert.match(code, /import \* as selectors/);
      assert.ok(reasons(residual).includes('unsupported-import'));
    });
  });

  describe('output', () => {
    test('leaves every byte it did not rewrite exactly as it was', () => {
      const { code } = transform(js`
        import $ from 'selectors';

        function render ( ) {
          return   $.list   ;
        }
      `);

      assert.match(code, /function render \( \) \{/);
      assert.match(code, new RegExp(`return   "${$.list}"   ;`));
    });

    test('parses TypeScript and TSX from the filename alone', () => {
      const ts = transform(js`
        import $ from 'selectors';

        const el = <HTMLElement>document.querySelector('.' + $.list);
      `, { filename: 'a.ts' });

      assert.match(ts.code, new RegExp(`'\\.' \\+ "${$.list}"`));

      const tsx = transform(js`
        import $ from 'selectors';

        const el = <li className={$.list.item} />;
      `, { filename: 'a.tsx' });

      assert.match(tsx.code, new RegExp(`className=\\{"${$.list.item}"\\}`));
    });

    test('returns a sourcemap for the edits it made', () => {
      const { map } = transform(js`
        import $ from 'selectors';

        find($.list);
      `, { filename: 'app/a.js' });

      assert.strictEqual(map.version, 3);
      assert.deepStrictEqual(map.sources, ['app/a.js']);
      assert.ok(map.mappings.length > 0);
    });

    test('leaves a syntax error for the bundler to report', () => {
      const source = 'import $ from "selectors"; find($.';

      assert.strictEqual(transform(source, { filename: 'a.js' }), null);
    });
  });

  // Resolving `$` to its binding is the one thing oxc does not hand over, so
  // these pin the walk that does it. Every case must decline to inline.
  describe('the scope walk', () => {
    const cases = {
      'function parameter': 'function f ($) { return $.list }',
      'arrow parameter': 'const f = ($) => $.list;',
      'destructured parameter': 'const f = ({ $ }) => $.list;',
      'defaulted parameter': 'const f = ($ = x) => $.list;',
      'rest parameter': 'const f = (...$) => $.list;',
      'let in a block': '{ let $ = x; use($.list); }',
      'const in a block': '{ const $ = x; use($.list); }',
      'var in a function': 'function f () { use($.list); var $; }',
      'catch parameter': 'try { x() } catch ($) { use($.list) }',
      'for-of binding': 'for (const $ of xs) use($.list);',
      'named function expression': 'const f = function $ () { return $.list };',
      'class declaration': 'class $ {}\nuse($.list);',
      'nested function parameter': 'function a () { return function b ($) { return $.list } }',
    };

    for (const [label, body] of Object.entries(cases)) {
      test(`does not inline through a ${label}`, () => {
        const source = `import $ from 'selectors';\n${body}\n`;

        // Nothing inlinable is left, so the transform declines the file whole.
        assert.strictEqual(
          transform(source, { filename: 'a.js' }),
          null,
          `inlined through ${label}`,
        );
      });
    }
  });
});
