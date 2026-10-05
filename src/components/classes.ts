import type { ButtonHTMLAttributes } from 'react'

/** Joins class names, skipping falsy ones. */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

type ButtonVariant = 'default' | 'primary' | 'ghost' | 'spotify' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  default: 'border border-line bg-surface-2',
  primary: 'bg-accent-gradient text-on-accent shadow-[0_8px_24px_rgb(255_93_143/0.3)] disabled:shadow-none',
  ghost: 'border border-line',
  spotify: 'bg-spotify text-[#04130a]',
  danger: 'border border-line bg-surface-2 text-bad',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-3.5 text-sm',
  md: 'min-h-12 px-4.5',
  lg: 'min-h-14 px-4.5 text-[1.05rem]',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
}

export function buttonClass({ variant = 'default', size, block }: Omit<ButtonProps, 'className'>): string {
  return cx(
    'inline-flex items-center justify-center gap-1.5 rounded-full font-semibold disabled:opacity-45',
    BUTTON_SIZES[size ?? (variant === 'primary' ? 'lg' : 'md')],
    BUTTON_VARIANTS[variant],
    block && 'w-full',
  )
}
