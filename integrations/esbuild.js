// esbuild plugin.
//
// esbuild has a single load hook and runs its own JSX and TS transforms after
// plugins return, so this sees the raw source. That suits oxc, which parses
// every dialect from the filename anyway.
//
// onLoad has nowhere to put a sourcemap, so when the build asks for one it goes
// into the returned source as a data URI and esbuild picks it up from there.

import fs from 'node:fs/promises';
import path from 'node:path';

import transform, { INCLUDE, matches } from '../transform.js';

const LOADERS = {
  '.js': 'js',
  '.mjs': 'js',
  '.cjs': 'js',
  '.jsx': 'jsx',
  '.ts': 'ts',
  '.mts': 'ts',
  '.cts': 'ts',
  '.tsx': 'tsx',
};

export default function selectors (options = {}) {
  const specifier = options.source ?? 'omniselect';

  return {
    name: 'omniselect',

    setup (build) {
      const sourcemap = Boolean(build.initialOptions.sourcemap);

      // esbuild filters at the load step, so the pattern has to be given here
      // rather than checked afterwards — otherwise every file is read.
      build.onLoad({ filter: options.include ?? INCLUDE }, async (args) => {
        if (!matches(args.path, options)) return null;

        const source = await fs.readFile(args.path, 'utf8');
        if (!source.includes(specifier)) return null;

        const result = transform(source, args.path, options);
        if (!result) return null;

        options.onReport?.({ id: args.path, inlined: result.inlined, residual: result.residual });

        const loader = LOADERS[path.extname(args.path)] ?? 'js';
        if (!sourcemap) return { contents: result.code, loader };

        const map = result.map.toUrl();
        return { contents: `${result.code}\n//# sourceMappingURL=${map}\n`, loader };
      });
    },
  };
}
