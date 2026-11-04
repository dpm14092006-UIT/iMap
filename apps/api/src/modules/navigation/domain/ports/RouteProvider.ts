import type { RouteRequest, RouteResult } from '@routetwin/shared';
export interface RouteProvider {
  calculate(input: RouteRequest): Promise<RouteResult>;
}
