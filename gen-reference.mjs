import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const out = [];
const w = (s = '') => out.push(s);
const rel = (p) => p.replace(/\\/g, '/');
function walk(dir, filter, acc = []) {
  for (const n of readdirSync(dir)) { const p = join(dir, n); const st = statSync(p); if (st.isDirectory()) walk(p, filter, acc); else if (filter(p)) acc.push(p); }
  return acc;
}
const uniq = (a) => [...new Set(a)];
const tablesIn = (s) => uniq([...s.matchAll(/\.from\(['"`]([a-z_]+)['"`]\)/g)].map(m => m[1]));
const rpcsIn = (s) => uniq([...s.matchAll(/\.rpc\(['"`]([a-z_]+)['"`]/g)].map(m => m[1]));
const opsIn = (s) => uniq([
  /\.insert\(/.test(s) && 'insert', /\.upsert\(/.test(s) && 'upsert', /\.update\(/.test(s) && 'update',
  /\.delete\(/.test(s) && 'delete', /\.select\(/.test(s) && 'select', /\.rpc\(/.test(s) && 'rpc',
  /storage\.from/.test(s) && 'storage', /\.channel\(/.test(s) && 'realtime',
].filter(Boolean));

// leading // or /** */ comment immediately above an index
function leadComment(src, idx) {
  const before = src.slice(0, idx).split(/\r?\n/);
  const buf = [];
  for (let i = before.length - 2; i >= 0; i--) {
    const t = before[i].trim();
    if (t === '') { if (buf.length) break; else continue; }
    if (t.startsWith('//')) buf.unshift(t.replace(/^\/\/\s?/, ''));
    else if (t.startsWith('*') || t.startsWith('/*') || t.endsWith('*/')) buf.unshift(t.replace(/^\/?\*+\/?/, '').replace(/\*\/$/, '').trim());
    else break;
  }
  return buf.filter(x => x && !x.includes('====')).join(' ').slice(0, 220);
}
function headComment(src) {
  const cl = src.split(/\r?\n/).slice(0, 14).filter(l => l.trim().startsWith('//') && !l.includes('====')).map(l => l.replace(/^\s*\/\/\s?/, '').trim()).filter(Boolean);
  return cl.slice(0, 3).join(' ');
}

// ---------- ROUTES (detailed) ----------
const pageFiles = walk('src/app', p => p.endsWith('page.tsx')).map(rel);
const routeOf = (p) => { let r = p.replace(/^src\/app/, '').replace(/\/page\.tsx$/, '').replace(/\/\([^)]+\)/g, ''); return r === '' ? '/' : r; };
const pageInfo = pageFiles.map(p => {
  const src = readFileSync(p, 'utf8');
  const title = (src.match(/title=["'`]([^"'`]{2,60})["'`]/) || src.match(/title=\{`([^`]{2,60})`/) || [])[1] || '';
  const services = uniq([...src.matchAll(/from ['"]@\/services\/([A-Za-z0-9_]+)['"]/g)].map(m => m[1]));
  const tables = tablesIn(src);
  return { route: routeOf(p), title, services, tables };
}).sort((a, b) => a.route.localeCompare(b.route));
const byMod = {};
for (const p of pageInfo) { const seg = p.route === '/' ? '(root)' : p.route.split('/')[1]; (byMod[seg] ||= []).push(p); }
const apiRoutes = walk('src/app', p => p.endsWith('route.ts')).map(p => routeOf(rel(p).replace(/route\.ts$/, 'page.tsx')));

// ---------- SERVICES (deep) ----------
const svcFiles = readdirSync('src/services').filter(f => f.endsWith('.ts')).sort();
const services = svcFiles.map(f => {
  const src = readFileSync(join('src/services', f), 'utf8');
  const defRe = /(?:^|\n)([ \t]{2,6})(async\s+)?([a-zA-Z_]\w*)\s*(?:<[^>]*>)?\(([^)]*)\)|(?:^|\n)export\s+function\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)/g;
  const defs = []; let m;
  while ((m = defRe.exec(src))) {
    const name = m[3] || m[5];
    if (['if', 'for', 'while', 'switch', 'catch', 'map', 'filter', 'forEach', 'then', 'reduce', 'function', 'constructor', 'return', 'await', 'throw', 'yield', 'console', 'typeof', 'new', 'super'].includes(name)) continue;
    const params = (m[4] || m[6] || '').replace(/\s+/g, ' ').trim();
    defs.push({ name, async: !!m[2] || !!m[5] === false && !!m[2], isFn: !!m[5], params, idx: m.index + (m[0].startsWith('\n') ? 1 : 0) });
  }
  // de-dupe by name (first occurrence)
  const seen = new Set(); const methods = [];
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i]; if (seen.has(d.name)) continue; seen.add(d.name);
    const end = defs[i + 1] ? defs[i + 1].idx : Math.min(src.length, d.idx + 2200);
    const body = src.slice(d.idx, end);
    methods.push({ ...d, comment: leadComment(src, d.idx), tables: tablesIn(body), rpcs: rpcsIn(body), ops: opsIn(body) });
  }
  return { file: f.replace(/\.ts$/, ''), desc: headComment(src), methods };
}).filter(s => s.methods.length);

const hooks = readdirSync('src/hooks').filter(f => /\.tsx?$/.test(f)).map(f => f.replace(/\.tsx?$/, '')).sort();
const migs = readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort();
const totalFns = services.reduce((a, s) => a + s.methods.length, 0);

// ---------- WRITE ----------
w('# JEET ERP — Deep Reference (every page & function)');
w('');
w('> Auto-generated from source. For each **page**: title, services used, tables queried.');
w('> For each **function**: what it does (doc-comment), tables touched, RPCs called, DB operations.');
w('> Pair with `JEET-ERP-SYSTEM-REPORT.md` (architecture & business-logic narrative).');
w('');
w(`**Totals:** ${pageInfo.length} pages · ${apiRoutes.length} API routes · ${services.length} services / **${totalFns} functions** · ${hooks.length} hooks · ${migs.length} migrations.`);
w('');
w('Legend — **ops:** insert/update/delete/upsert/select/rpc/storage/realtime · **tables:** Postgres tables read or written · **rpc:** Postgres functions called.');
w('\n---\n');

w('## 1. Pages — detailed');
w('');
const modLabels = { '(root)': 'Root', signin: 'Sign in', signup: 'Sign up', workspace: 'My Workspace', sales: 'Sales & Pre-Award', projects: 'Projects', procurement: 'Procurement', warehouse: 'Warehouse', service: 'Service', 'service-desk': 'Service Desk', amc: 'AMC', fleet: 'Fleet', assets: 'Assets', hr: 'HR', payroll: 'Payroll', finance: 'Finance', comms: 'Communications', admin: 'Administration' };
for (const mod of Object.keys(byMod)) {
  w(`### ${modLabels[mod] || mod} — \`/${mod === '(root)' ? '' : mod}\` (${byMod[mod].length})`);
  w('');
  for (const p of byMod[mod]) {
    w(`#### \`${p.route}\`${p.title ? ` — ${p.title}` : ''}`);
    if (p.services.length) w(`- **services:** ${p.services.map(s => '`' + s + '`').join(', ')}`);
    if (p.tables.length) w(`- **tables:** ${p.tables.map(t => '`' + t + '`').join(', ')}`);
    if (!p.services.length && !p.tables.length) w('- *(presentational / composed of child components)*');
    w('');
  }
}
w('### API routes (server)');
w('');
for (const r of apiRoutes.sort()) w(`- \`${r}\``);
w('\n---\n');

w('## 2. Services — every function');
w('');
for (const s of services) {
  w(`### \`${s.file}\`${s.desc ? ` — ${s.desc}` : ''}`);
  w('');
  for (const mth of s.methods) {
    w(`**\`${mth.async ? 'async ' : ''}${mth.name}(${mth.params.length > 100 ? mth.params.slice(0, 98) + '…' : mth.params})\`**${mth.isFn ? ' *(pure fn)*' : ''}  `);
    if (mth.comment) w(mth.comment + '  ');
    const bits = [];
    if (mth.ops.length) bits.push(`ops: ${mth.ops.join(', ')}`);
    if (mth.tables.length) bits.push(`tables: ${mth.tables.map(t => '`' + t + '`').join(', ')}`);
    if (mth.rpcs.length) bits.push(`rpc: ${mth.rpcs.map(t => '`' + t + '`').join(', ')}`);
    if (bits.length) w('› ' + bits.join(' · '));
    w('');
  }
}
w('---\n');
w('## 3. Data hooks');
w('');
for (const h of hooks) w(`- \`${h}\``);
w('\n---\n');
w('## 4. Migrations (data model)');
w('');
for (const m of migs) w(`- \`${m}\``);
w('');

writeFileSync('docs/JEET-ERP-DEEP-REFERENCE.md', out.join('\n'));
console.log(`wrote docs/JEET-ERP-DEEP-REFERENCE.md — ${out.length} lines · ${pageInfo.length} pages · ${services.length} services · ${totalFns} functions`);
