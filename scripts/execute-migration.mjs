#!/usr/bin/env node

/**
 * This script helps execute the migration by providing the SQL
 * and opening the Supabase SQL Editor in your browser
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const projectRef = supabaseUrl ? supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] : null;

console.log('🚀 Database Migration Execution\n');

if (!projectRef) {
  console.error('❌ Could not extract project ref from SUPABASE_URL');
  process.exit(1);
}

const sqlEditorUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`;

console.log('📋 Migration Instructions:\n');
console.log('1. Open Supabase SQL Editor:');
console.log(`   ${sqlEditorUrl}\n`);
console.log('2. Copy the SQL below:\n');
console.log('='.repeat(80));
console.log('');

// Read and print migration SQL
const migrationFile = join(__dirname, '../supabase/migrations/001_initial_schema.sql');
try {
  const sql = readFileSync(migrationFile, 'utf8');
  console.log(sql);
  console.log('');
  console.log('='.repeat(80));
  console.log('');
  console.log('3. Paste the SQL above into the Supabase SQL Editor');
  console.log('4. Click "Run" button (or press Cmd/Ctrl + Enter)');
  console.log('5. Wait for "Success" confirmation\n');
  console.log('✅ After running, verify with: npm run migration:check\n');
  
  // Try to open browser (optional)
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  try {
    // Try to open browser
    const platform = process.platform;
    let command;
    if (platform === 'darwin') {
      command = `open "${sqlEditorUrl}"`;
    } else if (platform === 'win32') {
      command = `start "${sqlEditorUrl}"`;
    } else {
      command = `xdg-open "${sqlEditorUrl}"`;
    }
    
    await execAsync(command);
    console.log('🌐 Opened Supabase SQL Editor in your browser!\n');
  } catch (error) {
    // Browser opening failed, but that's okay
    console.log('💡 Tip: Copy the URL above to open in your browser\n');
  }
} catch (error) {
  console.error('❌ Error reading migration file:', error.message);
  process.exit(1);
}

