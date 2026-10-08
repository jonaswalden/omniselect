## Zero-runtime

A selector chain is a constant – the same path always resolves to the same class name. A build step can evaluate the chains and substitute string literals, so the factory never reaches the browser.

```jsx
import $, { $q } from 'omniselect';

const headline = <h2 className={$.todo.headline} />;
const items = root.querySelectorAll($q.todo.item);
```

becomes

```jsx
const headline = <h2 className={"aSo4ab"} />;
const items = root.querySelectorAll(".dH9zWc");
```

Imports left without readers are removed. Values come from the same module the runtime uses, so build time and runtime output cannot drift apart.

Anything that can't be resolved statically is left as is and handled by the runtime – a computed segment `$.todo[key]`, optional chaining `$?.todo`, a reassigned or namespace import. Shadowed names are never touched.

### Integrations

Ready made for some bundlers. All run before JSX/TS compilation, so chains are read as written.

The transform needs two parsing packages that runtime-only use doesn't, so they are optional peer dependencies – install them alongside:

```sh
npm install --save-dev oxc-parser magic-string
```

```js
// vite.config.js
import omniselect from 'omniselect/vite';

export default {
  plugins: [omniselect()],
};
```

- esbuild: `omniselect/esbuild`
- Rolldown: `omniselect/rolldown`
- Rollup: `omniselect/rollup`
- Vite: `omniselect/vite`
- webpack, Rspack: `omniselect/webpack-loader`

> webpack has no plugin-level transform hook, so add the loader as a rule with `enforce: 'pre'`:

```js
{
  test: /\.[cm]?[jt]sx?$/,
  exclude: /node_modules/,
  enforce: 'pre',
  use: { loader: 'omniselect/webpack-loader' },
}
```

#### Options

- `source` – module specifier to look for. Default `'omniselect'`.
- `include` / `exclude` – file patterns. Defaults JS/TS/JSX/TSX, excluding `node_modules`.
- `onReport({ id, inlined, residual })` – called per transformed file. `residual` lists chains left to the runtime, and why.

### Custom

`omniselect/transform` exposes the transform itself.

```js
import transform from 'omniselect/transform';

const result = transform(source, 'todo.jsx');
// null when there is nothing to inline
// { code, map, inlined, residual } otherwise
```
