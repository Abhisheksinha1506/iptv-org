#!/usr/bin/env node

import process from 'node:process';

const DEFAULT_ROUTE = 'check-repos';

function buildRoute(argv) {
  return argv[2] ?? DEFAULT_ROUTE;
}

async function invokeCron(route) {
  const url = `http://localhost:3000/api/cron/${route}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Cron request failed: ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
  return payload;
}

async function main() {
  const route = buildRoute(process.argv);
  try {
    const payload = await invokeCron(route);
    console.log(`[cron:${route}]`, JSON.stringify(payload, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(`[cron:${route}]`, error);
    process.exit(1);
  }
}

main();

