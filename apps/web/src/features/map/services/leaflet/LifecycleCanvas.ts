import * as L from 'leaflet';

// Leaflet 1.9's Canvas._updatePaths can synchronously call _redraw while an earlier RAF is
// queued. That loses the RAF id, so Canvas.onRemove cannot cancel it. Keep this version-specific
// override in the adapter: an orphaned callback must never touch the disposed canvas context.
const redraw = (L.Canvas.prototype as L.Canvas & { _redraw(): void })._redraw;

export class LifecycleCanvas extends L.Canvas {
  private disposed = false;

  _redraw() {
    if (!this.disposed) redraw.call(this);
  }

  dispose() {
    this.disposed = true;
  }
}
