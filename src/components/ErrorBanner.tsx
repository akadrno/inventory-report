import { MessageBar, MessageBarBody, MessageBarActions, Button, Text } from '@fluentui/react-components'
import { ArrowClockwiseRegular } from '@fluentui/react-icons'

interface ErrorBannerProps {
  error: Error
  onRetry: () => void
}

export function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  return (
    <MessageBar intent="error">
      <MessageBarBody>
        <Text weight="semibold">Failed to load resources</Text>
        <br />
        {error.message}
        {error.message.includes('401') && (
          <> Make sure your App Registration has the Power Platform API permission and an admin has granted consent.</>
        )}
      </MessageBarBody>
      <MessageBarActions>
        <Button appearance="transparent" icon={<ArrowClockwiseRegular />} size="small" onClick={onRetry}>
          Retry
        </Button>
      </MessageBarActions>
    </MessageBar>
  )
}
