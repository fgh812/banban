import { useEffect, useRef, useState } from 'react'
import { fmtIn, parseNum } from '../lib/util'

interface Props {
  value: number
  onChange: (n: number) => void
  className?: string
  placeholder?: string
  ariaLabel?: string
  style?: React.CSSProperties
  zeroAsBlank?: boolean
}
// 금액 입력칸: 포커스되면 숫자만, 벗어나면 콤마 표기. Enter 로도 적용.
export default function AmountInput({ value, onChange, className, placeholder = '–', ariaLabel, style, zeroAsBlank = true }: Props) {
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState(() => zeroAsBlank ? fmtIn(value) : (value || 0).toLocaleString('ko-KR'))
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (!focused) setText(zeroAsBlank ? fmtIn(value) : (value || 0).toLocaleString('ko-KR')) }, [value, focused, zeroAsBlank])
  useEffect(() => { if (focused) ref.current?.select() }, [focused])
  return (
    <input ref={ref} className={'inp amt' + (className ? ' ' + className : '')} inputMode="numeric" placeholder={placeholder} aria-label={ariaLabel} style={style}
      value={text}
      onFocus={() => { setFocused(true); setText(value ? String(value) : '') }}
      onChange={e => { setText(e.target.value); onChange(parseNum(e.target.value)) }}
      onBlur={e => { setFocused(false); const n = parseNum(e.target.value); if (n !== value) onChange(n); setText(zeroAsBlank ? fmtIn(n) : n.toLocaleString('ko-KR')) }}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() } }}
    />
  )
}

// 일반 텍스트 입력: Enter/blur 시에만 커밋
export function TextInput({ value, onCommit, className, placeholder, ariaLabel, style, ...rest }: {
  value: string; onCommit: (s: string) => void; className?: string; placeholder?: string; ariaLabel?: string; style?: React.CSSProperties; [k: string]: any
}) {
  const [text, setText] = useState(value)
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setText(value) }, [value, focused])
  return (
    <input {...rest} className={className} placeholder={placeholder} aria-label={ariaLabel} style={style} value={text}
      onFocus={() => setFocused(true)}
      onChange={e => setText(e.target.value)}
      onBlur={() => { setFocused(false); if (text !== value) onCommit(text) }}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() } if (e.key === 'Escape') { setText(value); (e.target as HTMLInputElement).blur() } }}
    />
  )
}
