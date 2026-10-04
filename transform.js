// Resolve selector chains to class names at build time.
//
// `$.list.item` is a constant — the same path always mangles to the same name
// — so nothing about it needs to be computed in a browser. This evaluates the
// chains during the build and substitutes string literals, which lets the
// factory, the proxies and mangle() drop out of the bundle entirely.
//
//   oxc-parser    parses JS, TS, JSX and TSX from the filename alone, in Rust.
//   magic-string  edits the original bytes rather than re-printing the file.
//
// The values come from the real module, not a reimplementation: one hashing
// implementation serves the runtime, the CSS pass and this transform, so the
// three cannot drift apart.
//
// What oxc does not give is scope. `parseSync` returns program, module,
// comments and errors — no symbol table — so resolving `$` to its binding is
// done here, and it is the bulk of this file.
//
// That walk is allowed to be conservative. Failing to notice that a name is
// free costs nothing but a missed inline, because the runtime factory still
// answers for anything left alone. Failing to notice that a name is *bound*
// would produce wrong code, so every uncertain case widens the shadow instead
// of narrowing it.
//
// Bundler integrations live in ./integrations: vite.js, rollup.js, rolldown.js,
// esbuild.js and webpack-loader.js. All of them call transform() below.

import MagicString from 'magic-string';
import { parseSync, visitorKeys } from 'oxc-parser';

import $n, { $q } from './selectors.js';

const ROOTS = { default: $n, $n, $q };
const TERMINALS = new Set(['toString', 'valueOf']);

const FUNCTIONS = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

// A `var` or function declaration binds across the nearest of these.
const VAR_SCOPES = new Set([...FUNCTIONS, 'Program', 'StaticBlock']);

// A `let`, `const` or class declaration binds across the nearest of these.
const BLOCK_SCOPES = new Set([
  'Program',
  'BlockStatement',
  'StaticBlock',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'SwitchStatement',
  'CatchClause',
]);

export const INCLUDE = /\.[cm]?[jt]sx?$/;
export const EXCLUDE = /[\\/]node_modules[\\/]/;

// Bundlers address modules with a query string appended (`?v=`, `?import`).
export function clean (id) {
  return id.split('?')[0];
}

export function matches (id, { include = INCLUDE, exclude = EXCLUDE } = {}) {
  const file = clean(id);
  return include.test(file) && !exclude.test(file);
}

export default function transform (source, filename = 'input.js', options = {}) {
  const specifier = options.source ?? 'selectors';

  const { program, errors } = parseSync(filename, source);

  // A real syntax error is the bundler's to report, with its own diagnostics.
  if (errors.length > 0) return null;

  const declarations = program.body.filter((node) => {
    return node.type === 'ImportDeclaration' && node.source.value === specifier;
  });
  if (declarations.length === 0) return null;

  const residual = [];
  const roots = new Map();

  for (const declaration of declarations) {
    for (const node of declaration.specifiers) {
      const root = rootFor(node);

      // A namespace import reaches the factory through a property of the
      // module object, one hop further out than the chain walk looks.
      if (!root) {
        residual.push({ local: node.local.name, reason: 'unsupported-import' });
        continue;
      }

      roots.set(node.local.name, root);
    }
  }
  if (roots.size === 0) return null;

  const { shadows, references, violations } = collect(program, roots);

  const string = new MagicString(source);
  const inlined = [];
  const resolved = new Set(roots.keys());

  for (const local of violations) {
    // Reassigning the root makes every later reference unknowable, so the
    // whole binding is given up on rather than each reference separately.
    residual.push({ local, reason: 'reassigned' });
    resolved.delete(local);
  }

  for (const reference of references) {
    if (violations.has(reference.name)) continue;

    // Shadowed references belong to some other binding entirely. They are not
    // residual — they place no demand on the import at all.
    if (shadowed(shadows, reference)) continue;

    const chain = resolve(reference, roots.get(reference.name), source);

    if (!chain) {
      residual.push({
        local: reference.name,
        reason: writeTarget(reference) ? 'reassigned' : 'dynamic',
        start: reference.node.start,
      });
      resolved.delete(reference.name);
      continue;
    }

    string.overwrite(reference.node.start, chain.end, JSON.stringify(chain.value));
    inlined.push({ chain: `${reference.name}.${chain.segments.join('.')}`, value: chain.value });
  }

  if (inlined.length === 0) return null;

  for (const declaration of declarations) rewrite(string, declaration, resolved, source);

  return {
    code: string.toString(),
    map: string.generateMap({ source: filename, hires: 'boundary' }),
    inlined,
    residual,
  };
}

// One traversal, collecting everything position-dependent: the ranges within
// which each name is re-bound, every reference to one of the names, and any
// assignment to a name. References have to be gathered before they can be
// judged, since a binding further down the file still shadows one above it.
function collect (program, roots) {
  const shadows = new Map();
  const references = [];
  const violations = new Set();

  const shadow = (name, scope) => {
    if (!roots.has(name) || !scope) return;
    if (!shadows.has(name)) shadows.set(name, []);
    shadows.get(name).push([scope.start, scope.end]);
  };

  traverse(program, (node, scope, outer, ancestors) => {
    switch (node.type) {
      case 'VariableDeclaration':
        for (const declarator of node.declarations) {
          names(declarator.id, (name) => {
            shadow(name, node.kind === 'var' ? scope.var : scope.block);
          });
        }
        return;

      // A function's own name binds outside it; a class's binds in its block.
      case 'FunctionDeclaration':
        if (node.id) shadow(node.id.name, outer.var);
        break;
      case 'ClassDeclaration':
        if (node.id) shadow(node.id.name, outer.block);
        break;

      // A named function expression binds its own name inside itself.
      case 'FunctionExpression':
      case 'ClassExpression':
        if (node.id) shadow(node.id.name, node);
        break;

      case 'CatchClause':
        names(node.param, (name) => shadow(name, node));
        return;

      case 'Identifier':
        if (roots.has(node.name) && !binding(node, ancestors)) {
          const reference = { node, name: node.name, ancestors: [...ancestors] };
          references.push(reference);
          if (writeTarget(reference)) violations.add(node.name);
        }
        return;
    }

    if (FUNCTIONS.has(node.type)) {
      for (const parameter of node.params) names(parameter, (name) => shadow(name, node));
    }
  });

  return { shadows, references, violations };
}

function traverse (root, visit) {
  const ancestors = [];

  (function walk (node, scope) {
    if (!node || typeof node.type !== 'string') return;

    const inner = {
      var: VAR_SCOPES.has(node.type) ? node : scope.var,
      block: BLOCK_SCOPES.has(node.type) ? node : scope.block,
    };

    visit(node, inner, scope, ancestors);

    ancestors.push(node);
    for (const key of visitorKeys[node.type] ?? Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) for (const item of child) walk(item, inner);
      else walk(child, inner);
    }
    ancestors.pop();
  })(root, { var: null, block: null });
}

// Every name a binding pattern introduces.
function names (node, add) {
  if (!node) return;

  switch (node.type) {
    case 'Identifier': return add(node.name);
    case 'ObjectPattern':
      for (const property of node.properties) {
        names(property.type === 'RestElement' ? property.argument : property.value, add);
      }
      return;
    case 'ArrayPattern':
      for (const element of node.elements) names(element, add);
      return;
    case 'AssignmentPattern': return names(node.left, add);
    case 'RestElement': return names(node.argument, add);
    case 'TSParameterProperty': return names(node.parameter, add);
  }
}

// Positions where an identifier is a name rather than a read of a value. The
// import's own specifier is the one that matters most: counted as a reference
// it would hold the import in place forever.
function binding (node, ancestors) {
  const parent = ancestors[ancestors.length - 1];
  if (!parent) return false;

  switch (parent.type) {
    case 'ImportDefaultSpecifier':
    case 'ImportNamespaceSpecifier':
      return true;
    case 'ImportSpecifier':
      return true;
    case 'MemberExpression':
      return parent.property === node && !parent.computed;
    case 'Property':
      return parent.key === node && !parent.computed;
    case 'MethodDefinition':
    case 'PropertyDefinition':
      return parent.key === node && !parent.computed;
    case 'VariableDeclarator':
      return parent.id === node;
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ClassDeclaration':
    case 'ClassExpression':
      return parent.id === node || parent.params?.includes(node);
    case 'ArrowFunctionExpression':
      return parent.params.includes(node);
    case 'CatchClause':
      return parent.param === node;
    case 'LabeledStatement':
    case 'BreakStatement':
    case 'ContinueStatement':
      return parent.label === node;
    default:
      return false;
  }
}

function shadowed (shadows, { node }) {
  const ranges = shadows.get(node.name);
  if (!ranges) return false;
  return ranges.some(([start, end]) => node.start >= start && node.end <= end);
}

// Walk outwards from the reference, taking statically known segments, and
// report the class name plus where the chain ends in the source.
function resolve (reference, root, source) {
  const segments = [];
  let current = reference.node;
  let index = reference.ancestors.length - 1;

  for (;;) {
    const parent = reference.ancestors[index];
    if (!parent || parent.type !== 'MemberExpression' || parent.object !== current) break;

    // `$?.list` inside an optional chain: rewriting it has subtleties no
    // selector usage needs, so the runtime keeps it.
    if (parent.optional) return null;

    const segment = segmentOf(parent);

    // `$.list[key]` continues the path at runtime. Inlining the static prefix
    // would turn the lookup into a character index, so the whole chain stays.
    if (segment === null) return null;

    if (TERMINALS.has(segment)) break;

    segments.push(segment);
    current = parent;
    index--;
  }

  if (segments.length === 0) return null;
  if (writeTarget({ node: current, ancestors: reference.ancestors.slice(0, index + 1) })) return null;

  return {
    segments,
    end: current.end,
    value: String(segments.reduce((factory, name) => factory[name], root)),
  };
}

function segmentOf (member) {
  const { property, computed } = member;
  if (!computed) return property.type === 'Identifier' ? property.name : null;
  if (property.type !== 'Literal') return null;
  return typeof property.value === 'string' ? property.value : null;
}

function writeTarget ({ node, ancestors }) {
  const parent = ancestors[ancestors.length - 1];
  if (!parent) return false;

  if (parent.type === 'AssignmentExpression') return parent.left === node;
  if (parent.type === 'UpdateExpression') return parent.argument === node;
  if (parent.type === 'UnaryExpression') return parent.operator === 'delete';
  if (parent.type === 'ForInStatement' || parent.type === 'ForOfStatement') return parent.left === node;
  return false;
}

// Drop the whole statement when nothing reads it any more, otherwise reprint
// it without the specifiers that no longer have readers. The module specifier
// is sliced from the original so its quote style survives.
function rewrite (string, declaration, resolved, source) {
  const kept = declaration.specifiers.filter((node) => !resolved.has(node.local.name));
  if (kept.length === declaration.specifiers.length) return;

  if (kept.length === 0) {
    string.remove(declaration.start, declaration.end);
    return;
  }

  const text = (node) => source.slice(node.start, node.end);
  const named = kept.filter((node) => node.type === 'ImportSpecifier');
  const bare = kept.filter((node) => node.type !== 'ImportSpecifier');

  const clause = [
    ...bare.map(text),
    named.length > 0 ? `{ ${named.map(text).join(', ')} }` : null,
  ].filter(Boolean).join(', ');

  string.overwrite(
    declaration.start,
    declaration.end,
    `import ${clause} from ${text(declaration.source)};`,
  );
}

function rootFor (node) {
  if (node.type === 'ImportDefaultSpecifier') return ROOTS.default;
  if (node.type !== 'ImportSpecifier') return null;

  const { imported } = node;
  const name = imported.type === 'Identifier' ? imported.name : imported.value;
  return ROOTS[name] ?? null;
}
