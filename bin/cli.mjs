#!/usr/bin/env node
const [major] = process.versions.node.split('.').map(Number);
if (major < 20) {
  console.error(`speckit-overview needs Node.js 20 or newer; this is ${process.version}.`);
  process.exit(1);
}

const debug = process.argv.includes('--debug');
try {
  const { main } = await import('../lib/main.mjs');
  await main(process.argv.slice(2));
} catch (error) {
  if (error?.name === 'UserError') {
    (error.exitCode === 0 ? console.log : console.error)(error.message);
    process.exitCode = error.exitCode;
  } else {
    console.error(debug ? error : `speckit-overview failed: ${error?.message ?? error}\nRe-run with --debug for details.`);
    process.exitCode = 1;
  }
}
