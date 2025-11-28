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
  slug: string;
  start_date: string;
  end_date: string;
  required_hashtags: string[];
  required_description_template: string;
  visibility: 'open' | 'private_link_only';
  profile_image_url: string;
  cover_image_url: string;
  display_stats: boolean;
}

interface SubmissionRulesState {
  allow_multiple_submissions: boolean;
  force_single_category: boolean;
  require_social_verification: boolean;
  require_mp4_upload: boolean;
  public_submissions_visibility: 'public_hide_metrics' | 'public_with_rankings' | 'private_judges_only';
}

interface AssetLink {
  id?: string;
  name: string;
  url: string;
  display_order: number;
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
  asset_links?: AssetLink[];
}

export interface ContestWithRelations extends ContestFormState, SubmissionRulesState {
  id: string;
  status?: 'upcoming' | 'live' | 'ended' | 'draft';
  visibility?: 'open' | 'private_link_only';
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
  contest_asset_links?: Array<{
    id: string;
    name: string;
    url: string;
    display_order: number;
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
  slug: '',
  start_date: '',
  end_date: '',
  required_hashtags: [],
  required_description_template: '',
  visibility: 'open',
  profile_image_url: '',
  cover_image_url: '',
  display_stats: true,
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
  const [assetLinks, setAssetLinks] = useState<AssetLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type SectionKey = 'basics' | 'categories' | 'rules' | 'hashtags' | 'design';
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    basics: true,
    categories: true,
    rules: true,
    hashtags: true,
    design: true,
  });
  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const combinedError = remoteError || error;
  const hasSpecificCategories = categories.some((category) => !category.is_general);

  useEffect(() => {
    if (!hasSpecificCategories && submissionRules.force_single_category) {
      setSubmissionRules((prev) => ({ ...prev, force_single_category: false }));
    }
  }, [hasSpecificCategories, submissionRules.force_single_category]);

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
      slug: (initialContest as any).slug || '',
      start_date: initialContest.start_date ? initialContest.start_date.slice(0, 16) : '',
      end_date: initialContest.end_date ? initialContest.end_date.slice(0, 16) : '',
      required_hashtags: initialContest.required_hashtags?.length
        ? initialContest.required_hashtags
        : [''],
      required_description_template: initialContest.required_description_template || '',
      visibility: (initialContest as any).visibility || 'open',
      profile_image_url: initialContest.profile_image_url || '',
      cover_image_url: initialContest.cover_image_url || '',
      display_stats: initialContest.display_stats ?? true,
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
            ranking_method: category.ranking_method || 'views',
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

    // Load asset links
    if (initialContest.contest_asset_links?.length) {
      setAssetLinks(
        initialContest.contest_asset_links
          .sort((a, b) => a.display_order - b.display_order)
          .map((link) => ({
            id: link.id,
            name: link.name,
            url: link.url,
            display_order: link.display_order,
          }))
      );
    } else {
      setAssetLinks([]);
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
        ranking_method: 'views',
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

  const addAssetLink = () => {
    setAssetLinks((prev) => [
      ...prev,
      {
        name: '',
        url: '',
        display_order: prev.length,
      },
    ]);
  };

  const removeAssetLink = (index: number) => {
    setAssetLinks((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((link, idx) => ({
          ...link,
          display_order: idx,
        }))
    );
  };

  const handleAssetLinkChange = (index: number, field: keyof AssetLink, value: string | number) => {
    setAssetLinks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
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

  const renderCollapsibleCard = (
    key: SectionKey,
    title: string,
    description: string,
    content: ReactNode
  ) => (
    <Card className="text-xs space-y-2">
      <button
        type="button"
        className="w-full flex items-center justify-between text-left gap-2"
        onClick={() => toggleSection(key)}
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-primary)]">
            {title}
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${
            openSections[key] ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {openSections[key] && <div className="space-y-3">{content}</div>}
    </Card>
  );

  const renderCategoriesSection = () => (
    <Card className="text-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-primary)]">
            Categories & Prizes
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="xs"
          onClick={addCategory}
          className="px-3 py-1 min-h-0 min-w-0 text-[11px]"
        >
          + Add Category
        </Button>
      </div>

      {categories.length === 0 ? (
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Add categories if this contest needs multiple tracks (e.g., Best Edit, Best Trailer).
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {categories.map((category, index) => (
            <div
              key={index}
              className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={category.name}
                  onChange={(e) => handleCategoryChange(index, 'name', e.target.value)}
                  placeholder="Category name"
                  className="flex-1 px-3 py-2 rounded border border-[var(--color-border)] text-[var(--color-text-primary)]"
                />
                <input
                  type="number"
                  min="1"
                  value={category.display_order}
                  onChange={(e) =>
                    handleCategoryChange(index, 'display_order', Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-16 px-2 py-2 rounded border border-[var(--color-border)] text-center text-[var(--color-text-primary)]"
                />
              </div>
              <textarea
                rows={2}
                value={category.description}
                onChange={(e) => handleCategoryChange(index, 'description', e.target.value)}
                placeholder="Short description"
                className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
              />
              <textarea
                rows={2}
                value={category.rules}
                onChange={(e) => handleCategoryChange(index, 'rules', e.target.value)}
                placeholder="Rules (optional)"
                className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
              />
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={category.is_general}
                    onChange={(e) => handleCategoryChange(index, 'is_general', e.target.checked)}
                  />
                  <span className="text-[11px] text-[var(--color-text-primary)]">General</span>
                </label>
                <select
                  value={category.ranking_method === 'shares' ? 'manual' : category.ranking_method}
                  onChange={(e) => handleCategoryChange(index, 'ranking_method', e.target.value)}
                  className="flex-1 min-w-[140px] px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                >
                  <option value="manual">Manual Judging</option>
                  <option value="views">Most Views</option>
                  <option value="likes">Most Likes</option>
                  <option value="comments">Most Comments</option>
                </select>
              </div>
              <div className="space-y-2 border-t border-[var(--color-border)] pt-2">
                <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Prizes</p>
                {category.prizes.map((prize, prizeIndex) => {
                  const placeName = PLACE_NAMES[prizeIndex] || `${prizeIndex + 1}th`;
                  return (
                    <div
                      key={prizeIndex}
                      className="flex items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)]/60 px-2 py-1.5"
                    >
                      <span className="w-12 text-[11px] font-medium text-[var(--color-text-primary)]">{placeName}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={prize.payout_amount}
                        onChange={(e) =>
                          handlePrizeChange(index, prizeIndex, 'payout_amount', parseFloat(e.target.value) || 0)
                        }
                        className="flex-1 px-2 py-1.5 rounded border border-[var(--color-border)] text-[var(--color-text-primary)]"
                      />
                      {category.prizes.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => removePrize(index, prizeIndex)}
                          className="px-2 py-1 min-h-0 min-w-0 text-[10px]"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  );
                })}
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => addPrize(index)}
                  className="px-3 py-1 min-h-0 min-w-0 text-[11px]"
                >
                  + Add Prize
                </Button>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => removeCategory(index)}
                  className="px-2 py-1 min-h-0 min-w-0 text-[10px]"
                >
                  Remove Category
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded border border-[var(--color-border)] bg-[var(--color-primary)]/5 px-3 py-2 text-[11px]">
        <p className="text-[var(--color-text-primary)] font-semibold">
          Total Prize Pool: ${totalPrizePool.toFixed(2)}
        </p>
        <p className="text-[var(--color-text-muted)]">Sum of every prize across all categories.</p>
      </div>
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
        ranking_method: category.ranking_method || 'views',
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
      force_single_category: hasSpecificCategories ? submissionRules.force_single_category : false,
      require_social_verification: submissionRules.require_social_verification,
      require_mp4_upload: submissionRules.require_mp4_upload,
      public_submissions_visibility: submissionRules.public_submissions_visibility,
      asset_links: assetLinks.filter((link) => link.name.trim() !== '' && link.url.trim() !== ''),
    };
  };

  const handleSubmit = async (event: React.FormEvent, isDraft: boolean = false) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = buildPayload();
      // Add status: 'draft' if creating draft, otherwise let backend calculate
      const finalPayload = isDraft ? { ...payload, status: 'draft' } : payload;
      await onSubmit(finalPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save contest');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e, false); }} className="text-xs">
      <div className="space-y-3">
        {combinedError && (
          <Card className="border-red-500/20 bg-red-500/5">
            <p className="text-red-500">{combinedError}</p>
          </Card>
        )}

        {renderCollapsibleCard(
          'basics',
          'Contest Basics',
          'Core contest information, scheduling, and status.',
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
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
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
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
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
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

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                  URL Slug
                  <span className="text-[var(--color-text-muted)] ml-1">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => {
                      const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                      handleInputChange('slug', value);
                    }}
                    placeholder="e.g., killbill"
                    pattern="[a-z0-9-]+"
                    className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const generatedSlug = formData.title
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, '');
                      handleInputChange('slug', generatedSlug);
                    }}
                    className="whitespace-nowrap"
                  >
                    Generate from Title
                  </Button>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Used in URL: /contests/{formData.slug || '[slug]'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                    Visibility *
                  </label>
                  <select
                    required
                    value={formData.visibility}
                    onChange={(e) => handleInputChange('visibility', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  >
                    <option value="open">Open</option>
                    <option value="private_link_only">Private Link Only</option>
                  </select>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                    Open contests appear on the contest page. Private contests require a direct link.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
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
                  <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
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
          'rules',
          'Submission Rules',
          'Control how creators submit entries and what is required.',
          <>
          <div className="space-y-3">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={submissionRules.allow_multiple_submissions}
                onChange={(e) =>
                  setSubmissionRules((prev) => ({ ...prev, allow_multiple_submissions: e.target.checked }))
                }
              />
              <div>
                <p className="text-xs font-medium text-[var(--color-text-primary)]">Allow multiple submissions per user</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  When enabled, creators can submit more than once.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={submissionRules.force_single_category}
                onChange={(e) =>
                  setSubmissionRules((prev) => ({ ...prev, force_single_category: e.target.checked }))
                }
                disabled={!hasSpecificCategories}
              />
              <div>
                <p className="text-xs font-medium text-[var(--color-text-primary)]">Force one category selection</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {hasSpecificCategories
                    ? 'Require entrants to choose exactly one category during submission.'
                    : 'Add at least one specific (non-general) category to enable this option.'}
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={submissionRules.require_social_verification}
                onChange={(e) =>
                  setSubmissionRules((prev) => ({ ...prev, require_social_verification: e.target.checked }))
                }
              />
              <div>
                <p className="text-xs font-medium text-[var(--color-text-primary)]">Require social account verification</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  Enforce BrightData verification before accepting entries.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={submissionRules.require_mp4_upload}
                onChange={(e) =>
                  setSubmissionRules((prev) => ({ ...prev, require_mp4_upload: e.target.checked }))
                }
              />
              <div>
                <p className="text-xs font-medium text-[var(--color-text-primary)]">Require MP4 upload</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  Entrants must add an MP4 alongside the source URL.
                </p>
              </div>
            </label>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1 uppercase tracking-wide">
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

            <div>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={formData.display_stats}
                  onChange={(e) => setFormData((prev) => ({ ...prev, display_stats: e.target.checked }))}
                />
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-primary)]">Display stats on submissions</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    When enabled, stats (views, likes, comments) will be shown on contest submissions.
                  </p>
                </div>
              </label>
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
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
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

        {renderCollapsibleCard(
          'design',
          'Design & Assets',
          'Customize contest appearance and provide asset links for creators.',
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                  Profile Image URL
                </label>
                <input
                  type="url"
                  value={formData.profile_image_url}
                  onChange={(e) => handleInputChange('profile_image_url', e.target.value)}
                  placeholder="https://example.com/profile.jpg"
                  className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  Square image (recommended: 400x400px) displayed as contest logo
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                  Cover Image URL
                </label>
                <input
                  type="url"
                  value={formData.cover_image_url}
                  onChange={(e) => handleInputChange('cover_image_url', e.target.value)}
                  placeholder="https://example.com/cover.jpg"
                  className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  Banner image (recommended: 1920x1080px) displayed as contest header
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-2">
                  Asset Links
                </label>
                <p className="text-[10px] text-[var(--color-text-muted)] mb-3">
                  Provide links to assets (logos, fonts, images, etc.) that creators can use in their submissions
                </p>
                <div className="space-y-3">
                  {assetLinks.map((link, index) => (
                    <div key={index} className="p-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)]">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                        <div>
                          <label className="block text-[10px] font-medium text-[var(--color-text-primary)] mb-1">
                            Asset Name
                          </label>
                          <input
                            type="text"
                            value={link.name}
                            onChange={(e) => handleAssetLinkChange(index, 'name', e.target.value)}
                            placeholder="e.g., Logo Pack, Font Files"
                            className="w-full px-3 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-[var(--color-text-primary)] mb-1">
                            URL
                          </label>
                          <input
                            type="url"
                            value={link.url}
                            onChange={(e) => handleAssetLinkChange(index, 'url', e.target.value)}
                            placeholder="https://example.com/assets"
                            className="w-full px-3 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] text-[var(--color-text-muted)]">Order:</label>
                          <input
                            type="number"
                            min="0"
                            value={link.display_order}
                            onChange={(e) => handleAssetLinkChange(index, 'display_order', parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => removeAssetLink(index)}
                          className="px-2 py-1 min-h-0 min-w-0 text-[10px]"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={addAssetLink}
                    className="px-3 py-1 min-h-0 min-w-0 text-[11px]"
                  >
                    + Add Asset Link
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {renderCategoriesSection()}

        <div className="flex flex-wrap gap-3">
          {mode === 'create' ? (
            <>
              <Button 
                type="button" 
                variant="primary" 
                size="sm" 
                isLoading={loading} 
                className="px-4 py-2 min-h-[38px]"
                onClick={(e) => handleSubmit(e, false)}
              >
                Create Contest
              </Button>
              <Button 
                type="button" 
                variant="secondary" 
                size="sm" 
                isLoading={loading} 
                className="px-4 py-2 min-h-[38px]"
                onClick={(e) => handleSubmit(e, true)}
              >
                Create Draft
              </Button>
            </>
          ) : (
            <Button type="submit" variant="primary" size="sm" isLoading={loading} className="px-4 py-2 min-h-[38px]">
              {submitLabel || 'Save Changes'}
            </Button>
          )}
          {footerActions}
        </div>
      </div>
    </form>
  );
}


