import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const buttonVariants = cva('button', {
  variants: {
    variant: {
      default: 'button-primary', destructive: 'button-destructive', outline: 'button-outline',
      secondary: 'button-secondary', ghost: 'button-ghost', link: 'button-link',
    },
    size: { default: '', sm: 'button-small', lg: 'button-large', icon: 'button-icon' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

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
