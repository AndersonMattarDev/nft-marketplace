import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva('inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d68b45] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] disabled:pointer-events-none disabled:opacity-50', {
  variants: {
    variant: { default: 'bg-[#d68b45] text-[#17100a] hover:bg-[#e4a15f]', outline: 'border border-[#744a2b] bg-transparent text-[#f4eee5] hover:bg-[#39210f]', ghost: 'text-[#c4a987] hover:bg-[#39210f] hover:text-[#f4eee5]' },
    size: { default: 'min-h-10 px-4 py-2', sm: 'min-h-8 px-3 text-xs', icon: 'size-10' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
))
Button.displayName = 'Button'
