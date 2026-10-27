// Verifies every locale has exactly the same keys and placeholders as en.json.
// Run: npm run i18n:check   (exits 1 on any mismatch so CI can gate on it)
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../src/i18n/locales');
const flatten = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? flatten(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]);
const vars = (s) => [
  ...[...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]),
  ...[...s.matchAll(/<(\w+)\s*\/>/g)].map((m) => `<${m[1]}/>`), // <Trans> self-closing slots
  ...[...s.matchAll(/<\/?(\w+)>/g)].map((m) => m[0]),            // <Trans> paired tags
].sort().join(',');

const load = (f) => new Map(flatten(JSON.parse(readFileSync(join(dir, f), 'utf8'))));
const en = load('en.json');
let errors = 0;

for (const f of readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'en.json')) {
  const loc = load(f);
  for (const [k, v] of en) {
    if (!loc.has(k)) { console.error(`${f}: missing key ${k}`); errors++; continue; }
    if (!loc.get(k).trim()) { console.error(`${f}: empty value ${k}`); errors++; }
    if (vars(v) !== vars(loc.get(k))) { console.error(`${f}: placeholder mismatch in ${k}`); errors++; }
  }
  for (const k of loc.keys()) if (!en.has(k)) { console.error(`${f}: unknown key ${k}`); errors++; }
}
console.log(errors ? `FAILED: ${errors} problem(s)` : `OK: all locales match en.json (${en.size} keys)`);
process.exit(errors ? 1 : 0);
