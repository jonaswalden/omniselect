// build.proposed.js + build-time selector inlining.
//
// The transform goes into the *client* build only. The template pass discards
// its JS and loads .mjs as empty, so transforming anything there would be
// wasted at best. Stylesheets need no transform either: .css.js is imported and
// executed in Node during the build, so its selectors are already resolved by
// the time the CSS text exists. The browser is the only place where a selector
// would otherwise be computed at runtime, and it is the only place this touches.
//
// Run with: node scripts/build.selectors.js [--verbose]

import path from "node:path";
import fs from "node:fs/promises";
import esbuild from 'esbuild';

import selectors from 'selectors/esbuild';

const verbose = process.argv.includes('--verbose');

await esbuild.build({
  entryPoints: [
    'ui/pages/**/*.jsx',
  ],
  outdir: 'ui/dist',
  bundle: true,
  format: 'iife',
  plugins: [
    cssjs(),
    clientScripts({
      plugins: [selectors({ onReport: verbose ? report : undefined })],
    }),
  ],
});

function report ({ id, inlined, residual }) {
  console.log(id.replace(process.cwd() + '/', ''));
  for (const { chain, value } of inlined) console.log(`  ${chain} -> ${value}`);
  for (const { local, reason } of residual) console.log(`  ${local} kept (${reason})`);
}

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

function clientScripts({ extension = '.mjs', plugins = [] } = {}) {
  return {
    name: 'client-scripts',
    setup(build) {
      const options = build.initialOptions;

      options.metafile = true;
      options.loader ??= {};
      options.loader[extension] = 'empty';
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
            plugins,
          }));

        await Promise.all([...stylesheets, ...bundles]);
      });
    }
  };
}

function collect(metafile, entryPoint, extension) {
  const scripts = [];
  const seen = new Set();

  (function visit(input) {
    if (seen.has(input)) return;
    seen.add(input);

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
