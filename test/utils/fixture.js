import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after } from 'node:test';

import { js } from './js.js';

export const ENTRY = js`
  import $ from 'selectors';

  export const rows = document.getElementsByClassName($.list.item);
`;

export const DYNAMIC = js`
  import $ from 'selectors';

  export const pick = (key) => $.list[key];
`;

const directories = [];
after(() => Promise.all(directories.map((dir) => fs.rm(dir, { recursive: true, force: true }))));

export async function fixture (files) {
  // esbuild stamps the entry's path into the bundle, so the fixture directory
  // must not contain the word the assertions search for.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fixture-'));
  directories.push(dir);

  for (const [name, contents] of Object.entries(files)) {
    await fs.writeFile(path.join(dir, name), contents);
  }

  return (name) => path.join(dir, name);
}
