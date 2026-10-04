import assert from 'node:assert';
import fs from 'node:fs/promises';
import esbuild from 'esbuild';
import selectors from 'selectors/esbuild';

await esbuild.build({
  entryPoints: [
    `ui/pages/**/*.css.js`,
    `ui/pages/**/*.mjs`,
  ],
  outdir: 'ui/dist',
  bundle: true,
  sourcemap: 'inline',
  plugins: [
    cssjs(),
    selectors({
      include: /\.mjs$/,
      onReport: checkResidual,
    })
  ],
});

function cssjs() {
  return {
    name: 'cssjs',
    setup(build) {
      build.initialOptions.metafile = true;

      build.onLoad({ filter: /\.css\.js$/ }, async (args) => {
        const { default: contents } = await import(args.path);
        return { contents, loader: 'css' };
      });

      build.onEnd(async (result) => {
        const duplicated = Object.keys(result.metafile?.outputs ?? {})
          .filter((file) => file.endsWith('.css.css'));

        await Promise.all(duplicated.map((file) => {
          return fs.rename(file, file.replace(/\.css$/, ''));
        }));
      });
    }
  };
}

function checkResidual({ residual }) {
  assert.deepEqual(residual, []);
}
