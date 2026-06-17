#!/usr/bin/env python3
# ============================================================
# JEET ERP — Portfolio seed generator (Phase 1)
# Reads ELV_PM_Tracker_Final.xlsx and emits an idempotent, FK-safe
# wipe-and-reseed SQL migration for the CORE entities:
#   clients · projects (awarded only) · client_invoices · pricing_suppliers
#
# Decisions (confirmed with the user):
#  - Source of truth = Excel tracker (status/client/scope), enriched with
#    quoted values from the Quotation Tracker sheet.
#  - Only AWARDED/executed rows become projects. Pre-award "Quotation Sent"
#    rows are skipped here (Phase 2 -> tenders/BOQ/quotations).
#  - Wipe-and-reseed in ONE transaction (BEGIN/COMMIT). On any FK error the
#    whole thing rolls back — safe to iterate.
#  - created_by is taken from the admin user at apply time.
#
# Run:  python scripts/seed_portfolio.py  <path-to-xlsx>
# Out:  supabase/migrations/20260617000000_seed_portfolio.sql
# ============================================================
import sys, os, re, uuid, datetime
import openpyxl

XLSX = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\Jeet_intech\Desktop\ELV_PM_Tracker_Final.xlsx'
OUT  = os.path.join('supabase', 'migrations', '20260617000000_seed_portfolio.sql')
NS   = uuid.UUID('5f2e1a00-0000-4000-8000-000000000000')  # fixed namespace for deterministic ids

def q(v):
    """SQL string literal (or NULL)."""
    if v is None: return 'NULL'
    s = str(v).strip()
    if s == '' or s.lower() == 'none': return 'NULL'
    return "'" + s.replace("'", "''") + "'"

def num(v):
    if v is None: return 'NULL'
    s = str(v).replace(',', '').strip()
    if s in ('', 'none', '#VALUE!'): return 'NULL'
    try: return repr(round(float(s), 2))
    except Exception: return 'NULL'

def numf(v, default=0.0):
    g = num(v)
    return g if g != 'NULL' else repr(default)

def d(v):
    """SQL date literal (or NULL). Accepts datetime or messy strings."""
    if v is None: return 'NULL'
    if isinstance(v, (datetime.datetime, datetime.date)):
        return "'" + v.strftime('%Y-%m-%d') + "'"
    s = str(v).strip()
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})', s)
    if m:
        y, mo, da = int(m[1]), int(m[2]), int(m[3])
        if 1 <= mo <= 12 and 1 <= da <= 31:
            return f"'{y:04d}-{mo:02d}-{da:02d}'"
    return 'NULL'

def cid(name):    return str(uuid.uuid5(NS, 'client:' + name))
def sid(name):    return str(uuid.uuid5(NS, 'supplier:' + name))

# ---------- client normalisation (Excel short names -> canonical) ----------
def norm_client(raw):
    if not raw: return None
    full = str(raw).strip()
    up = full.upper()                    # match keywords on the FULL string first
    if 'KAYAN' in up:                   return 'M/s Kayan Al Arabiah Developers'
    if up.startswith('TSC') or 'DIAMOND' in up: return 'TSC Limited (Sustainable City)'
    if up.startswith('SSC'):            return 'SSC'
    if 'CITY SOLAR' in up:              return 'City Solar Energy Systems'
    if 'JEET MEP' in up:                return 'JEET MEP'
    if 'JEET FITOUT' in up:             return 'JEET Fitout'
    if 'HOLIDAY HOMES' in up:           return 'Holiday Homes'
    if 'SEE ENGINEERING' in up:         return 'SEE Engineering'
    if 'KAIRON' in up:                  return 'Kairon'
    if 'LAMASAT' in up:                 return 'Lamasat'
    if 'ALMOUSALLI' in up or 'ALMOUSSALI' in up: return 'Almousalli Restaurant'
    if 'WASSIM' in up or 'CLUSTER' in up: return 'Eng Wassim'
    return full.split('/')[0].strip().title()

# ---------- status / type / systems mapping ----------
AWARDED = {  # Excel status -> projects.status  (only these become projects)
    'completed': 'CLOSED', 'in progress': 'IN_PROGRESS', 'on hold': 'ON_HOLD',
    'quotation approved': 'MOBILIZATION', 'cancelled': 'CANCELLED',
}
SKIP_STATUS = {'quotation sent'}  # pre-award leads -> Phase 2

SCOPE_SYS = {
    'cctv': 'CCTV', 'gate barrier': 'GATE_BARRIER', 'access control': 'ACS',
    'home automation': 'AUTOMATION', 'it': 'IT', 'pbx': 'PBX', 'pava': 'PA_VA',
    'fo': 'FIBER', 'dta': 'DTA', 'qms': 'QMS', 'elv': 'ELV',
}
def proj_type(name, scope):
    n = (name or '').upper()
    if 'MAINTENANCE' in n or 'AMC' in n: return 'AMC'
    return 'SUPPLY_INSTALL'
def systems(scope):
    s = (scope or '').strip().lower()
    return SCOPE_SYS.get(s, 'ELV')

# ---------- read workbook ----------
wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
def rows(sheet, start):  # 1-indexed data start
    ws = wb[sheet]
    for r in ws.iter_rows(min_row=start, values_only=True):
        if r and any(c is not None and str(c).strip() != '' for c in r):
            yield r

clients = {}   # canonical name -> True
projects = []  # dicts
invoices = []
suppliers = []

# Project Register: data from row 5; cols 1=No,2=Proj,3=Name,4=Client,5=Loc,6=Scope,9=ContractDate,12=ActualComp,13=Status,15=Remarks
for r in rows('Project Register', 5):
    code = (r[1] or '').strip() if len(r) > 1 else ''
    if not re.match(r'^DSC-', str(code)): continue
    status_raw = (str(r[12]).strip().lower() if len(r) > 12 and r[12] else '')
    if status_raw in SKIP_STATUS or status_raw not in AWARDED:  # only awarded/executed
        continue
    name = (r[2] or code).strip()
    client = norm_client(r[3] if len(r) > 3 else None) or 'TSC Limited (Sustainable City)'
    clients[client] = True
    projects.append({
        'code': code, 'name': name, 'client': client,
        'status': AWARDED[status_raw],
        'ptype': proj_type(name, r[5] if len(r) > 5 else None),
        'systems': systems(r[5] if len(r) > 5 else None),
        'location': (r[4] if len(r) > 4 else None),
        'contract_date': (r[8] if len(r) > 8 else None),
        'actual_end': (r[11] if len(r) > 11 else None),
        'remarks': (r[14] if len(r) > 14 else None),
        'contract_value': 0.0,
    })

# Quotation Tracker -> contract_value (Net Quoted col 10) keyed by project code
qval = {}
for r in rows('Quotation Tracker', 4):
    c = (r[0] or '').strip() if r and r[0] else ''
    if not c: continue
    v = num(r[10] if len(r) > 10 else None)
    if v != 'NULL': qval[c] = v
for p in projects:
    if p['code'] in qval: p['contract_value'] = qval[p['code']]

# Invoice & Payment Tracker: data from row 4
for r in rows('Invoice & Payment Tracker', 4):
    inv = (r[0] or '').strip() if r and r[0] else ''
    if not re.match(r'^INV-', str(inv)): continue
    client = norm_client(r[2] if len(r) > 2 else None) or 'TSC Limited (Sustainable City)'
    clients[client] = True
    taxable = num(r[7] if len(r) > 7 else None)
    invoices.append({
        'number': inv, 'proj': (r[1] or '').strip() if len(r) > 1 else '',
        'client': client, 'desc': (r[3] if len(r) > 3 else None),
        'date': (r[4] if len(r) > 4 else None),
        'taxable': taxable if taxable != 'NULL' else '0',
        'collected': num(r[10] if len(r) > 10 else None),
        'status_raw': (str(r[12]).strip().lower() if len(r) > 12 and r[12] else ''),
    })

# Supplier Register: data from row 4 (skip placeholder [Subcon ..] + fake contacts)
for r in rows('Supplier Register', 4):
    ref = (r[0] or '').strip() if r and r[0] else ''
    if not re.match(r'^SUP-', str(ref)): continue
    name = (r[1] or '').strip()
    if not name or name.startswith('['): continue   # skip placeholder subcontractors
    suppliers.append({
        'name': name, 'category': (r[2] if len(r) > 2 else None),
        'terms': (r[7] if len(r) > 7 else None),
        'lead': (r[8] if len(r) > 8 else None),
        'preferred': ('★★★★★' in str(r[9])) if len(r) > 9 and r[9] else False,
    })

# ---------- emit SQL ----------
def terms_days(t):
    m = re.search(r'(\d+)\s*Day', str(t or ''), re.I)
    return m.group(1) if m else '30'

L = []
A = L.append
A("-- ============================================================")
A("-- JEET ERP — Portfolio seed (Phase 1): clients · projects · invoices · suppliers")
A("-- GENERATED by scripts/seed_portfolio.py from ELV_PM_Tracker_Final.xlsx — do not hand-edit.")
A("-- Add-only / idempotent (ON CONFLICT upserts) — safe to run repeatedly; deletes NOTHING.")
A("-- Apply in the Supabase SQL editor. (Demo-data cleanup is a separate, deliberate step —")
A("--  a blanket wipe would cascade into fleet/inventory/asset registers.)")
A("-- ============================================================")
A("BEGIN;")
A("")
A("-- admin user drives created_by (NOT NULL). Falls back to the first user.")
A("SELECT set_config('jeet.admin_id',")
A("  COALESCE((SELECT id::text FROM auth.users WHERE email='ramma.mosbah@gmail.com' LIMIT 1),")
A("           (SELECT id::text FROM auth.users ORDER BY created_at LIMIT 1)), false);")
A("")
A("-- Add-only / idempotent: upserts the real portfolio without deleting anything.")
A("-- (A blanket wipe would cascade into fleet/inventory/asset registers or require")
A("--  enumerating ~30 child tables; the demo cleanup is a separate, deliberate step.)")
A("")

# Clients
A("-- 2) CLIENTS")
for name in sorted(clients):
    A(f"INSERT INTO public.clients (id, name, country) VALUES "
      f"('{cid(name)}'::uuid, {q(name)}, 'UAE') "
      f"ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, country=EXCLUDED.country;")
A("")

# Projects
A("-- 3) PROJECTS (awarded / executed only)")
for p in projects:
    A("INSERT INTO public.projects (project_number, name, client_id, client_name, "
      "project_type, systems, status, contract_value, original_contract_value, budget_cost, "
      "site_address, start_date, actual_end_date, notes, created_by) VALUES (")
    A(f"  {q(p['code'])}, {q(p['name'])}, '{cid(p['client'])}'::uuid, {q(p['client'])}, "
      f"{q(p['ptype'])}, ARRAY[{q(p['systems'])}], {q(p['status'])}, "
      f"{numf(p['contract_value'])}, {numf(p['contract_value'])}, 0, "
      f"{q(p['location'])}, {d(p['contract_date'])}, {d(p['actual_end'])}, {q(p['remarks'])}, "
      f"current_setting('jeet.admin_id')::uuid)")
    A("  ON CONFLICT (project_number) DO UPDATE SET name=EXCLUDED.name, client_id=EXCLUDED.client_id, "
      "client_name=EXCLUDED.client_name, project_type=EXCLUDED.project_type, systems=EXCLUDED.systems, "
      "status=EXCLUDED.status, contract_value=EXCLUDED.contract_value, "
      "original_contract_value=EXCLUDED.original_contract_value, site_address=EXCLUDED.site_address, "
      "start_date=EXCLUDED.start_date, actual_end_date=EXCLUDED.actual_end_date, notes=EXCLUDED.notes;")
A("")

# Invoices — insert as DRAFT (satisfies the finance integrity guard), then UPDATE
# to the real paid status. Works whether or not guard 20260616220000 is applied.
A("-- 4) CLIENT INVOICES (5% VAT). Insert DRAFT then post, to respect the integrity guard.")
for v in invoices:
    paid = numf(v['collected'] if v['collected'] != 'NULL' else '0')
    tax  = numf(v['taxable'])
    A("INSERT INTO public.client_invoices (invoice_number, project_id, client_id, client_name, "
      "invoice_type, status, invoice_date, supply_date, due_date, gross_claim, taxable_amount, "
      "vat_amount, total_incl_vat, net_due, amount_paid, notes, created_by)")
    A("SELECT " +
      f"{q(v['number'])}, (SELECT id FROM public.projects WHERE project_number={q(v['proj'])}), "
      f"'{cid(v['client'])}'::uuid, {q(v['client'])}, 'STANDALONE', 'DRAFT', "
      f"COALESCE({d(v['date'])}, CURRENT_DATE), COALESCE({d(v['date'])}, CURRENT_DATE), "
      f"COALESCE({d(v['date'])}, CURRENT_DATE) + 30, "
      f"{tax}, {tax}, round({tax}*0.05,2), round({tax}*1.05,2), round({tax}*1.05,2), 0, "
      f"{q(v['desc'])}, current_setting('jeet.admin_id')::uuid "
      f"ON CONFLICT (invoice_number) DO NOTHING;")
    A(f"UPDATE public.client_invoices SET amount_paid={paid}, status="
      f"CASE WHEN {paid} >= round({tax}*1.05,2) THEN 'PAID' "
      f"WHEN {paid} > 0 THEN 'PARTIALLY_PAID' ELSE 'APPROVED' END "
      f"WHERE invoice_number={q(v['number'])};")
A("")

# Suppliers
A("-- 5) SUPPLIERS (real names; placeholder contacts intentionally omitted)")
for s in suppliers:
    A("INSERT INTO public.pricing_suppliers (id, name, systems_covered, payment_terms_days, preferred) VALUES "
      f"('{sid(s['name'])}'::uuid, {q(s['name'])}, ARRAY[{q(s['category'])}], "
      f"{terms_days(s['terms'])}, {str(s['preferred']).lower()}) "
      f"ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, systems_covered=EXCLUDED.systems_covered, "
      f"payment_terms_days=EXCLUDED.payment_terms_days, preferred=EXCLUDED.preferred;")
A("")
A("NOTIFY pgrst, 'reload schema';")
A("COMMIT;")
A("")
A(f"-- summary: {len(clients)} clients · {len(projects)} projects · "
  f"{len(invoices)} invoices · {len(suppliers)} suppliers")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(L))
print(f"clients={len(clients)} projects={len(projects)} invoices={len(invoices)} suppliers={len(suppliers)}")
print('wrote', OUT)
