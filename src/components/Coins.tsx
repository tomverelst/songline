/** A golden coin, the symbol for bonus points. */
export function Coin() {
  return <span className="coin" aria-hidden />
}

/** Coin followed by a count, e.g. next to a player's points. */
export function Coins({ count }: { count: number }) {
  return (
    <span className={`coins ${count ? '' : 'none'}`} aria-label={`${count} bonus ${count === 1 ? 'coin' : 'coins'}`}>
      <Coin />
      {count}
    </span>
  )
}
