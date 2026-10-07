// Rollup-style plugin, shared by Rollup and Rolldown. Vite wraps this and adds
// `enforce: 'pre'`; see ./vite.js.

import transform, { clean, matches } from '../transform.js';

export default function selectors (options = {}) {
  const specifier = options.source ?? 'omniselect';

  return {
    name: 'omniselect',

    transform (code, id) {
      if (!matches(id, options)) return null;

      // Parsing every file to find the few that import anything relevant is
      // the bulk of the cost, and the specifier has to appear in the source.
      if (!code.includes(specifier)) return null;

      const file = clean(id);
      const result = transform(code, file, options);

      // Nothing to inline: no import of the module, every chain dynamic, or a
      // syntax error the bundler will report with better diagnostics than we
      // can. Returning null leaves the original bytes in place.
      if (!result) return null;

      options.onReport?.({ id: file, inlined: result.inlined, residual: result.residual });

      return { code: result.code, map: result.map };
    },
  };
}
