#!/usr/bin/env ts-node
/**
 * Sync Blog Schema from mythoria-webapp to mythoria_admin
 * Simple copy of blog.ts + update index export.
 */
import * as fs from 'fs/promises';
import * as path from 'path';

const SOURCE_FILE = path.resolve(__dirname, '../../mythoria-webapp/src/db/schema/blog.ts');
const TARGET_DIR = path.resolve(__dirname, '../src/db/schema/blog');
const TARGET_FILE = path.join(TARGET_DIR, 'blog.ts');

async function ensureDir(p: string) { try { await fs.access(p); } catch { await fs.mkdir(p, { recursive: true }); } }

async function copyBlog() {
  await ensureDir(TARGET_DIR);
  const content = await fs.readFile(SOURCE_FILE, 'utf-8');
  await fs.writeFile(TARGET_FILE, content, 'utf-8');
  const indexPath = path.join(TARGET_DIR, 'index.ts');
  await fs.writeFile(indexPath, `export * from './blog';\n`, 'utf-8');
  console.log('Blog schema synced.');
}

copyBlog().catch(e => { console.error(e); process.exit(1); });
