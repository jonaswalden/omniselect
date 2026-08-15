import { $q as $ } from 'selectors';

export default function css(strings, ...values) {
  return String.raw({ raw: strings }, ...values)
    // Optional replacement of $.* to avoid ${} everywhere
    .replaceAll(/\$(?:\.\w+)+/g, (selector) => {
      return selector.split('.')
        .slice(1)
        .reduce((factory, name) => factory[name], $);
    });
}
