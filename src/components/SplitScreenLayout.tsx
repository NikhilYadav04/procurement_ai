import React, { useState, useRef, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { GripVertical, Maximize2, Minimize2, X } from 'lucide-react';
import { spring } from '@/lib/motion';
import { Button } from './ui/button';

interface SplitScreenLayoutProps {
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
  onClose?: () => void;
  title?: string;
  showLiveDot?: boolean;
  defaultSplitPosition?: number; // percentage (0-100)
  minSplitPosition?: number; // percentage (0-100)
  maxSplitPosition?: number; // percentage (0-100)
  /** Render rightContent across the full width, with no left pane or divider.
   *  For surfaces that need the whole screen, such as the quote comparison. */
  singlePane?: boolean;
}

const KEYBOARD_STEP = 2; // percent, per arrow-key press on the separator

export const SplitScreenLayout: React.FC<SplitScreenLayoutProps> = ({
  leftContent,
  rightContent,
  onClose,
  title = 'Live Auction Mode',
  showLiveDot = true,
  defaultSplitPosition = 50,
  minSplitPosition = 20,
  maxSplitPosition = 80,
  singlePane = false,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [splitPosition, setSplitPosition] = useState(defaultSplitPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newPosition = ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Clamp the position within min and max bounds
      const clampedPosition = Math.min(Math.max(newPosition, minSplitPosition), maxSplitPosition);
      setSplitPosition(clampedPosition);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isDragging) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, minSplitPosition, maxSplitPosition]);

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDividerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSplitPosition((p) => Math.max(minSplitPosition, p - KEYBOARD_STEP));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSplitPosition((p) => Math.min(maxSplitPosition, p + KEYBOARD_STEP));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSplitPosition(defaultSplitPosition);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
      transition={shouldReduceMotion ? { duration: 0 } : spring.surface}
      className={`fixed inset-0 z-50 bg-background ${isFullscreen ? '' : 'ml-20'}`}
      ref={containerRef}
    >
      {/* Header Bar */}
      <div className="absolute top-0 left-0 right-0 h-14 bg-surface/60 backdrop-blur-xl border-b border-border z-10 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          {showLiveDot && <span className="h-2 w-2 rounded-full bg-destructive" aria-hidden="true" />}
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <Maximize2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="Exit split view"
              aria-label="Exit split view"
            >
              <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {/* Split Content Container */}
      <div className="absolute top-14 left-0 right-0 bottom-0 flex">
        {singlePane ? (
          <div className="relative w-full overflow-hidden">
            <div className="absolute inset-0 overflow-y-auto">{rightContent}</div>
          </div>
        ) : (
        <>
        {/* Left Panel - Chat */}
        <div className="relative overflow-hidden" style={{ width: `${splitPosition}%` }}>
          <div className="absolute inset-0 overflow-y-auto">{leftContent}</div>
        </div>

        {/* Draggable Divider */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panels"
          aria-valuenow={Math.round(splitPosition)}
          aria-valuemin={minSplitPosition}
          aria-valuemax={maxSplitPosition}
          tabIndex={0}
          onMouseDown={handleDragStart}
          onKeyDown={handleDividerKeyDown}
          className="group relative flex w-3 items-center justify-center cursor-col-resize touch-none focus-visible:outline-none"
        >
          {/* Divider Line */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-secondary transition-colors duration-150 group-hover:bg-primary group-focus-visible:bg-primary" />

          {/* Drag Handle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-inner)] border border-border bg-surface p-1.5 opacity-0 transition-[opacity,border-color] duration-150 group-hover:opacity-100 group-hover:border-primary/30 group-focus-visible:opacity-100 group-focus-visible:border-primary/30 group-focus-visible:ring-2 group-focus-visible:ring-ring">
            <GripVertical className="h-4 w-4 text-muted-foreground group-hover:text-primary group-focus-visible:text-primary" aria-hidden="true" />
          </div>
        </div>

        {/* Right Panel - Live Auction Feed */}
        <div className="relative overflow-hidden" style={{ width: `${100 - splitPosition}%` }}>
          <div className="absolute inset-0 overflow-y-auto">{rightContent}</div>
        </div>
        </>
        )}
      </div>
    </motion.div>
  );
};
