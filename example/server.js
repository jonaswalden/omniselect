import Article from './ui/pages/article/article.jsx';
import fs from 'node:fs/promises';
import http from 'node:http';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const html = (strings, ...values) =>
  String.raw({ raw: strings }, ...values);

let styles, scripts;
const server = http.createServer(listener)
  .listen(5716, () => console.log('Server is running on port 5716'));

export {
  server as default,
  close,
};

async function listener(req, res) {
  styles ??= await read('./ui/dist/article/article.css');
  scripts ??= await read('./ui/dist/article/article.js');

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html`
    <!doctype html>
    <title>Selectors sample app</title>
    <style>${styles}</style>
    ${renderToStaticMarkup(createElement(Article))}
    <script>${scripts}</script>
  `);
}

function read(path) {
  return fs.readFile(new URL(path, import.meta.url));
}

function close() {
  server.close();
}
