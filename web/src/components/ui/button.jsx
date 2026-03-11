import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import React from 'react';

/**
 * NovaSound TITAN LUX — Button component
 * Entièrement surchargé pour l'app dark-theme.
 * Les variantes shadcn par défaut utilisaient --accent (blanc) → texte noir au hover.
 * Toutes les variantes ici restent sur fond sombre.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Gradient buttons passent leur propre bg + hover via className → opacity seul
        default:
          'bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white hover:opacity-90 active:opacity-80',
        destructive:
          'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
        // outline : fond transparent, texte conservé, JAMAIS de bg clair
        outline:
          'border border-white/20 bg-transparent text-inherit hover:bg-white/[0.07] hover:border-white/30 active:bg-white/10',
        secondary:
          'bg-white/10 text-white hover:bg-white/15 active:bg-white/20',
        ghost:
          'bg-transparent text-inherit hover:bg-white/[0.07] hover:text-white active:bg-white/10',
        link:
          'text-cyan-400 underline-offset-4 hover:underline hover:text-cyan-300',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = 'Button';

export { Button, buttonVariants };
