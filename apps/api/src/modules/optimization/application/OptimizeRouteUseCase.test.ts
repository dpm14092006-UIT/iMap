import { describe, expect, it, vi } from 'vitest';
import { OptimizeRouteUseCase } from './OptimizeRouteUseCase.js';
const input = { points: [{lat:10.77,lng:106.69},{lat:10.78,lng:106.7},{lat:10.79,lng:106.71}], vehicle: 'car' as const, objective:'distance' as const, returnToStart:false };
const route = { source:'vietmap' as const, distanceMeters:10,durationSeconds:4,coordinates:[[106.69,10.77],[106.71,10.79]] as [number,number][], instructions:[] };
describe('optimize route integration boundary', () => {
  it('orders by road cost, forwards vehicle/objective and renders a single actual road route', async () => {
    const matrices={getCosts:vi.fn().mockResolvedValue([[0,100,1],[100,0,100],[100,1,0]])};
    const routes={calculate:vi.fn().mockResolvedValue(route)};
    const output=await new OptimizeRouteUseCase(matrices,routes).execute(input);
    expect(output).toMatchObject({order:[0,2,1],originalCost:200,optimizedCost:2,objective:'distance',route});
    expect(routes.calculate).toHaveBeenCalledExactlyOnceWith({points:[input.points[0],input.points[2],input.points[1]],vehicle:'car',objective:'distance'});
  });
  it('returns to departure exactly once when requested', async () => {
    const matrices={getCosts:vi.fn().mockResolvedValue([[0,1,5],[5,0,1],[1,5,0]])};
    const routes={calculate:vi.fn().mockResolvedValue(route)};
    const output=await new OptimizeRouteUseCase(matrices,routes).execute({...input,returnToStart:true});
    expect(output.order).toEqual([0,1,2,0]);expect(routes.calculate.mock.calls[0]![0].points).toHaveLength(4);
  });
  it('rejects duplicate positions before any billed matrix request', async () => {
    const matrices={getCosts:vi.fn()}; const routes={calculate:vi.fn()};
    await expect(new OptimizeRouteUseCase(matrices,routes).execute({...input,points:[input.points[0]!,input.points[0]!]})).rejects.toThrow();
    expect(matrices.getCosts).not.toHaveBeenCalled();
  });
  it('does not calculate fabricated routes when no complete tour exists', async () => {
    const matrices={getCosts:vi.fn().mockResolvedValue([[0,Infinity,Infinity],[1,0,Infinity],[1,1,0]])}; const routes={calculate:vi.fn()};
    await expect(new OptimizeRouteUseCase(matrices,routes).execute(input)).rejects.toMatchObject({code:'TOUR_UNREACHABLE'});
    expect(routes.calculate).not.toHaveBeenCalled();
  });
});
