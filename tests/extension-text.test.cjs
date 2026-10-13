const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('./vendor/acorn.cjs');
const { inventory, files } = require('./text-inventory.cjs');
const root = path.resolve(__dirname, '..');
test('live extension wording stays verbatim against the approved baseline', () => {
  const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'extension-text-baseline.json'), 'utf8'));
  assert.deepEqual(inventory(root), baseline, 'Do not change the approved text inventory to bypass the user rule.');
});
test('HTML text and accessible labels have verbatim keep text comments', () => {
  for (const file of files.filter(file => file.endsWith('.html'))) {
    const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.includes('<!--')) return;
      const text = line.replace(/<[^>]*>/g, '').trim();
      if (text || /\b(?:placeholder|aria-label|title|alt)="[^"]+"/.test(line)) {
        assert.ok(lines[i - 1]?.includes('<!-- verbatim keep text -->'), `${file}:${i + 1}`);
      }
    });
  }
});
test('JS string sources and dynamic text rendering have verbatim keep text comments', () => {
  for (const file of files.filter(file => file.endsWith('.js'))) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const ast = acorn.parse(source, { ecmaVersion: 'latest', locations: true });
    const lines = source.split('\n');
    function visit(node, template) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(n => visit(n, template));
      const outer = template || (node.type === 'TemplateLiteral' ? node : null);
      const literal = node.type === 'Literal' && typeof node.value === 'string' || node.type === 'TemplateLiteral';
      const renderer = node.type === 'AssignmentExpression' && /textContent|innerHTML|placeholder|\.title/.test(source.slice(node.left.start, node.left.end));
      if (literal || renderer) {
        const target = outer || node;
        let line = target.loc.start.line - 2;
        // A closing template line can contain a later literal; its template's opening comment covers it.
        if (!lines[line]?.includes('verbatim keep text')) {
          const start = source.lastIndexOf('\n', target.start - 1) + 1;
          const before = source.slice(start, target.start);
          if (before.includes('`')) return;
        }
        assert.ok(lines[line]?.includes('verbatim keep text'), `${file}:${target.loc.start.line}`);
      }
      for (const [key, value] of Object.entries(node)) if (!['loc', 'start', 'end', 'raw'].includes(key)) visit(value, outer);
    }
    visit(ast, null);
  }
});
