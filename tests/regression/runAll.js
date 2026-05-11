/**
 * WiseMove Connect — Regression Test Runner
 *
 * Runs all 8 regression test suites in sequence.
 * Each suite is isolated: it connects/disconnects its own DB if needed.
 *
 * Usage:
 *   node tests/regression/runAll.js
 *
 * Prerequisites:
 *   - .env set with MONGO_URI
 *   - master55.seed.js run (for T3, T5, T7, T8)
 *   - qualificationQuestions55.seed.js run (for T8)
 */
require('dotenv').config();

const { execSync } = require('child_process');
const path = require('path');

const SUITES = [
    { file: 't1_confirmationEmail.js',  label: 'T1 — Confirmation Email (unit)'        },
    { file: 't2_commissionSplit.js',     label: 'T2 — Commission Split 70/30 (unit)'    },
    { file: 't3_master55seed.js',        label: 'T3 — master55 Seed (DB)'               },
    { file: 't4_leadSchema.js',          label: 'T4 — Lead Schema Fields (DB)'          },
    { file: 't5_wonTwoStep.js',          label: 'T5 — Two-Step Won Flow (DB)'           },
    { file: 't6_paymentReminder.js',     label: 'T6 — Payment Reminder Cron (unit+DB)'  },
    { file: 't7_multiService.js',        label: 'T7 — Multi-Service Lead (DB)'          },
    { file: 't8_qualQuestions.js',       label: 'T8 — Qualification Questions (DB)'     },
];

const LINE = '═'.repeat(60);

console.log(`\n${LINE}`);
console.log('  WiseMove Connect — Regression Test Suite');
console.log(`  ${new Date().toISOString()}`);
console.log(LINE);

let passed = 0;
let failed = 0;

for (const suite of SUITES) {
    const filePath = path.join(__dirname, suite.file);
    console.log(`\n▶  Running: ${suite.label}`);

    try {
        execSync(`node "${filePath}"`, {
            stdio: 'inherit',
            env: process.env,
        });
        passed++;
    } catch (e) {
        // execSync throws on non-zero exit code
        console.error(`\n  ⚠  Suite exited with failure: ${suite.label}`);
        failed++;
    }
}

console.log(`\n${LINE}`);
console.log(`  REGRESSION RESULTS`);
console.log(`  Suites passed : ${passed}`);
console.log(`  Suites failed : ${failed}`);
console.log(`  Total suites  : ${SUITES.length}`);
console.log(LINE);

if (failed > 0) {
    console.error('\n  ❌ REGRESSION FAILURES DETECTED — review output above\n');
    process.exit(1);
} else {
    console.log('\n  ✅ ALL REGRESSION SUITES PASSED\n');
    process.exit(0);
}
