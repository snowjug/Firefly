// Keeps package-lock.json portable.
//
// Some corporate npm proxies return tarball URLs on an internal host. npm records
// those in package-lock.json, which then breaks installs outside that network and
// leaks internal hostnames into the repository. This script rewrites such URLs to
// the canonical registry.npmjs.org form (same package bytes; integrity hashes are
// unchanged) or, with --check, only reports them.
//
// Usage:
//   node scripts/normalize-lockfile.mjs          rewrite package-lock.json in place
//   node scripts/normalize-lockfile.mjs --check  exit 1 if non-canonical URLs exist
import { readFileSync, writeFileSync } from 'node:fs';

const LOCK_PATH = new URL('../package-lock.json', import.meta.url);
const CANONICAL_HOST = 'registry.npmjs.org';
const checkOnly = process.argv.includes('--check');

const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
const offenders = [];

for (const [key, pkg] of Object.entries(lock.packages ?? {})) {
  if (!pkg || typeof pkg.resolved !== 'string' || !/^https?:\/\//.test(pkg.resolved)) continue;
  const url = new URL(pkg.resolved);
  if (url.hostname === CANONICAL_HOST) continue;
  const name = key.split('node_modules/').pop();
  const file = url.pathname.split('/-/').pop();
  offenders.push({ key, from: url.hostname });
  if (!checkOnly) pkg.resolved = `https://${CANONICAL_HOST}/${name}/-/${file}`;
}

if (checkOnly) {
  if (offenders.length > 0) {
    console.error(
      `package-lock.json has ${offenders.length} non-canonical resolved URL(s), e.g. ${offenders[0].from}. ` +
        'Run: node scripts/normalize-lockfile.mjs',
    );
    process.exit(1);
  }
  console.log('package-lock.json: all resolved URLs are canonical.');
} else {
  writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + '\n');
  console.log(`package-lock.json: normalised ${offenders.length} resolved URL(s).`);
}
