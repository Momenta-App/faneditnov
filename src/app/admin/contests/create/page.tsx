'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../contexts/AuthContext';
import { Page, PageSection } from '../../../components/layout';
import { Button } from '../../../components/Button';
import { AdminContestForm, ContestSubmitPayload } from '../components/AdminContestForm';
import { authFetch } from '@/lib/auth-fetch';

export default function CreateContestPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  const handleCreateContest = async (payload: ContestSubmitPayload) => {
    const response = await authFetch('/api/admin/contests', {
      method: 'POST',
      includeJson: true,
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create contest');
    }

    router.push(`/admin/contests/${data.data.id}`);
  };

  if (isLoading || !user) {
    return null;
  }

  return (
    <Page>
      <PageSection variant="header">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-2">
            <Link href="/admin/contests">
              <Button variant="ghost" size="sm">
                ← Back to Contests
              </Button>
            </Link>
          </div>
          <h1 className="text-4xl font-bold text-[var(--color-text-primary)] mb-2">
            Create a New Contest
          </h1>
          <p className="text-[var(--color-text-muted)]">Set up a new fan edit contest</p>
        </div>
      </PageSection>

      <PageSection variant="content">
        <div className="max-w-4xl mx-auto">
          <AdminContestForm
            mode="create"
            onSubmit={handleCreateContest}
            footerActions={
              <Link href="/admin/contests">
                <Button type="button" variant="ghost" size="lg">
                  Cancel
                </Button>
              </Link>
            }
          />
        </div>
      </PageSection>
    </Page>
  );
}
