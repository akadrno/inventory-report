import { useEffect, useRef, useState } from 'react'
import { makeStyles } from '@fluentui/react-components'

// ── Command-center motion kit ───────────────────────────────────────────────
// A cinematic animated backdrop + count-up helpers shared by the sign-in screen
// and the home hero. The scene is intentionally dark in BOTH themes — it's a
// decorative banner, not a themed surface, so fixed colors here are by design.
// All @keyframes live in index.css and are referenced via inline `animation`.

/** Animate a number from 0 → target on mount (easeOutCubic). */
export function useCountUp(target: number, durationMs = 1100): number {
  const [value, setValue] = useState(0)
  const prefersReduced = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    if (prefersReduced.current) { setValue(target); return }
    let raf = 0
    const begin = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - begin) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])

  return value
}

export function CountUp({ value, durationMs }: { value: number; durationMs?: number }) {
  const v = useCountUp(value, durationMs)
  return <>{v.toLocaleString()}</>
}

const useStyles = makeStyles({
  grid: {
    position: 'absolute',
    left: '-25%', right: '-25%', top: '-25%', bottom: '-25%',
    backgroundImage:
      'linear-gradient(rgba(120,180,255,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(120,180,255,0.10) 1px, transparent 1px)',
    backgroundSize: '46px 46px',
    maskImage: 'radial-gradient(ellipse 80% 60% at 50% 35%, #000 0%, transparent 75%)',
    WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 35%, #000 0%, transparent 75%)',
  },
  orb: { position: 'absolute', borderRadius: '50%', filter: 'blur(70px)', pointerEvents: 'none' },
  scan: {
    position: 'absolute', left: 0, right: 0, height: '160px', top: '-25%',
    background: 'linear-gradient(180deg, transparent, rgba(120,200,255,0.07), transparent)',
    pointerEvents: 'none',
  },
  vignette: {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    background: 'radial-gradient(ellipse 75% 75% at 50% 40%, transparent 38%, rgba(3,7,16,0.55) 100%)',
  },
})

/**
 * Fills its (position:relative; overflow:hidden) parent with the animated
 * holographic scene. Purely decorative — marked aria-hidden, no pointer events.
 */
export function CommandBackdrop() {
  const s = useStyles()
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div className={s.grid} style={{ animation: 'ppGridPan 5.5s linear infinite' }} />
      <div className={s.orb} style={{ width: 340, height: 340, top: -60, left: -40, background: 'radial-gradient(circle, rgba(58,160,255,0.45), transparent 70%)', animation: 'ppDriftA 16s ease-in-out infinite' }} />
      <div className={s.orb} style={{ width: 300, height: 300, bottom: -80, right: -30, background: 'radial-gradient(circle, rgba(150,90,255,0.40), transparent 70%)', animation: 'ppDriftB 19s ease-in-out infinite' }} />
      <div className={s.orb} style={{ width: 220, height: 220, top: '28%', right: '18%', background: 'radial-gradient(circle, rgba(58,209,196,0.26), transparent 70%)', animation: 'ppDriftA 23s ease-in-out infinite' }} />
      <div className={s.scan} style={{ animation: 'ppScan 7s ease-in-out infinite' }} />
      <div className={s.vignette} />
    </div>
  )
}
