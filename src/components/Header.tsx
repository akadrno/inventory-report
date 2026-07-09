import { makeStyles, tokens, Text, Button, Badge } from '@fluentui/react-components'
import {
  SquareMultipleRegular,
  SignOutRegular,
  PersonRegular,
  SettingsRegular,
} from '@fluentui/react-icons'
import { useMsal } from '@azure/msal-react'
import { useDebug } from '../context/DebugContext'

const useClasses = makeStyles({
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    boxShadow: tokens.shadow4,
  },
  inner: {
    maxWidth: '1440px',
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingLeft: tokens.spacingHorizontalXL,
    paddingRight: tokens.spacingHorizontalXL,
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  logoBox: {
    width: '28px',
    height: '28px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorNeutralForegroundOnBrand,
    flexShrink: 0,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground2,
  },
  gearActive: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
})

export function Header() {
  const { instance, accounts } = useMsal()
  const account = accounts[0]
  const { isOpen, setIsOpen, entries } = useDebug()
  const classes = useClasses()

  const errorCount = entries.filter(
    e => e.error || (e.status !== undefined && e.status >= 400),
  ).length

  return (
    <header className={classes.header}>
      <div className={classes.inner}>
        <div className={classes.brand}>
          <div className={classes.logoBox}>
            <SquareMultipleRegular fontSize={16} />
          </div>
          <Text weight="semibold" size={400}>Platform 360</Text>
        </div>

        <div className={classes.right}>
          {account && (
            <div className={classes.userInfo}>
              <PersonRegular fontSize={16} />
              <Text size={200}>{account.name ?? account.username}</Text>
            </div>
          )}

          <div style={{ position: 'relative' }}>
            <Button
              appearance="subtle"
              icon={<SettingsRegular />}
              onClick={() => setIsOpen(!isOpen)}
              title="Debug panel"
              aria-label="Debug panel"
            />
            {errorCount > 0 && !isOpen && (
              <Badge
                size="tiny"
                color="danger"
                style={{ position: 'absolute', top: 2, right: 2 }}
              />
            )}
          </div>

          <Button
            appearance="subtle"
            icon={<SignOutRegular />}
            onClick={() => instance.logoutPopup().catch(console.error)}
          >
            Sign out
          </Button>
        </div>
      </div>
    </header>
  )
}
