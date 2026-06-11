import fs from 'fs';
import path from 'path';

const servicesDir = 'src/services';
const files = fs.readdirSync(servicesDir);

console.log('--- SCANNING SELECT CALLS IN SERVICES ---');
for (const file of files) {
  if (!file.endsWith('.ts')) continue;
  const filePath = path.join(servicesDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Find all .select(...) blocks
  const selectRegex = /\.select\([\s\S]*?\)/g;
  let match;
  while ((match = selectRegex.exec(content)) !== null) {
    const call = match[0];
    if (call.includes('(') && (call.includes(':') || call.includes('*'))) {
      console.log(`\nFile: ${file}`);
      console.log(call.trim());
    }
  }
}
