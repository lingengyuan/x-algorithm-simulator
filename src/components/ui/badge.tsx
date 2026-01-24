import { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#1DA1F2] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[#1DA1F2] text-white',
        secondary: 'border-transparent bg-gray-100 text-gray-900',
        destructive: 'border-transparent bg-red-500 text-white',
        positive: 'border-transparent bg-green-100 text-green-800',
        negative: 'border-transparent bg-red-100 text-red-800',
        outline: 'text-gray-900 border-gray-300',
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

export { Badge, badgeVariants };
