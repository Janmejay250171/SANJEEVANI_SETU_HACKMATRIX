const fs = require('fs');

const content = fs.readFileSync('treatment_cost_benchmarks.csv', 'utf8');
const lines = content.trim().split('\n');
const errors = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  const cols = [];
  let inQ = false, cur = '';
  for (let c of line) {
    if (c === '"') {
      inQ = !inQ;
    } else if (c === ',' && !inQ) {
      cols.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  cols.push(cur.trim());

  const costId = cols[0];
  const canonId = cols[1];
  const procName = cols[2];
  const specialty = cols[3];
  const low = Number(cols[9]);
  const typ = Number(cols[10]);
  const high = Number(cols[11]);
  const curr = cols[13];
  const level = cols[14];
  const srcName = cols[16];
  const doc = cols[18];
  const yr = Number(cols[21]);

  if (!costId) errors.push(`Row ${i}: missing costId`);
  if (!canonId) errors.push(`Row ${i}: missing canonId`);
  if (!procName) errors.push(`Row ${i}: missing procName`);
  if (!specialty) errors.push(`Row ${i}: missing specialty`);
  if (isNaN(low) || low < 0) errors.push(`Row ${i} (${costId}): invalid low ${low}`);
  if (isNaN(typ) || typ < 0) errors.push(`Row ${i} (${costId}): invalid typ ${typ}`);
  if (isNaN(high) || high < 0) errors.push(`Row ${i} (${costId}): invalid high ${high}`);
  if (low > typ || typ > high) errors.push(`Row ${i} (${costId}): bad range ${low} <= ${typ} <= ${high}`);
  if (curr !== 'INR') errors.push(`Row ${i} (${costId}): currency not INR`);
  if (!level) errors.push(`Row ${i} (${costId}): missing level`);
  if (!srcName) errors.push(`Row ${i} (${costId}): missing source_name`);
  if (!doc) errors.push(`Row ${i} (${costId}): missing source_document`);
  if (isNaN(yr) || yr < 2020 || yr > 2026) errors.push(`Row ${i} (${costId}): invalid year ${yr}`);
}

if (errors.length) {
  console.error('Validation failed with errors:', errors);
  process.exit(1);
} else {
  console.log(`SUCCESS: All ${lines.length - 1} records strictly validated!`);
  console.log(' - low <= typical <= high verified for 100% of rows');
  console.log(' - No negative numbers');
  console.log(' - Currency is INR across all rows');
  console.log(' - Source name, document and valid data_year verified');
}
