import { describe, expect, it } from 'vitest';
import { KeywordStopIntentParser } from './KeywordStopIntentParser.js';
const parser = new KeywordStopIntentParser();
describe('honest rules fallback', () => {
  it.each([
    ['Tìm trạm xăng, đi thêm tối đa 1 km', 'fuel', 1000, null],
    ['Tìm cà phê, vòng thêm tối đa 5 phút', 'cafe', null, 300],
    ['Tìm nhà thuốc, đi thêm không quá 0,5 km', 'pharmacy', 500, null],
    ['Tìm ATM', 'atm', null, null],
    ['Find a gas station along my route, with at most 1 km extra', 'fuel', 1000, null],
    ['Find coffee with at most five extra minutes', 'cafe', null, 300],
    ['Find a pharmacy, up to one kilometer extra', 'pharmacy', 1000, null],
    ['Find a pharmacy with utmost 1 km extra', 'pharmacy', 1000, null],
    ['Find a pharmacy with its most 1-kilometer extra', 'pharmacy', 1000, null],
    ['Find a restroom, maximum 0.5 miles extra', 'toilets', 805, null],
  ])('extracts %s', async (query, category, distance, time) => {
    const result = await parser.parse(query);
    expect(result.source).toBe('rules');
    expect(result.intent).toMatchObject({
      category,
      maxExtraDistanceMeters: distance,
      maxExtraDurationSeconds: time,
    });
  });
  it('does not guess ambiguous or negated categories', async () => {
    expect((await parser.parse('Tìm trạm xăng hoặc cà phê')).intent.category).toBe('unknown');
    expect((await parser.parse('Không tìm trạm xăng')).intent.category).toBe('unknown');
  });
  it('does not mistake time spent at the stop for extra driving time', async () => {
    expect((await parser.parse('Tìm cà phê để ngồi 30 phút')).intent.maxExtraDurationSeconds).toBeNull();
  });
  it('exposes unavailable filters instead of asserting open-now or quiet', async () => {
    expect(
      (await parser.parse('Tìm cà phê đang mở cửa, yên tĩnh')).intent.unsupportedRequirements,
    ).toHaveLength(2);
  });
});
