import $ from 'omniselect';
import '../../components/list/list.mjs';

article(document);

function article (context) {
  const element = context.querySelector('.' + $.article);
  if (!element) return;

  element.dataset.read = true;
}
