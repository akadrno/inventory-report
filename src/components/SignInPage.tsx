import { makeStyles, Button } from '@fluentui/react-components'
import { LockClosedRegular } from '@fluentui/react-icons'
import { useMsal } from '@azure/msal-react'
import { powerPlatformScopes } from '../auth/msalConfig'
import { CommandBackdrop } from './CommandCenter'
import { PowerAppsIcon, PowerAutomateIcon, CopilotStudioIcon } from './ProductIcons'

const useClasses = makeStyles({
  page: {
    position: 'relative',
    minHeight: '100vh',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: 'radial-gradient(ellipse 90% 80% at 50% -10%, #16335f 0%, #0a1426 48%, #05080f 100%)',
  },
  console: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '600px',
    padding: '44px 44px 36px',
    borderRadius: '22px',
    background: 'linear-gradient(160deg, rgba(20,32,56,0.78), rgba(9,15,28,0.82))',
    border: '1px solid rgba(255,255,255,0.09)',
    boxShadow: '0 50px 140px rgba(0,0,0,0.65), 0 0 60px rgba(40,120,220,0.12), inset 0 1px 0 rgba(255,255,255,0.08)',
    backdropFilter: 'blur(22px)',
    WebkitBackdropFilter: 'blur(22px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  statusLine: {
    fontFamily: 'Consolas, "SFMono-Regular", monospace',
    fontSize: '11px',
    letterSpacing: '1.6px',
    textTransform: 'uppercase',
    color: 'rgba(150,200,255,0.7)',
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
  },
  liveDot: {
    width: '7px', height: '7px', borderRadius: '50%',
    backgroundColor: '#3ad1c4',
    flexShrink: 0,
  },
  glyphWrap: {
    position: 'relative',
    width: '60px', height: '60px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  glyphRing: {
    position: 'absolute', inset: 0,
    borderRadius: '18px',
    border: '1px solid rgba(58,209,196,0.55)',
  },
  glyph: {
    width: '56px', height: '56px',
    borderRadius: '16px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(145deg, #2b76d8, #1a48a0)',
    boxShadow: '0 8px 26px rgba(33,103,210,0.55), inset 0 1px 0 rgba(255,255,255,0.25)',
  },
  title: {
    margin: 0,
    fontSize: '32px',
    lineHeight: 1.1,
    fontWeight: 800,
    letterSpacing: '-0.5px',
    background: 'linear-gradient(90deg, #ffffff, #bcd8ff)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  },
  tagline: {
    margin: '8px 0 0',
    fontSize: '14.5px',
    lineHeight: 1.5,
    color: 'rgba(198,216,244,0.72)',
    maxWidth: '440px',
  },
  pillars: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  pillar: {
    flex: '1 1 150px',
    minWidth: '150px',
    padding: '14px 14px 0',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    position: 'relative',
    overflow: 'hidden',
  },
  pillarLabel: { color: '#ffffff', fontWeight: 700, fontSize: '15px' },
  pillarDesc: { color: 'rgba(190,210,240,0.6)', fontSize: '11.5px', lineHeight: 1.35 },
  pillarTrack: {
    height: '2px',
    marginTop: '12px',
    background: 'rgba(255,255,255,0.08)',
    position: 'relative',
    overflow: 'hidden',
  },
  pillarBar: {
    position: 'absolute', top: 0, left: 0, height: '100%', width: '45%',
  },
  signInBtn: {
    width: '100%',
    height: '48px',
    justifyContent: 'center',
    gap: '10px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#ffffff',
    background: 'linear-gradient(135deg, #2b8af0, #1f6fd6)',
    border: '1px solid rgba(255,255,255,0.18)',
    boxShadow: '0 10px 30px rgba(33,120,220,0.45)',
    ':hover': { background: 'linear-gradient(135deg, #3a97f7, #2877dd)', color: '#ffffff', boxShadow: '0 12px 36px rgba(33,120,220,0.6)' },
    ':hover:active': { background: 'linear-gradient(135deg, #2877dd, #1c63c4)', color: '#ffffff' },
  },
  footHint: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    fontSize: '11.5px',
    color: 'rgba(170,195,230,0.55)',
    fontFamily: 'Consolas, "SFMono-Regular", monospace',
    letterSpacing: '0.5px',
  },
})

const MicrosoftLogo = () => (
  <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
    <rect x="1" y="1" width="9" height="9" fill="#F25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
    <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
    <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
  </svg>
)

const PILLARS = [
  { icon: <CopilotStudioIcon fontSize={26} />, label: 'Agents', desc: 'Agents', accent: '#3ad1c4' },
  { icon: <PowerAppsIcon fontSize={26} />, label: 'Apps', desc: 'Canvas & model-driven', accent: '#b07cff' },
  { icon: <PowerAutomateIcon fontSize={26} />, label: 'Flows', desc: 'Cloud & desktop', accent: '#4aa8ff' },
]

const fadeUp = (delay: number) => ({ animation: 'ppFadeUp 0.6s both', animationDelay: `${delay}s` })

export function SignInPage() {
  const { instance } = useMsal()
  const classes = useClasses()

  return (
    <div className={classes.page}>
      <CommandBackdrop />

      <div className={classes.console}>
        <div className={classes.statusLine} style={fadeUp(0)}>
          <span className={classes.liveDot} style={{ animation: 'ppPulseRing 2s ease-out infinite' }} />
          Systems nominal · Awaiting operator authentication
        </div>

        <div style={fadeUp(0.08)}>
          <div className={classes.glyphWrap}>
            <div className={classes.glyphRing} style={{ animation: 'ppGlyphRing 2.8s ease-out infinite' }} />
            <div className={classes.glyph}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z" fill="white" fillOpacity=".95" />
              </svg>
            </div>
          </div>
        </div>

        <div style={fadeUp(0.16)}>
          <h1 className={classes.title}>Power Platform Inventory</h1>
          <p className={classes.tagline}>
            Your command center for real-time inventory and governance — every Agent, App, and Flow across every environment, in one view.
          </p>
        </div>

        <div className={classes.pillars} style={fadeUp(0.24)}>
          {PILLARS.map(p => (
            <div key={p.label} className={classes.pillar}>
              <span style={{ color: p.accent }}>{p.icon}</span>
              <span className={classes.pillarLabel}>{p.label}</span>
              <span className={classes.pillarDesc}>{p.desc}</span>
              <div className={classes.pillarTrack}>
                <div
                  className={classes.pillarBar}
                  style={{
                    background: `linear-gradient(90deg, transparent, ${p.accent}, transparent)`,
                    animation: 'ppShimmer 2.6s ease-in-out infinite',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div style={fadeUp(0.32)}>
          <Button
            appearance="primary"
            size="large"
            className={classes.signInBtn}
            icon={<MicrosoftLogo />}
            onClick={() => instance.loginPopup({ scopes: powerPlatformScopes }).catch(console.error)}
          >
            Sign in with Microsoft
          </Button>
          <div className={classes.footHint} style={{ marginTop: '14px' }}>
            <LockClosedRegular fontSize={13} />
            Secured by Microsoft Entra ID
          </div>
        </div>
      </div>
    </div>
  )
}
