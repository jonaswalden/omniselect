import mangle from './mangle.js';

const factoryCache = {};
const props = {
  name: Symbol('name'),
  value: Symbol('value'),
  format: Symbol('format'),
};

export const $n = createFactory((n) => n);
export const $q = createFactory((n) => '.' + n);
export default $n;

function createFactory (format, name, namespace) {
  name = [namespace, name].filter(Boolean).join('-');
  factoryCache[format] ??= {};
  return factoryCache[format][name] ??= new Proxy({
    [props.name]: name,
    [props.value]: format(mangle(name)),
    [props.format]: format,
    [Symbol.toPrimitive]: stringify,
    toString: stringify,
    valueOf: stringify,
  }, { get: factory });
}

function factory (target, prop) {
  if (typeof prop === 'symbol') return target[prop];
  if (prop === 'toString') return target[prop];
  if (prop === 'valueOf') return target[prop];
  return createFactory(target[props.format], prop, target[props.name]);
}

function stringify () {
  return this[props.value];
}
