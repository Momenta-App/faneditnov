'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../contexts/AuthContext';
import { Page, PageSection } from '../../../../components/layout';
import { Button } from '../../../../components/Button';
import { AdminContestForm, ContestSubmitPayload, ContestWithRelations } from '../../components/AdminContestForm';
import { authFetch } from '@/lib/auth-fetch';
import { Card } from '../../../../components/Card';

interface AdminContestResponse {
  data: ContestWithRelations & { stats?: any };
}

export default function EditContestPage({ params }: { params: { id: string } }) {
  const { user, profile, isLoading } = useAuth();
  const router = useRouter();
  const [contest, setContest] = useState<ContestWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/auth/login');
        return;
      }
      if (profile?.role !== 'admin') {
        router.push('/');
        return;
      }
      fetchContest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user, profile]);

  const fetchContest = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await authFetch(`/api/admin/contests/${params.id}`);
      const data: AdminContestResponse = await response.json();
      if (!response.ok) {
        throw new Error(data?.data ? 'Failed to load contest' : data?.toString());
      }
      setContest(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contest');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateContest = async (payload: ContestSubmitPayload) => {
    const response = await authFetch(`/api/admin/contests/${params.id}`, {
      method: 'PUT',
      includeJson: true,
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update contest');
    }

    router.push(`/admin/contests/${params.id}`);
  };

  if (isLoading || !user || profile?.role !== 'admin') {
    return null;
  }

  return (
    <Page>
      <PageSection variant="header">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-2">
            <Link href={`/admin/contests/${params.id}`}>
              <Button variant="ghost" size="sm">
                ← Back to Contest
              </Button>
            </Link>
          </div>
          <h1 className="text-4xl font-bold text-[var(--color-text-primary)] mb-2">
            Edit Contest
          </h1>
          <p className="text-[var(--color-text-muted)]">Update contest details, rules, and prizes</p>
        </div>
      </PageSection>

      <PageSection variant="content">
        <div className="max-w-4xl mx-auto">
          {error && (
            <Card className="border-red-500/20 bg-red-500/5 mb-6">
              <p className="text-red-500">{error}</p>
            </Card>
          )}

          {loading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, idx) => (
                <Card key={idx} className="h-32 animate-pulse" />
              ))}
            </div>
          ) : contest ? (
            <AdminContestForm
              mode="edit"
              initialContest={contest}
              onSubmit={handleUpdateContest}
              submitLabel="Save Changes"
              footerActions={
                <Link href={`/admin/contests/${params.id}`}>
                  <Button type="button" variant="ghost" size="lg">
                    Cancel
                  </Button>
                </Link>
              }
            />
          ) : null}
        </div>
      </PageSection>
    </Page>
  );
}


