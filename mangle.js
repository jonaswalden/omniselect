// FNV-1a
export default function mangle(value) {
  let acc = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    acc ^= value.charCodeAt(index);
    acc = Math.imul(acc, 0x01000193);
  }
  return (acc >>> 0).toString(36);
}
