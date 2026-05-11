/**
 * Shared helpers for regression tests.
 * No dependencies — plain Node.js.
 */

let _passed = 0;
let _failed = 0;
let _section = '';

const pass = (msg) => {
    _passed++;
    console.log(`  ✓ ${msg}`);
};

const fail = (msg) => {
    _failed++;
    console.error(`  ✗ FAIL: ${msg}`);
};

const section = (title) => {
    _section = title;
    console.log(`\n═══ ${title} ═══`);
};

const summary = () => {
    const total = _passed + _failed;
    const status = _failed === 0 ? '✅ ALL PASSED' : `❌ ${_failed} FAILED`;
    console.log(`\n  ${status} — ${_passed}/${total} checks passed in [${_section}]\n`);
    // Reset for next suite
    _passed = 0;
    _failed = 0;
};

// Returns current fail count so the runner can detect failures
const failCount = () => _failed;

module.exports = { pass, fail, section, summary, failCount };
