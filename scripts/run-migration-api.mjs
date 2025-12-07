#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

console.log('🚀 Database Migration Tool\n');
console.log('⚠️  Note: Supabase REST API does not support arbitrary SQL execution.');
console.log('   This script will help you verify the migration.\n');
console.log('📋 To run the migration:');
console.log('   1. Go to: https://supabase.com/dashboard/project/xswmxmumzgkvuvjufomn/sql/new');
console.log('   2. Run: npm run migration:print');
console.log('   3. Copy the SQL and paste it in the Supabase SQL Editor');
console.log('   4. Click "Run"\n');

// Verify current state
console.log('🔍 Checking current database state...\n');

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const tables = ['channels', 'test_results', 'quality_metrics', 'repositories', 'repository_updates'];
let existingTables = 0;
let missingTables = 0;

for (const table of tables) {
  try {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      if (error.code === 'PGRST205' || error.message.includes('schema cache')) {
        console.log(`   ❌ Table "${table}" - NOT FOUND`);
        missingTables += 1;
      } else {
        console.log(`   ⚠️  Table "${table}" - Error: ${error.message}`);
        missingTables += 1;
      }
    } else {
      console.log(`   ✅ Table "${table}" - EXISTS`);
      existingTables += 1;
    }
  } catch (error) {
    console.log(`   ❌ Table "${table}" - Error: ${error.message}`);
    missingTables += 1;
  }
}

console.log('\n📊 Summary:');
console.log(`   Existing tables: ${existingTables}/${tables.length}`);
console.log(`   Missing tables: ${missingTables}/${tables.length}\n`);

if (missingTables > 0) {
  console.log('📝 Migration needed! Run the SQL in Supabase Dashboard:\n');
  console.log('   npm run migration:print\n');
  process.exit(1);
} else {
  console.log('✅ All tables exist! Migration appears to be complete.\n');
  process.exit(0);
}

