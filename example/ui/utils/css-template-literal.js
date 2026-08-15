import $ from 'selectors';

export default function css(strings, ...values) {
  return String.raw({ raw: strings }, ...values)
    .replaceAll(/\$(?:\.\w+)+/g, (selector) => {
      return '.' +
        selector.split('.')
          .slice(1)
          .reduce((factory, name) => {
            return factory[name];
          }, $);
    });
}
