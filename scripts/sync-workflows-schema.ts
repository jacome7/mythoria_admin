#!/usr/bin/env ts-node

/**
 * Schema Sync Script for Workflows Database
 * 
 * This script synchronizes the workflows schema from the master source
 * (story-generation-workflow) to the mythoria_admin project.
 * 
 * Usage: npm run sync-workflows-schema
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const SOURCE_SCHEMA_DIR = path.resolve(__dirname, '../../story-generation-workflow/src/db/workflows-schema');
const TARGET_SCHEMA_DIR = path.resolve(__dirname, '../src/db/schema/workflows');

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
    errors: []
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
  const schemaFiles = sourceFiles.filter(file => 
    file.endsWith('.ts') && !file.endsWith('.d.ts')
  );

  console.log(`Found ${schemaFiles.length} schema files to sync:`);
  schemaFiles.forEach(file => console.log(`  - ${file}`));

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
          fs.stat(targetPath)
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
  const schemaFiles = files.filter(file => 
    file.endsWith('.ts') && 
    file !== 'index.ts' && 
    !file.endsWith('.d.ts')
  );

  // Generate index content
  const exports = schemaFiles.map(file => {
    const baseName = path.basename(file, '.ts');
    return `export * from './${baseName}';`;
  }).join('\n');

  const indexContent = `// Auto-generated index file for workflows schema
// Last updated: ${new Date().toISOString()}

${exports}
`;

  await fs.writeFile(indexPath, indexContent, 'utf-8');
  console.log(`Updated index file: ${indexPath}`);
}

async function main(): Promise<void> {
  console.log('🔄 Starting workflows schema synchronization...\n');
  
  try {
    const result = await syncSchemaFiles();
    await updateIndexFile();
    
    console.log('\n📊 Synchronization Summary:');
    console.log(`✅ Files copied: ${result.copied.length}`);
    if (result.copied.length > 0) {
      result.copied.forEach(file => console.log(`   - ${file}`));
    }
    
    console.log(`⏭️  Files skipped (up to date): ${result.skipped.length}`);
    if (result.skipped.length > 0) {
      result.skipped.forEach(file => console.log(`   - ${file}`));
    }
    
    if (result.errors.length > 0) {
      console.log(`❌ Errors: ${result.errors.length}`);
      result.errors.forEach(({ file, error }) => console.log(`   - ${file}: ${error}`));
      process.exit(1);
    }
    
    console.log('\n✅ Schema synchronization completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Review the copied files for any manual adjustments needed');
    console.log('   2. Run database migrations if schema changes require them');
    console.log('   3. Update your application imports if needed');
    
  } catch (error) {
    console.error('\n❌ Schema synchronization failed:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

export { syncSchemaFiles, updateIndexFile };
