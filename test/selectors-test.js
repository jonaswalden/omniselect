import assert from 'node:assert';
import { describe, test } from 'node:test';
import { inspect } from 'node:util';

import $, { $n, $q } from '../selectors.js';
import mangle from '../mangle.js';

describe('selectors', () => {
  test('level 1 getter returns string-ish', () => {
    const selector = $.list;
    const mangled = mangle('list');
    assert.equal(selector, mangled);
    assert.strictEqual(String(selector), mangled);
  });

  test('level 2 getter returns string-ish', () => {
    const selector = $.list.item;
    const mangled = mangle('list-item');
    assert.equal(selector, mangled);
    assert.strictEqual(String(selector), mangled);
  });

  test('level 3 getter returns string-ish', () => {
    const selector = $.list.item.headline;
    const mangled = mangle('list-item-headline');
    assert.equal(selector, mangled);
    assert.strictEqual(String(selector), mangled);
  });

  test('interpolates into template literals', () => {
    assert.strictEqual(`.${$.list.item}`, `.${mangle('list-item')}`);
  });

  test('returns the same factory for the same path', () => {
    assert.strictEqual($.list.item, $.list.item);
  });

  test('survives symbol property access', () => {
    // Frameworks, node's inspector and happy-dom all probe objects with
    // symbols. Joining one into a name would throw.
    assert.doesNotThrow(() => Object.prototype.toString.call($.list));
    assert.doesNotThrow(() => inspect($.list));
    assert.strictEqual($.list[Symbol.iterator], undefined);
  });

  describe('$n', () => {
    test('returns a name', () => {
      assert.equal($n.list.item, mangle('list-item'));
    });
  });

  describe('$q', () => {
    test('returns a CSS selector', () => {
      assert.equal($q.list.item, '.' + mangle('list-item'));
    });
  });
});
