import { useEffect, type RefObject } from 'react'

export interface DragCallbacks {
  onMoveItem: (id: string, cat: string, beforeId: string) => void
  onMoveCat: (name: string, refName: string, after: boolean) => void
  onMoveGroup: (gid: string, refGid: string, after: boolean) => void
  ghostFor: (kind: 'item' | 'cat' | 'grp', id: string) => string   // ghost innerHTML
}

interface Drag {
  kind: 'item' | 'cat' | 'grp'; id: string; row: HTMLElement
  x: number; y: number; live: boolean; fromInput: boolean
  target: any; ghost?: HTMLElement
}

// 표의 항목/분류/묶음 줄을 누른 채 끌어서 옮기기 (마우스: 줄 아무 데나, 터치: 손잡이만)
export function useRowDrag(tableRef: RefObject<HTMLTableElement | null>, cb: DragCallbacks, enabled = true) {
  useEffect(() => {
    const led = tableRef.current
    if (!led || !enabled) return
    let drag: Drag | null = null

    const clearMarks = () => led.querySelectorAll('.drop-before,.drop-after,.drop-into,.dragsrc').forEach(x => x.classList.remove('drop-before', 'drop-after', 'drop-into', 'dragsrc'))
    const endDrag = (commit: boolean) => {
      if (!drag) return
      const d = drag; drag = null
      d.ghost?.remove(); clearMarks(); document.body.classList.remove('dragging')
      if (commit && d.live && d.target) {
        if (d.kind === 'grp') cb.onMoveGroup(d.id, d.target.gid, d.target.after)
        else if (d.kind === 'cat') cb.onMoveCat(d.id, d.target.cat, d.target.after)
        else if (d.target.before !== d.id) cb.onMoveItem(d.id, d.target.cat, d.target.before)
      }
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const t = e.target as HTMLElement
      const tag = t.tagName
      const grpRow = t.closest('tr.tot.grp') as HTMLElement | null
      const catRow = t.closest('tr.cat') as HTMLElement | null
      const itemRow = t.closest('tr.item') as HTMLElement | null
      const row = grpRow || catRow || itemRow
      if (!row || !led.contains(row)) return
      const onGrab = !!t.closest('.grab')
      if (!onGrab && (tag === 'BUTTON' || tag === 'SELECT' || tag === 'LABEL' || (tag === 'INPUT' && (t as HTMLInputElement).type === 'checkbox'))) return
      if (!onGrab && e.pointerType !== 'mouse') return
      if ((grpRow || catRow) && !onGrab && tag === 'INPUT') return
      const kind = grpRow ? 'grp' : catRow ? 'cat' : 'item'
      const id = grpRow ? grpRow.dataset.gid! : catRow ? catRow.dataset.cat! : itemRow!.dataset.row!
      drag = { kind, id, row, x: e.clientX, y: e.clientY, live: false, fromInput: tag === 'INPUT' && !onGrab, target: null }
      if (onGrab) e.preventDefault()
    }
    const onMove = (e: PointerEvent) => {
      if (!drag) return
      if (!drag.live) {
        const dx = Math.abs(e.clientX - drag.x), dy = Math.abs(e.clientY - drag.y)
        if (drag.fromInput) {
          if (dy < 9) { if (dx > 12) drag = null; return }
          if (dy < dx) { drag = null; return }
          ;(document.activeElement as HTMLElement | null)?.blur?.()
          window.getSelection()?.removeAllRanges()
        } else if (dx + dy < 6) return
        drag.live = true
        const g = document.createElement('div'); g.className = 'dragghost'
        g.innerHTML = cb.ghostFor(drag.kind, drag.id)
        document.body.appendChild(g); drag.ghost = g
        drag.row.classList.add('dragsrc'); document.body.classList.add('dragging')
        if (drag.kind === 'cat') {
          let sib = drag.row.nextElementSibling
          while (sib && !sib.classList.contains('cat') && !sib.classList.contains('addcat') && !sib.classList.contains('tot')) { sib.classList.add('dragsrc'); sib = sib.nextElementSibling }
        }
      }
      e.preventDefault()
      drag.ghost!.style.left = e.clientX + 'px'; drag.ghost!.style.top = e.clientY + 'px'
      if (e.clientY < 70) window.scrollBy(0, -12); else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 12)
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const sel = drag.kind === 'grp' ? 'tr.tot.grp' : 'tr.item, tr.cat, tr.addrow'
      const tr = el?.closest?.(sel) as HTMLElement | null
      led.querySelectorAll('.drop-before,.drop-after,.drop-into').forEach(x => x.classList.remove('drop-before', 'drop-after', 'drop-into'))
      drag.target = null
      if (!tr || !led.contains(tr)) return
      if (drag.kind === 'grp') {
        const tg = tr.dataset.gid!; if (tg === drag.id) return
        const b = tr.getBoundingClientRect(), after = e.clientY > b.top + b.height / 2
        tr.classList.add(after ? 'drop-after' : 'drop-before'); drag.target = { gid: tg, after }; return
      }
      const cat = tr.dataset.cat!
      if (drag.kind === 'cat') {
        if (!cat || cat === drag.id) return
        const head = led.querySelector(`tr.cat[data-cat="${CSS.escape(cat)}"]`) as HTMLElement
        let tail: Element = head
        while (tail.nextElementSibling && !tail.nextElementSibling.classList.contains('cat') && !tail.nextElementSibling.classList.contains('addcat') && !tail.nextElementSibling.classList.contains('tot')) tail = tail.nextElementSibling
        const hb = head.getBoundingClientRect(), tb = tail.getBoundingClientRect()
        const after = e.clientY > (hb.top + tb.bottom) / 2
        ;(after ? tail : head).classList.add(after ? 'drop-after' : 'drop-before')
        drag.target = { cat, after }; return
      }
      if (tr.classList.contains('item')) {
        if (tr === drag.row) return
        const b = tr.getBoundingClientRect(), after = e.clientY > b.top + b.height / 2
        tr.classList.add(after ? 'drop-after' : 'drop-before')
        let before: string
        if (after) { const nx = tr.nextElementSibling as HTMLElement | null; before = nx && nx.classList.contains('item') ? nx.dataset.row! : '' }
        else before = tr.dataset.row!
        drag.target = { cat, before }
      } else if (tr.classList.contains('cat')) {
        tr.classList.add('drop-into')
        const first = tr.nextElementSibling as HTMLElement | null
        drag.target = { cat, before: first && first.classList.contains('item') ? first.dataset.row! : '' }
      } else { tr.classList.add('drop-into'); drag.target = { cat, before: '' } }
    }
    const onUp = () => endDrag(true)
    const onCancel = () => endDrag(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && drag) endDrag(false) }

    led.addEventListener('pointerdown', onDown)
    document.addEventListener('pointermove', onMove, { passive: false })
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onCancel)
    document.addEventListener('keydown', onKey)
    return () => {
      led.removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onCancel)
      document.removeEventListener('keydown', onKey)
      endDrag(false)
    }
  }, [tableRef.current, enabled, cb])
}
