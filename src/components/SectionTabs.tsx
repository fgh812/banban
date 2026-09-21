import { useEffect, useState } from 'react'

// 화면 위에 붙는 섹션 탭: 누르면 그 카드로 스크롤, 스크롤하면 현재 카드 탭에 밑줄
export const SEC_NAMES: Record<string, string> = { ledger: '가계부', insights: '분석', goals: '목표', flow: '월별 흐름', loans: '대출과 자산' }
const TAB_H = 46
const topInset = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0

export default function SectionTabs({ order }: { order: string[] }) {
  const [active, setActive] = useState(order[0])
  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const line = TAB_H + topInset() + 8
        let cur = order[0]
        for (const id of order) {
          const el = document.querySelector<HTMLElement>(`[data-sec="${id}"]`)
          if (el && el.getBoundingClientRect().top - line <= 0) cur = id
        }
        // 맨 아래까지 내려가면 마지막 탭
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) cur = order[order.length - 1]
        setActive(cur)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [order.join(',')])

  const go = (id: string) => {
    const el = document.querySelector<HTMLElement>(`[data-sec="${id}"]`); if (!el) return
    const y = el.getBoundingClientRect().top + window.scrollY - TAB_H - topInset() - 4
    window.scrollTo({ top: y, behavior: 'smooth' })
  }
  useEffect(() => { document.querySelector<HTMLElement>(`.sectabs [aria-selected="true"]`)?.scrollIntoView({ block: 'nearest', inline: 'center' }) }, [active])

  return (
    <nav className="sectabs" aria-label="섹션 이동">
      {order.map(id => <button key={id} role="tab" aria-selected={active === id} onClick={() => go(id)}>{SEC_NAMES[id] || id}</button>)}
    </nav>
  )
}
