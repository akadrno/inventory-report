import { Badge, tokens } from '@fluentui/react-components'
import { getResourceCategory } from '../types'
import { PowerAppsIcon, PowerAutomateIcon, CopilotStudioIcon } from './ProductIcons'

interface ResourceTypeBadgeProps {
  type: string
  kind?: string
}

export function friendlyType(type: string, kind?: string): string {
  const lower = type.toLowerCase()
  if (kind) return kind
  if (lower.includes('modeldriven')) return 'Model Driven'
  if (lower.includes('codeapp') || lower.includes('codeapps')) return 'Code App'
  if (lower.includes('canvasapp')) return 'Canvas App'
  if (lower.includes('m365agentflow')) return 'Workflow Agent Flow'
  if (lower.includes('agentflow')) return 'Agent Flow'
  if (lower.includes('flow') || lower.includes('logic')) return 'Cloud Flow'
  if (lower.includes('bot') || lower.includes('agent') || lower.includes('copilot')) return 'Agent'
  if (lower.includes('/apps')) return 'App Builder'
  const parts = type.split('/')
  return parts[parts.length - 1] ?? type
}

type BadgeColor = 'brand' | 'success' | 'subtle'

const categoryColors: Record<string, BadgeColor> = {
  apps: 'brand',
  flows: 'success',
  all: 'subtle',
}

function CategoryIcon({ category, size }: { category: string; size: number }) {
  if (category === 'apps') return <PowerAppsIcon fontSize={size} />
  if (category === 'flows') return <PowerAutomateIcon fontSize={size} />
  if (category === 'agents') return <CopilotStudioIcon fontSize={size} />
  return null
}

export function ResourceTypeBadge({ type, kind }: ResourceTypeBadgeProps) {
  const category = getResourceCategory(type)
  const label = friendlyType(type, kind)

  if (category === 'agents') {
    return (
      <Badge
        appearance="tint"
        color="subtle"
        size="small"
        icon={<CategoryIcon category={category} size={12} />}
        style={{ backgroundColor: tokens.colorNeutralBackground3, color: tokens.colorNeutralForeground1, borderColor: tokens.colorNeutralStroke2 }}
      >
        {label}
      </Badge>
    )
  }

  return (
    <Badge
      appearance="tint"
      color={categoryColors[category] ?? 'subtle'}
      size="small"
      icon={<CategoryIcon category={category} size={12} />}
    >
      {label}
    </Badge>
  )
}
