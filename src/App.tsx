import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'
import { makeStyles, tokens, Spinner, Text, Title2 } from '@fluentui/react-components'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { SignInPage } from './components/SignInPage'
import { Shell } from './components/Shell'

const CONFIG_MISSING = !import.meta.env.VITE_CLIENT_ID

const useClasses = makeStyles({
  loadingPage: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  configPage: {
    minHeight: '100vh',
    backgroundColor: tokens.colorNeutralBackground2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacingVerticalXL,
  },
  configCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    border: `1px solid ${tokens.colorPaletteYellowBorder2}`,
    padding: tokens.spacingVerticalXXL,
    maxWidth: '500px',
    width: '100%',
    boxShadow: tokens.shadow16,
  },
  codeSpan: {
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusSmall,
    paddingLeft: '4px',
    paddingRight: '4px',
    fontFamily: 'Consolas, monospace',
    fontSize: tokens.fontSizeBase200,
  },
  ol: {
    paddingLeft: tokens.spacingHorizontalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalM,
  },
})

function ConfigWarning() {
  const classes = useClasses()
  return (
    <div className={classes.configPage}>
      <div className={classes.configCard}>
        <Title2 style={{ color: tokens.colorPaletteYellowForeground2, display: 'block', marginBottom: tokens.spacingVerticalXS }}>
          Configuration Required
        </Title2>
        <Text style={{ color: tokens.colorNeutralForeground2 }}>
          Copy <span className={classes.codeSpan}>.env.example</span> to{' '}
          <span className={classes.codeSpan}>.env.local</span> and fill in your Azure AD App Registration Client ID.
        </Text>
        <ol className={classes.ol}>
          <li><Text size={200}>Go to Azure portal → App registrations → New registration</Text></li>
          <li><Text size={200}>Set redirect URI to <span className={classes.codeSpan}>http://localhost:3000</span></Text></li>
          <li><Text size={200}>Under API permissions, add <strong>Power Platform API → user_impersonation</strong></Text></li>
          <li><Text size={200}>Copy the Application (client) ID into <span className={classes.codeSpan}>.env.local</span></Text></li>
        </ol>
      </div>
    </div>
  )
}

function AppShell() {
  const isAuthenticated = useIsAuthenticated()
  const { inProgress } = useMsal()
  const classes = useClasses()

  if (inProgress !== InteractionStatus.None) {
    return (
      <div className={classes.loadingPage}>
        <Spinner label="Signing in..." size="large" />
      </div>
    )
  }

  if (!isAuthenticated) return <SignInPage />

  return <Shell />
}

export default function App() {
  if (CONFIG_MISSING) return <ConfigWarning />
  return <AppShell />
}
