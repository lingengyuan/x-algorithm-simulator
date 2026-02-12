import { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-slate-900/20 bg-slate-900 text-white',
        secondary: 'border-slate-900/10 bg-slate-200/70 text-slate-700',
        destructive: 'border-red-700/20 bg-red-100 text-red-700',
        positive: 'border-emerald-700/20 bg-emerald-100 text-emerald-700',
        negative: 'border-rose-700/20 bg-rose-100 text-rose-700',
        outline: 'border-slate-700/30 text-slate-700 bg-white/60',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge };
