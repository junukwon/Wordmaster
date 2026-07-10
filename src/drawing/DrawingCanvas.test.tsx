import { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DrawingCanvas, type DrawingCanvasHandle } from './DrawingCanvas';

let lineToMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  lineToMock = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: lineToMock, stroke: vi.fn(),
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

test('palm touch cannot interrupt an active Pencil stroke', () => {
  render(<DrawingCanvas />);
  const canvas = screen.getByRole('img', { name: /Apple Pencil/ });

  fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: 'pen', clientX: 10, clientY: 10, pressure: 0.5 });
  fireEvent.pointerMove(canvas, { pointerId: 1, pointerType: 'pen', clientX: 40, clientY: 35, pressure: 0.7 });
  fireEvent.pointerDown(canvas, { pointerId: 2, pointerType: 'touch', clientX: 110, clientY: 100, pressure: 0.5 });
  fireEvent.pointerMove(canvas, { pointerId: 2, pointerType: 'touch', clientX: 130, clientY: 120, pressure: 0.5 });
  fireEvent.pointerUp(canvas, { pointerId: 2, pointerType: 'touch', clientX: 130, clientY: 120, pressure: 0.5 });
  fireEvent.pointerMove(canvas, { pointerId: 1, pointerType: 'pen', clientX: 90, clientY: 70, pressure: 0.8 });
  fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: 'pen', clientX: 90, clientY: 70, pressure: 0.8 });

  expect(canvas).toHaveAttribute('data-stroke-count', '1');
  expect(lineToMock).toHaveBeenCalledWith(90, 70);
});
