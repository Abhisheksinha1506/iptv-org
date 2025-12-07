#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const migrationFile = path.join(__dirname, '../supabase/migrations/001_initial_schema.sql');

console.log('📋 Supabase Migration SQL\n');
console.log('='.repeat(80));
console.log('Copy the SQL below and run it in Supabase SQL Editor:');
console.log('https://supabase.com/dashboard/project/xswmxmumzgkvuvjufomn/sql/new\n');
console.log('='.repeat(80));
console.log('\n');

try {
  const sql = fs.readFileSync(migrationFile, 'utf8');
  console.log(sql);
  console.log('\n');
  console.log('='.repeat(80));
  console.log('\n✅ Migration SQL ready to copy!');
  console.log('\nNext steps:');
  console.log('1. Copy the SQL above');
  console.log('2. Go to: https://supabase.com/dashboard/project/xswmxmumzgkvuvjufomn/sql/new');
  console.log('3. Paste and click "Run"');
  console.log('4. Verify with: npm run test:connection\n');
} catch (error) {
  console.error('❌ Error reading migration file:', error.message);
  process.exit(1);
}

