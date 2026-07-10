import { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DrawingCanvas, type DrawingCanvasHandle } from './DrawingCanvas';

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
    setTransform: vi.fn(), lineCap: '', lineJoin: '', strokeStyle: '', lineWidth: 0,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 240, width: 400, height: 240,
    toJSON: () => ({}),
  });
});

afterEach(() => vi.restoreAllMocks());

function drawStroke(canvas: HTMLElement, offset = 0) {
  fireEvent.pointerDown(canvas, { pointerId: offset + 1, clientX: 10 + offset, clientY: 10, pressure: 0.5 });
  fireEvent.pointerMove(canvas, { pointerId: offset + 1, clientX: 50 + offset, clientY: 40, pressure: 0.7 });
  fireEvent.pointerUp(canvas, { pointerId: offset + 1, clientX: 50 + offset, clientY: 40, pressure: 0.7 });
}

test('pointer down, move and up creates a stroke', () => {
  render(<DrawingCanvas />);
  const canvas = screen.getByRole('img', { name: /Apple Pencil 필기장/ });
  drawStroke(canvas);
  expect(canvas).toHaveAttribute('data-stroke-count', '1');
  expect(canvas).toHaveStyle({ touchAction: 'none' });
  expect(canvas.parentElement).not.toHaveStyle({ touchAction: 'none' });
});

test('undo removes only the last stroke and clear removes all', () => {
  const ref = createRef<DrawingCanvasHandle>();
  render(<DrawingCanvas ref={ref} />);
  const canvas = screen.getByRole('img', { name: /Apple Pencil 필기장/ });
  drawStroke(canvas, 0);
  drawStroke(canvas, 20);
  expect(canvas).toHaveAttribute('data-stroke-count', '2');
  act(() => ref.current?.undo());
  expect(canvas).toHaveAttribute('data-stroke-count', '1');
  act(() => ref.current?.clear());
  expect(canvas).toHaveAttribute('data-stroke-count', '0');
});
