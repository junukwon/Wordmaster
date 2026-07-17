import { act, renderHook } from '@testing-library/react';
import { useAnswerRevealGuard } from './useAnswerRevealGuard';

afterEach(() => {
  vi.useRealTimers();
});

test('guards ratings for exactly 600 ms after revealing and reset cancels activation', () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useAnswerRevealGuard());

  act(() => result.current.reveal());
  expect(result.current.revealed).toBe(true);
  expect(result.current.ratingReady).toBe(false);

  act(() => vi.advanceTimersByTime(599));
  expect(result.current.ratingReady).toBe(false);

  act(() => vi.advanceTimersByTime(1));
  expect(result.current.ratingReady).toBe(true);

  act(() => {
    result.current.reset();
    result.current.reveal();
    result.current.reset();
    vi.advanceTimersByTime(600);
  });
  expect(result.current.revealed).toBe(false);
  expect(result.current.ratingReady).toBe(false);
});
