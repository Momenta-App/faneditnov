'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Card } from '@/app/components/Card';
import { Button } from '@/app/components/Button';
import { HashtagInput } from '@/app/components/HashtagInput';

interface Prize {
  payout_amount: number;
  rank_order: number;
}

interface Category {
  name: string;
  description: string;
  rules: string;
  display_order: number;
  is_general: boolean;
  ranking_method: 'manual' | 'views' | 'likes' | 'comments' | 'shares' | 'impact_score';
  prizes: Prize[];
}

interface ContestFormState {
  title: string;
  description: string;
  movie_identifier: string;
  start_date: string;
  end_date: string;
  required_hashtags: string[];
  required_description_template: string;
  status: 'upcoming' | 'live' | 'closed';
}

interface SubmissionRulesState {
  allow_multiple_submissions: boolean;
  force_single_category: boolean;
  require_social_verification: boolean;
  require_mp4_upload: boolean;
  public_submissions_visibility: 'public_hide_metrics' | 'public_with_rankings' | 'private_judges_only';
}

export interface ContestSubmitPayload extends ContestFormState, SubmissionRulesState {
  required_hashtags: string[];
  categories: Array<{
    name: string;
    description: string;
    rules: string;
    display_order: number;
    is_general: boolean;
    ranking_method: Category['ranking_method'];
    prizes: Prize[];
  }>;
}

export interface ContestWithRelations extends ContestFormState, SubmissionRulesState {
  id: string;
  required_hashtags: string[];
  contest_categories?: Array<{
    id: string;
    name: string;
    description?: string | null;
    rules?: string | null;
    display_order: number;
    is_general?: boolean;
    ranking_method?: Category['ranking_method'];
    contest_prizes?: Array<{
      id: string;
      payout_amount: number;
      rank_order: number;
    }>;
  }>;
}

interface AdminContestFormProps {
  mode: 'create' | 'edit';
  initialContest?: ContestWithRelations | null;
  onSubmit: (payload: ContestSubmitPayload) => Promise<void>;
  submitLabel?: string;
  footerActions?: React.ReactNode;
  remoteError?: string | null;
}

const DEFAULT_FORM_DATA: ContestFormState = {
  title: '',
  description: '',
  movie_identifier: '',
  start_date: '',
  end_date: '',
  required_hashtags: [],
  required_description_template: '',
  status: 'upcoming',
};

const DEFAULT_SUBMISSION_RULES: SubmissionRulesState = {
  allow_multiple_submissions: true,
  force_single_category: false,
  require_social_verification: false,
  require_mp4_upload: false,
  public_submissions_visibility: 'public_hide_metrics',
};

const PLACE_NAMES = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];

export function AdminContestForm({
  mode,
  initialContest,
  onSubmit,
  submitLabel,
  footerActions,
  remoteError,
}: AdminContestFormProps) {
  const [formData, setFormData] = useState<ContestFormState>(DEFAULT_FORM_DATA);
  const [categories, setCategories] = useState<Category[]>([]);
  const [submissionRules, setSubmissionRules] = useState<SubmissionRulesState>(DEFAULT_SUBMISSION_RULES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type SectionKey = 'basics' | 'categories' | 'rules' | 'hashtags';
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    basics: true,
    categories: true,
    rules: true,
    hashtags: true,
  });
  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const combinedError = remoteError || error;

  useEffect(() => {
    if (!initialContest) {
      setFormData(DEFAULT_FORM_DATA);
      setCategories([]);
      setSubmissionRules(DEFAULT_SUBMISSION_RULES);
      return;
    }

    setFormData({
      title: initialContest.title || '',
      description: initialContest.description || '',
      movie_identifier: initialContest.movie_identifier || '',
      start_date: initialContest.start_date ? initialContest.start_date.slice(0, 16) : '',
      end_date: initialContest.end_date ? initialContest.end_date.slice(0, 16) : '',
      required_hashtags: initialContest.required_hashtags?.length
        ? initialContest.required_hashtags
        : [''],
      required_description_template: initialContest.required_description_template || '',
      status: initialContest.status || 'upcoming',
    });

    setSubmissionRules({
      allow_multiple_submissions: initialContest.allow_multiple_submissions ?? true,
      force_single_category: initialContest.force_single_category ?? false,
      require_social_verification: initialContest.require_social_verification ?? false,
      require_mp4_upload: initialContest.require_mp4_upload ?? false,
      public_submissions_visibility: initialContest.public_submissions_visibility || 'public_hide_metrics',
    });

    if (initialContest.contest_categories?.length) {
      setCategories(
        initialContest.contest_categories
          .sort((a, b) => a.display_order - b.display_order)
          .map((category) => ({
            name: category.name || '',
            description: category.description || '',
            rules: category.rules || '',
            display_order: category.display_order,
            is_general: Boolean(category.is_general),
            ranking_method: category.ranking_method || 'manual',
            prizes:
              category.contest_prizes?.map((prize) => ({
                payout_amount: prize.payout_amount || 0,
                rank_order: prize.rank_order,
              })) || [{ payout_amount: 0, rank_order: 1 }],
          }))
      );
    } else {
      setCategories([]);
    }
  }, [initialContest]);

  const handleInputChange = (field: keyof ContestFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleHashtagListChange = (hashtags: string[]) => {
    setFormData((prev) => ({ ...prev, required_hashtags: hashtags }));
  };

  const handlePrizeChange = (categoryIndex: number, prizeIndex: number, field: keyof Prize, value: number) => {
    setCategories((prev) => {
      const next = [...prev];
      const prizes = [...next[categoryIndex].prizes];
      prizes[prizeIndex] = { ...prizes[prizeIndex], [field]: value };
      next[categoryIndex] = { ...next[categoryIndex], prizes };
      return next;
    });
  };

  const addPrize = (categoryIndex: number) => {
    setCategories((prev) => {
      const next = [...prev];
      const target = next[categoryIndex];
      target.prizes = [
        ...target.prizes,
        {
          payout_amount: 0,
          rank_order: target.prizes.length + 1,
        },
      ];
      return next;
    });
  };

  const removePrize = (categoryIndex: number, prizeIndex: number) => {
    setCategories((prev) => {
      const next = [...prev];
      const target = next[categoryIndex];
      if (target.prizes.length <= 1) {
        return prev;
      }
      target.prizes = target.prizes
        .filter((_, i) => i !== prizeIndex)
        .map((prize, idx) => ({ ...prize, rank_order: idx + 1 }));
      return next;
    });
  };

  const handleCategoryChange = (index: number, field: keyof Category, value: string | number | boolean) => {
    setCategories((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addCategory = () => {
    setCategories((prev) => [
      ...prev,
      {
        name: '',
        description: '',
        rules: '',
        display_order: prev.length + 1,
        is_general: false,
        ranking_method: 'manual',
        prizes: [{ payout_amount: 0, rank_order: 1 }],
      },
    ]);
  };

  const removeCategory = (index: number) => {
    setCategories((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((category, idx) => ({
          ...category,
          display_order: idx + 1,
        }))
    );
  };

  const totalPrizePool = useMemo(
    () =>
      categories.reduce(
        (total, cat) =>
          total + cat.prizes.reduce((sum, prize) => sum + (prize.payout_amount || 0), 0),
        0
      ),
    [categories]
  );

  const summaryStats = useMemo(() => {
    const hashtagCount = formData.required_hashtags.filter((tag) => tag.trim() !== '').length;
    const generalCategories = categories.filter((cat) => cat.is_general).length;
    const totalPrizes = categories.reduce((sum, cat) => sum + cat.prizes.length, 0);
    return {
      totalCategories: categories.length,
      generalCategories,
      specificCategories: categories.length - generalCategories,
      totalPrizes,
      hashtagCount,
      prizePool: totalPrizePool,
    };
  }, [categories, formData.required_hashtags, totalPrizePool]);

  const renderSummaryCard = () => (
    <Card className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
          Contest Snapshot
        </p>
        <h3 className="text-xl font-bold text-[var(--color-text-primary)]">Quick Overview</h3>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-muted)]">Categories</span>
          <span className="text-[var(--color-text-primary)] font-semibold">
            {summaryStats.totalCategories || 0}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-muted)]">General Tracks</span>
          <span className="text-[var(--color-text-primary)] font-semibold">
            {summaryStats.generalCategories || 0}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-muted)]">Prizes Configured</span>
          <span className="text-[var(--color-text-primary)] font-semibold">
            {summaryStats.totalPrizes || 0}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-muted)]">Required Hashtags</span>
          <span className="text-[var(--color-text-primary)] font-semibold">
            {summaryStats.hashtagCount || 0}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-muted)]">Total Prize Pool</span>
          <span className="text-[var(--color-primary)] font-bold">
            ${summaryStats.prizePool.toFixed(2)}
          </span>
        </div>
      </div>
    </Card>
  );

  const renderCollapsibleCard = (
    key: SectionKey,
    title: string,
    description: string,
    content: ReactNode
  ) => (
    <Card>
      <button
        type="button"
        className="w-full flex items-center justify-between text-left gap-3"
        onClick={() => toggleSection(key)}
      >
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{title}</h2>
          <p className="text-sm text-[var(--color-text-muted)]">{description}</p>
        </div>
        <svg
          className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform ${
            openSections[key] ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {openSections[key] && <div className="mt-5 space-y-4">{content}</div>}
    </Card>
  );

  const buildPayload = (): ContestSubmitPayload => {
    const validHashtags = formData.required_hashtags.filter((h) => h.trim() !== '');

    if (validHashtags.length === 0) {
      throw new Error('At least one required hashtag is required');
    }

    const validCategories = categories
      .map((category, index) => ({
        name: category.name,
        description: category.description,
        rules: category.rules,
        display_order: index + 1,
        is_general: category.is_general || false,
        ranking_method: category.ranking_method || 'manual',
        prizes: category.prizes
          .map((prize, prizeIndex) => ({
            payout_amount: prize.payout_amount || 0,
            rank_order: prizeIndex + 1,
          }))
          .filter((prize) => prize.payout_amount > 0),
      }))
      .filter((category) => category.name.trim() !== '' && category.prizes.length > 0);

    return {
      ...formData,
      required_hashtags: validHashtags,
      categories: validCategories,
      allow_multiple_submissions: submissionRules.allow_multiple_submissions,
      force_single_category: submissionRules.force_single_category,
      require_social_verification: submissionRules.require_social_verification,
      require_mp4_upload: submissionRules.require_mp4_upload,
      public_submissions_visibility: submissionRules.public_submissions_visibility,
    };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = buildPayload();
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save contest');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] lg:gap-6">
        <div className="space-y-6 order-2 lg:order-1">
          {combinedError && (
            <Card className="border-red-500/20 bg-red-500/5">
              <p className="text-red-500">{combinedError}</p>
            </Card>
          )}
          <div className="lg:hidden">{renderSummaryCard()}</div>

        {renderCollapsibleCard(
          'basics',
          'Contest Basics',
          'Core contest information, scheduling, and status.',
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                  Contest Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                  Description *
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                  Movie or Project Name
                </label>
                <input
                  type="text"
                  value={formData.movie_identifier}
                  onChange={(e) => handleInputChange('movie_identifier', e.target.value)}
                  placeholder="e.g., movie-2024-001"
                  className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    Status *
                  </label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="live">Live</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    Start Date *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.start_date}
                    onChange={(e) => handleInputChange('start_date', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    End Date *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.end_date}
                    onChange={(e) => handleInputChange('end_date', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {renderCollapsibleCard(
          'categories',
          'Contest Categories (Optional)',
          'Add tracks and matching prizes for each submission path.',
          <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Contest Categories (Optional)</h2>
            <Button type="button" variant="secondary" size="sm" onClick={addCategory}>
              + Add Category
            </Button>
          </div>
          {categories.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              Add categories if this contest needs multiple tracks (e.g., Best Edit, Best Trailer).
            </p>
          ) : (
            <div className="space-y-4">
              {categories.map((category, index) => (
                <div key={index} className="p-4 border border-[var(--color-border)] rounded-lg space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                        Category Name
                      </label>
                      <input
                        type="text"
                        value={category.name}
                        onChange={(e) => handleCategoryChange(index, 'name', e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                        Order / Rank
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={category.display_order}
                        onChange={(e) =>
                          handleCategoryChange(index, 'display_order', Math.max(1, Number(e.target.value) || 1))
                        }
                        className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      value={category.description}
                      onChange={(e) => handleCategoryChange(index, 'description', e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                      Category Rules
                    </label>
                    <textarea
                      rows={3}
                      value={category.rules}
                      onChange={(e) => handleCategoryChange(index, 'rules', e.target.value)}
                      placeholder="Any special requirements for this category"
                      className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4"
                          checked={category.is_general}
                          onChange={(e) => handleCategoryChange(index, 'is_general', e.target.checked)}
                        />
                        <div>
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">General Category</p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            All submissions automatically enter this category
                          </p>
                        </div>
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                        Ranking Method
                      </label>
                      <select
                        value={category.ranking_method}
                        onChange={(e) => handleCategoryChange(index, 'ranking_method', e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      >
                        <option value="manual">Manual Judging</option>
                        <option value="views">Most Views</option>
                        <option value="likes">Most Likes</option>
                        <option value="comments">Most Comments</option>
                        <option value="shares">Most Shares</option>
                      </select>
                      {category.is_general && category.ranking_method === 'manual' && (
                        <p className="mt-1 text-xs text-yellow-600">
                          Note: General categories typically use stat-based ranking
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-[var(--color-border)] pt-4 mt-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                        Prizes for {category.name || 'this category'}
                      </h3>
                      <Button type="button" variant="secondary" size="sm" onClick={() => addPrize(index)}>
                        + Add Prize
                      </Button>
                    </div>
                    <div className="space-y-4">
                      {category.prizes.map((prize, prizeIndex) => {
                        const placeName = PLACE_NAMES[prizeIndex] || `${prizeIndex + 1}th`;
                        return (
                          <div key={prizeIndex} className="p-4 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)]/50">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex-1">
                                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                                  {placeName} Place - Payout Amount ($)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={prize.payout_amount}
                                  onChange={(e) =>
                                    handlePrizeChange(index, prizeIndex, 'payout_amount', parseFloat(e.target.value) || 0)
                                  }
                                  className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                />
                              </div>
                            </div>
                            {category.prizes.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removePrize(index, prizeIndex)}
                              >
                                Remove Prize
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeCategory(index)}>
                      Remove Category
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {categories.length > 0 && (
            <div className="mt-4 p-4 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-lg">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Total Prize Pool: ${totalPrizePool.toFixed(2)}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Calculated from all prizes across all categories
              </p>
            </div>
          )}
          </>
        )}

        {renderCollapsibleCard(
          'rules',
          'Submission Rules',
          'Control how creators submit entries and what is required.',
          <>
          <div className="space-y-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={submissionRules.allow_multiple_submissions}
                onChange={(e) =>
                  setSubmissionRules((prev) => ({ ...prev, allow_multiple_submissions: e.target.checked }))
                }
              />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Allow multiple submissions per user</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  When enabled, creators can submit more than once.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={submissionRules.force_single_category}
                onChange={(e) =>
                  setSubmissionRules((prev) => ({ ...prev, force_single_category: e.target.checked }))
                }
              />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Force one category selection</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Require entrants to choose exactly one category during submission.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={submissionRules.require_social_verification}
                onChange={(e) =>
                  setSubmissionRules((prev) => ({ ...prev, require_social_verification: e.target.checked }))
                }
              />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Require social account verification</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Enforce BrightData verification before accepting entries.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={submissionRules.require_mp4_upload}
                onChange={(e) =>
                  setSubmissionRules((prev) => ({ ...prev, require_mp4_upload: e.target.checked }))
                }
              />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Require MP4 upload</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Entrants must add an MP4 alongside the source URL.
                </p>
              </div>
            </label>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Display Public Submissions
              </label>
              <select
                value={submissionRules.public_submissions_visibility}
                onChange={(e) =>
                  setSubmissionRules((prev) => ({
                    ...prev,
                    public_submissions_visibility: e.target.value as SubmissionRulesState['public_submissions_visibility'],
                  }))
                }
                className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="public_hide_metrics">Public but hide metrics</option>
                <option value="public_with_rankings">Public with rankings</option>
                <option value="private_judges_only">Private, only judges see submissions</option>
              </select>
            </div>
          </div>
          </>
        )}

        {renderCollapsibleCard(
          'hashtags',
          'Hashtags & Description',
          'Define required hashtags and description expectations.',
          <>
            <div className="space-y-4">
              <HashtagInput
                value={formData.required_hashtags}
                onChange={handleHashtagListChange}
                label="Required Hashtags *"
                placeholder="#fanactivation"
                helperText="Paste or type hashtags separated by commas or spaces. We will normalize and deduplicate them automatically."
              />
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                  Description Template (Optional)
                </label>
                <textarea
                  rows={3}
                  value={formData.required_description_template}
                  onChange={(e) => handleInputChange('required_description_template', e.target.value)}
                  placeholder="e.g., Must include 'fan edit' or similar phrase"
                  className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
            </div>
          </>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="primary" size="lg" isLoading={loading}>
            {submitLabel || (mode === 'create' ? 'Create Contest' : 'Save Changes')}
          </Button>
          {footerActions}
        </div>
        </div>
        <div className="order-1 lg:order-2 lg:sticky lg:top-24 hidden lg:flex lg:flex-col lg:gap-4">
          {renderSummaryCard()}
        </div>
      </div>
    </form>
  );
}


