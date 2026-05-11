import { makeStyles, tokens, Text, Button, Title2 } from '@fluentui/react-components'
import { useMsal } from '@azure/msal-react'
import { powerPlatformScopes } from '../auth/msalConfig'

const useClasses = makeStyles({
  page: {
    minHeight: '100vh',
    background: `linear-gradient(135deg, ${tokens.colorBrandBackground2} 0%, ${tokens.colorBrandBackground} 60%, #0c3b5e 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacingVerticalXL,
  },
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow64,
    padding: tokens.spacingVerticalXXL,
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalL,
  },
  logoBox: {
    width: '56px',
    height: '56px',
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorBrandBackground,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  signInBtn: {
    width: '100%',
    justifyContent: 'center',
    gap: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
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

export function SignInPage() {
  const { instance } = useMsal()
  const classes = useClasses()

  return (
    <div className={classes.page}>
      <div className={classes.card}>
        <div className={classes.logoBox}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z"
              fill="white" fillOpacity=".9" />
          </svg>
        </div>

        <div className={classes.textBlock}>
          <Title2>Power Platform Inventory</Title2>
          <Text style={{ color: tokens.colorNeutralForeground2 }}>
            Sign in to view your organization's Power Platform resources across all environments.
          </Text>
        </div>

        <Button
          appearance="primary"
          size="large"
          className={classes.signInBtn}
          icon={<MicrosoftLogo />}
          onClick={() => instance.loginPopup({ scopes: powerPlatformScopes }).catch(console.error)}
        >
          Sign in with Microsoft
        </Button>

      </div>
    </div>
  )
}
