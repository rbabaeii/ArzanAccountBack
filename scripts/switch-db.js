const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetMode = (process.argv[2] || '').toLowerCase();

if (!['sqlite', 'postgres', 'postgresql'].includes(targetMode)) {
  console.error('\x1b[31m%s\x1b[0m', 'Usage: node scripts/switch-db.js <sqlite|postgres>');
  process.exit(1);
}

const provider = targetMode === 'sqlite' ? 'sqlite' : 'postgresql';
const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

if (!fs.existsSync(schemaPath)) {
  console.error('\x1b[31m%s\x1b[0m', `Schema file not found at: ${schemaPath}`);
  process.exit(1);
}

let schema = fs.readFileSync(schemaPath, 'utf8');

// Replace provider in datasource db
const providerRegex = /datasource\s+db\s+\{[\s\S]*?provider\s*=\s*"[^"]+"[\s\S]*?\}/;
const match = schema.match(providerRegex);

if (!match) {
  console.error('\x1b[31m%s\x1b[0m', 'Could not locate datasource db block in schema.prisma');
  process.exit(1);
}

const updatedBlock = match[0].replace(/provider\s*=\s*"[^"]+"/, `provider = "${provider}"`);
schema = schema.replace(providerRegex, updatedBlock);

fs.writeFileSync(schemaPath, schema, 'utf8');
console.log('\x1b[32m%s\x1b[0m', `✓ Prisma schema datasource provider updated to: "${provider}"`);

// Regenerate Prisma Client
console.log('\x1b[34m%s\x1b[0m', 'Regenerating Prisma Client...');
try {
  execSync('npx prisma generate', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
  console.log('\x1b[32m%s\x1b[0m', `✓ Prisma Client successfully re-generated for ${provider}!`);
  if (provider === 'sqlite') {
    console.log('\x1b[33m%s\x1b[0m', 'ℹ Mode SQLite: Ensure DATABASE_URL="file:./dev.db" in .env');
  } else {
    console.log('\x1b[33m%s\x1b[0m', 'ℹ Mode PostgreSQL: Ensure DATABASE_URL is set to your Postgres connection string.');
  }
} catch (err) {
  console.error('\x1b[31m%s\x1b[0m', 'Failed to generate Prisma client: ' + err.message);
  process.exit(1);
}
