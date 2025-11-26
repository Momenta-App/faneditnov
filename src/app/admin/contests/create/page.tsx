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
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="flex flex-wrap items-center gap-2 mb-2 text-[11px]">
            <Link href="/admin/contests">
              <Button variant="ghost" size="xs" className="px-2 py-1 min-h-0 min-w-0 text-[10px]">
                ← Back to Contests
              </Button>
            </Link>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
              Contest setup
            </p>
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
              Create a New Contest
            </h1>
          </div>
        </div>
      </PageSection>

      <PageSection variant="content">
        <div className="max-w-5xl mx-auto rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-xs">
          <AdminContestForm
            mode="create"
            onSubmit={handleCreateContest}
            footerActions={
              <Link href="/admin/contests">
                <Button type="button" variant="ghost" size="xs" className="px-3 py-2 min-h-0 min-w-0 text-[11px]">
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
