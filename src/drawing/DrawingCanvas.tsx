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
    const [strokes, setStrokes] = useState<Stroke[]>([]);

    const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
      const rect = event.currentTarget.getBoundingClientRect();
      const scaleX = rect.width > 0 ? event.currentTarget.width / (rect.width * (window.devicePixelRatio || 1)) : 1;
      const scaleY = rect.height > 0 ? event.currentTarget.height / (rect.height * (window.devicePixelRatio || 1)) : 1;
      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
        pressure: event.pressure > 0 ? event.pressure : 0.5,
      };
    };

    const redraw = useCallback((allStrokes: Stroke[]) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) return;
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = '#17364c';
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
      }
      activePointer.current = { id: event.pointerId, type: event.pointerType };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      activeStroke.current = [pointFromEvent(event)];
      redraw([...strokes, activeStroke.current]);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!activeStroke.current || activePointer.current?.id !== event.pointerId) return;
      event.preventDefault();
      activeStroke.current.push(pointFromEvent(event));
      redraw([...strokes, activeStroke.current]);
    };

    const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!activeStroke.current || activePointer.current?.id !== event.pointerId) return;
      event.preventDefault();
      const completed = [...activeStroke.current];
      activeStroke.current = null;
      activePointer.current = null;
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
