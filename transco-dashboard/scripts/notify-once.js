'use strict';
/**
 * Runs one email-update pass and exits. Use it from an external scheduler (cron, a cloud
 * scheduled job) with SCHEDULER_ENABLED=false on the web server.
 *   npm run notify:once            send changes and due summaries
 *   npm run notify:once -- --force send a summary for every followed shipment now
 */
const notifier = require('../src/notifier');

notifier.runCycle({ force: process.argv.includes('--force') })
  .then((r) => { console.log(`Checked ${r.checked} shipments, sent ${r.emails} emails`); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
