import path from "node:path";
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
    mjs(),
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

function mjs() {
  return {
    name: 'mjs',
    setup(build) {
      build.initialOptions.metafile = true;
      build.initialOptions.loader ??= {};
      build.initialOptions.loader['.mjs'] = 'empty';

      build.onEnd(async result => {
        console.log(JSON.stringify(result.metafile, null, 2))
      });
    }
  };

  function getInputsByOutput(outputs) {
    return Object.values(outputs)
      .filter(output => output.entryPoint?.endsWith('.jsx'))
      .map(output => {
        return [
          output.entryPoint,
          Object.keys(output.inputs)
            // .filter(input => input.endsWith('.mjs'))
        ];
      })
  }
}
