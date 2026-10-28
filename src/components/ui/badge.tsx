import { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const badgeVariants = cva('status-badge', {
  variants: { variant: {
    default: 'badge-default', secondary: '', destructive: 'badge-destructive', positive: 'badge-positive', negative: 'badge-negative', outline: '',
  } },
  defaultVariants: { variant: 'default' },
});

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge };
