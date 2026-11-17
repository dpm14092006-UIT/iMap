import type { RoutePreference } from '@routetwin/shared';

export interface RoutePreferenceProvider {
  interpret(text: string): Promise<RoutePreference>;
}
