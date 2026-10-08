import type { SourceMap } from 'magic-string';

export interface Options {
  /** Module specifier to look for. Default `'omniselect'`. */
  source?: string;
  /** Files to transform. Defaults to JS/TS/JSX/TSX. */
  include?: RegExp;
  /** Files to skip. Defaults to `node_modules`. */
  exclude?: RegExp;
  /** Called per transformed file. */
  onReport?: (report: Report) => void;
}

export interface Report {
  id: string;
  inlined: Inlined[];
  residual: Residual[];
}

export interface Inlined {
  chain: string;
  value: string;
}

export interface Residual {
  local: string;
  reason: 'unsupported-import' | 'reassigned' | 'dynamic';
  start?: number;
}

export interface Result {
  code: string;
  map: SourceMap;
  inlined: Inlined[];
  residual: Residual[];
}

export declare const INCLUDE: RegExp;
export declare const EXCLUDE: RegExp;

export declare function clean (id: string): string;
export declare function matches (id: string, options?: Pick<Options, 'include' | 'exclude'>): boolean;

/** `null` when there is nothing to inline. */
export default function transform (source: string, filename?: string, options?: Options): Result | null;
