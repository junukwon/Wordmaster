import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

type Point = { x: number; y: number; pressure: number };
type Stroke = Point[];
type ActivePointer = { id: number; type: string };
type CanvasMetrics = { left: number; top: number; scaleX: number; scaleY: number };

export type DrawingCanvasHandle = {
  undo(): void;
  clear(): void;
};

type DrawingCanvasProps = {
  className?: string;
};

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  function DrawingCanvas({ className = '' }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const activeStroke = useRef<Stroke | null>(null);
    const activePointer = useRef<ActivePointer | null>(null);
    const activeMetrics = useRef<CanvasMetrics | null>(null);
    const [strokes, setStrokes] = useState<Stroke[]>([]);

    const metricsForCanvas = (canvas: HTMLCanvasElement): CanvasMetrics => {
      const rect = canvas.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        scaleX: rect.width > 0 ? canvas.width / (rect.width * (window.devicePixelRatio || 1)) : 1,
        scaleY: rect.height > 0 ? canvas.height / (rect.height * (window.devicePixelRatio || 1)) : 1,
      };
    };

    const pointFromCoordinates = (
      metrics: CanvasMetrics,
      clientX: number,
      clientY: number,
      pressure: number,
    ): Point => {
      return {
        x: (clientX - metrics.left) * metrics.scaleX,
        y: (clientY - metrics.top) * metrics.scaleY,
        pressure: pressure > 0 ? pressure : 0.5,
      };
    };

    const prepareContext = (context: CanvasRenderingContext2D) => {
      const ratio = window.devicePixelRatio || 1;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = '#17364c';
    };

    const drawIncrementally = (previous: Point, points: Point[]) => {
      const context = canvasRef.current?.getContext('2d');
      if (!context || points.length === 0) return;
      prepareContext(context);
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      for (const point of points) {
        context.lineWidth = 2 + point.pressure * 3;
        context.lineTo(point.x, point.y);
      }
      context.stroke();
    };

    const redraw = useCallback((allStrokes: Stroke[]) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) return;
      const rect = canvas.getBoundingClientRect();
      prepareContext(context);
      context.clearRect(0, 0, rect.width, rect.height);
      for (const stroke of allStrokes) {
        if (stroke.length === 0) continue;
        context.beginPath();
        context.moveTo(stroke[0].x, stroke[0].y);
        for (let index = 1; index < stroke.length; index += 1) {
          context.lineWidth = 2 + stroke[index].pressure * 3;
          context.lineTo(stroke[index].x, stroke[index].y);
        }
        if (stroke.length === 1) context.lineTo(stroke[0].x + 0.1, stroke[0].y + 0.1);
        context.stroke();
      }
    }, []);

    const resize = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      redraw(strokes);
    }, [redraw, strokes]);

    useEffect(() => {
      resize();
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    }, [resize]);

    useEffect(() => redraw(strokes), [redraw, strokes]);

    useImperativeHandle(ref, () => ({
      undo: () => setStrokes((current) => current.slice(0, -1)),
      clear: () => {
        activeStroke.current = null;
        activePointer.current = null;
        activeMetrics.current = null;
        setStrokes([]);
      },
    }), []);

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      const currentPointer = activePointer.current;
      if (currentPointer) {
        const PencilTakesPriority = event.pointerType === 'pen' && currentPointer.type !== 'pen';
        if (!PencilTakesPriority) return;
        event.currentTarget.releasePointerCapture?.(currentPointer.id);
        activeStroke.current = null;
        activeMetrics.current = null;
      }
      activePointer.current = { id: event.pointerId, type: event.pointerType };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      activeMetrics.current = metricsForCanvas(event.currentTarget);
      const firstPoint = pointFromCoordinates(
        activeMetrics.current, event.clientX, event.clientY, event.pressure,
      );
      activeStroke.current = [firstPoint];
      drawIncrementally(firstPoint, [{ ...firstPoint, x: firstPoint.x + 0.1, y: firstPoint.y + 0.1 }]);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!activeStroke.current || activePointer.current?.id !== event.pointerId) return;
      event.preventDefault();
      const nativeEvent = event.nativeEvent as PointerEvent & {
        getCoalescedEvents?: () => PointerEvent[];
      };
      const samples = nativeEvent.getCoalescedEvents?.();
      const metrics = activeMetrics.current ?? metricsForCanvas(event.currentTarget);
      const points = samples && samples.length > 0
        ? samples.map((sample) => pointFromCoordinates(
            metrics,
            sample.clientX,
            sample.clientY,
            sample.pressure,
          ))
        : [pointFromCoordinates(
            metrics,
            event.clientX,
            event.clientY,
            event.pressure,
          )];
      const previous = activeStroke.current[activeStroke.current.length - 1];
      drawIncrementally(previous, points);
      activeStroke.current.push(...points);
    };

    const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!activeStroke.current || activePointer.current?.id !== event.pointerId) return;
      event.preventDefault();
      const completed = [...activeStroke.current];
      activeStroke.current = null;
      activePointer.current = null;
      activeMetrics.current = null;
      setStrokes((current) => [...current, completed]);
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    };

    return (
      <canvas
        ref={canvasRef}
        className={`drawing-canvas ${className}`.trim()}
        role="img"
        aria-label={`Apple Pencil 필기장, ${strokes.length}개 획`}
        data-stroke-count={strokes.length}
        style={{ touchAction: 'none' }}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />
    );
  },
);
