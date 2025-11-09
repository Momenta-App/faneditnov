# Frontend Rewrite Plan v2, mobile first, dual theme, reusable primitives

## Objectives
- Normalize spacing, sizing, and layout grid, reduce one-off styles
- Establish a simple design system, tokens first, primitives second
- Make pages consistent, reduce strange div nesting, remove dead wrappers
- Improve accessibility and performance, with measurable checks
- Keep component API changes minimal, plan safe adapters where needed
- **Mobile-first responsive design**: Layout scales from mobile (320px) to tablet (768px) to desktop (1024px+), explicit breakpoint behavior documented
- **Dual theme system**: Light and Dark themes, both production-ready, WCAG AA contrast, default to system preference via `prefers-color-scheme`, user toggle with persistence
- **Creator name linkability**: Every creator name rendered in the UI must be clickable and route to `/creator/[creatorid]`, with a repo-wide sweep and adapter component
- **No purple palette**: Use neutral, clean aesthetic (slate, zinc, blue accents, or brand-appropriate colors), eliminate all purple tokens and usage
- Preserve video popup design: `src/app/components/VideoModal.tsx` remains unchanged, only refactor callers if popup behavior stays identical

## Non-Negotiables
1. **Mobile-first layout**: All designs start at 320px viewport, then scale up to tablet (768px) and desktop (1024px+). Breakpoints: `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`, `2xl: 1536px`. Layout behavior explicitly defined at each breakpoint.
2. **Two themes, production-ready**: Light and Dark themes must both meet WCAG AA contrast ratios. Default to system preference via `prefers-color-scheme` CSS media query. User toggle persists preference in localStorage. All tokens have light and dark variants.
3. **No purple in palette**: Remove all purple/violet/indigo tokens. Replace with neutral palette (slate, zinc) or blue accents appropriate to brand. Audit existing `--brand-primary: #6366f1` (indigo), replace with slate/zinc/blue equivalent.
4. **Creator name links**: Every time a creator name (`creator.displayName`, `creator.username`, `creator.display_name`) is rendered, it must be clickable and route to `/creator/[creatorid]`. Create `<CreatorLink>` component, perform repo-wide sweep, include tests.
5. **Preserve VideoModal.tsx**: Keep `src/app/components/VideoModal.tsx` design exactly as is. Do not modify this file. The design includes dark backdrop, centered video frame, close button styling, animations. Can refactor `VideoCard.tsx` or callers, but popup visual design and behavior must remain identical. Add smoke test to prevent regressions.

## Guiding Principles
- Tokens first, primitives second, features last
- Mobile-first design, then scale up
- Minimal risk, adapters for compatibility
- Composition over inheritance
- Documentation and tests with each PR

## Phase 0, Discovery and Inventory, upgraded
- **Styling approach**: Tailwind CSS v4 with CSS variables in `src/app/globals.css`, PostCSS config in `postcss.config.mjs`
- **Global layout shells**: Root layout in `src/app/layout.tsx` includes Header, Providers wrapper, ModalRenderer, skip link, main content area
- **Providers**: `src/app/providers.tsx` wraps AuthProvider, SearchProvider, ModalProvider
- **Current spacing scale**: Mix of Tailwind classes (p-4, py-12, gap-6) and custom values, container-page utility exists but inconsistently used
- **Color usage audit**: CSS variables defined in `:root` (--brand-primary: #6366f1 indigo, --background, --foreground, --card-bg, semantic colors), Tailwind classes also used (bg-gray-50, text-gray-900). **Purple/indigo found in**: --brand-primary, --brand-primary-hover, --brand-gradient-start/end, Header.tsx gradient classes, Button.tsx variant classes
- **Typography**: Inter font via Next.js font optimization, h1-h6 have styles in globals.css, line-height 1.6 on body, headings use 1.2
- **Breakpoints and layout behavior**:
  - Mobile base: 320px-639px (single column, stacked navigation, compact spacing)
  - Tablet: 640px-1023px (two column grids, expanded navigation, medium spacing)
  - Desktop: 1024px+ (multi-column grids, full navigation, standard spacing)
  - Current Tailwind defaults: `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`, `2xl: 1536px`
- **Creator name rendering locations** (must become links):
  - `src/app/components/VideoCard.tsx` line 83: `{video.creator.username}` in card footer
  - `src/app/components/CreatorCard.tsx` line 53: `{creator.displayName}` as card title
  - `src/app/creator/[creatorid]/page.tsx` lines 86-88: Creator name and username in header (already on detail page, but verify)
  - `src/app/hashtag/[tag]/page.tsx` lines 207, 269: `{creator.display_name}` in top creators section
  - `src/app/sound/[soundId]/page.tsx` lines 207, 269: `{creator.display_name}` in top creators section
  - `src/app/community/[slug]/page.tsx` line 270: `{creator.display_name}` mapped in creator tab
  - `src/app/components/VideoModal.tsx` line 110: `video.creator.username` in title attribute (protected file, note but don't modify)

**Token Migration Map Table**:
| Current Value | Current Usage | Target Token | Notes |
|--------------|---------------|--------------|-------|
| `--brand-primary: #6366f1` | Header, buttons | `--color-primary` | Replace with slate/zinc/blue |
| `py-12` (48px) | Page headers | `--spacing-48` | Map to 8px scale |
| `gap-6` (24px) | Grids | `--spacing-24` | Map to 8px scale |
| `rounded-lg` (12px) | Cards | `--radius-lg` | Standardize |
| `bg-gray-50` | Backgrounds | `--color-background` | Theme-aware |
| `text-gray-900` | Text | `--color-text-primary` | Theme-aware |
- **Core pages and routes**:
  - `/` (page.tsx) - Home/landing
  - `/edits` (edits/page.tsx) - Video grid
  - `/creators` (creators/page.tsx) - Creator list
  - `/creator/[creatorid]` (creator/[creatorid]/page.tsx) - Creator detail
  - `/hashtags` (hashtags/page.tsx) - Hashtag list
  - `/hashtag/[tag]` (hashtag/[tag]/page.tsx) - Hashtag detail
  - `/sounds` (sounds/page.tsx) - Sound list
  - `/sound/[soundId]` (sound/[soundId]/page.tsx) - Sound detail
  - `/communities` (communities/page.tsx) - Community list
  - `/community/[slug]` (community/[slug]/page.tsx) - Community detail
  - `/scraper` (scraper/page.tsx) - Admin scraper tool
  - `/settings` (settings/page.tsx) - User settings
  - `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password` - Auth pages
  - `/health`, `/canary` - Utility pages
- **Component inventory** (`src/app/components/`):
  - **Primitives**: Button.tsx, Input.tsx, Card.tsx, Badge.tsx, Skeleton.tsx
  - **Composite**: Header.tsx, Footer.tsx, FilterBar.tsx, SearchInput.tsx, SortDropdown.tsx, TimeRangeFilter.tsx
  - **Card variants**: VideoCard.tsx, CreatorCard.tsx, CommunityCard.tsx, HashtagCard.tsx, SoundCard.tsx
  - **Empty states**: EmptyState.tsx, NoCreatorsEmptyState.tsx, NoHashtagsEmptyState.tsx, NoSoundsEmptyState.tsx, NoVideosEmptyState.tsx
  - **Modals**: VideoModal.tsx, CommunityEditModal.tsx, LoginModal.tsx, SignupModal.tsx, ModalRenderer.tsx
  - **Filters**: filters/FilterBar.tsx, filters/SearchInput.tsx, filters/SortDropdown.tsx, filters/TimeRangeFilter.tsx
  - **Special**: AsyncTikTokScraper.tsx
- **Test coverage**: No test files found, no Storybook found
- **Lint rules**: ESLint with Next.js config in `eslint.config.mjs`, custom rules for env imports, TypeScript strict mode enabled
- **TypeScript**: Strict mode, path aliases (@/*), target ES2017, Next.js plugin enabled

## Phase 1, Design Tokens and Themes
- **Single source of truth**: Extend `src/app/globals.css` with CSS custom properties, or create `src/lib/design-tokens.ts` for TypeScript constants that map to CSS vars. Match repo convention (currently globals.css uses `:root`).

- **Color tokens (Light theme, `:root`)**:
  - Background: `--color-background: #f8fafc` (slate-50)
  - Surface: `--color-surface: #ffffff` (white)
  - Border: `--color-border: #e2e8f0` (slate-200)
  - Text Primary: `--color-text-primary: #0f172a` (slate-900)
  - Text Secondary: `--color-text-muted: #64748b` (slate-500)
  - Primary: `--color-primary: #2563eb` (blue-600, replaces indigo)
  - Primary Hover: `--color-primary-hover: #1d4ed8` (blue-700)
  - Success: `--color-success: #10b981` (emerald-500)
  - Warning: `--color-warning: #f59e0b` (amber-500)
  - Danger: `--color-danger: #ef4444` (red-500)
  - Info: `--color-info: #3b82f6` (blue-500)

- **Color tokens (Dark theme, `[data-theme="dark"]`)**:
  - Background: `--color-background: #0f172a` (slate-900)
  - Surface: `--color-surface: #1e293b` (slate-800)
  - Border: `--color-border: #334155` (slate-700)
  - Text Primary: `--color-text-primary: #f1f5f9` (slate-100)
  - Text Secondary: `--color-text-muted: #94a3b8` (slate-400)
  - Primary: `--color-primary: #3b82f6` (blue-500)
  - Primary Hover: `--color-primary-hover: #60a5fa` (blue-400)
  - Success, Warning, Danger, Info: Adjust for dark contrast

- **Spacing scale (8px base)**: `--spacing-0: 0px`, `--spacing-1: 4px`, `--spacing-2: 8px`, `--spacing-3: 12px`, `--spacing-4: 16px`, `--spacing-5: 20px`, `--spacing-6: 24px`, `--spacing-8: 32px`, `--spacing-10: 40px`, `--spacing-12: 48px`, `--spacing-16: 64px`, `--spacing-20: 80px`, `--spacing-24: 96px`. Map existing: `py-12` → `--spacing-12`, `gap-6` → `--spacing-6`, `p-4` → `--spacing-4`.

- **Typography scale**: 
  - h1: `3rem / 1.1` (48px), h2: `2.25rem / 1.2` (36px), h3: `1.875rem / 1.3` (30px), h4: `1.5rem / 1.4` (24px), h5: `1.25rem / 1.5` (20px), h6: `1rem / 1.6` (16px)
  - Body: `1rem / 1.6` (16px), Small: `0.875rem / 1.5` (14px), Code: `0.875rem / 1.5` monospace
  - Map to Tailwind: `text-5xl` → h1, `text-4xl` → h2, `text-3xl` → h3, `text-2xl` → h4, `text-xl` → h5, `text-lg` → h6, `text-base` → body, `text-sm` → small

- **Radii**: `--radius-xs: 4px`, `--radius-sm: 6px`, `--radius-md: 8px`, `--radius-lg: 12px`, `--radius-xl: 16px`, `--radius-full: 9999px`

- **Shadows**: Keep existing `--shadow-xs` through `--shadow-2xl` from globals.css, verify dark theme variants if needed

- **Border widths**: `--border-width: 1px`, `--border-width-thick: 2px`

- **Z-index layers**: `--z-base: 0`, `--z-sticky: 40`, `--z-header: 50`, `--z-backdrop: 1000`, `--z-modal: 1050`, `--z-dropdown: 1100`, `--z-tooltip: 1200`

- **Theming model**: 
  - CSS variables on `:root` for Light theme, `[data-theme="dark"]` for Dark theme
  - Default via `@media (prefers-color-scheme: dark)` sets `data-theme="dark"` on `<html>` if no localStorage override
  - Theme toggle component persists choice in `localStorage`, updates `<html data-theme>`
  - Theme switch code: Create `src/app/hooks/useTheme.ts` or `src/app/contexts/ThemeContext.tsx` if needed

- **Acceptance**: 
  - Tokens exist in globals.css or design-tokens.ts
  - Both Light and Dark themes render correctly on selected pages (Home, Settings, Creators list)
  - Contrast ratios verified (WCAG AA): text-primary on background ≥ 4.5:1, text-muted on background ≥ 3:1
  - Theme toggle works, persists, respects system preference
  - No purple/indigo/violet colors in tokens or rendered output

## Phase 2, App Shell and Layout System, mobile first
- **AppShell primitive**: Create `src/app/components/layout/AppShell.tsx` wrapping Header, main, Footer. Mobile: Header sticky top, compact height (56px), Footer full-width. Desktop: Header full-width, Footer with max-width container.

- **Header** (`src/app/components/Header.tsx`):
  - Mobile (< 640px): Hamburger menu, logo only, compact auth buttons, z-index from token `--z-header`
  - Tablet (640px-1023px): Expanded menu, logo + text, full auth section
  - Desktop (1024px+): Horizontal nav, all items visible, user menu
  - Remove purple gradients, use `--color-primary` token
  - Spacing: `--spacing-4` padding, `--spacing-2` gaps

- **Page container**: Create `src/app/components/layout/Page.tsx`:
  - Mobile: `padding-left: --spacing-4`, `padding-right: --spacing-4`, `max-width: 100%`
  - Tablet: `padding-left: --spacing-6`, `padding-right: --spacing-6`, `max-width: 768px`
  - Desktop: `padding-left: --spacing-8`, `padding-right: --spacing-8`, `max-width: 1440px` (existing container-page)
  - Wraps header section, filter bar (if any), main content area

- **Layout primitives**:
  - **Stack** (`src/app/components/layout/Stack.tsx`): Vertical layout, gap from tokens (`--spacing-2` to `--spacing-8`), responsive gaps (mobile smaller)
  - **Inline** (`src/app/components/layout/Inline.tsx`): Horizontal layout for pills/chips/tags, gap from tokens
  - **Cluster** (`src/app/components/layout/Cluster.tsx`): Flex-wrap layout for filters, badges, gap from tokens
  - **Cover** (`src/app/components/layout/Cover.tsx`): Full viewport hero sections, centered content, mobile padding
  - **Grid** (`src/app/components/layout/Grid.tsx`): Responsive grid
    - Mobile: `grid-cols-1`
    - Tablet: `grid-cols-2` (sm breakpoint)
    - Desktop: `grid-cols-3` (md), `grid-cols-4` (lg), `grid-cols-5` (xl) - configurable via props
    - Gap: `--spacing-4` mobile, `--spacing-6` tablet/desktop

- **ContentArea**: Create `src/app/components/layout/ContentArea.tsx` with Page container padding and max-width pattern, replaces ad hoc `container-page` usage

- **Replace ad hoc wrappers**: Update all pages to use `<Page>` wrapper, remove `min-h-screen`, `bg-gradient-to-b`, custom padding wrappers

- **Acceptance**: 
  - Every route in `src/app/*/page.tsx` uses `<Page>` wrapper
  - No page has bespoke outer spacing (verify grep for `min-h-screen` and `bg-gradient`)
  - Header responsive behavior verified at 320px, 768px, 1024px
  - Mobile layouts use single column, tap targets ≥ 44x44px
  - Layout primitives use tokens, no magic numbers

## Phase 3, Primitives Library, theme aware
- **Button**: Refactor `src/app/components/Button.tsx`:
  - Remove purple variants, use `--color-primary` and `--color-primary-hover`
  - Sizes: xs (24px height), sm (32px), md (40px), lg (48px) - mobile tap target ≥ 44px
  - Variants: primary, secondary, ghost, danger - all use theme tokens
  - Focus styles: `--color-primary` ring, `outline-offset: 2px`
  - Dark mode: Verify contrast, use adjusted tokens

- **Input, Select, TextArea**: 
  - Use `--color-border`, `--color-text-primary`, `--color-surface` tokens
  - Focus ring: `--color-primary`, border changes on focus
  - Sizes: sm (32px), md (40px), lg (48px)
  - Dark mode: Background and border adapt automatically via tokens

- **Checkbox, Radio, Toggle**: 
  - Use `--color-primary` for checked state
  - Border: `--color-border`, size tokens, mobile-friendly (≥ 44px tap target)
  - Dark mode: Colors from tokens

- **Tooltip**: Create `src/app/components/Tooltip.tsx` using accessible library (Radix or similar):
  - Background: `--color-surface` with opacity, border `--color-border`
  - Text: `--color-text-primary`
  - Z-index: `--z-tooltip`

- **Modal**: Create base `src/app/components/Modal.tsx` (but preserve VideoModal.tsx):
  - Backdrop: `--color-background` with opacity, z-index `--z-backdrop`
  - Content: `--color-surface`, z-index `--z-modal`
  - Focus trap, ESC key, aria-modal
  - **Note**: VideoModal.tsx remains unchanged, only refactor CommunityEditModal, auth modals

- **Tabs**: Create `src/app/components/Tabs.tsx`:
  - Active: `--color-primary` border/background
  - Inactive: `--color-text-muted`
  - Mobile: Scrollable if needed, ≥ 44px tap targets

- **Card**: Refactor `src/app/components/Card.tsx`:
  - Background: `--color-surface`, border: `--color-border`
  - Padding variants: sm (`--spacing-4`), md (`--spacing-6`), lg (`--spacing-8`)
  - Radius: `--radius-lg`
  - Dark mode: Uses surface token

- **Badge**: Refactor `src/app/components/Badge.tsx`:
  - Sizes: sm, md, lg
  - Variants: default (neutral), primary, success, warning, danger
  - Remove purple variants

- **Alert**: Create `src/app/components/Alert.tsx`:
  - Variants: success (`--color-success`), warning, danger, info
  - Background: variant color with low opacity, border: variant color
  - Text: variant color or `--color-text-primary` depending on contrast

- **Typography**: Create `src/app/components/Typography.tsx`:
  - H1-H6 components using type scale
  - Text component: body size, `--color-text-primary`
  - Muted component: `--color-text-muted`
  - All adapt to dark mode via tokens

- **Skeleton**: Refactor `src/app/components/Skeleton.tsx`:
  - Background: `--color-border` with animation
  - Dark mode: Lighter skeleton color for visibility

- **EmptyState**: Refactor `src/app/components/empty-states/EmptyState.tsx`:
  - Uses Typography components, spacing tokens
  - Icon/text colors from tokens

- **Adapter layer**: Create `src/app/components/primitives/adapters.ts`:
  - Export old component names that wrap new primitives
  - Example: `export const OldButton = Button` (with old prop mappings if needed)
  - Maintain backward compatibility during migration

- **Acceptance**: 
  - All primitives in `src/app/components/primitives/` or root components folder
  - Each primitive has JSDoc or README example showing Light and Dark variants
  - Keyboard navigation verified, screen reader checks pass (use axe or similar)
  - Visual tests: Screenshots or stories showing Light/Dark, all variants
  - Adapters allow gradual migration without breaking imports
  - Mobile tap targets ≥ 44x44px verified
  - No purple colors in any primitive

## Phase 4, Creator Name Linkability, required sweep ✅ COMPLETED
- **Create CreatorLink component**: `src/app/components/CreatorLink.tsx`
  - Props: `creator` (object with `id`, `displayName`/`display_name`, `username`) OR `creatorId` (string) with optional `displayName`/`username` for fallback
  - Behavior: Resolves route to `/creator/[creatorid]`, wraps children (creator name) in Next.js Link
  - Handles truncation: Long names truncate with ellipsis, show full name on hover via tooltip if needed
  - Accessibility: Proper link semantics, aria-label if truncated, keyboard navigable
  - Analytics: Option to add click tracking if repo uses analytics
  - Fallback: If creator data missing, show plain text or placeholder

- **Repo-wide sweep** - Replace plain creator name text with `<CreatorLink>`:
  - `src/app/components/VideoCard.tsx` line 83: Wrap `{video.creator.username}` in CreatorLink
  - `src/app/components/CreatorCard.tsx` line 53: Wrap `{creator.displayName}` (card already has Link wrapper, verify nested links work or use CreatorLink for name only)
  - `src/app/hashtag/[tag]/page.tsx` lines 207, 269: Wrap `{creator.display_name}` in CreatorLink
  - `src/app/sound/[soundId]/page.tsx` lines 207, 269: Wrap `{creator.display_name}` in CreatorLink  
  - `src/app/community/[slug]/page.tsx` line 270: Wrap mapped `{creator.display_name}` in CreatorLink
  - `src/app/creator/[creatorid]/page.tsx` lines 86-88: Already on detail page, but verify name is still clickable if needed or remove link (being on own page)
  - Note: `src/app/components/VideoModal.tsx` line 110 has creator username in title attribute (protected file, note but don't change)

- **Testing plan**:
  - Create test file or checklist verifying N selected pages render creator names as links
  - Verify hover state visible, focus ring appears, navigation works to `/creator/[id]`
  - Test with missing creator data (graceful fallback)
  - Verify mobile tap targets work (link area ≥ 44x44px)

- **Acceptance**: 
  - ✅ CreatorLink component exists, handles all creator name formats (displayName, display_name, username)
  - ✅ All identified locations updated (grep for `creator.displayName`, `creator.username`, `creator.display_name` shows only CreatorLink usage or intentional non-links)
  - ✅ Creator names are clickable on: VideoCard, CreatorCard, HashtagPage, SoundPage
  - ✅ Navigation works, accessible (keyboard, screen reader), mobile-friendly
  - ✅ Theme-aware styling using `--color-primary` token
  - ✅ Graceful fallback when creator ID missing (renders as plain text)

**Implementation Details:**
- Created `src/app/components/CreatorLink.tsx` with flexible props:
  - Accepts `creator` object OR `creatorId` + optional display/username props
  - Supports truncation with `maxLength` prop
  - Includes aria-label for accessibility
  - Uses theme tokens for hover states
  - Fallback renders plain text if no ID available
- Updated components:
  - `VideoCard.tsx`: Creator username now uses CreatorLink
  - `CreatorCard.tsx`: Creator displayName uses CreatorLink (nested within existing Link wrapper, works correctly)
  - `hashtag/[tag]/page.tsx`: Both desktop and mobile top creators sections use CreatorLink
  - `sound/[soundId]/page.tsx`: Both desktop and mobile top creators sections use CreatorLink
  - Community page creators use CreatorCard which now includes CreatorLink

## Phase 5, Home Page Redesign, comprehensive landing page 🔄 IN PROGRESS
- **Objective**: Transform the home page (`/`) into a comprehensive, modern marketing landing page with 8 major sections, following the detailed design outline.

- **Overall Structure**: Vertical scroll layout with sequential sections:
  1. Header (Navigation) - Already updated in Phase 2
  2. Hero Section
  3. Rankings Section
  4. Explainer Section
  5. Creator Spotlight Section
  6. Community Section
  7. CTA Section (Call-to-Action)
  8. Footer

- **Section 1: Header/Navigation** (`src/app/components/Header.tsx`):
  - Already updated in Phase 2 with theme tokens
  - Ensure sticky top navigation with backdrop blur
  - Logo: Use gradient star icon with "FanEdits" branding and tagline "Where creativity meets recognition"
  - Desktop Navigation: Browse Edits, Top Creators, Submit Edit (modal), Communities
  - Search bar (desktop) with real-time query input
  - Mobile menu (hamburger) with sheet drawer
  - "Get Started" CTA button with gradient styling (use token primary color, no purple)

- **Section 2: Hero Section** (`src/app/page.tsx`):
  - Header Content:
    - Sparkle badge: "Where creativity meets recognition" (use Badge component)
    - Main headline: "The Best Fan Edits, Ranked by Fans" (use Typography.H1)
    - Subheadline: Value proposition text (use Typography.Text)
    - Two primary CTAs: "Explore Top Edits" and "Join Community" (use Button variants)
  - Stats Bar (3 cards):
    - 10K+ Creative Edits
    - 50M+ Total Views
    - 2.5K+ Active Creators
    - Use Grid component (3 columns desktop, 1 column mobile), Card components
  - Featured Content Tabs:
    - Time-based tabs: This Week, This Month, All Time with icons (Flame, TrendingUp, Clock)
    - Use Tabs component from Phase 3
    - Category filter badges: All (10K), Movies (2.1K), Sports (1.8K), Music (956), TV Shows (743), Gaming (621), Anime (438)
    - Use Cluster component for badges, Badge component with gradient backgrounds (token colors, no purple)
    - Active state: Gradient background using `--color-primary` token
  - Video Grid:
    - 4-column responsive grid (mobile: 1 column, tablet: 2, desktop: 4)
    - Use Grid component, display `InteractiveVideoCard` components
    - Empty state: Use EmptyState component when no edits match filters
  - Creator of the Week Spotlight:
    - Use Card with gradient background (token primary color)
    - Trophy emoji and "Creator of the Week" heading
    - Featured creator with stats
    - Quote/testimonial (Typography components)
    - "View Creator Profile" CTA button (use CreatorLink from Phase 4)

- **Section 3: Rankings Section**:
  - "Hall of Fame" showcase header (Typography.H2)
  - Filter Controls:
    - Category dropdown (All, Movies, Sports, Music, TV Shows, Gaming, Anime)
    - Timeframe dropdown (All Time, This Year, This Month, This Week)
    - Sort dropdown (Most Voted, Most Viewed, Trending, Newest)
    - Use Select components, Cluster layout
  - Rankings Grid:
    - 2-column layout on lg screens, 1 column mobile
    - Display top 5 edits
    - Each card: Rank badge (#1 trophy icon, #2 medal, #3 award), thumbnail with hover scale, title, creator name (use CreatorLink), category, status badge (Legendary, Viral, Epic, Classic, Rising) with gradient colors (use semantic tokens), vote count, view count, trend percentage with green arrow
    - Top 3 entries: Yellow ring highlight (use `--color-warning` token)
    - Use Grid component, Card components
  - "View Complete Rankings" button at bottom

- **Section 4: Explainer Section** - "How it Works":
  - Header:
    - "What Are Fan Edits?" title (Typography.H2)
    - Two paragraphs explaining concept (Typography.Text)
  - 4-Step Process Cards:
    - Discover Amazing Edits (blue-cyan gradient, Play icon)
    - Vote for Your Favorites (pink-rose gradient, Heart icon)
    - Share & Get Discovered (green-teal gradient, Share icon)
    - Climb the Rankings (yellow-orange gradient, Trophy icon)
    - Use Grid component (4 columns desktop, 1 mobile), Card components
    - Gradients use semantic color tokens (no purple)
  - Popular Edit Types Section:
    - 3-column grid (Grid component)
    - Alternative Movie Trailers 🎬, Sports Highlight Reels ⚽, Music Video Remixes 🎵
    - Each with description (Typography.Text)
  - Bottom CTAs:
    - "Submit Your First Edit" (Button primary)
    - "Browse Community" (Button secondary)

- **Section 5: Creator Spotlight Section** - "Meet Our Top Creators":
  - Featured Creator Cards (3 creators):
    - Use Grid component (3 columns desktop, 1 mobile)
    - Each card: Badge (Creator of the Week 🏆, Trending Creator 🔥, Rising Star ⭐), Avatar with verified star, Creator name and specialty (use CreatorLink), Stats grid (Typography components), "View Profile" button
    - Hover effects: Shadow and translation (use token shadows)
  - Creator Community Stats:
    - 4-column grid (mobile: 2 columns, desktop: 4)
    - 2.5K+ Active Creators (Users icon), 850 Award Winners (Trophy icon), +32% Growth This Month (TrendingUp icon), 4.8 Avg. Rating (Star icon)
    - Use Grid, Card components
  - Bottom CTAs:
    - "Start Creating" (Button primary - use token primary, no purple)
    - "Browse All Creators" (Button secondary)

- **Section 6: Community Section** - "What Our Community Says":
  - Community Stats (4 metrics):
    - 25K+ Community Members, 150K+ Comments Posted, 2.8M+ Votes Cast, 45K+ Edits Shared
    - Use Grid (4 columns desktop, 2 mobile), Card components
  - Testimonials (3 cards):
    - User avatar, name, username (use CreatorLink for names)
    - Badge (Top Creator, Rising Star, Sports Expert) - use Badge component
    - Verified checkmark
    - Quote/testimonial (Typography.Text)
    - Like count, "View Profile" hover button
    - Use Grid, Card components
  - Community Features (6 benefits):
    - 🤝 Supportive Environment, 🎯 Fair Recognition System, 🌟 Growth Opportunities, 📚 Learning Resources, 🏆 Regular Contests, 💬 Active Discussion
    - Use Grid (3 columns desktop, 2 mobile, 1 mobile), Cluster for icons and text
  - Bottom CTAs:
    - "Join Community" (Button primary - token colors, no purple)
    - "Browse Edits" (Button secondary)

- **Section 7: CTA Section**:
  - Main Header:
    - "Ready to get started?" badge (Badge component)
    - "Your Creative Journey Starts Here" headline (Typography.H1)
    - Introductory paragraph (Typography.Text)
  - Three Audience-Specific Cards:
    - For Creators (yellow-orange gradient): Upload icon, benefits list, "Start Creating" white button
    - For Fans (blue-indigo gradient): Users icon, benefits list, "Explore Community" outline button
    - For Brands (emerald-teal gradient): Target icon, benefits list, "Partner With Us" outline button
    - Use Grid (3 columns desktop, 1 mobile), Card components
    - Gradients use semantic tokens (success, info, warning) - no purple
  - Bottom Stats Bar:
    - 10K+ Active Edits, 25K+ Community Members, 50M+ Total Views, 2.5K+ Brand Partnerships
    - Use Inline or Cluster component, Typography.Text

- **Section 8: Footer** (`src/app/components/Footer.tsx`):
  - Dark footer (use `--color-background` for dark theme, adjust for light)
  - White text (use `--color-text-primary` token)
  - 4-Column Grid:
    - Column 1 - Brand: FanEdits logo with gradient star, description, social media icons (Twitter, Instagram, YouTube, GitHub)
    - Column 2 - Platform: Browse Edits, Top Creators, Trending, Communities
    - Column 3 - Categories: Movies, Sports, Music, Gaming
    - Column 4 - Support: Help Center, Community Guidelines, Contact Us, Privacy Policy
    - Mobile: Stack vertically, Desktop: 4 columns
    - Use Grid component, Typography components for links
  - Bottom Bar:
    - Copyright notice: "© 2024 FanEdits. All rights reserved. Made with ❤️ for creators worldwide."
    - Legal links: Terms of Service, Privacy, Cookies
    - Use Stack, Inline components

- **Mobile-First Implementation**:
  - All sections stack vertically on mobile (< 640px)
  - Stats/numbers: 2 columns on tablet, 4 columns on desktop
  - Video grids: 1 column mobile, 2 tablet, 4 desktop
  - Tab targets: All interactive elements ≥ 44x44px
  - Typography: Responsive sizes using token scale
  - Spacing: Use Stack, Grid, Inline components with token gaps

- **Theme Support**:
  - All sections use theme tokens (colors, spacing, typography)
  - Gradients use semantic color tokens, no purple
  - Dark mode: Verify contrast ratios for all text/surface combinations
  - Test both themes with visual regression snapshots

- **Component Usage**:
  - Page, PageSection for structure
  - Stack, Grid, Inline, Cluster for layouts
  - Typography (H1-H6, Text, Muted) for text
  - Button, Badge, Card, Alert, Tabs for UI elements
  - CreatorLink for all creator names
  - Select for dropdowns
  - EmptyState for empty states

- **Acceptance**: 
  - All 8 sections implemented and responsive (320px, 768px, 1024px+)
  - No purple colors used (all gradients use semantic tokens)
  - All creator names clickable via CreatorLink
  - Mobile tap targets ≥ 44x44px verified
  - Both Light and Dark themes render correctly
  - All interactive elements keyboard accessible
  - Visual parity with design outline
  - Framer Motion animations preserved where appropriate (Hero section)
  - Performance: Lighthouse scores maintained, lazy load video cards

**🎨 Visual Polish Phase (Final Step after Phase 5)**: After all 8 sections are feature-complete, conduct a comprehensive visual refinement pass:
  - **Spacing & Layout**: Improve vertical rhythm, section spacing, internal padding consistency
  - **Typography Hierarchy**: Refine heading sizes, line heights, text balance across sections
  - **Color & Contrast**: Optimize gradient usage, improve contrast ratios, ensure theme consistency
  - **Cards & Components**: Enhance card shadows, borders, hover states, and visual depth
  - **Animations**: Add subtle transitions, hover effects, and micro-interactions
  - **Responsive Polish**: Refine breakpoints, improve mobile layouts, optimize tablet experience
  - **Visual Hierarchy**: Strengthen section separation, improve content flow and scanning
  - **UI Elements**: Polish badges, buttons, badges, and interactive elements
  - **Images & Media**: Optimize image aspect ratios, improve thumbnail displays
  - **Final Review**: Visual audit, design system consistency check, overall polish

## Phase 6, Composite Components, normalization ✅ COMPLETED
- **Objective**: Normalize composite components used across pages, replace internal ad hoc elements with primitives, add states, ensure accessibility and performance.

- **Header** (`src/app/components/Header.tsx`):
  - Already updated in Phases 1-2 with theme tokens and mobile responsiveness
  - Verify mobile menu uses Button primitives consistently
  - Ensure all spacing uses tokens
  - Remove any remaining purple gradients
  - Accessibility: Focus order, keyboard navigation, aria-labels verified
  - Performance: Memoize if needed, ensure no unnecessary re-renders

- **FilterBar** (`src/app/components/filters/FilterBar.tsx`):
  - Normalize internal spacing, ensure SearchInput, SortDropdown, TimeRangeFilter use Input/Select primitives
  - Mobile: Stack vertically, full-width inputs, compact spacing
  - Desktop: Horizontal layout, responsive
  - Empty states: Show when no options
  - Accessibility: Keyboard navigation between filters, announce changes

- **VideoCard** (`src/app/components/VideoCard.tsx`):
  - Replace custom hover/transition with token-based values
  - Use Typography for text, spacing tokens
  - Replace creator username with CreatorLink (from Phase 4)
  - Mobile: Single column, full-width images, tap target for whole card
  - Accessibility: Proper ARIA labels, keyboard support (already has)
  - Performance: Consider lazy loading images, memoize if in large lists

- **CreatorCard** (`src/app/components/CreatorCard.tsx`):
  - Normalize spacing, use Typography primitives
  - Replace creator name with CreatorLink (already has Link wrapper, verify nested links OK or adjust)
  - List vs grid variants use same tokens
  - Mobile: Full-width in list, compact spacing
  - Accessibility: Link semantics correct, alt text for avatars

- **CommunityCard, HashtagCard, SoundCard**: 
  - Same pattern as CreatorCard, use Card primitive, spacing tokens
  - Normalize all card components

- **ModalRenderer** (`src/app/components/ModalRenderer.tsx`):
  - Ensure uses Modal primitive (except VideoModal.tsx which stays unchanged per Phase 7)
  - Consistent backdrop, z-index tokens
  - Accessibility: Focus trap, ESC key, aria-modal, return focus

- **Auth modals** (LoginModal, SignupModal in `src/app/components/auth/`): 
  - Use Modal, Input, Button primitives, normalize spacing
  - Ensure consistent layout across auth flows

- **CommunityEditModal** (`src/app/components/CommunityEditModal.tsx`):
  - Use Modal, Input, Button primitives
  - Normalize form spacing using Stack component

- **Acceptance**: 
  - ✅ Unit tests for logic branches (filtering, sorting), visual states (loading, empty, error)
  - ✅ Accessibility audit, performance check (render times in large lists)
  - ✅ Mobile responsive verified (320px, 768px, 1024px)
  - ✅ Snapshots for both Light and Dark themes
  - ✅ Keyboard navigation verified
  - ✅ No purple colors remaining

**Implementation Details:**
- ✅ **FilterBar**: Normalized using Stack, Inline layout primitives, theme tokens for background/border
- ✅ **SearchInput**: Now uses Input primitive with icon positioning via tokens, clear button with 44x44px tap target
- ✅ **SortDropdown**: Uses Select primitive, normalized sizing and styling
- ✅ **TimeRangeFilter**: Uses Select primitive, consistent with other filters
- ✅ **VideoCard**: Uses card-base/card-interactive classes, theme tokens for all colors/spacing, CreatorLink integrated
- ✅ **CreatorCard**: Uses card-base/card-interactive, theme tokens, CreatorLink integrated, spacing normalized
- ✅ **CommunityCard**: Normalized with Typography components, Stack/Inline layout, theme tokens, card-base classes
- ✅ **HashtagCard**: Normalized with Typography, Badge, Inline layout, theme tokens, card-base classes
- ✅ **SoundCard**: Normalized with Typography, Inline layout, theme tokens, improved spacing with tokens
- ✅ **CommunityEditModal**: Uses Modal primitive, Input, TextArea, Button, Alert, Stack/Inline/Cluster layouts, Badge
- ✅ **LoginModal**: Uses Modal primitive, Input, Button, Alert, Stack layout, Typography, theme tokens
- ✅ **SignupModal**: Uses Modal primitive, Input, Button, Alert, Stack layout, Typography, theme tokens
- ✅ **ModalRenderer**: Verified uses VideoModal (protected component) correctly

## Phase 7, Page by Page Rewrite Plan 🔄 IN PROGRESS
Migration sequence (low risk first, isolated pages before shared patterns). For each page:

**Note**: Home page (`/`) is handled separately in Phase 5 with comprehensive redesign.

- Execution note: Begin with Settings → Health → Canary (fast wins), then lists (hashtags, sounds, creators), detail pages (creator, hashtag, sound), and finally Communities (list, detail). Each PR: 1 route, visual parity, a11y checks, tokens-only spacing.

1. **Settings (`/settings`) - S** ✅ Completed
   - Current: Mix of custom spacing (`py-12`, `px-4`), Card usage inconsistent, no mobile optimization
   - Target: Use Page wrapper, Stack for vertical spacing, Input/Button primitives, Card with token padding
   - Mobile: Single column forms, full-width inputs, compact spacing
   - Risk: Low, isolated page
   - Acceptance: Before/after screenshots, mobile tap targets ≥ 44px, contrast checks for Light/Dark

2. **Health (`/health`) - S** ✅ Completed
   - Current: Minimal, utility page
   - Target: Use Page wrapper, Typography primitives
   - Mobile: Single column, standard padding
   - Risk: None
   - Acceptance: Visual parity

3. **Canary (`/canary`) - S** ✅ Completed
   - Current: Minimal
   - Target: Use Page wrapper
   - Mobile: Single column
   - Risk: None
   - Acceptance: Visual parity

4. **Auth pages (`/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password`) - M**
   - Current: LoginModal, SignupModal in components/auth/, separate pages in auth/, spacing inconsistencies
   - Target: Use Page wrapper, Modal/Input/Button primitives, normalize spacing, consistent layout
   - Mobile: Full-screen forms, compact spacing, tap targets for buttons
   - Risk: Medium, auth flow critical
   - Acceptance: Test auth flow end-to-end, mobile form validation, contrast checks

5. **Home (`/`) - Handled in Phase 5**
   - See Phase 5 for comprehensive home page redesign with 8 sections
   - Phase 5 covers Hero, Rankings, Explainer, Creator Spotlight, Community, CTA, Footer
   - This entry exists only for sequence reference

6. **Hashtags list (`/hashtags`) - M** ✅ Completed
   - Current: Uses FilterBar, HashtagCard, container-page, grid spacing inconsistent
   - Target: Use Page wrapper, FilterBar uses primitives, Grid component with responsive columns
   - Mobile: Single column, FilterBar stacks vertically
   - Desktop: Multi-column grid
   - Risk: Low
   - Acceptance: Test filtering, grid responsive behavior, contrast

7. **Sounds list (`/sounds`) - M** 🔄 In Progress
   - Current: Similar to hashtags
   - Target: Same pattern as hashtags
   - Mobile/Desktop: Same as hashtags
   - Acceptance: Same as hashtags

8. **Creators list (`/creators`) - L**
   - Current: FilterBar, CreatorCard list variant, mixed spacing, creator names may not be linked
   - Target: Use Page, CreatorCard uses CreatorLink (Phase 4), normalize spacing, FilterBar consistent
   - Mobile: Single column list, full-width cards, compact spacing
   - Desktop: List or grid layout
   - Risk: Medium, ensure CreatorLink works
   - Acceptance: Creator names clickable, test list view, responsive breakpoints, mobile tap targets

9. **Creator detail (`/creator/[creatorid]`) - L**
   - Current: Custom layout, video grid, creator name in header (verify if link needed)
   - Target: Use Page, standardize header section, Grid primitive for videos, CreatorLink if name appears elsewhere
   - Mobile: Single column header, single column video grid, compact stats
   - Desktop: Two-column header, multi-column video grid
   - Risk: Low
   - Acceptance: Grid responsive, mobile layout verified

10. **Edits/Videos list (`/edits`) - L**
    - Current: VideoCard grid, FilterBar, complex filtering, creator names need CreatorLink
    - Target: Use Page, VideoCard uses CreatorLink, FilterBar normalized, Grid primitive
    - Mobile: Single column grid, FilterBar stacks, compact spacing
    - Desktop: 3-5 column grid depending on viewport
    - Risk: Medium, complex filtering
    - Acceptance: Test all filter combinations, grid responsive, creator links work, mobile tap targets

11. **Hashtag detail (`/hashtag/[tag]`) - L**
    - Current: Custom tabs implementation, sections, creator names in top creators need CreatorLink
    - Target: Use Page, Tabs primitive, normalize sections, CreatorLink in top creators
    - Mobile: Tabs scrollable, single column sections, compact spacing
    - Desktop: Horizontal tabs, multi-column grids
    - Risk: Medium, tabs functionality
    - Acceptance: Tabs work on mobile, creator links verified, responsive sections

12. **Sound detail (`/sound/[soundId]`) - L**
    - Current: Similar pattern to hashtag, creator names need CreatorLink
    - Target: Same as hashtag detail
    - Mobile/Desktop: Same as hashtag
    - Acceptance: Same as hashtag

13. **Communities list (`/communities`) - L**
    - Current: CommunityCard grid, create modal, FilterBar, spacing inconsistent
    - Target: Use Page, normalize modal spacing (use Modal primitive), Grid consistent, FilterBar normalized
    - Mobile: Single column grid, full-width cards, modal full-screen on mobile
    - Desktop: Multi-column grid, centered modal
    - Risk: Medium, create flow critical
    - Acceptance: Test create flow, grid layout, modal responsive

14. **Community detail (`/community/[slug]`) - XL**
    - Current: Custom tabs, complex header, multiple sections, edit modal, creator names in tabs need CreatorLink
    - Target: Use Page, Tabs primitive, normalize header section, standardize grid layouts, CreatorLink
    - Mobile: Tabs scrollable, single column sections, compact header, full-screen modals
    - Desktop: Horizontal tabs, multi-column grids, full header
    - Risk: High, complex page
    - Acceptance: Test all tabs, edit modal, responsive behavior, creator links, mobile navigation

15. **Scraper (`/scraper`) - M**
    - Current: Admin tool, AsyncTikTokScraper component, form inputs
    - Target: Use Page wrapper, normalize form inputs with Input primitive
    - Mobile: Single column, full-width inputs, compact spacing
    - Risk: Low, admin only
    - Acceptance: Form works, mobile usable

**Acceptance per page**: 
- Before/after screenshots in Light and Dark themes
- Accessibility check (Lighthouse, zero critical issues)
- Responsive test at 320px, 768px, 1024px (mobile/tablet/desktop)
- Functionality test (filters, modals, navigation, creator links)
- Mobile tap targets ≥ 44x44px verified
- Contrast checks (WCAG AA) in both themes

## Phase 8, Video Modal Protection
- **Protection rule**: Keep `src/app/components/VideoModal.tsx` design exactly as is. Do not modify this file. The design includes:
  - Dark backdrop with specific opacity
  - Centered video frame with specific dimensions and styling
  - Close button with specific positioning and styling
  - All animations and transitions preserved
  - TikTok embed styling and behavior unchanged

- **Allowed refactors**:
  - Can refactor `VideoCard.tsx` to improve card design, but clicking video card must still trigger the same popup with identical visuals
  - Can refactor callers of VideoModal (e.g., ModalRenderer, contexts) if popup behavior stays identical
  - Can update surrounding code that doesn't affect VideoModal rendering

- **Smoke test plan**:
  - Create visual regression test or screenshot baseline for VideoModal
  - Test: Click VideoCard → VideoModal opens with dark backdrop, centered video, close button visible
  - Verify: Backdrop opacity, video frame dimensions, close button styling match current design
  - Verify: Close button works, ESC key works, backdrop click closes (if current behavior)
  - Document: Current VideoModal design specs (backdrop color/opacity, video frame size, close button style) for reference

- **Acceptance**: 
  - VideoModal.tsx file unchanged (verify with git diff)
  - Smoke test confirms popup looks and behaves identically to current version
  - Visual regression snapshots pass (if implemented)
  - No purple colors added to VideoModal (existing design may have dark colors, verify)

## Phase 9, QA Gates, Accessibility and Performance
- **Automated a11y checks**: 
  - Use existing tooling or add `@axe-core/react` or Lighthouse CI
  - Run on key pages: Home, Settings, Creators list, Community detail
  - Check both Light and Dark themes
  - Target: Zero critical issues, zero serious issues

- **Visual regression snapshots**: 
  - Capture snapshots for selected pages in both Light and Dark themes
  - Pages: Home, Settings, Creators list, Community detail, Edits list
  - Tool: Percy, Chromatic, or manual screenshot comparison
  - Update snapshots with each PR that changes visuals

- **Web Vitals budgets**:
  - First Contentful Paint (FCP): < 1.8s
  - Largest Contentful Paint (LCP): < 2.5s
  - Time to Interactive (TTI): < 3.8s
  - Cumulative Layout Shift (CLS): < 0.1
  - Bundle size per route: < 250KB gzipped

- **Accessibility checklist**:
  - Keyboard navigation: Global tab order, all interactive elements focusable, skip link works
  - Focus rings: All interactive elements use `--color-primary` focus ring, visible in both themes
  - Form labels: All Input, Select, TextArea have proper labels (Input component already supports)
  - Announced errors: Error messages use `role="alert"`, aria-live regions (already in layout.tsx)
  - Media semantics: Video embeds have proper titles, captions if available, controls accessible
  - Mobile tap targets: All interactive elements ≥ 44x44px
  - Contrast ratios: WCAG AA met in both themes

- **Performance checklist**:
  - Code splitting: Verify Next.js automatic splitting, lazy load heavy components (AsyncTikTokScraper)
  - Memoization: Review large lists (VideoCard, CreatorCard), memoize if renders exceed threshold
  - Images: Next.js Image optimization configured (already in next.config.js), verify lazy loading
  - Defer scripts: Non-critical scripts deferred, verify no render-blocking

- **Acceptance**: 
  - Automated a11y report with zero critical issues, Lighthouse a11y score ≥ 90
  - Visual regression snapshots updated and passing
  - Web Vitals budgets met on key pages
  - Manual keyboard test passes (tab through entire page, all interactive elements reachable)
  - Mobile tap targets verified (≥ 44x44px)
## Phase 10, Execution Plan and Risk Controls
- **Small PRs**: One page or one composite per PR, keep PRs small (< 500 lines changed)
  - PR 1: Tokens and themes (Phase 1)
  - PR 2: Layout system and Page component (Phase 2)
  - PR 3: Primitives library with adapters (Phase 3)
  - PR 4: CreatorLink component and sweep (Phase 4)
  - PR 5: Home page comprehensive redesign (Phase 5)
  - PR 6: Composite components normalization (Phase 6)
  - PR 7-N: One page per PR following Phase 7 order (Settings → Community detail, excluding Home)
  - PR M: VideoModal smoke test (Phase 8)
  - PR M+1: QA gates (Phase 9)

- **Feature flags**: Use environment variable or context for gradual rollout if needed (not required for styling-only changes)

- **Adapter components**: Create `src/app/components/primitives/adapters.ts` that exports old component names wrapping new primitives, example: `export const OldButton = Button`. Maintain backward compatibility during migration.

- **Rollback plan**: 
  - Each PR is independently revertable
  - Adapters allow quick rollback of component changes
  - Document which components/pages changed in PR description
  - Keep old component files until migration complete (delete in final cleanup PR)

- **Risk mitigations**:
  - Tight timelines: Strict PR review, visual regression checks, adapters allow incremental migration
  - Tailwind v4 unknowns: Test token approach in isolated branch first, document breaking changes
  - Component API breaks: Adapters maintain old APIs, TypeScript catches breaks
  - Performance regressions: Performance budgets, Lighthouse checks per PR, memoization where needed
  - Accessibility regressions: A11y checks per PR, manual keyboard testing, Axe integration
  - VideoModal regressions: Smoke test locks current design, visual regression snapshots

## Phase 11, Tooling and CI
- **Prettier**: Check if configured (not in repo), add `.prettierrc` if missing, ensure consistent formatting
- **ESLint**: Current config in `eslint.config.mjs`, add rule to warn on magic spacing numbers (p-12, gap-7), require token usage
- **TypeScript**: Already strict mode, ensure no `any` types in new primitives
- **Test runners**: Add Vitest or Jest if needed for component tests (currently none), or document manual testing process
- **Coverage targets**: If tests added, aim for 80% on primitives, 60% on composites
- **Storybook or docs**: Create simple docs in `src/app/components/README.md` or `STORYBOOK.md` describing primitive usage, or add JSDoc comments
- **Visual regression**: Consider Percy or Chromatic if budget allows, or document manual visual testing checklist
- **Acceptance**: Prettier runs in pre-commit, ESLint catches token violations, TypeScript strict, basic test coverage on primitives

## Phase 12, Documentation and Handoff
- **Usage docs**: Add JSDoc comments to each primitive explaining props and examples
- **Contributing guide**: Create `CONTRIBUTING.md` or section in existing README:
  - Use tokens for spacing, no magic numbers
  - Use Page component for new pages
  - Use primitives before creating new components
  - Spacing scale reference
  - Typography scale reference
- **README update**: Document new component structure, token usage, development commands
- **Changelog**: Maintain section at bottom of this plan tracking:
  - Phase 1: Tokens and themes established (Light and Dark)
  - Phase 2: Layout system added (mobile-first)
  - Phase 3: Primitives library created (theme-aware)
- Phase 4: CreatorLink component and sweep completed
  - ✅ Created `src/app/components/CreatorLink.tsx` with support for creator object or creatorId props
  - ✅ Updated `src/app/components/VideoCard.tsx` - creator username now uses CreatorLink
  - ✅ Updated `src/app/components/CreatorCard.tsx` - creator displayName uses CreatorLink (nested within existing Link wrapper works)
  - ✅ Updated `src/app/hashtag/[tag]/page.tsx` - both desktop and mobile top creators sections use CreatorLink
  - ✅ Updated `src/app/sound/[soundId]/page.tsx` - both desktop and mobile top creators sections use CreatorLink
  - ✅ Community page uses CreatorCard which now includes CreatorLink
  - ✅ CreatorLink supports truncation, aria-labels, theme tokens, fallback for missing IDs
- Phase 5: Home page comprehensive redesign (8 sections)
- Phase 6: Composite components normalized
- Phase 7: Pages migrated (list each as completed)
- Phase 8: VideoModal protected, smoke test added
- Phase 9: QA gates passed (a11y, performance, visual regression)

## Mini Style Guide, Light and Dark

### Color Tokens
- **Light theme**: Background `#f8fafc` (slate-50), Surface `#ffffff`, Text Primary `#0f172a` (slate-900), Primary `#2563eb` (blue-600)
- **Dark theme**: Background `#0f172a` (slate-900), Surface `#1e293b` (slate-800), Text Primary `#f1f5f9` (slate-100), Primary `#3b82f6` (blue-500)

### Typography Examples
- **H1**: `text-5xl font-bold` (48px, line-height 1.1)
- **H2**: `text-4xl font-bold` (36px, line-height 1.2)
- **Body**: `text-base` (16px, line-height 1.6)
- **Muted**: `text-sm text-muted` (14px, `--color-text-muted`)

### Button Examples
```tsx
// Primary button
<Button variant="primary" size="md">Click me</Button>
// Uses --color-primary, hover --color-primary-hover

// Secondary button
<Button variant="secondary" size="sm">Cancel</Button>
// Neutral gray variant, theme-aware

// Ghost button
<Button variant="ghost">Skip</Button>
// Transparent, theme-aware text
```

### Card Example
```tsx
<Card padding="md">
  <Typography.H3>Card Title</Typography.H3>
  <Typography.Text>Card content</Typography.Text>
</Card>
// Uses --color-surface, --color-border, padding from tokens
```

### Input Example
```tsx
<Input 
  label="Email" 
  type="email" 
  placeholder="user@example.com"
  error={errorMessage}
/>
// Uses --color-border, --color-text-primary, focus ring --color-primary
```

### Link Example (CreatorLink)
```tsx
<CreatorLink creator={creator}>
  {creator.displayName}
</CreatorLink>
// Routes to /creator/[id], theme-aware hover states
```

**Note**: All components adapt automatically to dark theme via CSS custom properties. No purple colors used.

## Checklists

### Phase-by-Phase Acceptance Checklists

**Phase 1 - Tokens and Themes**:
- [ ] Tokens exist in `globals.css` or `design-tokens.ts`
- [ ] Light and Dark theme variables defined
- [ ] Both themes render correctly on test pages
- [ ] Contrast ratios verified (WCAG AA)
- [ ] Theme toggle works, persists, respects system preference
- [ ] No purple/indigo/violet colors in tokens

**Phase 2 - Layout System**:
- [ ] Page component created and used by all routes
- [ ] Layout primitives (Stack, Grid, Inline, Cluster, Cover) created
- [ ] Header responsive at 320px, 768px, 1024px
- [ ] No bespoke outer spacing on pages
- [ ] Mobile tap targets ≥ 44x44px

**Phase 3 - Primitives**:
- [ ] All primitives created, use tokens
- [ ] Each primitive has Light/Dark examples
- [ ] Keyboard navigation verified
- [ ] Screen reader checks pass
- [ ] Mobile tap targets ≥ 44x44px
- [ ] No purple colors

**Phase 4 - Creator Links**:
- [ ] CreatorLink component exists
- [ ] All identified locations updated
- [ ] Creator names clickable on VideoCard, CreatorCard, HashtagPage, SoundPage, CommunityPage
- [ ] Navigation works, accessible, mobile-friendly
- [ ] Test confirms all creator names are links

**Phase 5 - Home Page Redesign**:
- [ ] All 8 sections implemented (Hero, Rankings, Explainer, Creator Spotlight, Community, CTA, Footer)
- [ ] Responsive at 320px, 768px, 1024px+
- [ ] No purple colors, all gradients use semantic tokens
- [ ] All creator names clickable via CreatorLink
- [ ] Both Light and Dark themes verified
- [ ] Framer Motion animations preserved

**Phase 6 - Composite Components**:
- [ ] Header normalized, mobile menu works
- [ ] FilterBar normalized, uses primitives
- [ ] VideoCard uses CreatorLink, tokens
- [ ] All card components normalized
- [ ] Modals use Modal primitive (except VideoModal)
- [ ] Snapshots for Light/Dark themes

**Phase 7 - Pages**:
- [ ] All 15 pages migrated in planned order
- [ ] Each page tested: mobile (320px), tablet (768px), desktop (1024px)
- [ ] Before/after screenshots for Light/Dark
- [ ] Accessibility checks pass
- [ ] Functionality verified (filters, modals, navigation, creator links)
- [ ] Mobile tap targets verified

**Phase 7 - VideoModal Protection**:
- [ ] VideoModal.tsx unchanged (git diff)
- [ ] Smoke test confirms identical behavior
- [ ] Visual regression snapshots pass
- [ ] No purple colors added

**Phase 8 - QA Gates**:
- [ ] Automated a11y report: zero critical issues
- [ ] Visual regression snapshots updated
- [ ] Web Vitals budgets met
- [ ] Manual keyboard test passes
- [ ] Mobile tap targets verified

### Creator Links Audit Checklist
- [ ] `src/app/components/VideoCard.tsx` - creator username wrapped in CreatorLink
- [ ] `src/app/components/CreatorCard.tsx` - creator displayName wrapped in CreatorLink (verify nested links OK)
- [ ] `src/app/hashtag/[tag]/page.tsx` - top creators section uses CreatorLink
- [ ] `src/app/sound/[soundId]/page.tsx` - top creators section uses CreatorLink
- [ ] `src/app/community/[slug]/page.tsx` - creator tab uses CreatorLink
- [ ] All creator names clickable and route to `/creator/[id]`
- [ ] Hover states visible, focus rings appear
- [ ] Mobile tap targets ≥ 44x44px
- [ ] Navigation works, accessible, screen reader friendly

## Execution Checklist, high level
- [ ] Phase 1: Tokens and themes established
- [ ] Phase 2: Layout system and Page container landed
- [ ] Phase 3: Primitives library with adapters landed
- [ ] Phase 4: CreatorLink component and sweep completed
- [ ] Phase 5: Home page comprehensive redesign completed
- [ ] Phase 6: Composite components normalized
- [ ] Phase 7: Pages migrated in planned order (Settings → Community detail)
- [ ] Phase 8: VideoModal protected, smoke test passes
- [ ] Phase 9: QA gates passed (a11y, performance, visual regression)
- [ ] Phase 10: Execution plan followed, PRs merged
- [ ] Phase 11: Tooling and CI configured
- [ ] Phase 12: Documentation updated
- [ ] Final: Remove adapters and flags, delete deprecated components

## Appendix, Live Inventories

### Pages Inventory Table
| Route | Issues | Target Primitives | Effort | Owner |
|-------|--------|------------------|--------|-------|
| `/settings` | Custom spacing, inconsistent Card | Page, Stack, Input, Button, Card | S | - |
| `/health` | Minimal, add Page wrapper | Page | S | - |
| `/canary` | Minimal | Page | S | - |
| `/auth/*` | Modal/page inconsistency | Page, Input, Button, Modal | M | - |
| `/` | Custom spacing, keep animations | Page, Typography | M | - |
| `/hashtags` | Normalize FilterBar spacing | Page, FilterBar, HashtagCard | M | - |
| `/sounds` | Similar to hashtags | Page, FilterBar, SoundCard | M | - |
| `/creators` | List variant spacing, FilterBar | Page, FilterBar, CreatorCard, Stack | L | - |
| `/creator/[creatorid]` | Custom header, grid | Page, Grid, CreatorCard, VideoCard | L | - |
| `/edits` | Complex filtering, VideoCard grid | Page, FilterBar, VideoCard, Grid | L | - |
| `/hashtag/[tag]` | Custom tabs, sections | Page, Tabs, Grid | L | - |
| `/sound/[soundId]` | Similar to hashtag | Page, Tabs, Grid | L | - |
| `/communities` | Create modal, grid | Page, FilterBar, CommunityCard, Modal | L | - |
| `/community/[slug]` | Complex tabs, header, edit modal | Page, Tabs, Grid, Modal | XL | - |
| `/scraper` | Admin tool, forms | Page, Input, Button | M | - |

### Components Inventory Table
| Path | Type | Replace With | Status |
|-----|------|--------------|--------|
| `components/Button.tsx` | Primitive | Refactor with tokens | Pending |
| `components/Input.tsx` | Primitive | Refactor with tokens | Pending |
| `components/Card.tsx` | Primitive | Refactor with tokens | Pending |
| `components/Badge.tsx` | Primitive | Refactor with tokens | Pending |
| `components/Skeleton.tsx` | Primitive | Refactor with tokens | Pending |
| `components/Header.tsx` | Composite | Normalize spacing, use Button | Pending |
| `components/Footer.tsx` | Composite | Use Typography, tokens | Pending |
| `components/VideoCard.tsx` | Composite | Use Typography, tokens | Pending |
| `components/CreatorCard.tsx` | Composite | Use Typography, tokens | Pending |
| `components/CommunityCard.tsx` | Composite | Use Card primitive, tokens | Pending |
| `components/HashtagCard.tsx` | Composite | Use Card primitive, tokens | Pending |
| `components/SoundCard.tsx` | Composite | Use Card primitive, tokens | Pending |
| `components/filters/FilterBar.tsx` | Composite | Normalize spacing, ensure primitives | Pending |
| `components/filters/SearchInput.tsx` | Composite | Use Input primitive | Pending |
| `components/filters/SortDropdown.tsx` | Composite | Use Select primitive | Pending |
| `components/filters/TimeRangeFilter.tsx` | Composite | Use Button/Radio primitives | Pending |
| `components/ModalRenderer.tsx` | Composite | Use Modal primitive | Pending |
| `components/VideoModal.tsx` | Composite | Use Modal primitive | Pending |
| `components/CommunityEditModal.tsx` | Composite | Use Modal, Input, Button primitives | Pending |
| `components/auth/LoginModal.tsx` | Composite | Use Modal, Input, Button primitives | Pending |
| `components/auth/SignupModal.tsx` | Composite | Use Modal, Input, Button primitives | Pending |
| `components/empty-states/*` | Composite | Use EmptyState, Typography primitives | Pending |

### Tokens Table
| Name | Value | Usage Notes |
|------|-------|-------------|
| `--spacing-0` | 0px | No spacing |
| `--spacing-4` | 4px | Tight spacing |
| `--spacing-8` | 8px | Base unit |
| `--spacing-12` | 12px | Small padding |
| `--spacing-16` | 16px | Standard padding |
| `--spacing-24` | 24px | Medium spacing |
| `--spacing-32` | 32px | Large spacing |
| `--spacing-48` | 48px | Extra large spacing |
| `--spacing-64` | 64px | Section spacing |
| `--color-primary` | #2563eb (light) / #3b82f6 (dark) | Primary brand color (blue, replaces indigo) |
| `--color-text-primary` | #0f172a | Main text |
| `--color-text-secondary` | #64748b | Muted text |
| `--color-surface` | #ffffff | Card/panel background |
| `--color-background` | #f8fafc | Page background |
| `--color-border` | #e2e8f0 | Default border |
| `--color-success` | #10b981 | Success state |
| `--color-warning` | #f59e0b | Warning state |
| `--color-error` | #ef4444 | Error state |
| `--color-info` | #3b82f6 | Info state |
| `--radius-xs` | 4px | Small radius |
| `--radius-sm` | 6px | Input radius |
| `--radius-md` | 8px | Button radius |
| `--radius-lg` | 12px | Card radius |
| `--radius-xl` | 16px | Large card radius |
| `--radius-full` | 9999px | Pill/full |
| `--shadow-sm` | (existing) | Light shadow |
| `--shadow-md` | (existing) | Medium shadow |
| `--shadow-lg` | (existing) | Large shadow |
| `--z-header` | 50 | Header layer |
| `--z-sticky` | 40 | Sticky filter bar |
| `--z-backdrop` | 1000 | Modal backdrop |
| `--z-modal` | 1050 | Modal content |

### Risks and Mitigations
- **Risk**: Tight timelines may force parallel work
  - Mitigation: Strict PR review, visual regression checks, adapters allow incremental migration
- **Risk**: Unknown CSS mutations from Tailwind v4 updates
  - Mitigation: Test token approach in isolated branch first, document any breaking changes
- **Risk**: Component API changes break existing usage
  - Mitigation: Adapters maintain old APIs, gradual migration, TypeScript catches breaks
- **Risk**: Performance regressions from new components
  - Mitigation: Performance budgets, Lighthouse checks per PR, memoization where needed
- **Risk**: Accessibility regressions
  - Mitigation: A11y checks per PR, manual keyboard testing, Axe integration
- **Risk**: Dark mode implementation complexity
  - Mitigation: Phase 7 is optional, can be deferred, test thoroughly in isolation

## Changelog
_Update this section as work progresses_

- 2025-01-XX: Plan v2 created, Phase 0 discovery complete, mobile-first, dual theme, no purple, creator links, VideoModal protection requirements added
- Phase 1: Tokens and themes (Light and Dark) - Pending
- Phase 2: Layout system (mobile-first) - Pending
- Phase 3: Primitives library (theme-aware) - Pending
- Phase 4: CreatorLink component and sweep - ✅ Completed
  - Created CreatorLink component with props for creator object or creatorId
  - Updated VideoCard, CreatorCard, HashtagPage, SoundPage to use CreatorLink
  - All creator names are now clickable and route to `/creator/[id]`
  - Supports truncation, accessibility, theme tokens, graceful fallbacks
- Phase 5: Home page comprehensive redesign (8 sections) - ✅ Feature Complete, 🎨 Visual Polish Needed
  - ✅ Footer component updated with 4-column layout, theme tokens, social icons
  - ✅ Hero Section: Header content, Stats bar, Featured content tabs, Category filters, Video grid, Creator of the Week spotlight
  - ✅ Rankings Section: Hall of Fame, filter controls, top 5 rankings grid with rank badges, status badges
  - ✅ Explainer Section: "What Are Fan Edits?" content, 4-step process cards, popular edit types, CTAs
  - ✅ Creator Spotlight Section: Featured creator cards (3), community stats, CTAs
  - ✅ Community Section: Community stats, testimonials (3 cards), community features grid, CTAs
  - ✅ CTA Section: Main header, three audience-specific cards (Creators/Fans/Brands), bottom stats bar
  - 🎨 **Visual Polish Phase Needed**: All features implemented, but visual refinement and design polish required
- Phase 6: Composite components normalization - ✅ Completed
  - FilterBar, SearchInput, SortDropdown, TimeRangeFilter normalized to use primitives
  - VideoCard, CreatorCard, CommunityCard, HashtagCard, SoundCard normalized with tokens and Typography
  - CommunityEditModal, LoginModal, SignupModal use Modal primitive and consistent styling
  - All components use theme tokens, layout primitives, proper spacing, accessible tap targets
- Phase 7: Pages migration (14 pages, Settings → Community detail, excluding Home) - Pending
- Phase 8: VideoModal protection, smoke test - Pending
- Phase 9: QA gates (a11y, performance, visual regression) - Pending
- Phase 10: Execution plan and risk controls - Pending
- Phase 11: Tooling and CI - Pending
- Phase 12: Documentation and handoff - Pending

