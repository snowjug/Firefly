// Lightweight secret and internal-URL scan over files Git would track.
// It is a safety net, not a replacement for a dedicated scanner such as gitleaks.
//
//   node scripts/scan-secrets.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PATTERNS = [
  { name: 'private key block', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { name: 'GitHub fine-grained token', re: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/ },
  { name: 'OpenAI-style secret key', re: /\bsk-[A-Za-z0-9_-]{24,}\b/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'Google AI Studio auth key', re: /\bAQ\.[A-Za-z0-9_-]{30,}/ },
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'Azure storage connection string', re: /AccountKey=[A-Za-z0-9+/=]{40,}/ },
  { name: 'bearer token literal', re: /\bBearer\s+[A-Za-z0-9._~+/-]{30,}=*/ },
  {
    name: 'hard-coded credential assignment',
    re: /\b(?:api[_-]?key|secret|token|password|passwd)\b["']?\s*[:=]\s*["'][A-Za-z0-9/+_.-]{20,}["']/i,
  },
  {
    name: 'internal package feed URL',
    re: /pkgs\.visualstudio\.com|packagefeedproxy\.microsoft\.io/,
  },
];

// Files that legitimately describe these patterns.
const SKIP = new Set(['scripts/scan-secrets.mjs', 'package-lock.json']);

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\n')
  .map((f) => f.trim())
  .filter(Boolean)
  .filter((f) => !SKIP.has(f));

const findings = [];
for (const file of files) {
  if (/\.(png|jpe?g|gif|ico|woff2?|pdf|zip|db|sqlite)$/i.test(file)) continue;
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const { name, re } of PATTERNS) {
      if (re.test(line)) findings.push(`${file}:${index + 1}  ${name}`);
    }
  });
}

if (files.some((f) => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.env.example'))) {
  findings.push('an .env file is tracked or about to be committed');
}

if (findings.length > 0) {
  console.error('Possible secrets or internal URLs found:\n  ' + findings.join('\n  '));
  process.exit(1);
}
console.log(`Secret scan: ${files.length} files checked, no findings.`);
