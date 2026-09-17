import type { ComponentPropsWithoutRef, FC } from 'react'

type Props = ComponentPropsWithoutRef<'svg'>

/**
 * A pair of bongo drums - the low hembra and the high macho - standing in
 * for the two halves of Bongo DB: your schema and the agent that plays it.
 */
export const BongoLogoMark: FC<Props> = (props) => {
  return (
    <svg
      role="img"
      aria-label="Bongo DB Logo"
      width={24}
      height={24}
      viewBox="0 0 100 92"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect x="30" y="66" width="40" height="9" rx="3" fill="#4A2A18" />
      <ellipse cx="66" cy="52" rx="32" ry="28" fill="#7A4326" />
      <ellipse cx="66" cy="40" rx="23" ry="16" fill="#EFD6A6" />
      <ellipse cx="28" cy="58" rx="24" ry="21" fill="#4A2A18" />
      <ellipse cx="28" cy="49" rx="17" ry="12" fill="#E2C185" />
    </svg>
  )
}
