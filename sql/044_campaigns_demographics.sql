-- Migration: Add demographics column to campaigns table
-- This stores AI-generated fake demographics data showing viewership breakdown by country or city

-- Add demographics column (JSONB) to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS demographics JSONB;

-- Add comment explaining the structure
COMMENT ON COLUMN campaigns.demographics IS 'AI-generated demographics data with structure: { type: "country" | "city", locations: [{ name: string, percentage: number }] }. Contains top 5 locations with 5th being "Other".';

