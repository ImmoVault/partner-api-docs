#!/usr/bin/env node
// Renders the MCP tool reference in mcp/index.html from the saved tools/list snapshot.
//
//   node scripts/render-tools.mjs          rewrite the generated block
//   node scripts/render-tools.mjs --check  exit 1 if the block is out of date
//
// Inputs (both committed):
//   mcp/tools-list.json         verbatim copy of PartnerMcp.Tests/Snapshots/tools-list.json (azure-functions)
//   mcp/tools-list.source.json  { source, commit, sha256, scopes: { <tool>: <scope> } }
//
// tools/list does not carry the scope a tool requires (it lives in [RequiresScope] on the server), so the
// scope comes from tool._meta["messpunkt/requiredScope"] when present, otherwise from source.scopes.
// No dependencies: plain Node >= 18.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'mcp/index.html';
const BEGIN = '<!-- BEGIN GENERATED: scripts/render-tools.mjs -->';
const END = '<!-- END GENERATED -->';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Loads the snapshot; null when it has not been copied yet. Throws on a hash mismatch or a tool without scope. */
export function loadTools(root = ROOT) {
  const listPath = join(root, 'mcp/tools-list.json');
  const sourcePath = join(root, 'mcp/tools-list.source.json');
  if (!existsSync(listPath)) return null;
  const raw = readFileSync(listPath);
  const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const sha256 = createHash('sha256').update(raw).digest('hex');
  if (source.sha256 !== sha256)
    throw new Error(`mcp/tools-list.json sha256 ${sha256} != recorded ${source.sha256} (copy it verbatim and update tools-list.source.json)`);
  const parsed = JSON.parse(raw.toString('utf8'));
  const tools = (Array.isArray(parsed) ? parsed : parsed.tools ?? parsed.result?.tools ?? [])
    .map(t => ({ ...t, scope: t._meta?.['messpunkt/requiredScope'] ?? source.scopes?.[t.name] }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (tools.length === 0) throw new Error('mcp/tools-list.json contains no tools');
  const unscoped = tools.filter(t => !t.scope).map(t => t.name);
  if (unscoped.length) throw new Error(`no required scope known for: ${unscoped.join(', ')}`);
  return { tools, source, sha256 };
}

const typeOf = s => {
  if (!s) return '';
  if (s.enum) return s.enum.map(v => JSON.stringify(v)).join(' | ');
  const t = Array.isArray(s.type) ? s.type.join(' | ') : s.type ?? (s.anyOf || s.oneOf ? 'union' : 'object');
  const fmt = s.format ? ` (${s.format})` : s.pattern ? ` (${s.pattern})` : '';
  return t === 'array' ? `array of ${typeOf(s.items)}` : t + fmt;
};

function inputTable(schema) {
  const props = Object.entries(schema?.properties ?? {});
  if (props.length === 0) return '<p class="meta">No input.</p>';
  const required = new Set(schema.required ?? []);
  const rows = props.map(([name, s]) => {
    const limits = [s.minimum != null && `min ${s.minimum}`, s.maximum != null && `max ${s.maximum}`,
      s.default !== undefined && `default ${JSON.stringify(s.default)}`].filter(Boolean).join(', ');
    return `          <tr><td><code>${esc(name)}</code></td><td>${esc(typeOf(s))}${limits ? `<br><span class="meta">${esc(limits)}</span>` : ''}</td>` +
      `<td>${required.has(name) ? 'yes' : 'no'}</td><td lang="de">${esc(s.description)}</td></tr>`;
  });
  return `        <div class="table-wrap"><table>
          <tr><th>Input</th><th>Type</th><th>Required</th><th>Description (as delivered)</th></tr>
${rows.join('\n')}
        </table></div>`;
}

/** The HTML that goes between the markers. */
export function renderSection(root = ROOT) {
  const data = loadTools(root);
  if (!data) {
    return `      <div class="status" id="tools-pending"><strong>Pending.</strong> This section is generated from the server's <code>tools/list</code> snapshot and is filled in before publication.</div>`;
  }
  const { tools, source, sha256 } = data;
  const summary = tools.map(t =>
    `          <tr><td><a href="#tool-${esc(t.name)}"><code>${esc(t.name)}</code></a></td><td lang="de">${esc(t.title ?? t.annotations?.title)}</td><td><code>${esc(t.scope)}</code></td></tr>`);
  const cards = tools.map(t => {
    const a = t.annotations ?? {};
    const hints = ['readOnlyHint', 'idempotentHint', 'destructiveHint', 'openWorldHint']
      .filter(k => a[k] !== undefined).map(k => `<code>${k}: ${a[k]}</code>`).join(' · ');
    return `      <section class="tool" id="tool-${esc(t.name)}">
        <h3>${esc(t.name)}</h3>
        <div class="meta"><span lang="de">${esc(t.title ?? a.title)}</span> · scope <code>${esc(t.scope)}</code>${hints ? ` · ${hints}` : ''}</div>
        <blockquote lang="de">${esc(t.description)}</blockquote>
${inputTable(t.inputSchema)}
        <details><summary>Input schema</summary><pre><code>${esc(JSON.stringify(t.inputSchema ?? {}, null, 2))}</code></pre></details>
        <details><summary>Output schema</summary><pre><code>${esc(JSON.stringify(t.outputSchema ?? null, null, 2))}</code></pre></details>
      </section>`;
  });
  return `      <p>${tools.length} tools. Generated from <a href="./tools-list.json">tools-list.json</a> (sha256 <code>${sha256.slice(0, 12)}…</code>, ${esc(source.source)} at <code>${esc(source.commit)}</code>). Descriptions are quoted exactly as the server delivers them (German).</p>
      <div class="table-wrap"><table>
          <tr><th>Tool</th><th>Title</th><th>Required scope</th></tr>
${summary.join('\n')}
      </table></div>
${cards.join('\n')}`;
}

/** Returns { current, expected } page contents. */
export function renderPage(root = ROOT) {
  const current = readFileSync(join(root, PAGE), 'utf8');
  const start = current.indexOf(BEGIN);
  const end = current.indexOf(END);
  if (start < 0 || end < start) throw new Error(`${PAGE}: generated-block markers missing`);
  const expected = current.slice(0, start + BEGIN.length) + '\n' + renderSection(root) + '\n' + current.slice(end);
  return { current, expected };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { current, expected } = renderPage();
    if (process.argv.includes('--check')) {
      if (current !== expected) { console.error(`${PAGE} is out of date: run node scripts/render-tools.mjs`); process.exit(1); }
      console.log(`${PAGE} is up to date`);
    } else {
      writeFileSync(join(ROOT, PAGE), expected);
      console.log(`${PAGE} written`);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
