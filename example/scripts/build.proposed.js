// Proposed alternative to scripts/build.js — one config, one entry glob.
//
// Stylesheets and client scripts both appear per entry, both from co-located
// imports. The two-pass mechanism is an implementation detail of clientScripts().
//
// Run with: node scripts/build.proposed.js

import path from "node:path";
import fs from "node:fs/promises";
import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: [
    'ui/pages/**/*.jsx',
  ],
  outdir: 'ui/dist',
  bundle: true,
  format: 'iife',
  plugins: [
    cssjs(),
    clientScripts(),
  ],
});

function cssjs() {
  return {
    name: 'cssjs',
    setup(build) {
      build.onLoad({ filter: /\.css\.js$/ }, async (args) => {
        const { default: contents } = await import(args.path);
        return { contents, loader: 'css' };
      });
    }
  };
}

// Templates reach client scripts but never run them. This plugin treats the
// template build as a query: it takes the stylesheets and the dependency graph,
// discards the compiled templates, and rebuilds each entry's reachable .mjs
// files into a browser bundle sitting where the template bundle would have been.
function clientScripts({ extension = '.mjs' } = {}) {
  return {
    name: 'client-scripts',
    setup(build) {
      const options = build.initialOptions;

      // The graph is the whole point of this pass.
      options.metafile = true;

      // Loading the scripts as empty keeps them out of the template graph while
      // still recording the import edge. Their contents are never parsed here,
      // so browser-only imports inside them can't break the template build.
      options.loader ??= {};
      options.loader[extension] = 'empty';

      // The compiled templates are never wanted — the server imports the .jsx
      // straight from source. Taking over writing avoids emitting them at all,
      // and avoids racing the client bundle for the same path.
      options.write = false;

      build.onEnd(async (result) => {
        if (!result.metafile) return;

        const stylesheets = result.outputFiles
          .filter((file) => file.path.endsWith('.css'))
          .map(async (file) => {
            await fs.mkdir(path.dirname(file.path), { recursive: true });
            await fs.writeFile(file.path, file.contents);
          });

        const bundles = Object.entries(result.metafile.outputs)
          .filter(([outfile, { entryPoint }]) => outfile.endsWith('.js') && entryPoint)
          .map(([outfile, { entryPoint }]) => ({
            outfile,
            scripts: collect(result.metafile, entryPoint, extension),
          }))
          .filter(({ scripts }) => scripts.length > 0)
          .map(({ outfile, scripts }) => esbuild.build({
            // stdin is esbuild's own synthetic entry point, so the collected
            // scripts need no made-up path to be resolved from. One build per
            // entry — stdin defines exactly one entry point.
            stdin: {
              contents: scripts
                .map((script) => `import ${JSON.stringify(script)};`)
                .join('\n'),
              resolveDir: process.cwd(),
              sourcefile: path.basename(outfile, '.js') + ' (client)',
              loader: 'js',
            },
            outfile,
            bundle: true,
            format: options.format ?? 'iife',
            minify: options.minify,
            define: options.define,
          }));

        await Promise.all([...stylesheets, ...bundles]);
      });
    }
  };
}

// Depth-first walk of the graph, collecting client scripts in import order.
// The metafile only ever records one hop, so an entry's connection to a script
// two levels down exists solely as a path through it.
function collect(metafile, entryPoint, extension) {
  const scripts = [];
  const seen = new Set();

  (function visit(input) {
    if (seen.has(input)) return;
    seen.add(input);

    // Stop at the boundary: everything below a client script belongs to the
    // browser graph, which the second build resolves against the real files.
    if (input.endsWith(extension)) {
      scripts.push(path.resolve(input));
      return;
    }

    for (const { path: next } of metafile.inputs[input]?.imports ?? []) {
      visit(next);
    }
  })(entryPoint);

  return scripts;
}
