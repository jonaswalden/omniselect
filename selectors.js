import mangle from './mangle.js';

const factoryCache = {};
const props = {
  name: Symbol('name'),
  mangled: Symbol('mangled'),
};
const selectors = createFactory();
export default selectors;

function createFactory (name, namespace) {
  name = [namespace, name].filter(Boolean).join('-');

  return factoryCache[name] ??= new Proxy({
    [props.name]: name,
    [props.mangled]: mangle(name),
    [Symbol.toPrimitive]: stringify,
    toString: stringify,
    valueOf: stringify,
  }, { get: factory });
}

function factory (target, prop) {
  if (typeof prop === 'symbol') return target[prop];
  if (prop === 'toString') return target[prop];
  if (prop === 'valueOf') return target[prop];
  return createFactory(prop, target[props.name]);
}

function stringify () {
  return this[props.mangled];
}
