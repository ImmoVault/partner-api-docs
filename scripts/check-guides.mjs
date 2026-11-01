#!/usr/bin/env node
// Consistency check for the guides (connect/, erp/, mcp/) and the pages that announce them.
//
//   node scripts/check-guides.mjs                  full check; fails while the tools/list snapshot is missing
//   node scripts/check-guides.mjs --allow-pending  same, but a missing snapshot is only a warning
//   AZURE_FUNCTIONS_DIR=<checkout> node scripts/check-guides.mjs
//                                                  also compares the auth-server routes with SandboxAuth/Functions
//                                                  and the tool scopes with [RequiresScope] in PartnerMcp/Tools
//                                                  and the Bruno UUIDs with SandboxApi/Fixtures/sandbox-data.json
//
// What it checks:
//   1. every https://api(.sandbox).messpunkt.io/v1/... URL matches a path of erp-api-openapi.yaml
//   2. every auth(.sandbox).messpunkt.io and mcp.messpunkt.io URL is a known route
//   3. every scope named (read:…, write:…) exists in the spec or in the tools/list snapshot
//   4. every MCP tool name in <code> exists in the snapshot
//   5. relative links and in-page anchors resolve
//   6. index.html and llms.txt link the three guides
//   7. each client section of connect/ has a "verified" and an "unverified" block
//   8. the generated tool reference is up to date (scripts/render-tools.mjs --check)
//   9. facts that were wrong once and must not come back: the refresh-token lifetime (90 days without use,
//      no absolute cap) and authorization-code extraction that assumes hex (codes are base64url)
//  10. every problem type https://developer.messpunkt.io/errors/#<code> in the spec and the pages has an anchor
//      of that name on errors/, and no page or example uses the old api(.sandbox)…/errors/<code> form
//  11. bruno/messpunkt-sandbox.zip holds exactly bruno/*.bru and bruno/bruno.json (same bytes); with
//      AZURE_FUNCTIONS_DIR also: every UUID in bruno/*.bru is an "id" of the sandbox fixture, except the all-zeros
//      UUID of get-property-out-of-scope.bru. Without it this part is skipped with a notice (the fixture is private).
// Placeholders (<SUPPORT_KONTAKT> …) are listed, never treated as errors: they must stay visible.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { dirname, join, normalize } from 'node:path';
import { ROOT, loadTools, renderPage } from './render-tools.mjs';

const allowPending = process.argv.includes('--allow-pending');
const errors = [];
const warnings = [];
const read = p => readFileSync(join(ROOT, p), 'utf8');

// --- spec -----------------------------------------------------------------------------------------------
const spec = read('erp-api-openapi.yaml');
const pathsBlock = spec.slice(spec.indexOf('\npaths:'), spec.indexOf('\ncomponents:'));
const specPaths = [...pathsBlock.matchAll(/^ {2}(\/[^:\s]*):\s*$/gm)].map(m => m[1]);
const specScopes = new Set([
  ...[...spec.matchAll(/^\s+"((?:read|write):[a-z-]+)":/gm)].map(m => m[1]),
  ...[...spec.matchAll(/OAuth2: \[([^\]]*)\]/g)].flatMap(m => m[1].split(',').map(s => s.trim()).filter(Boolean)),
]);
if (specPaths.length === 0) errors.push('spec: no paths parsed');

const pathRegex = p => new RegExp('^' + p.replace(/\{[^}]+\}/g, '[^/]+') + '/?$');
const matchesSpec = path => specPaths.some(p => pathRegex(p).test(path));

// --- known non-spec routes ------------------------------------------------------------------------------
// Authorization server (azure-functions SandboxAuth/Functions, Route = "…"); verified against a checkout
// when AZURE_FUNCTIONS_DIR is set.
const AUTH_ROUTES = [
  '/.well-known/oauth-authorization-server', '/.well-known/openid-configuration',
  '/oauth/authorize', '/oauth/token', '/oauth/revoke', '/oauth/jwks.json', '/login/callback',
];
// MCP server (azure-functions PartnerMcp: McpPath "/v1" and its RFC 9728 metadata path).
const MCP_ROUTES = ['/v1', '/.well-known/oauth-protected-resource/v1'];

if (process.env.AZURE_FUNCTIONS_DIR) {
  const dir = join(process.env.AZURE_FUNCTIONS_DIR, 'SandboxAuth/Functions');
  const implemented = new Set(readdirSync(dir).filter(f => f.endsWith('.cs'))
    .flatMap(f => [...readFileSync(join(dir, f), 'utf8').matchAll(/Route\s*=\s*"([^"]+)"/g)].map(m => '/' + m[1])));
  for (const r of AUTH_ROUTES) if (!implemented.has(r)) errors.push(`auth route ${r} is not implemented in ${dir}`);
  for (const r of implemented) if (!AUTH_ROUTES.includes(r)) warnings.push(`auth route ${r} exists but is not in AUTH_ROUTES`);
  const program = readFileSync(join(process.env.AZURE_FUNCTIONS_DIR, 'PartnerMcp/PartnerMcpOptions.cs'), 'utf8');
  if (!program.includes('"https://mcp.messpunkt.io/v1"')) errors.push('PartnerMcp: default Resource is not https://mcp.messpunkt.io/v1');
}

// --- tools/list -----------------------------------------------------------------------------------------
let tools = null;
try {
  tools = loadTools();
} catch (e) {
  errors.push(e.message);
}
if (!tools) (allowPending ? warnings : errors).push('mcp/tools-list.json missing: tool reference still pending (P08b)');
const toolNames = new Set(tools?.tools.map(t => t.name) ?? []);
const toolScopes = new Set(tools?.tools.map(t => t.scope) ?? []);
if (tools && process.env.AZURE_FUNCTIONS_DIR) {
  // The scope map in tools-list.source.json must match [RequiresScope] next to each [McpServerTool(Name = …)].
  // The attribute takes a string literal or a constant of PartnerMcp/Security/McpScopes.cs (since FX-C1).
  const dir = join(process.env.AZURE_FUNCTIONS_DIR, 'PartnerMcp/Tools');
  const scopesFile = join(process.env.AZURE_FUNCTIONS_DIR, 'PartnerMcp/Security/McpScopes.cs');
  const constants = new Map(existsSync(scopesFile)
    ? [...readFileSync(scopesFile, 'utf8').matchAll(/const string (\w+) = "([^"]+)"/g)].map(m => [m[1], m[2]]) : []);
  const code = new Map(readdirSync(dir).filter(f => f.endsWith('.cs'))
    .flatMap(f => [...readFileSync(join(dir, f), 'utf8').matchAll(/McpServerTool\(Name = "([^"]+)"[\s\S]*?\[RequiresScope\((?:"([^"]+)"|McpScopes\.(\w+))\)\]/g)])
    .map(m => [m[1], m[2] ?? constants.get(m[3])]));
  for (const t of tools.tools)
    if (code.get(t.name) !== t.scope) errors.push(`tool ${t.name}: scope ${t.scope} != [RequiresScope] ${code.get(t.name) ?? '(none)'} in ${dir}`);
  for (const n of code.keys()) if (!toolNames.has(n)) errors.push(`tool ${n} exists in code but not in mcp/tools-list.json (snapshot outdated?)`);
}

// --- pages ----------------------------------------------------------------------------------------------
const GUIDES = ['connect/index.html', 'erp/index.html', 'mcp/index.html'];
const SCANNED = [...GUIDES, 'quickstart/index.html', 'index.html', 'llms.txt', 'README.md'];
const PLACEHOLDERS = ['SUPPORT_KONTAKT', 'AVV_HINWEIS', 'PROD_RATE_LIMITS'];
const placeholderHits = [];

const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

for (const file of SCANNED) {
  if (!existsSync(join(ROOT, file))) { errors.push(`${file}: missing`); continue; }
  const text = decode(read(file));
  const isGuide = GUIDES.includes(file);

  // 1 + 2: URLs on our hosts
  for (const m of text.matchAll(/https:\/\/(api|auth|mcp)(\.sandbox)?\.messpunkt\.io(\/[^\s"'`<>)\\]*)?/g)) {
    const [url, host, sandbox] = m;
    const path = (m[3] ?? '').split(/[?#]/)[0].replace(/[.,;:]+$/, '');
    if (!path || path === '/' || path === '/v1/') continue;                        // bare origin, e.g. a resource value
    if (host === 'api') {
      if (!path.startsWith('/v1')) errors.push(`${file}: ${url}: API path outside /v1`);
      else if (path !== '/v1' && !matchesSpec(path.slice(3))) errors.push(`${file}: ${url}: no such path in the spec`);
    } else if (host === 'auth') {
      if (!AUTH_ROUTES.includes(path)) errors.push(`${file}: ${url}: unknown authorization-server route`);
    } else {
      if (sandbox) errors.push(`${file}: ${url}: there is no sandbox MCP server`);
      if (!MCP_ROUTES.includes(path)) errors.push(`${file}: ${url}: unknown MCP route`);
    }
  }
  // endpoint mentions like `GET /v1/usage-units/{id}` in text
  for (const m of text.matchAll(/\b(?:GET|POST) (\/v1\/[a-z0-9{}\/_-]+)/g))
    if (!matchesSpec(m[1].slice(3))) errors.push(`${file}: ${m[0]}: no such path in the spec`);

  // 3: scopes
  for (const m of text.matchAll(/\b((?:read|write):[a-z][a-z-]*)\b/g))
    if (!specScopes.has(m[1]) && !toolScopes.has(m[1])) errors.push(`${file}: scope ${m[1]} does not exist`);

  // 4: tool names
  if (tools) {
    const codeSpans = [...text.matchAll(/<code>([a-z_]+)<\/code>|`([a-z_]+)`/g)].map(m => m[1] ?? m[2]);
    const listed = file === 'llms.txt' || file === 'README.md'
      ? [...text.matchAll(/`((?:list|get)_[a-z_]+)`/g)].map(m => m[1]) : codeSpans;
    for (const n of listed) if (/^(list|get)_[a-z_]+$/.test(n) && !toolNames.has(n)) errors.push(`${file}: tool ${n} is not in tools/list`);
    if (file === 'llms.txt')
      for (const n of toolNames) if (!text.includes('`' + n + '`')) errors.push(`llms.txt: tool ${n} is not mentioned`);
  }

  // 9: facts that regressed before (RU D-1, D-2)
  for (const m of text.matchAll(/refresh[_ ]tokens?\b[^.]{0,80}?\b(\d+) days/gi))
    if (m[1] !== '90') errors.push(`${file}: "${m[0]}": refresh tokens expire after 90 days without use`);
  if (/refresh[_ ]tokens?\b[^.]{0,80}absolute (session )?cap \d/i.test(text))
    errors.push(`${file}: refresh tokens have no absolute cap`);
  if (/code=\[A-F0-9\]/.test(text))
    errors.push(`${file}: extracts the authorization code as hex; codes are base64url (use sed 's/.*[?&]code=([^&]*).*/\\1/')`);

  // placeholders
  for (const p of PLACEHOLDERS) {
    const count = text.split('<' + p + '>').length - 1;
    if (count) placeholderHits.push(`${file}: <${p}> ×${count}`);
  }

  if (!file.endsWith('.html')) continue;
  // 5: relative links and anchors
  const raw = read(file);
  const ids = new Set([...raw.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  for (const m of raw.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const ref = decode(m[1]);
    if (/^(https?:|mailto:)/.test(ref)) continue;
    if (ref.startsWith('#')) { if (!ids.has(ref.slice(1))) errors.push(`${file}: anchor ${ref} not found`); continue; }
    const [target, anchor] = ref.split('#');
    let p = normalize(join(dirname(join(ROOT, file)), target));
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
    if (!existsSync(p)) { errors.push(`${file}: link ${ref} does not resolve`); continue; }
    if (anchor && p.endsWith('.html') && !p.endsWith('reference/index.html')
        && !new RegExp(`\\sid="${anchor}"`).test(readFileSync(p, 'utf8'))) errors.push(`${file}: anchor ${ref} not found`);
  }
}

// 6: announcements
for (const [file, needles] of [
  ['index.html', ['./connect/', './erp/', './mcp/', './roadmap/']],
  ['llms.txt', ['https://developer.messpunkt.io/connect/', 'https://developer.messpunkt.io/erp/', 'https://developer.messpunkt.io/mcp/', 'https://developer.messpunkt.io/roadmap/']],
  ['erp/index.html', ['../roadmap/']],
  ['changelog/index.html', ['../roadmap/']],
]) {
  const text = read(file);
  for (const n of needles) if (!text.includes(n)) errors.push(`${file}: does not link ${n}`);
}
for (const file of ['index.html', 'llms.txt', 'README.md', 'erp-api-openapi.yaml', ...GUIDES]) {
  const text = read(file);
  // Seit 2026-09-30 sind auth., api. und mcp.messpunkt.io live. Der Waechter haelt fest, dass keine Seite die
  // Produktion wieder als „kommt mit dem ersten Pilotpartner" beschreibt (stand bis 2026-10-04 auf jeder Seite).
  // Die deutschen Wendungen und „rc.3 is unpublished" standen bis 2026-10-31 noch in connect/ und llms.txt.
  if (/(goes live|GA ships|GA with) (with )?the first pilot partner|production in preparation|not yet available|V1 in Vorbereitung|zusammen mit der Produktions-Schnittstelle live|rc\.3 is unpublished/i.test(text))
    errors.push(`${file}: describes production as not yet live; it is live since 2026-09-30`);
}

// 7: verified / unverified per client
const connect = read('connect/index.html');
// The consent screen (azure-functions SandboxAuth ConsentPage) links connect/#datenschutz from outside this repo.
if (!/\sid="datenschutz"/.test(connect)) errors.push('connect/index.html: anchor #datenschutz is gone, but the consent screen links it');
const sections = [...connect.matchAll(/<section id="([^"]+)" data-client="[^"]+">([\s\S]*?)<\/section>/g)];
if (sections.length < 4) errors.push(`connect/index.html: expected 4 client sections, found ${sections.length}`);
for (const [, id, body] of sections) {
  if (!body.includes('class="verified"')) errors.push(`connect/#${id}: no "verified" block`);
  if (!body.includes('class="unverified"')) errors.push(`connect/#${id}: no "unverified" block`);
}

// 8: generated block
try {
  const { current, expected } = renderPage();
  if (current !== expected) errors.push('mcp/index.html: tool reference out of date (node scripts/render-tools.mjs)');
} catch (e) {
  errors.push(e.message);
}

// 10: problem types resolve to errors/
{
  const errorIds = new Set([...read('errors/index.html').matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  for (const file of ['erp-api-openapi.yaml', 'errors/index.html', 'bruno/get-property-out-of-scope.bru', ...SCANNED]) {
    const text = read(file);
    for (const m of text.matchAll(/https:\/\/developer\.messpunkt\.io\/errors\/#([a-z-]+)/g))
      if (!errorIds.has(m[1])) errors.push(`${file}: problem type #${m[1]} has no anchor on errors/`);
    if (/https:\/\/(api|auth)(\.sandbox)?\.messpunkt\.io\/errors\//.test(text))
      errors.push(`${file}: problem type on the API host; use https://developer.messpunkt.io/errors/#<code>`);
  }
}

// 11: Bruno collection: zip = repo files; request IDs exist in the sandbox fixture
const BRUNO_ZIP_DIR = 'messpunkt-sandbox-api/';
const NULL_UUID = '00000000-0000-0000-0000-000000000000';
const brunoFiles = readdirSync(join(ROOT, 'bruno')).filter(f => f.endsWith('.bru') || f === 'bruno.json').sort();
// Minimal zip reader (central directory; stored or deflated entries), so the check needs no unzip binary.
function readZip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('not a zip file');
  const entries = new Map();
  for (let i = 0, p = buf.readUInt32LE(eocd + 16); i < buf.readUInt16LE(eocd + 10); i++) {
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    if (!name.endsWith('/')) entries.set(name, method === 0 ? data : method === 8 ? inflateRawSync(data) : null);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}
try {
  const zip = readZip(readFileSync(join(ROOT, 'bruno/messpunkt-sandbox.zip')));
  for (const f of brunoFiles) {
    const entry = zip.get(BRUNO_ZIP_DIR + f);
    if (!entry) errors.push(`bruno/messpunkt-sandbox.zip: ${BRUNO_ZIP_DIR}${f} missing (rebuild the zip)`);
    else if (!entry.equals(readFileSync(join(ROOT, 'bruno', f)))) errors.push(`bruno/messpunkt-sandbox.zip: ${f} differs from bruno/${f} (rebuild the zip)`);
  }
  for (const name of zip.keys())
    if (!name.startsWith(BRUNO_ZIP_DIR) || !brunoFiles.includes(name.slice(BRUNO_ZIP_DIR.length)))
      errors.push(`bruno/messpunkt-sandbox.zip: ${name} is not a file of bruno/`);
} catch (e) {
  errors.push(`bruno/messpunkt-sandbox.zip: ${e.message}`);
}
let brunoIdCheck = 'skipped (set AZURE_FUNCTIONS_DIR to check the request IDs against the sandbox fixture)';
if (process.env.AZURE_FUNCTIONS_DIR) {
  const fixturePath = join(process.env.AZURE_FUNCTIONS_DIR, 'SandboxApi/Fixtures/sandbox-data.json');
  if (!existsSync(fixturePath)) errors.push(`bruno: sandbox fixture ${fixturePath} not found`);
  else {
    const fixtureIds = new Set([...readFileSync(fixturePath, 'utf8').matchAll(/"id":\s*"([0-9a-f-]{36})"/gi)].map(m => m[1].toLowerCase()));
    let count = 0;
    for (const f of brunoFiles.filter(f => f.endsWith('.bru'))) {
      for (const m of read('bruno/' + f).matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)) {
        const id = m[0].toLowerCase();
        if (id === NULL_UUID && f === 'get-property-out-of-scope.bru') continue;   // the 404 demo, deliberately not in the fixture
        count++;
        if (!fixtureIds.has(id)) errors.push(`bruno/${f}: ${id} is not an id in the sandbox fixture (${fixturePath})`);
      }
    }
    brunoIdCheck = `${count} UUID(s) checked against ${fixturePath}`;
  }
}

// --- report ---------------------------------------------------------------------------------------------
console.log(`spec: ${specPaths.length} paths, scopes ${[...specScopes].sort().join(' ')}`);
console.log(`tools/list: ${tools ? `${tools.tools.length} tools (${[...toolNames].join(', ')})` : 'pending'}`);
console.log(`auth routes: ${process.env.AZURE_FUNCTIONS_DIR ? 'checked against ' + process.env.AZURE_FUNCTIONS_DIR : 'static list (set AZURE_FUNCTIONS_DIR to check against the code)'}`);
console.log(`bruno IDs: ${brunoIdCheck}`);
console.log('placeholders (must stay visible until filled):');
for (const p of placeholderHits) console.log('  ' + p);
for (const w of warnings) console.log('WARN ' + w);
for (const e of errors) console.log('FAIL ' + e);
console.log(errors.length ? `${errors.length} problem(s)` : 'OK');
process.exit(errors.length ? 1 : 0);
