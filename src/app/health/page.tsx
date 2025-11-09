'use client';

import { Page, PageSection, Stack } from '../components/layout';
import { Typography } from '../components/Typography';

export default function HealthPage() {
  return (
    <Page>
      <PageSection variant="header">
        <Stack gap={2}>
          <Typography.H1>Health</Typography.H1>
          <Typography.Muted>Service status and basic diagnostics</Typography.Muted>
        </Stack>
      </PageSection>

      <PageSection variant="content">
        <Stack gap={4}>
          <Typography.Text>health ok</Typography.Text>
        </Stack>
      </PageSection>
    </Page>
  );
}
