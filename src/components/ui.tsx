import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { buttonClass, cx, type ButtonProps } from './classes'

export function Button({ variant, size, block, className, ...props }: ButtonProps) {
  return <button className={cx(buttonClass({ variant, size, block }), className)} {...props} />
}

export function IconButton({
  big,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { big?: boolean }) {
  return (
    <button
      className={cx(
        'grid flex-none place-items-center rounded-full border border-line bg-surface-2',
        big ? 'size-14 text-[1.6rem]' : 'size-11',
        className,
      )}
      {...props}
    />
  )
}

export function LinkButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cx('self-start py-1 text-sm text-accent-2', className)} {...props} />
}

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cx('flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4', className)} {...props} />
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-[1.05rem] font-bold">{children}</h2>
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        // 16px text keeps iOS from zooming in on focus.
        'min-h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3.5 text-base text-ink',
        'placeholder:text-muted focus:outline-2 focus:-outline-offset-1 focus:outline-accent',
        className,
      )}
      {...props}
    />
  )
}

export function Muted({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx('text-sm text-muted', className)} {...props} />
}

/** Full-width card-like choice, e.g. a game mode or a playback device. */
export function OptionButton({
  selected,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      className={cx(
        'flex min-h-13 w-full flex-col items-start justify-center gap-0.5 rounded-xl border px-3 py-2 text-left',
        selected ? 'border-accent bg-accent/12' : 'border-line bg-bg',
        className,
      )}
      {...props}
    />
  )
}

export function Switch({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="mt-2 flex items-center gap-3 rounded-xl border border-line bg-bg p-3">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-muted">{description}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={cx(
          'relative h-8 w-13 flex-none appearance-none rounded-full border border-line bg-surface-2 transition-colors',
          'checked:border-good checked:bg-good focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          "after:absolute after:top-[3px] after:left-[3px] after:size-6 after:rounded-full after:bg-ink after:transition-transform after:content-['']",
          'checked:after:translate-x-5',
        )}
      />
    </label>
  )
}

/** Page column with room at the bottom for the BottomBar. */
export function Screen({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        'mx-auto flex max-w-[560px] flex-col gap-4 px-4',
        'pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+104px)]',
        className,
      )}
      {...props}
    />
  )
}

/** The main action, pinned to the bottom of the screen. */
export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 bg-linear-to-t from-bg from-70% to-transparent px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <div className="mx-auto max-w-[528px]">{children}</div>
    </div>
  )
}

/** Album art, or a note on a tile when there is none. */
export function Artwork({ src, className }: { src?: string; className: string }) {
  return src ? (
    <img src={src} alt="" loading="lazy" className={cx('flex-none object-cover', className)} />
  ) : (
    <div className={cx('grid flex-none place-items-center bg-surface-2 text-muted', className)}>♪</div>
  )
}

/** Gradient tile with an emoji or symbol, used in screen headers. */
export function Logo({ children }: { children: ReactNode }) {
  return (
    <div className="grid size-16 place-items-center rounded-[20px] bg-accent-gradient text-[2rem] text-on-accent">
      {children}
    </div>
  )
}
