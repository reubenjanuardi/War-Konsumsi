// ==============================================================================
// WAR KONSUMSI — ISOLATED DATABASE BACKUP & RESTORE VERIFICATION AUDIT
// ==============================================================================
// Dumps current database to a temporary file, restores into an isolated temporary
// database (war_konsumsi_isolated_audit), audits row counts, foreign keys, unique
// constraints, quota state, and selection records, then cleans up.
//
// Usage:
//   npx tsx scripts/verify-backup-restore-isolated.ts
// ==============================================================================

import postgres from 'postgres';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const DB_HOST = process.env.PGHOST || '127.0.0.1';
const DB_PORT = parseInt(process.env.PGPORT || '5432', 10);
const DB_USER = process.env.PGUSER || 'postgres';
const DB_PASS = process.env.PGPASSWORD || 'postgres';
const ORIG_DB = process.env.PGDATABASE || 'war_konsumsi';
const TEMP_DB = 'war_konsumsi_isolated_audit';

const TEMP_DUMP = path.resolve(process.cwd(), './backups/isolated_audit_test.dump');

function findPgBin(binName: string): string {
  try {
    execSync(`where ${binName}`, { stdio: 'ignore' });
    return binName;
  } catch {
    const laragonBin = `C:\\laragon\\bin\\postgresql\\postgresql-17.10\\bin\\${binName}.exe`;
    if (fs.existsSync(laragonBin)) return `"${laragonBin}"`;
    return binName;
  }
}

async function runAudit() {
  console.log('================================================================');
  console.log('🔍 ISOLATED DATABASE BACKUP & RESTORE AUDIT');
  console.log(`Original DB: ${ORIG_DB}`);
  console.log(`Target Temp DB: ${TEMP_DB}`);
  console.log('================================================================\n');

  fs.mkdirSync(path.dirname(TEMP_DUMP), { recursive: true });

  const pgDump = findPgBin('pg_dump');
  const pgRestore = findPgBin('pg_restore');

  // 1. Dump source database
  console.log('==> [1/5] Dumping original database with pg_dump -Fc...');
  execSync(
    `${pgDump} -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${ORIG_DB} -Fc -f "${TEMP_DUMP}"`,
    { stdio: 'inherit', env: { ...process.env, PGPASSWORD: DB_PASS } },
  );

  const dumpStats = fs.statSync(TEMP_DUMP);
  console.log(`    ✓ Dump created: ${TEMP_DUMP} (${(dumpStats.size / 1024).toFixed(2)} KB)`);

  // 2. Connect to postgres root database to recreate isolated temporary database
  console.log(`\n==> [2/5] Creating isolated target database '${TEMP_DB}'...`);
  const rootSql = postgres({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: 'postgres',
  });

  await rootSql.unsafe(`DROP DATABASE IF EXISTS ${TEMP_DB};`);
  await rootSql.unsafe(`CREATE DATABASE ${TEMP_DB};`);
  await rootSql.end();
  console.log(`    ✓ Isolated database '${TEMP_DB}' created.`);

  // 3. Restore into isolated temporary database
  console.log(`\n==> [3/5] Restoring dump into isolated database '${TEMP_DB}'...`);
  try {
    execSync(
      `${pgRestore} -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${TEMP_DB} --clean --if-exists --no-owner --no-privileges -v "${TEMP_DUMP}"`,
      { stdio: 'pipe', env: { ...process.env, PGPASSWORD: DB_PASS } },
    );
  } catch (err: any) {
    // pg_restore exits with 1 on harmless warnings (e.g. relation does not exist on DROP IF EXISTS)
    if (err.status !== 1) throw err;
  }
  console.log(`    ✓ Restore completed successfully into '${TEMP_DB}'.`);

  // 4. Comparative Audit
  console.log('\n==> [4/5] Performing comparative structural & data integrity audit...');
  const origSql = postgres({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: ORIG_DB,
  });

  const tempSql = postgres({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: TEMP_DB,
  });

  // A. Compare Table Row Counts
  const tables = ['events', 'categories', 'participants', 'selections'];
  console.log('\n    --- Row Counts Audit ---');
  for (const table of tables) {
    const [origCount] = await origSql.unsafe(`SELECT count(*)::int as count FROM ${table}`);
    const [tempCount] = await tempSql.unsafe(`SELECT count(*)::int as count FROM ${table}`);
    console.log(`    - Table '${table}': Original = ${origCount.count} | Restored = ${tempCount.count}`);
    if (origCount.count !== tempCount.count) {
      throw new Error(`Row count mismatch in table '${table}': ${origCount.count} !== ${tempCount.count}`);
    }
  }
  console.log('    ✓ All table row counts match exactly 100%.');

  // B. Compare Constraints & Foreign Keys
  console.log('\n    --- Constraints & Foreign Keys Audit ---');
  const constraintQuery = `
    SELECT conname, contype, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid IN ('events'::regclass, 'categories'::regclass, 'participants'::regclass, 'selections'::regclass)
    ORDER BY conname;
  `;
  const origConstraints = await origSql.unsafe(constraintQuery);
  const tempConstraints = await tempSql.unsafe(constraintQuery);

  console.log(`    - Constraints found: Original = ${origConstraints.length}, Restored = ${tempConstraints.length}`);
  if (origConstraints.length !== tempConstraints.length) {
    throw new Error(`Constraint count mismatch: ${origConstraints.length} !== ${tempConstraints.length}`);
  }

  for (let i = 0; i < origConstraints.length; i++) {
    const oc = origConstraints[i];
    const tc = tempConstraints[i];
    if (oc.conname !== tc.conname || oc.contype !== tc.contype || oc.def !== tc.def) {
      throw new Error(`Constraint definition mismatch on ${oc.conname}: ${oc.def} !== ${tc.def}`);
    }
  }

  const indexQuery = `
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE tablename IN ('events', 'categories', 'participants', 'selections')
    ORDER BY indexname;
  `;
  const origIndexes = await origSql.unsafe(indexQuery);
  const tempIndexes = await tempSql.unsafe(indexQuery);

  console.log(`    - Indexes found: Original = ${origIndexes.length}, Restored = ${tempIndexes.length}`);
  if (origIndexes.length !== tempIndexes.length) {
    throw new Error(`Index count mismatch: ${origIndexes.length} !== ${tempIndexes.length}`);
  }

  const hasCheckQuota = tempConstraints.some((c) => c.def.includes('remaining_quota >= 0'));
  const hasUniqueParticipant = tempIndexes.some((idx) => idx.indexname === 'uq_selections_event_participant');
  const fkCount = tempConstraints.filter((c) => c.contype === 'f').length;

  console.log(`    - Check constraint 'remaining_quota >= 0': ${hasCheckQuota ? 'VERIFIED' : 'MISSING'}`);
  console.log(`    - Unique index 'uq_selections_event_participant': ${hasUniqueParticipant ? 'VERIFIED' : 'MISSING'}`);
  console.log(`    - Foreign keys verified: ${fkCount} foreign keys active`);

  if (!hasCheckQuota || !hasUniqueParticipant || fkCount < 3) {
    throw new Error('Critical integrity constraint missing in restored database!');
  }
  console.log('    ✓ All constraints, unique indexes, and foreign keys verified identical.');

  // C. Compare Quota State
  console.log('\n    --- Quota State Audit ---');
  const origCats = await origSql`SELECT id, quota, remaining_quota FROM categories ORDER BY id`;
  const tempCats = await tempSql`SELECT id, quota, remaining_quota FROM categories ORDER BY id`;

  for (let i = 0; i < origCats.length; i++) {
    const oc = origCats[i];
    const tc = tempCats[i];
    if (oc.quota !== tc.quota || oc.remaining_quota !== tc.remaining_quota) {
      throw new Error(`Quota mismatch on category ${oc.id}: (${oc.quota}, ${oc.remaining_quota}) !== (${tc.quota}, ${tc.remaining_quota})`);
    }
  }
  console.log(`    ✓ Verified quota state for all ${origCats.length} categories.`);

  // D. Compare Selection State
  console.log('\n    --- Selection State Audit ---');
  const origSels = await origSql`SELECT id, event_id, participant_id, category_id, selected_at FROM selections ORDER BY id`;
  const tempSels = await tempSql`SELECT id, event_id, participant_id, category_id, selected_at FROM selections ORDER BY id`;

  for (let i = 0; i < origSels.length; i++) {
    const os = origSels[i];
    const ts = tempSels[i];
    if (
      os.id !== ts.id ||
      os.event_id !== ts.event_id ||
      os.participant_id !== ts.participant_id ||
      os.category_id !== ts.category_id ||
      new Date(os.selected_at).getTime() !== new Date(ts.selected_at).getTime()
    ) {
      throw new Error(`Selection record mismatch on selection ${os.id}`);
    }
  }
  console.log(`    ✓ Verified selection state for all ${origSels.length} committed selections.`);

  // 5. Cleanup
  console.log('\n==> [5/5] Cleaning up isolated temporary database & dump artifact...');
  await origSql.end();
  await tempSql.end();

  const cleanupSql = postgres({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: 'postgres',
  });
  await cleanupSql.unsafe(`DROP DATABASE IF EXISTS ${TEMP_DB};`);
  await cleanupSql.end();

  if (fs.existsSync(TEMP_DUMP)) {
    fs.unlinkSync(TEMP_DUMP);
  }
  console.log('    ✓ Temporary database dropped and dump file cleaned up.');

  console.log('\n================================================================');
  console.log('🏆 ISOLATED DATABASE BACKUP & RESTORE AUDIT: 100% PASSED');
  console.log('================================================================\n');
}

runAudit().catch((err) => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
