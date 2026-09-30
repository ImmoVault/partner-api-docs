#!/usr/bin/env node
// Link check for every HTML page of the site (check-guides.mjs covers only the guides).
//
//   node scripts/check-links.mjs
//
// Checks that relative href/src targets exist and that #anchors exist on the target page. Anchors into
// reference/ are not checked: Redoc renders them at runtime from the spec. External links are not fetched
// (they would make the check flaky); mailto: and https: are skipped. No dependencies: plain Node >= 18.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { ROOT } from './render-tools.mjs';

const SKIP_DIRS = new Set(['.git', 'node_modules']);
const pages = [];
const walk = dir => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(name)) walk(p); }
    else if (name.endsWith('.html')) pages.push(p);
  }
};
walk(ROOT);

const decode = s => s.replace(/&amp;/g, '&');
const idsOf = file => new Set([...readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const errors = [];
let links = 0;

for (const page of pages) {
  const name = relative(ROOT, page);
  const raw = readFileSync(page, 'utf8').replace(/<script\b[\s\S]*?<\/script>/g, '');
  const ids = idsOf(page);
  for (const m of raw.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const ref = decode(m[1]);
    if (!ref || /^(https?:|mailto:|data:|javascript:)/.test(ref)) continue;
    links++;
    if (ref.startsWith('#')) { if (ref.length > 1 && !ids.has(ref.slice(1))) errors.push(`${name}: anchor ${ref} not found`); continue; }
    const [target, anchor] = ref.split('#');
    let p = normalize(join(dirname(page), target.split('?')[0]));
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
    if (!existsSync(p)) { errors.push(`${name}: link ${ref} does not resolve`); continue; }
    if (anchor && p.endsWith('.html') && !relative(ROOT, p).startsWith('reference') && !idsOf(p).has(anchor))
      errors.push(`${name}: anchor ${ref} not found`);
  }
}

console.log(`${pages.length} pages, ${links} relative links`);
for (const e of errors) console.log('FAIL ' + e);
console.log(errors.length ? `${errors.length} problem(s)` : 'OK');
process.exit(errors.length ? 1 : 0);
