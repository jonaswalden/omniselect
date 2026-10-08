// Typed structurally rather than against webpack, so Rspack users don't need
// webpack's types installed. The loader is referenced by name in config, so
// this is mostly for the options.

import type { Options } from '../transform.js';

export type LoaderOptions = Options;

export default function selectorsLoader (
  this: {
    resourcePath: string;
    getOptions?: () => Options;
    cacheable?: (flag?: boolean) => void;
    callback: (error: Error | null, content?: string, map?: unknown, meta?: unknown) => void;
  },
  source: string,
  map?: unknown,
  meta?: unknown,
): void;
