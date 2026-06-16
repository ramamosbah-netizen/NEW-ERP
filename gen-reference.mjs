import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = 'src';
const out = [];
const w = (s = '') => out.push(s);

// ---------- helpers ----------
function walk(dir, filter, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, filter, acc);
    else if (filter(p)) acc.push(p);
  }
  return acc;
}
const rel = (p) => p.replace(/\\/g, '/');
function headComment(src) {
  // first run of // lines or a /* */ block near top
  const lines = src.split(/\r?\n/).slice(0, 14);
  const cl = lines.filter(l => l.trim().startsWith('//') && !l.includes('eslint') && !l.includes('====')).map(l => l.replace(/^\s*\/\/\s?/, '').trim()).filter(Boolean);
  return cl.slice(0, 3).join(' ');
}

// ---------- 1. ROUTES ----------
const pages = walk(join(ROOT, 'app'), p => p.endsWith('page.tsx')).map(rel);
const routeOf = (p) => {
  let r = p.replace(/^src\/app/, '').replace(/\/page\.tsx$/, '');
  r = r.replace(/\/\([^)]+\)/g, ''); // route groups
  return r === '' ? '/' : r;
};
const routes = pages.map(routeOf).sort();
const byModule = {};
for (const r of routes) {
  const seg = r === '/' ? '(root)' : r.split('/')[1];
  (byModule[seg] ||= []).push(r);
}
const apiRoutes = walk(join(ROOT, 'app'), p => p.endsWith('route.ts')).map(p => routeOf(rel(p).replace(/route\.ts$/, 'page.tsx')));

// ---------- 2. SERVICES ----------
const svcFiles = readdirSync(join(ROOT, 'services')).filter(f => f.endsWith('.ts')).sort();
const services = svcFiles.map(f => {
  const src = readFileSync(join(ROOT, 'services', f), 'utf8');
  const desc = headComment(src);
  const methods = [];
  const re = /^\s{2,6}(async\s+)?([a-zA-Z_]\w*)\s*(<[^>]*>)?\s*\(([^)]*)\)/gm;
  let m; const seen = new Set();
  while ((m = re.exec(src))) {
    const name = m[2];
    if (['if', 'for', 'while', 'switch', 'catch', 'map', 'filter', 'forEach', 'then', 'reduce', 'return', 'function', 'constructor'].includes(name)) continue;
    if (seen.has(name)) continue; seen.add(name);
    let params = m[4].replace(/\s+/g, ' ').trim();
    if (params.length > 90) params = params.slice(0, 88) + '…';
    methods.push(`${m[1] ? 'async ' : ''}${name}(${params})`);
  }
  // also top-level exported functions
  const re2 = /export\s+function\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)/g;
  while ((m = re2.exec(src))) { if (!seen.has(m[1])) { seen.add(m[1]); methods.push(`function ${m[1]}(${m[2].replace(/\s+/g, ' ').trim().slice(0, 88)})`); } }
  return { file: f.replace(/\.ts$/, ''), desc, methods };
}).filter(s => s.methods.length);

// ---------- 3. HOOKS ----------
const hooks = readdirSync(join(ROOT, 'hooks')).filter(f => f.endsWith('.ts') || f.endsWith('.tsx')).map(f => f.replace(/\.tsx?$/, '')).sort();

// ---------- 4. MIGRATIONS ----------
const migs = readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort();

// ---------- WRITE ----------
const totalMethods = services.reduce((a, s) => a + s.methods.length, 0);
w('# JEET ERP — Full Reference (auto-generated)');
w('');
w('> Generated from the source tree — every page route, every service function signature,');
w('> every hook and migration. Pair with `JEET-ERP-SYSTEM-REPORT.md` (architecture & logic narrative).');
w('');
w(`**Totals:** ${routes.length} page routes · ${apiRoutes.length} API routes · ${services.length} services exposing **${totalMethods} functions** · ${hooks.length} hooks · ${migs.length} migrations.`);
w('');
w('---');
w('');
w('## 1. Pages by module');
w('');
const modOrder = ['(root)', 'signin', 'signup', 'dashboard', 'myday', 'workspace', 'tasks', 'meetings', 'notifications', 'sales', 'tenders', 'quotations', 'vo', 'projects', 'snags', 'tc', 'handover', 'procurement', 'warehouse', 'pricing', 'service', 'service-desk', 'ppm', 'amc', 'technician', 'fleet', 'assets', 'tools', 'hr', 'payroll', 'timesheets', 'finance', 'documents', 'reports', 'comms', 'whatsapp', 'admin', 'settings'];
const mods = [...new Set([...modOrder.filter(m => byModule[m]), ...Object.keys(byModule)])];
for (const mod of mods) {
  const rs = byModule[mod]; if (!rs) continue;
  w(`### \`/${mod === '(root)' ? '' : mod}\` — ${rs.length} page${rs.length > 1 ? 's' : ''}`);
  w('');
  for (const r of rs) w(`- \`${r}\``);
  w('');
}
w('### API routes');
w('');
for (const r of apiRoutes.sort()) w(`- \`${r}\` (server)`);
w('');
w('---');
w('');
w('## 2. Services — function reference');
w('');
w('Every service object and its public functions (signatures extracted from source).');
w('');
for (const s of services) {
  w(`### \`${s.file}\``);
  if (s.desc) w(`*${s.desc}*`);
  w('');
  for (const mth of s.methods) w(`- \`${mth}\``);
  w('');
}
w('---');
w('');
w('## 3. Data hooks');
w('');
for (const h of hooks) w(`- \`${h}\``);
w('');
w('---');
w('');
w('## 4. Migrations (data model)');
w('');
for (const m of migs) w(`- \`${m}\``);
w('');

writeFileSync('docs/JEET-ERP-FULL-REFERENCE.md', out.join('\n'));
console.log(`wrote docs/JEET-ERP-FULL-REFERENCE.md — ${out.length} lines · ${routes.length} routes · ${services.length} services · ${totalMethods} functions`);
