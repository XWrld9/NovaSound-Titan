import React, { useRef } from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

const Slider = React.forwardRef(({ className, onValueChange, value, max = 100, step = 1, ...props }, ref) => {
  const trackRef = useRef(null);

  // ── Fix iOS Safari : touch-none bloque les événements tactiles
  // On recalcule la valeur manuellement depuis la position du touch
  const handleTouch = (e) => {
    if (!trackRef.current || !onValueChange) return;
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0] || e.changedTouches[0];
    if (!touch) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    const newValue = Math.round((ratio * max) / step) * step;
    onValueChange([newValue]);
  };

  return (
    <SliderPrimitive.Root
      ref={ref}
      value={value}
      max={max}
      step={step}
      onValueChange={onValueChange}
      className={cn(
        "relative flex w-full select-none items-center",
        // touch-pan-y au lieu de touch-none : permet le scroll vertical
        // tout en capturant le swipe horizontal pour le seek
        "touch-pan-y",
        className
      )}
      style={{ touchAction: 'pan-y' }}
      {...props}
    >
      <SliderPrimitive.Track
        ref={trackRef}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onTouchEnd={handleTouch}
        className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-800/60 cursor-pointer"
        style={{ touchAction: 'none' }}
      >
        <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-cyan-500 to-magenta-500" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        onTouchStart={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
        className="block h-5 w-5 rounded-full border-2 border-cyan-400 bg-white shadow-lg shadow-cyan-500/30 transition-transform focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 active:scale-125"
        style={{ touchAction: 'none' }}
      />
    </SliderPrimitive.Root>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
