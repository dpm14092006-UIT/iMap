/** Native geolocation test double; can deliver an already queued callback after clearWatch. */
export class TestGeolocation implements Geolocation {
  readonly watches: {
    success: PositionCallback;
    error?: PositionErrorCallback | null;
    options?: PositionOptions;
  }[] = [];
  readonly cleared: number[] = [];
  watchPosition(
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions,
  ): number {
    return this.watches.push({ success, error, options }) - 1;
  }
  clearWatch(id: number) {
    this.cleared.push(id);
  }
  getCurrentPosition(
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions,
  ) {
    this.watchPosition(success, error, options);
  }
  fix(id: number, lat = 10, lng = 106, extra: Partial<GeolocationCoordinates> = {}) {
    this.watches[id]!.success({
      coords: {
        latitude: lat,
        longitude: lng,
        accuracy: 5,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        ...extra,
      },
      timestamp: Date.now(),
    } as GeolocationPosition);
  }
  fail(id: number, code: number) {
    this.watches[id]!.error?.({
      code,
      message: 'GPS error',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError);
  }
}
