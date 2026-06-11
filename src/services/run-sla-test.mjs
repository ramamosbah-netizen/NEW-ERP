import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Parse .env.local manually and set env vars
try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  }
  console.log('Loaded .env.local environment variables for unit testing.');
} catch (err) {
  console.error('Warning: Failed to load .env.local:', err.message);
}

// Dynamically import the SLA tests
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import('./test-sla-service.ts').catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
