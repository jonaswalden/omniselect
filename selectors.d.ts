// A selector is typed as a string so it can go wherever one is expected –
// `className`, `querySelector` – without a cast. At runtime it is a proxy that
// coerces to its class name; `typeof` will say 'object'.
//
// Names that are also string members (`link`, `search`, `at`) are overridden to
// keep chaining. The exception is `length`, a number, which ends the chain.
export type Selector = string
  & { readonly [K in keyof String]: Selector }
  & { readonly [name: string]: Selector };

export declare const $n: Selector;
export declare const $q: Selector;
export default $n;
