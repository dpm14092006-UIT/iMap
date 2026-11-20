/** Tính năng có hạn mức theo người dùng (đếm nguyên tử trong Postgres, xem migration 0008). */
export type QuotaFeature = 'route_stops' | 'route_explanation';

/** Trừ một lượt dùng của người dùng; ném AppError 429 khi hết lượt. */
export interface FeatureQuota {
  consume(feature: QuotaFeature, accessToken: string): Promise<void>;
}
