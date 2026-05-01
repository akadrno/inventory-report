import { makeStyles, tokens, Title2, Caption1 } from '@fluentui/react-components'
import {
  AppGenericRegular,
  FlowRegular,
  BotRegular,
  FolderOpenRegular,
  PersonRegular,
  GlobeRegular,
} from '@fluentui/react-icons'
import type { ResourceItem } from '../types'
import { getResourceCategory } from '../types'

const useClasses = makeStyles({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: tokens.spacingHorizontalL,
    '@media (min-width: 640px)': { gridTemplateColumns: 'repeat(3, 1fr)' },
    '@media (min-width: 1280px)': { gridTemplateColumns: 'repeat(6, 1fr)' },
  },
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow4,
    padding: tokens.spacingVerticalL,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalL,
    cursor: 'pointer',
    ':hover': {
      boxShadow: tokens.shadow16,
      border: `1px solid ${tokens.colorNeutralStroke1}`,
    },
    transitionProperty: 'box-shadow, border-color',
    transitionDuration: tokens.durationNormal,
    transitionTimingFunction: tokens.curveEasyEase,
  },
  iconBox: {
    width: '44px',
    height: '44px',
    borderRadius: tokens.borderRadiusLarge,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '22px',
  },
  skeleton: {
    height: '32px',
    width: '48px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    animationName: {
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0.4 },
    },
    animationDuration: '1.5s',
    animationIterationCount: 'infinite',
  },
})

interface StatCardProps {
  label: string
  value: number
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  isLoading: boolean
  onClick: () => void
}

function StatCard({ label, value, icon, iconBg, iconColor, isLoading, onClick }: StatCardProps) {
  const classes = useClasses()
  return (
    <div className={classes.card} onClick={onClick} role="button" tabIndex={0}>
      <div className={classes.iconBox} style={{ backgroundColor: iconBg, color: iconColor }}>
        {icon}
      </div>
      <div>
        <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>{label}</Caption1>
        {isLoading
          ? <div className={classes.skeleton} />
          : <Title2 style={{ lineHeight: 1.2 }}>{value}</Title2>
        }
      </div>
    </div>
  )
}

interface StatCardsProps {
  resources: ResourceItem[]
  groupCount: number
  environmentCount: number
  userCount: number
  isLoading: boolean
  onTabChange: (tab: 'apps' | 'flows' | 'agents' | 'groups' | 'users' | 'environments') => void
}

export function StatCards({ resources, groupCount, environmentCount, userCount, isLoading, onTabChange }: StatCardsProps) {
  const apps = resources.filter(r => getResourceCategory(r.type) === 'apps').length
  const flows = resources.filter(r => getResourceCategory(r.type) === 'flows').length
  const agents = resources.filter(r => getResourceCategory(r.type) === 'agents').length
  const classes = useClasses()

  return (
    <div className={classes.grid}>
      <StatCard label="Canvas Apps" value={apps}
        icon={<AppGenericRegular />}
        iconBg={tokens.colorPaletteRoyalBlueBackground2}
        iconColor={tokens.colorPaletteRoyalBlueForeground2}
        isLoading={isLoading} onClick={() => onTabChange('apps')} />
      <StatCard label="Cloud Flows" value={flows}
        icon={<FlowRegular />}
        iconBg={tokens.colorPaletteTealBackground2}
        iconColor={tokens.colorPaletteTealForeground2}
        isLoading={isLoading} onClick={() => onTabChange('flows')} />
      <StatCard label="Agents" value={agents}
        icon={<BotRegular />}
        iconBg={tokens.colorPalettePurpleBackground2}
        iconColor={tokens.colorPalettePurpleForeground2}
        isLoading={isLoading} onClick={() => onTabChange('agents')} />
      <StatCard label="Groups" value={groupCount}
        icon={<FolderOpenRegular />}
        iconBg={tokens.colorPaletteMarigoldBackground2}
        iconColor={tokens.colorPaletteMarigoldForeground2}
        isLoading={isLoading} onClick={() => onTabChange('groups')} />
      <StatCard label="Users" value={userCount}
        icon={<PersonRegular />}
        iconBg={tokens.colorPaletteGreenBackground2}
        iconColor={tokens.colorPaletteGreenForeground2}
        isLoading={isLoading} onClick={() => onTabChange('users')} />
      <StatCard label="Environments" value={environmentCount}
        icon={<GlobeRegular />}
        iconBg={tokens.colorPaletteCranberryBackground2}
        iconColor={tokens.colorPaletteCranberryForeground2}
        isLoading={isLoading} onClick={() => onTabChange('environments')} />
    </div>
  )
}
