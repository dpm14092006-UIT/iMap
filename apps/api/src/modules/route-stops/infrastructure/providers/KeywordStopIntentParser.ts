import type { StopCategory } from '@routetwin/shared';
import { stopIntentSchema } from '@routetwin/shared';
import type { StopIntentParser } from '../../application/ports/StopIntentParser.js';
const categoryPatterns: [StopCategory, RegExp][] = [
  ['fuel', /\b(xang|tram nhien lieu|fuel|petrol|gas station|gasoline|low on gas|out of gas|need gas)\b/],
  ['cafe', /\b(ca phe|cafes?|coffee)\b/],
  ['restaurant', /\b(quan an|nha hang|an trua|an toi|restaurants?|food|do an|hungry|doi bung)\b/],
  ['pharmacy', /\b(nha thuoc|hieu thuoc|pharmacy|pharmacies)\b/],
  ['atm', /\b(atm|rut tien|withdraw cash)\b/],
  ['toilets', /\b(nha ve sinh|ve sinh|toilets?|restrooms?|bathrooms?|wc)\b/],
  ['school', /\b(truong hoc|truong tieu hoc|truong trung hoc|schools?)\b/],
  ['hospital', /\b(benh vien|hospitals?)\b/],
  ['parking', /\b(bai do|bai dau|dau xe|do xe|parking|park my car|park the car)\b/],
  ['park', /\b(cong vien|parks?)\b(?! (?:my|the|a) car)/],
  ['library', /\b(thu vien|library|libraries)\b/],
  ['bus_stop', /\b(tram xe buyt|ben xe buyt|bus stops?|bus stations?)\b/],
  ['train_station', /\b(ga tau|ga xe lua|train stations?|railway stations?)\b/],
  ['rest_area', /\b(tram nghi|tram dung chan|rest areas?|rest stops?)\b/],
];
export const normalizeQuery = (query: string) =>
  query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
const isNegated = (text: string) =>
  /\b(khong(?! qua| vuot)|tru|ngoai tru|dung tim|not(?! more than)|except|don.t)\b/.test(text);
const categoriesIn = (text: string) =>
  categoryPatterns.filter(([, pattern]) => pattern.test(text)).map(([category]) => category);
export class KeywordStopIntentParser implements StopIntentParser {
  async parse(query: string, context: string[] = []) {
    const numbers: Record<string, number> = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
    };
    const text = normalizeQuery(query)
      .replace(/(\d)-(kilomet(?:er|re)s?|km|minutes?)/g, '$1 $2')
      .replace(
        /\b(one|two|three|four|five|six|seven|eight|nine|ten)(?=\s+(?:extra\s+)?(?:km|kilometers?|kilometres?|meters?|metres?|miles?|minutes?|mins?))/g,
        (word) => String(numbers[word]),
      );
    let matches = categoriesIn(text);
    const isStation = /\b(station|tram)\b/.test(text);
    if (
      !matches.length &&
      !isNegated(text) &&
      (isStation || /\b(that|there|find it|cho do|dia diem do)\b/.test(text))
    ) {
      for (const previous of [...context].reverse()) {
        const normalized = normalizeQuery(previous);
        const prior = isNegated(normalized) ? [] : categoriesIn(normalized);
        if (prior.length !== 1) continue;
        if (!isStation || ['fuel', 'bus_stop', 'train_station'].includes(prior[0]!)) {
          matches = prior;
          break;
        }
      }
    }
    const category = matches.length === 1 && !isNegated(text) ? matches[0]! : 'unknown';
    const distance =
      text.match(
        /(?:di them|vong them|them|toi da|khong qua|khong vuot qua|at most|maximum|max|up to|no more than)\s*(\d+(?:[.,]\d+)?)\s*(?:extra\s*)?(km|kilomet(?:er|re)?s?|meters?|metres?|met|miles?|m)\b/,
      ) ?? text.match(/(\d+(?:[.,]\d+)?)\s*(km|kilomet(?:er|re)?s?|meters?|metres?|met|miles?|m)\s+extra\b/);
    const radius = text.match(
      /(?:within|radius|ban kinh|trong vong)\s*(\d+(?:[.,]\d+)?)\s*(km|kilomet(?:er|re)?s?|meters?|metres?|met|miles?|m)\b/,
    );
    const time =
      text.match(
        /(?:di them|vong them|them|toi da|khong qua|khong vuot qua|at most|maximum|max|up to|no more than)\s*(\d+(?:[.,]\d+)?)\s*(?:extra\s*)?(phut|minutes?|mins?)\b/,
      ) ?? text.match(/(\d+(?:[.,]\d+)?)\s*(phut|minutes?|mins?)\s+extra\b/);
    const parseNumber = (value: string) => Number(value.replace(',', '.'));
    const meters = (match: RegExpMatchArray | null) =>
      match
        ? Math.round(
            parseNumber(match[1]!) *
              (match[2]!.startsWith('k') ? 1000 : match[2]!.startsWith('mile') ? 1609.344 : 1),
          )
        : null;
    const unsupportedRequirements: string[] = [];
    if (/\b(dang mo|mo cua|24\/7|24h|open now|open 24)\b/.test(text))
      unsupportedRequirements.push('Chưa xác minh trạng thái đang mở cửa.');
    if (
      /\b(re nhat|gia re|yen tinh|o cam|wifi|sach se|an toan|cheap|cheapest|quiet|outlets|accessible|clean)\b/.test(
        text,
      )
    )
      unsupportedRequirements.push('Chưa có dữ liệu để lọc giá, tiện ích hoặc chất lượng địa điểm.');
    const vagueRest = /\b(nghi mot chut|can nghi|nghi ngoi|need a break|take a break|rest somewhere)\b/.test(
      text,
    );
    const publicPlace = /\b(public place|public space|cong cong)\b/.test(text);
    const suggestions: StopCategory[] = publicPlace
      ? ['park', 'library', 'toilets']
      : matches.length > 1
        ? matches.slice(0, 4)
        : isStation
          ? ['fuel', 'bus_stop', 'train_station']
          : vagueRest
            ? ['cafe', 'park', 'rest_area']
            : ['school', 'fuel', 'park', 'toilets'];
    const intent = stopIntentSchema.parse({
      category,
      maxExtraDistanceMeters: meters(distance),
      nearbyRadiusMeters: meters(radius),
      maxExtraDurationSeconds: time ? Math.round(parseNumber(time[1]!) * 60) : null,
      clarificationQuestion:
        category === 'unknown'
          ? isStation
            ? 'Bạn muốn tìm trạm xăng, trạm xe buýt hay ga tàu?'
            : vagueRest
              ? 'Bạn muốn nghỉ ở quán cà phê, công viên hay trạm nghỉ?'
              : 'Bạn muốn tìm loại địa điểm nào? Chọn bên dưới hoặc nói rõ hơn.'
          : null,
      suggestedCategories: category === 'unknown' ? suggestions : [],
      unsupportedRequirements,
    });
    return { intent, source: 'rules' as const };
  }
}
