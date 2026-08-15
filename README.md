# selectors

A selector factory. `$.list.item.headline` is a string-ish object that
deterministically resolves to one class name, derivable from anywhere without
shared state.

```jsx
import $ from 'selectors';

export default function Todo(props) {
  return <div className={$.todo}>
    <h2 className={$.todo.headline}>
      {props.headline}
    </h2>
    <ol>
      {props.items.map((item) => {
        return <li className={$.todo.item}>
          <input type="checkbox" checked={item.done} />
          {item.decription}
        </li>
      })}
    </ol>
  </div>;
}
```

```js
import $ from 'selectors';

for (const elements of document.getElementByClassName($.todo)) {
  todo(element);
}

export default function todo (element) {
  const items = element.getElementsByClassName($.todo.item);
  …
}
```

## Gotchas worth knowing

- **happy-dom ≥ 20 does not execute scripts by default.** You need
  `new Window({ settings: { enableJavaScriptEvaluation: true } })`. Without it a
  test that asserts on a client script passes vacuously.
- **happy-dom does not coerce DOM API arguments to strings.** A browser converts
  to DOMString for you, so `getElementsByClassName($.list)` works there but
  throws `className.replace is not a function` under happy-dom. Interpolate
  (`` `.${$.list}` ``) or be explicit (`String($.list)`).
- **Objects crossing out of happy-dom's vm realm** fail `deepStrictEqual`
  against plain objects. Spread them first.
- The client bundle ships the factory and hashes at runtime, so class names are
  not visible as literals in `dist/index.js`. Fine, but it is a few hundred
  bytes and a small startup cost — a build-time transform could inline them.
- Hashes are 32-bit. `mangle()` throws on a detected collision rather than
  silently merging two selectors.
