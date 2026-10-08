# omniselect

A selector factory.

`$.list.item.headline` is a string-ish object that
deterministically resolves to a minified class name `g43sYb`. Derivable from anywhere without shared state – templates, scripts, styles, tests.

Runtime or build time.

> Early days: 0.x, the API may change between minor versions.

## Install

```sh
npm install omniselect
```

For a zero-runtime setup install peer dependencies:

```sh
npm install --save-dev oxc-parser magic-string
```

## How names are made

A chain is a path. `$.todo.headline` is the path `todo-headline`, hashed into a short CSS identifier. Same path, same name – in any file, process or build.

Since segments are joined with `-`, `$['todo-headline']` and `$.todo.headline` are the same selector. Computed segments `$.todo[state]` work in runtime.

## Usage

### Templates

`$.name` results in a class name _selector_ – implicitly coalesces into a string.

```jsx
import $ from 'omniselect';

export default function Todo(props) {
  return <div className={$.todo}>
    <h2 className={$.todo.headline}>
      {props.headline}
    </h2>
    <ol>
      {props.items.map((item) =>
        <li className={$.todo.item}>
          <input type="checkbox" checked={item.done} />
          {item.description}
        </li>
      )}
    </ol>
  </div>;
}
```

### Scripts

`$n`, aliased as `$` results in a class name _selector_. 

`$q` results in a CSS _selector_ – a class selector prefixed with `.`.

```js
import { $n, $q } from 'omniselect';

for (const element of document.getElementsByClassName($n.todo)) {
  todo(element);
}

export default function todo (element) {
  const items = element.querySelectorAll($q.todo.item);
  …
}
```

### Styles

Works with tagged template literals in JS.

Simple replacement allows selector to be expressed without need for `${}` interpolation. Add to a basic template literal or a ready made one if it results in a string. The `$` in the CSS is only a placeholder – the tag resolves each chain through `$q`.

```js
import { $q } from 'omniselect';

export default css`
  $.todo { padding: 1em }
  $.todo.headline { font-size: 2em }
  $.todo.item { display: flex; gap: 0.5em }
`;

function css (strings, ...values) {
  return String.raw({ raw: strings }, ...values)
    .replaceAll(/\$(?:\.\w+)+/g, (selector) => {
      return selector.split('.')
        .slice(1)
        .reduce((factory, name) => factory[name], $q);
    });
}
```

## Zero-runtime

Runtime part of `omniselect` is fairly small. Easy just to drop in and go. But better than runtime is zero-runtime. The `omniselect/transform` module can inline the resulting _selectors_ into the code. There are also ready made integrations for some bundlers:

- esbuild: `omniselect/esbuild`
- Rolldown: `omniselect/rolldown`
- Rollup: `omniselect/rollup`
- Vite: `omniselect/vite`
- webpack, Rspack: `omniselect/webpack-loader`

The transform needs two parsing packages that runtime-only use doesn't, so they are optional peer dependencies – install them alongside:

```sh
npm install --save-dev oxc-parser magic-string
```

See [docs/zero-runtime.md](./docs/zero-runtime.md) for more details.

## Gotchas worth knowing

### A selector is an object, not a string

At runtime a selector is an object that turns into a string when coerced – by a template literal, `+`, `==`, `String()` or a DOM method. Where nothing coerces it, it stays an object:

- `$.todo === 'abc123'` is always `false`. `==` works.
- `typeof $.todo` is `'object'`, though the types say `string`.
- `JSON.stringify({ name: $.todo })` gives `{"name":{}}`, and `structuredClone` throws. Mind anything serialized – server rendered props, `postMessage`, storage.
- As a `Map` or `Set` key it won't match its string.

`String($.todo)` gives a real string. Chains inlined by the [zero-runtime](#zero-runtime) transform are real strings already.

### Happy DOM does not coerce DOM API arguments to strings

`getElementsByClassName($.list)`

Browser query methods automatically stringifies input. Happy DOM does not. **Runtime implementation** requires patching of query methods.

```js
import { Document, DocumentFragment, Element } from 'happy-dom';

const queryMethods = {
  getElementsByClassName: [Document, Element],
  querySelector: [Document, DocumentFragment, Element],
  querySelectorAll: [Document, DocumentFragment, Element],
  closest: [Element],
  matches: [Element],
};

for (const [name, classes] of Object.entries(queryMethods)) {
  for (const { prototype } of classes) {
    const method = prototype[name];
    prototype[name] = function (selector, ...rest) {
      return method.call(this, String(selector), ...rest);
    };
  }
}
```

### Collisions are possible

Names are a 32-bit hash of the path. Two paths producing the same name is unlikely at any ordinary number of selectors, but not impossible.

## License

[ISC](LICENSE)
