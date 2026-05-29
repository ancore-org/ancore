const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let wasmArg = null;
let budgetArg = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--wasm') wasmArg = args[++i];
  if (args[i] === '--budget') budgetArg = parseInt(args[++i], 10);
}

const BUDGET_FILE = path.join(__dirname, '../contracts/budgets/wasm-budgets.json');

async function main() {
  const report = {};
  let hasError = false;

  if (wasmArg && budgetArg) {
    // Single mode check
    if (!fs.existsSync(wasmArg)) {
      console.error(`WASM file not found: ${wasmArg}`);
      process.exit(1);
    }
    const size = fs.statSync(wasmArg).size;
    const name = path.basename(wasmArg);
    report[name] = { actual: size, budget: budgetArg, delta: size - budgetArg };
    
    if (size > budgetArg) {
      console.error(`❌ ${name} exceeded budget! (${size} > ${budgetArg})`);
      hasError = true;
    } else {
      console.log(`✅ ${name} is within budget. (${size} <= ${budgetArg})`);
    }
  } else {
    // Read from budget file
    if (!fs.existsSync(BUDGET_FILE)) {
      console.error(`Budget file not found at ${BUDGET_FILE}`);
      process.exit(1);
    }
    
    const budgets = JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8'));
    for (const [contractName, budget] of Object.entries(budgets)) {
      // Find the wasm file
      // assuming target dir is contracts/target/wasm32-unknown-unknown/release
      const targetDir = path.join(__dirname, '../contracts/target/wasm32-unknown-unknown/release');
      
      let wasmPath = path.join(targetDir, `${contractName}.optimized.wasm`);
      if (!fs.existsSync(wasmPath)) {
        wasmPath = path.join(targetDir, `${contractName}.wasm`);
      }
      
      if (!fs.existsSync(wasmPath)) {
        console.warn(`⚠️ Wasm file for ${contractName} not found at ${wasmPath}`);
        continue;
      }
      
      const size = fs.statSync(wasmPath).size;
      report[contractName] = { actual: size, budget, delta: size - budget };
      if (size > budget) {
        console.error(`❌ ${contractName} exceeded budget! (${size} bytes > ${budget} bytes)`);
        hasError = true;
      } else {
        console.log(`✅ ${contractName} is within budget. (${size} bytes <= ${budget} bytes)`);
      }
    }
  }

  // Write report
  const reportPath = path.join(__dirname, '../wasm-size-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${reportPath}`);

  // Also write a markdown summary for GitHub step summary
  let md = '## WASM Size Report\n\n| Contract | Actual Size | Budget | Status |\n|---|---|---|---|\n';
  for (const [name, stats] of Object.entries(report)) {
    const status = stats.actual <= stats.budget ? '✅ Pass' : '❌ Fail';
    md += `| ${name} | ${stats.actual} bytes | ${stats.budget} bytes | ${status} |\n`;
  }
  
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    fs.appendFileSync(summaryPath, md + '\n');
  }
  
  const mdReportPath = path.join(__dirname, '../wasm-size-report.md');
  fs.writeFileSync(mdReportPath, md);

  if (hasError) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
