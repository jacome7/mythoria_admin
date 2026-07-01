'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface ChartSize {
  width: number;
  height: number;
}

interface MeasuredChartFrameProps {
  children: (size: ChartSize) => ReactNode;
  className?: string;
  minHeight: number;
}

export default function MeasuredChartFrame({
  children,
  className = '',
  minHeight,
}: MeasuredChartFrameProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<ChartSize | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    const updateSize = () => {
      const nextWidth = Math.round(frame.clientWidth);
      const nextHeight = Math.round(frame.clientHeight);
      if (nextWidth <= 0 || nextHeight <= 0) {
        return;
      }

      setSize((current) =>
        current?.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight },
      );
    };

    updateSize();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(frame);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className={`h-full min-w-0 ${className}`} style={{ minHeight }}>
      {size ? children(size) : null}
    </div>
  );
}
