import { Document, DocumentFragment, Element } from 'happy-dom';

const METHODS = {
  getElementsByClassName: [Document, Element],
  querySelector: [Document, DocumentFragment, Element],
  querySelectorAll: [Document, DocumentFragment, Element],
  closest: [Element],
  matches: [Element],
};

// Stringify queries. Browsers do this internally, but happy-dom does not.
for (const [name, classes] of Object.entries(METHODS)) {
  for (const { prototype } of classes) {
    const method = prototype[name];
    prototype[name] = function (selector, ...rest) {
      return method.call(this, String(selector), ...rest);
    };
  }
}

export * from 'happy-dom';
