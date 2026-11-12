import { z } from 'zod';
import { stopCategories, type StopCategory } from '../constants.js';
import { geoPointSchema, type RouteResult } from './routes.js';

export const stopCategorySchema = z.enum(stopCategories);
export const stopIntentSchema = z.object({
  category: z.enum([...stopCategories, 'unknown']),
  maxExtraDistanceMeters: z.number().int().min(0).max(10000).nullable(),
  maxExtraDurationSeconds: z.number().int().min(0).max(3600).nullable(),
  nearbyRadiusMeters: z.number().int().min(100).max(5000).nullable().default(null),
  clarificationQuestion: z.string().max(240).nullable().default(null),
  suggestedCategories: z.array(stopCategorySchema).max(4).default([]),
  unsupportedRequirements: z.array(z.string().max(120)).max(5),
});
export type StopIntent = z.infer<typeof stopIntentSchema>;
export const routeStopRequestSchema = z.object({
  points: z.array(geoPointSchema).length(2),
  vehicle: z.enum(['car', 'motorcycle']),
  query: z.string().trim().min(2).max(300),
  category: stopCategorySchema.optional(),
  maxExtraDistanceMeters: z.number().int().min(0).max(10000).optional(),
  maxExtraDurationSeconds: z.number().int().min(0).max(3600).optional(),
});
export type RouteStopRequest = z.infer<typeof routeStopRequestSchema>;
export type StopPlace = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: StopCategory;
  osmUrl: string;
  openingHours: string | null;
};
export type RouteStopCandidate = {
  place: StopPlace;
  insertAfterIndex: number;
  extraDistanceMeters: number;
  extraDurationSeconds: number;
  reason: string;
  route: RouteResult;
};
export type RouteStopResponse = {
  interpretation: {
    source: 'ai' | 'rules';
    category: StopCategory;
    maxExtraDistanceMeters: number;
    maxExtraDurationSeconds: number;
  };
  candidates: RouteStopCandidate[];
  warnings: string[];
  checkedCandidates: number;
  searchedAt: string;
};

export const explorePlacesRequestSchema = z.object({
  query: z.string().trim().min(2).max(300),
  context: z.array(z.string().trim().min(1).max(300)).max(4).default([]),
  mode: z.enum(['nearby', 'route']),
  category: stopCategorySchema.optional(),
  center: geoPointSchema.optional(),
  points: z.array(geoPointSchema).length(2).optional(),
  vehicle: z.enum(['car', 'motorcycle']).default('motorcycle'),
  radiusMeters: z.number().int().min(100).max(5000).optional(),
  maxExtraDistanceMeters: z.number().int().min(0).max(10000).optional(),
  maxExtraDurationSeconds: z.number().int().min(0).max(3600).optional(),
});
export type ExplorePlacesRequest = z.infer<typeof explorePlacesRequestSchema>;
export type ExplorePlacesResponse =
  | {
      status: 'clarify';
      source: 'ai' | 'rules';
      question: string;
      suggestions: StopCategory[];
      warnings: string[];
    }
  | {
      status: 'needs_location';
      source: 'ai' | 'rules';
      message: string;
    }
  | {
      status: 'needs_route';
      source: 'ai' | 'rules';
      message: string;
    }
  | {
      status: 'results';
      source: 'ai' | 'rules';
      category: StopCategory;
      mode: 'nearby';
      places: { place: StopPlace; distanceMeters: number }[];
      radiusMeters: number;
      warnings: string[];
      searchedAt: string;
    }
  | {
      status: 'results';
      source: 'ai' | 'rules';
      category: StopCategory;
      mode: 'route';
      routeStops: RouteStopResponse;
      warnings: string[];
      searchedAt: string;
    };
