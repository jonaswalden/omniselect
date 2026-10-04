import '../scripts/jsx-hooks.js';

let server;

export async function globalSetup() {
  server = (await import('../server.js')).default;
}

export async function globalTeardown() {
  server.close();
}
