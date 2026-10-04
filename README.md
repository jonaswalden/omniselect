# selectors

A selector factory.

`$.list.item.headline` is a string-ish object that
deterministically resolves to a minified class name `FfN52b`. Derivable from anywhere without shared state – templates, scripts, styles, tests.

Runtime or build time. 

## Usage

### Templates

`$.name` results in a class name _selector_ – implicitly coalesces into a string.

```jsx
import $ from 'selectors';

export default function Todo(props) {
  return <div className={$.todo}>
    <h2 className={$.todo.headline}>
      {props.headline}
    </h2>
    <ol>
      {props.items.map((item) =>
        <li className={$.todo.item}>
          <input type="checkbox" checked={item.done} />
          {item.decription}
        </li>
      )}
    </ol>
  </div>;
}
```

### Scripts

`$n` alias of `$n` results in a class name _selector_. `$q` results in a CSS _selector_ – class name prefixed with `.` 

```js
import { $n, $q } from 'selectors';

for (const elements of document.getElementByClassName($n.todo)) {
  todo(element);
}

export default function todo (element) {
  const items = element.querySelectorAll($q.todo.item);
  …
}
```

### Styles

Works with tagged template literals in JS.

Simple replacement allows selector to be expressed without need for `${}` interpolation. Add to a basic template literal or a ready made one if it results in a string.

```js
import { $q } from 'selectors';

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

Runtime part of `selectors` is fairly small. Easy just to drop in and go. But better than runtime is zero-runtime. The `transform.js` module can inline the resulting _selectors_ into the code. There are also ready made integrations for some bundlers:

- esbuild: `selectors/esbuild`
- Rolldown: `selectors/rolldown`
- Rollup: `selectors/rollup`
- Vite: `selectors/vite`
- webpack, Rspack: `selectors/webpack-loader`

See [docs/zero-runtime.md](./docs/zero-runtime.md) for more details.

## Gotchas worth knowing

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
