import { readFileSync, writeFileSync } from 'node:fs';
import { KeywordStopIntentParser } from '../../apps/api/src/modules/route-stops/infrastructure/providers/KeywordStopIntentParser.js';
const path = process.argv[2] ?? 'docs/voice/benchmark-results.json';
const data = JSON.parse(readFileSync(path, 'utf8'));
const parser = new KeywordStopIntentParser();
for (const row of data.rows) {
  const { intent } = await parser.parse(row.transcript);
  const expected = {
    category: row.expectedCategory,
    nearbyRadiusMeters: row.expectedCategory === 'school' ? 2000 : null,
    maxExtraDistanceMeters: row.expectedCategory === 'pharmacy' ? 1000 : null,
    maxExtraDurationSeconds: row.expectedCategory === 'cafe' ? 300 : null,
  };
  row.expectedSlots = expected;
  row.recognizedSlots = Object.fromEntries(
    Object.keys(expected).map((key) => [key, intent[key as keyof typeof intent]]),
  );
  row.categoryCorrect = intent.category === expected.category;
  row.slotsCorrect = Object.entries(expected).every(
    ([key, value]) => intent[key as keyof typeof intent] === value,
  );
}
data.summary = Object.fromEntries(
  [...new Set<string>(data.rows.map((row: { condition: string }) => row.condition))].map((condition) => {
    const rows = data.rows.filter((row: { condition: string }) => row.condition === condition);
    const sum = (key: string) =>
      rows.reduce((total: number, row: Record<string, number>) => total + Number(row[key]), 0);
    return [
      condition,
      {
        samples: rows.length,
        rawWordErrorRate: Number((sum('wordErrors') / sum('referenceWords')).toFixed(4)),
        categoryAccuracy: sum('categoryCorrect') / rows.length,
        allSlotsAccuracy: sum('slotsCorrect') / rows.length,
        meanInferenceSeconds: Number((sum('seconds') / rows.length).toFixed(3)),
      },
    ];
  }),
);
writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify(data.summary, null, 2));
