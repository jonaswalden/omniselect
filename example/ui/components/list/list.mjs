import $ from 'omniselect';

for (const list of document.getElementsByClassName($.list)) {
  for (const listItem of list.getElementsByClassName($.list.item)) {
    listItem.dataset.found = true;
  }
}
