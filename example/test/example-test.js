import $ from 'selectors';
import assert from 'node:assert';
import { describe, test } from 'node:test';

import { Window } from './utils/happy-dom.js';

describe('example app', () => {
  test('loads document with predictable class names', async () => {
    const window = new Window();
    await fetch('http://localhost:5716/')
      .then(res => assert.equal(res.status, 200) || res)
      .then(res => res.text())
      .then(document => window.document.write(document))
      .then(() => window.happyDOM.waitUntilComplete());

    const [ listItem ] = window.document.getElementsByClassName($.list)
    assert(listItem);
  });
});
