#!/usr/bin/env ts-node

/**
 * Schema & Types Sync Script for Mythoria-db Database
 *
 * This script synchronizes:
 *  1. Schema files from mythoria-webapp/src/db/schema -> mythoria_admin/src/db/schema
 *  2. Type definition .ts files from mythoria-webapp/src/types -> mythoria_admin/src/db/type
 *
 * Excludes: clerk.ts, translation-keys.d.ts, and any *.d.ts files.
 *
 * Usage: npm run sync-mythoria-db-schema
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const SOURCE_SCHEMA_DIR = path.resolve(__dirname, '../../mythoria-webapp/src/db/schema');
const TARGET_SCHEMA_DIR = path.resolve(__dirname, '../src/db/schema/');
// NEW: types source/target
const SOURCE_TYPES_DIR = path.resolve(__dirname, '../../mythoria-webapp/src/types');
const TARGET_TYPES_DIR = path.resolve(__dirname, '../src/db/type/');

interface SyncResult {
  copied: string[];
  skipped: string[];
  errors: { file: string; error: string }[];
}

async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

async function copyFile(sourcePath: string, targetPath: string): Promise<void> {
  let content = await fs.readFile(sourcePath, 'utf-8');

  // Fix import paths - remove .js extensions for TypeScript
  content = content.replace(/from ['"](\.\/[^'"]+)\.js['"]/g, 'from "$1"');

  await fs.writeFile(targetPath, content, 'utf-8');
}

async function syncSchemaFiles(): Promise<SyncResult> {
  const result: SyncResult = {
    copied: [],
    skipped: [],
    errors: [],
  };

  try {
    // Ensure source directory exists
    await fs.access(SOURCE_SCHEMA_DIR);
    console.log(`Source schema directory found: ${SOURCE_SCHEMA_DIR}`);
  } catch {
    throw new Error(`Source schema directory not found: ${SOURCE_SCHEMA_DIR}`);
  }

  // Ensure target directory exists
  await ensureDirectoryExists(TARGET_SCHEMA_DIR);

  // Read all files from source directory
  const sourceFiles = await fs.readdir(SOURCE_SCHEMA_DIR);
  const schemaFiles = sourceFiles.filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'));

  console.log(`Found ${schemaFiles.length} schema files to sync:`);
  schemaFiles.forEach((file) => console.log(`  - ${file}`));

  // Copy each schema file
  for (const file of schemaFiles) {
    const sourcePath = path.join(SOURCE_SCHEMA_DIR, file);
    const targetPath = path.join(TARGET_SCHEMA_DIR, file);

    try {
      console.log(`\nSyncing ${file}...`);

      // Check if target file exists and compare modification times
      let shouldCopy = true;
      try {
        const [sourceStats, targetStats] = await Promise.all([
          fs.stat(sourcePath),
          fs.stat(targetPath),
        ]);

        if (sourceStats.mtime <= targetStats.mtime) {
          console.log(`  ↳ Target file is up to date, skipping`);
          result.skipped.push(file);
          shouldCopy = false;
        }
      } catch {
        // Target file doesn't exist, proceed with copy
      }

      if (shouldCopy) {
        await copyFile(sourcePath, targetPath);
        console.log(`  ↳ Copied successfully`);
        result.copied.push(file);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`  ↳ Error copying ${file}: ${errorMsg}`);
      result.errors.push({ file, error: errorMsg });
    }
  }

  return result;
}

async function updateIndexFile(): Promise<void> {
  const indexPath = path.join(TARGET_SCHEMA_DIR, 'index.ts');

  // Read all schema files
  const files = await fs.readdir(TARGET_SCHEMA_DIR);
  const schemaFiles = files.filter(
    (file) => file.endsWith('.ts') && file !== 'index.ts' && !file.endsWith('.d.ts'),
  );

  // Generate index content
  const exports = schemaFiles
    .map((file) => {
      const baseName = path.basename(file, '.ts');
      return `export * from './${baseName}';`;
    })
    .join('\n');

  const indexContent = `// Auto-generated index file for mythoria-db schema
// Last updated: ${new Date().toISOString()}

${exports}
`;

  await fs.writeFile(indexPath, indexContent, 'utf-8');
  console.log(`Updated index file: ${indexPath}`);
}

// NEW: syncTypeFiles function
async function syncTypeFiles(): Promise<SyncResult> {
  const result: SyncResult = { copied: [], skipped: [], errors: [] };

  try {
    await fs.access(SOURCE_TYPES_DIR);
    console.log(`\nSource types directory found: ${SOURCE_TYPES_DIR}`);
  } catch {
    console.log(`\nNo types directory found at source, skipping type sync.`);
    return result;
  }

  await ensureDirectoryExists(TARGET_TYPES_DIR);

  const sourceFiles = await fs.readdir(SOURCE_TYPES_DIR);
  const typeFiles = sourceFiles.filter(
    (file) =>
      file.endsWith('.ts') &&
      !file.endsWith('.d.ts') &&
      file !== 'clerk.ts' &&
      file !== 'translation-keys.d.ts',
  );

  if (typeFiles.length === 0) {
    console.log('No eligible type files to sync.');
    return result;
  }

  console.log(`\nFound ${typeFiles.length} type files to sync:`);
  typeFiles.forEach((f) => console.log(`  - ${f}`));

  for (const file of typeFiles) {
    const sourcePath = path.join(SOURCE_TYPES_DIR, file);
    const targetPath = path.join(TARGET_TYPES_DIR, file);
    try {
      console.log(`\nSyncing type ${file}...`);
      let shouldCopy = true;
      try {
        const [sStat, tStat] = await Promise.all([fs.stat(sourcePath), fs.stat(targetPath)]);
        if (sStat.mtime <= tStat.mtime) {
          console.log('  ↳ Up to date, skipping');
          result.skipped.push(file);
          shouldCopy = false;
        }
      } catch {
        // target missing -> copy
      }
      if (shouldCopy) {
        await copyFile(sourcePath, targetPath);
        console.log('  ↳ Copied successfully');
        result.copied.push(file);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  ↳ Error copying ${file}: ${msg}`);
      result.errors.push({ file, error: msg });
    }
  }

  return result;
}

async function main(): Promise<void> {
  console.log('🔄 Starting mythoria-db schema & types synchronization...\n');
  try {
    const schemaResult = await syncSchemaFiles();
    await updateIndexFile();
    const typesResult = await syncTypeFiles();

    console.log('\n📊 Schema Synchronization Summary:');
    console.log(`✅ Files copied: ${schemaResult.copied.length}`);
    schemaResult.copied.forEach((f) => console.log(`   - ${f}`));
    console.log(`⏭️  Files skipped: ${schemaResult.skipped.length}`);
    schemaResult.skipped.forEach((f) => console.log(`   - ${f}`));
    if (schemaResult.errors.length) {
      console.log(`❌ Errors: ${schemaResult.errors.length}`);
      schemaResult.errors.forEach((e) => console.log(`   - ${e.file}: ${e.error}`));
    }

    console.log('\n📁 Types Synchronization Summary:');
    console.log(`✅ Files copied: ${typesResult.copied.length}`);
    typesResult.copied.forEach((f) => console.log(`   - ${f}`));
    console.log(`⏭️  Files skipped: ${typesResult.skipped.length}`);
    typesResult.skipped.forEach((f) => console.log(`   - ${f}`));
    if (typesResult.errors.length) {
      console.log(`❌ Errors: ${typesResult.errors.length}`);
      typesResult.errors.forEach((e) => console.log(`   - ${e.file}: ${e.error}`));
    }

    const hadErrors = schemaResult.errors.length || typesResult.errors.length;
    if (hadErrors) {
      console.log('\n⚠️ Completed with errors.');
      process.exit(1);
    }

    console.log('\n✅ Synchronization completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Review copied schema & type files');
    console.log('   2. Run any necessary migrations');
    console.log('   3. Adjust imports if new types are used');
  } catch (error) {
    console.error('\n❌ Synchronization failed:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

export { syncSchemaFiles, updateIndexFile };
