import $ from 'selectors';

article(document);

function article (context) {
  const element = context.querySelector('.' + $.article);
  if (!element) return;

  element.dataset.read = true;
}
