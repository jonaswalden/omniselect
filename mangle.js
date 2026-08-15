const HEAD = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const TAIL = HEAD + '0123456789';

// FNV-1a, rendered as a CSS identifier: [a-zA-Z][0-9a-zA-Z]*
export default function mangle(value) {
  let acc = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    acc ^= value.charCodeAt(index);
    acc = Math.imul(acc, 0x01000193);
  }

  let rest = acc >>> 0;
  let name = HEAD[rest % HEAD.length];

  rest = Math.floor(rest / HEAD.length);
  while (rest > 0) {
    name += TAIL[rest % TAIL.length];
    rest = Math.floor(rest / TAIL.length);
  }

  return name;
}
