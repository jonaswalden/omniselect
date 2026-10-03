// Fixtures are indented to sit with the test that uses them. This strips that
// indentation back off, so what the plugin sees is the file the fixture looks
// like. A fixture containing a template literal escapes its backticks and
// `\${`, which the tag receives already unescaped.
export function js (strings, ...values) {
  const source = strings.reduce((out, string, index) => {
    return out + values[index - 1] + string;
  });

  const lines = source.split('\n');
  if (lines[0].trim() === '') lines.shift();

  const indent = Math.min(...lines
    .filter((line) => line.trim() !== '')
    .map((line) => line.match(/^ */)[0].length));

  return lines.map((line) => line.slice(indent)).join('\n').trimEnd();
}
