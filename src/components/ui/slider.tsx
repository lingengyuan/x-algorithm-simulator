import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/utils/cn';

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      'app-slider',
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="slider-track">
      <SliderPrimitive.Range className="slider-range" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} className="slider-thumb" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
