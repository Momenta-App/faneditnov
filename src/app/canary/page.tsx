'use client';

import { Page, PageSection, Stack } from '../components/layout';
import { Typography } from '../components/Typography';

export default function CanaryPage() {
  return (
    <Page>
      <PageSection variant="header">
        <Stack gap={2}>
          <Typography.H1>Canary</Typography.H1>
          <Typography.Muted>Quick connectivity and rendering check</Typography.Muted>
        </Stack>
      </PageSection>

      <PageSection variant="content">
        <Stack gap={4}>
          <Typography.Text>canary ok</Typography.Text>
        </Stack>
      </PageSection>
    </Page>
  );
}
