'use client';

import { useState, useEffect } from 'react';
import { Community } from '../types/data';
import { Modal } from './Modal';
import { Input } from './Input';
import { TextArea } from './TextArea';
import { Button } from './Button';
import { Alert } from './Alert';
import { Stack, Inline, Cluster } from './layout';
import { Typography } from './Typography';
import { Badge } from './Badge';

interface CommunityEditModalProps {
  community: Community;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Community) => Promise<void>;
}

export function CommunityEditModal({ community, isOpen, onClose, onSave }: CommunityEditModalProps) {
  const [formData, setFormData] = useState({
    name: community.name,
    description: community.description || '',
    linked_hashtags: community.linked_hashtags || [],
    profile_image_url: community.profile_image_url || '',
    cover_image_url: community.cover_image_url || '',
    links: community.links || {}
  });
  
  const [newHashtag, setNewHashtag] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: community.name,
        description: community.description || '',
        linked_hashtags: community.linked_hashtags || [],
        profile_image_url: community.profile_image_url || '',
        cover_image_url: community.cover_image_url || '',
        links: community.links || {}
      });
    }
  }, [community, isOpen]);

  const handleAddHashtag = () => {
    if (newHashtag.trim() && !formData.linked_hashtags.includes(newHashtag.toLowerCase())) {
      setFormData({
        ...formData,
        linked_hashtags: [...formData.linked_hashtags, newHashtag.toLowerCase().replace(/^#/, '')]
      });
      setNewHashtag('');
    }
  };

  const handleRemoveHashtag = (hashtag: string) => {
    setFormData({
      ...formData,
      linked_hashtags: formData.linked_hashtags.filter(h => h !== hashtag)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await onSave(formData as Community);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Community"
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap={6}>
          {/* Name */}
          <Input
            label="Name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          {/* Description */}
          <TextArea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={4}
          />

          {/* Profile Image URL */}
          <Input
            label="Profile Image URL"
            type="url"
            value={formData.profile_image_url}
            onChange={(e) => setFormData({ ...formData, profile_image_url: e.target.value })}
          />

          {/* Cover Image URL */}
          <Input
            label="Cover Image URL"
            type="url"
            value={formData.cover_image_url}
            onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
          />

          {/* Hashtags */}
          <Stack gap={2}>
            <Typography.Text className="text-sm font-medium">
              Linked Hashtags
            </Typography.Text>
            <Inline gap={2}>
              <Input
                type="text"
                value={newHashtag}
                onChange={(e) => setNewHashtag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddHashtag())}
                placeholder="Add hashtag"
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleAddHashtag}
                variant="secondary"
              >
                Add
              </Button>
            </Inline>
            {formData.linked_hashtags.length > 0 && (
              <Cluster gap={2}>
                {formData.linked_hashtags.map((hashtag) => (
                  <Badge key={hashtag} variant="primary" className="min-h-[44px]">
                    #{hashtag}
                    <button
                      type="button"
                      onClick={() => handleRemoveHashtag(hashtag)}
                      className="ml-[var(--spacing-2)] hover:text-[var(--color-primary-hover)] focus-ring rounded-[var(--radius-sm)] p-[var(--spacing-1)] min-w-[44px] min-h-[44px] flex items-center justify-center"
                      aria-label={`Remove ${hashtag}`}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </Cluster>
            )}
          </Stack>

          {error && (
            <Alert variant="danger" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Inline gap={3} justify="end">
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              isLoading={saving}
            >
              Save Changes
            </Button>
          </Inline>
        </Stack>
      </form>
    </Modal>
  );
}

