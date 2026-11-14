import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from './classes'

/**
 * Driver mode's buttons: tall, nearly square tiles with a big icon over a
 * short label, in one row, so they're easy to hit without looking long.
 */
export function driveButtonClass(variant: 'default' | 'primary' | 'liked' = 'default'): string {
  return cx(
    'flex h-[clamp(6rem,13dvh,7.5rem)] min-w-0 flex-col items-center justify-center gap-1 rounded-3xl px-1 text-base leading-tight font-semibold transition-transform active:scale-95 disabled:opacity-45 short:h-[clamp(4.25rem,22dvh,6rem)] short:gap-0.5 short:text-sm',
    variant === 'primary' && 'bg-accent-gradient text-on-accent shadow-[0_8px_24px_rgb(255_93_143/0.3)] disabled:shadow-none',
    variant === 'liked' && 'border border-[#1ed760]/50 bg-[#1ed760]/15 text-[#1ed760]',
    variant === 'default' && 'border border-line bg-surface-2',
  )
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  label: string
  variant?: 'default' | 'primary' | 'liked'
}

export function DriveButton({ icon, label, variant, className, ...props }: Props) {
  return (
    <button className={cx(driveButtonClass(variant), className)} {...props}>
      <span className="grid size-9 place-items-center text-[2rem] short:size-7 short:text-[1.6rem]" aria-hidden>
        {icon}
      </span>
      <span className="line-clamp-2 max-w-full text-center break-words">{label}</span>
    </button>
  )
}

/** Icons for the drive buttons, filling the icon box. */
export function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-full">
      <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" strokeLinejoin="round" />
    </svg>
  )
}

export function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-full">
      <rect x="5.5" y="4.5" width="4.5" height="15" rx="1.2" fill="currentColor" />
      <rect x="14" y="4.5" width="4.5" height="15" rx="1.2" fill="currentColor" />
    </svg>
  )
}

/** An eye: show what's hidden (the year). */
export function RevealIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-full" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M1.75 12S5.5 5.25 12 5.25 22.25 12 22.25 12 18.5 18.75 12 18.75 1.75 12 1.75 12z" />
      <circle cx="12" cy="12" r="3.25" fill="currentColor" />
    </svg>
  )
}
