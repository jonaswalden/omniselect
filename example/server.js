import http from 'node:http';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import Article from './ui/pages/article/article.jsx';

const html = (strings, ...values) =>
  String.raw({ raw: strings }, ...values);

let styles, scripts;
const server = http.createServer(listener)
  .listen(5716, () => console.log('Server is running on port 3000'));

export {
  server as default,
  close,
};

async function listener(req, res) {
  styles ??= await import('./ui/dist/article/article.css');
  scripts ??= await import('./ui/dist/article/article.js');

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html`
    <!doctype html>
    <title>Selectors sample app</title>
    <style>${styles.default}</style>
    ${renderToStaticMarkup(createElement(Article))}
    <script>${scripts.default}</script>
  `);
}

function close() {
  server.close();
}
