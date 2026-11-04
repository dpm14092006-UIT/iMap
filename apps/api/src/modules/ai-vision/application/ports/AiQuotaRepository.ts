export interface AiQuotaRepository {
  consume(accessToken: string): Promise<void>;
}
