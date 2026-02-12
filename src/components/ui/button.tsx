import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border border-slate-900/10 bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-[0_10px_20px_rgba(15,23,42,0.25)] hover:from-slate-800 hover:to-slate-600 hover:shadow-[0_14px_28px_rgba(15,23,42,0.35)]',
        destructive: 'border border-red-700/30 bg-gradient-to-br from-red-600 to-red-500 text-white shadow-[0_10px_18px_rgba(220,38,38,0.3)] hover:from-red-700 hover:to-red-600',
        outline: 'border border-slate-900/20 bg-white/70 text-slate-700 shadow-[0_4px_12px_rgba(15,23,42,0.08)] hover:border-slate-900/30 hover:bg-white hover:text-slate-950',
        secondary: 'border border-slate-800/10 bg-slate-100/80 text-slate-700 hover:bg-slate-200/90',
        ghost: 'text-slate-700 hover:bg-slate-200/70 hover:text-slate-950',
        link: 'text-sky-700 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-12 rounded-xl px-8',
        icon: 'h-10 w-10 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
