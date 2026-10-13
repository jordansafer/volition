const fs = require('node:fs');
const path = require('node:path');
const acorn = require('./vendor/acorn.cjs');
const files = ['blocked.html', 'options.html', 'stats.html', 'background.js', 'blocked.js', 'options.js', 'stats.js', 'model-config.js', 'daily-stats.js', 'timer.js'];
function inventory(root) {
  const result = {};
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    if (file.endsWith('.html')) {
      result[file] = [...source.matchAll(/(?:^|>)([^<>]+)(?=<|$)/gm)]
        .map(match => match[1].trim()).filter(Boolean);
      result[file].push(...[...source.matchAll(/\b(?:placeholder|aria-label|title|alt)="([^"]+)"/g)].map(match => match[1]));
    } else {
      const ast = acorn.parse(source, { ecmaVersion: 'latest', locations: true });
      const copy = [];
      function visit(node, parents = []) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) return node.forEach(n => visit(n, parents));
        const value = node.type === 'Literal' && typeof node.value === 'string' ? node.value : null;
        const rendered = parents.some(p => p.type === 'AssignmentExpression' && /textContent|innerHTML|placeholder|\.title/.test(source.slice(p.left.start, p.left.end))
          || p.type === 'CallExpression' && /^(alert|confirm|appendMessage)$/.test(source.slice(p.callee.start, p.callee.end))
          || p.type === 'NewExpression' && p.callee.name === 'Error'
          || p.type === 'Property' && ['label', 'desc'].includes(p.key.name)
          || p.type === 'VariableDeclarator' && ['dailyMetrics', 'DEFAULT_SYSTEM_PROMPT', 'conversation'].includes(p.id.name));
        if (value !== null && (rendered || /<[a-z][\s\S]*>/.test(value))) copy.push(value);
        // Preserve template text, including interpolation markers, without freezing internal expressions.
        if (node.type === 'TemplateLiteral') copy.push(node.quasis.map(q => q.value.raw).join('${…}'));
        for (const [key, child] of Object.entries(node)) if (!['start', 'end', 'loc', 'raw'].includes(key)) visit(child, [...parents, node]);
      }
      visit(ast);
      result[file] = copy;
    }
  }
  return result;
}
module.exports = { inventory, files };
