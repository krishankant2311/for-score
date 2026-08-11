/**
 * One-time helper: extract USDA TSV from agent transcript into data/usdaFoods.tsv
 * Run: node scripts/extractUsdaFoodsTsv.js
 */
const fs = require('fs');
const path = require('path');

const transcriptCandidates = [
  'C:/Users/Nitin/.cursor/projects/c-four-score/agent-transcripts/e2d7c8cf-9725-4719-bf9b-1c43a9a6dd74/e2d7c8cf-9725-4719-bf9b-1c43a9a6dd74.jsonl',
  path.join(
    __dirname,
    '../../.cursor/projects/c-four-score/agent-transcripts/e2d7c8cf-9725-4719-bf9b-1c43a9a6dd74/e2d7c8cf-9725-4719-bf9b-1c43a9a6dd74.jsonl'
  ),
];
const outPath = path.join(__dirname, '../data/usdaFoods.tsv');

const transcriptFile = transcriptCandidates.find((p) => fs.existsSync(p));
if (!transcriptFile) {
  console.error('Transcript file not found');
  process.exit(1);
}

const raw = fs.readFileSync(transcriptFile, 'utf8');
const marker = 'fdc_id\tfood_name\tcategory';
let tsv = '';

const markerIdx = raw.indexOf(marker);
if (markerIdx !== -1) {
  let end = raw.indexOf('</user_query>', markerIdx);
  if (end === -1) end = raw.length;
  tsv = raw.slice(markerIdx, end).replace(/\r/g, '').trim();
} else {
  for (const line of raw.split('\n')) {
    if (!line.includes('fdc_id')) continue;
    const row = JSON.parse(line);
    const text = row.message?.content?.[0]?.text || '';
    const idx = text.indexOf(marker);
    if (idx === -1) continue;
    tsv = text.slice(idx).replace(/\r/g, '').trim();
    break;
  }
}

if (!tsv) {
  console.error('Could not find USDA TSV in transcript');
  process.exit(1);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, tsv, 'utf8');

const rowCount = tsv.split('\n').length - 1;
console.log(`Wrote ${outPath} (${rowCount} data rows)`);
