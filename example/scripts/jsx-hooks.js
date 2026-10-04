import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

registerHooks({
  load(url, context, nextLoad) {
    if (!/\.jsx$/.test(new URL(url).pathname)) return nextLoad(url, context);

    const { source } = nextLoad(url, { ...context, format: 'module' });
    const { code } = esbuild.transformSync(String(source), {
      loader: 'jsx',
      jsx: 'automatic',
      format: 'esm',
      sourcefile: fileURLToPath(url),
      sourcemap: 'inline',
    });

    return { format: 'module', source: code, shortCircuit: true };
  },
});
