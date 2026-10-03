// Vite plugin.
//
// `enforce: 'pre'` puts this ahead of vite:esbuild, so the chains are read from
// the source as the author wrote it — before another plugin compiles the JSX
// away or renames the import. oxc handles TS and JSX directly, so there is no
// reason to wait for anything to be stripped first.

import rollup from './rollup.js';

export default function selectors (options = {}) {
  return { ...rollup(options), enforce: 'pre' };
}
