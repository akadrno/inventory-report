import { Badge } from '@fluentui/react-components'

interface EnvironmentBadgeProps {
  name?: string
  type?: string
}

type BadgeColor = 'danger' | 'warning' | 'brand' | 'severe' | 'subtle'

function getBadgeColor(type?: string): BadgeColor {
  if (!type) return 'subtle'
  const lower = type.toLowerCase()
  if (lower === 'production') return 'danger'
  if (lower === 'sandbox') return 'warning'
  if (lower === 'developer') return 'brand'
  if (lower === 'trial') return 'severe'
  return 'subtle'
}

export function EnvironmentBadge({ name, type }: EnvironmentBadgeProps) {
  if (!name) return null
  const label = name
  return (
    <Badge appearance="tint" color={getBadgeColor(type)} size="small">
      {label}
    </Badge>
  )
}
