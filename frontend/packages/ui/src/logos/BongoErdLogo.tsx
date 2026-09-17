import type { ComponentPropsWithoutRef, FC } from 'react'

type Props = ComponentPropsWithoutRef<'svg'>

export const BongoErdLogo: FC<Props> = (props) => {
  return (
    <svg
      role="img"
      aria-label="Bongo ERD Logo"
      width={265}
      height={50}
      viewBox="0 0 265 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <text
        x="0"
        y="38"
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontWeight={800}
        fontSize={40}
        letterSpacing="-0.5"
        fill="currentColor"
      >
        Bongo
        <tspan fill="#C89B3C"> DB</tspan>
      </text>
    </svg>
  )
}
