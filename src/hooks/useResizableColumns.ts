import { useState, useRef, useCallback } from 'react'

export function useResizableColumns<K extends string>(defaults: Record<K, number>) {
  const [widths, setWidths] = useState<Record<K, number>>(defaults)
  const widthsRef = useRef(widths)
  widthsRef.current = widths

  const getResizeProps = useCallback((col: K) => ({
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startW = widthsRef.current[col]
      const onMove = (ev: MouseEvent) => {
        const newW = Math.max(40, startW + (ev.clientX - startX))
        setWidths(prev => ({ ...prev, [col]: newW }))
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
  }), [])

  return { widths, getResizeProps }
}

export const RESIZE_HANDLE_STYLE: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: 0,
  height: '100%',
  width: '4px',
  cursor: 'col-resize',
  userSelect: 'none',
  zIndex: 1,
}
