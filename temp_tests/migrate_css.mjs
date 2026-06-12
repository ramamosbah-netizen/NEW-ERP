import fs from 'fs';
import path from 'path';

// List of target CSS files
const targetFiles = [
  'src/app/auth.css',
  'src/app/dashboard/dashboard.css',
  'src/app/handover/handover.css',
  'src/app/hr/hr.css',
  'src/app/pricing/pricing.css',
  'src/app/procurement/comparisons/comparisons.css',
  'src/app/quotations/quotations.css',
  'src/app/snags/snags.css',
  'src/app/tc/tc.css',
  'src/app/tenders/tenders.css',
  'src/app/tenders/[id]/boq/boq.css',
  'src/app/timesheets/timesheets.css',
  'src/app/whatsapp/whatsapp.css'
];

targetFiles.forEach((file) => {
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping missing file: ${file}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // 1. Remove backdrop blurs & prefix correctly
  content = content.replace(/(?:-webkit-)?backdrop-filter:\s*[^;]+;?/gi, '');

  // 2. Remove hover translation movements (translateY)
  content = content.replace(/transform:\s*translateY\(-?[0-9]+(\.[0-9]+)?(px|rem)\);?/gi, '');

  // 3. Standardize border-radiuses preserving trailing important/semicolon
  content = content.replace(/border-radius:\s*(?:20|24)px(\s*!important)?/gi, 'border-radius: 8px$1');
  content = content.replace(/border-radius:\s*18px(\s*!important)?/gi, 'border-radius: 8px$1');
  content = content.replace(/border-radius:\s*16px(\s*!important)?/gi, 'border-radius: 8px$1');
  content = content.replace(/border-radius:\s*14px(\s*!important)?/gi, 'border-radius: 6px$1');
  content = content.replace(/border-radius:\s*12px(\s*!important)?/gi, 'border-radius: 6px$1');
  content = content.replace(/border-radius:\s*10px(\s*!important)?/gi, 'border-radius: 6px$1');

  // 4. Replace custom shadows preserving important/semicolon
  content = content.replace(/box-shadow:\s*0\s+[0-9]+px\s+[0-9]+px\s+(?:rgba\([0-9,\s\.]+\)|var\(--[a-zA-Z-]+\))(\s*!important)?/gi, 'box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05)$1');
  content = content.replace(/box-shadow:\s*inset\s+[^;!]+(\s*!important)?/gi, '');

  // 5. Replace hardcoded dark-blue/teal background styles with var(--bg-card) preserving important/semicolon
  content = content.replace(/background(-color)?:\s*(?:rgba?\(6,\s*8,\s*20,\s*[0-9\.]+\)|rgba?\(10,\s*14,\s*34,\s*[0-9\.]+\)|rgba?\(13,\s*17,\s*39,\s*[0-9\.]+\)|#0a0e24|#0b0f2a|#0c102a)(\s*!important)?/gi, 'background$1: var(--bg-card)$2');

  // 6. Replace dark-mode deep background offsets with var(--bg-dark) preserving important/semicolon
  content = content.replace(/background(-color)?:\s*(?:rgba?\(0,\s*0,\s*0,\s*[0-9\.]+\)|#060814|#09090b|#02040a)(\s*!important)?/gi, 'background$1: var(--bg-dark)$2');

  // 7. Standardize borders to use dynamic var(--border-color) preserving important/semicolon
  content = content.replace(/border(-top|-bottom|-left|-right)?:\s*1px\s+solid\s+(?:rgba?\(255,\s*255,\s*255,\s*0\.0[4-9]\)|rgba?\(255,\s*255,\s*255,\s*0\.1[0-2]\)|var\(--border-color\))(\s*!important)?/gi, 'border$1: 1px solid var(--border-color)$2');
  content = content.replace(/border-color:\s*(?:rgba?\(255,\s*255,\s*255,\s*0\.0[4-9]\)|rgba?\(255,\s*255,\s*255,\s*0\.1[0-2]\))(\s*!important)?/gi, 'border-color: var(--border-color)$1');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Successfully migrated CSS: ${file}`);
  } else {
    console.log(`No changes needed for CSS: ${file}`);
  }
});
