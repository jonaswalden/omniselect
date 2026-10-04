// webpack loader, which Rspack accepts unchanged.
//
// A loader rather than a plugin: webpack has no plugin-level transform hook, so
// a plugin would have to inject module rules on your behalf. Adding a rule
// yourself is less magic and leaves the ordering visible:
//
//   {
//     test: /\.[cm]?[jt]sx?$/,
//     exclude: /node_modules/,
//     enforce: 'pre',
//     use: { loader: 'selectors/webpack-loader' },
//   }
//
// `enforce: 'pre'` matters for the same reason it does in Vite — run before
// babel-loader or ts-loader rewrites the import.

import transform, { matches } from '../transform.js';

export default function selectorsLoader (source, map, meta) {
  const options = this.getOptions?.() ?? {};
  const specifier = options.source ?? 'selectors';

  this.cacheable?.(true);

  if (!matches(this.resourcePath, options) || !source.includes(specifier)) {
    return this.callback(null, source, map, meta);
  }

  let result;
  try {
    result = transform(source, this.resourcePath, options);
  } catch (error) {
    return this.callback(error);
  }

  if (!result) return this.callback(null, source, map, meta);

  options.onReport?.({ id: this.resourcePath, inlined: result.inlined, residual: result.residual });

  return this.callback(null, result.code, result.map, meta);
}
