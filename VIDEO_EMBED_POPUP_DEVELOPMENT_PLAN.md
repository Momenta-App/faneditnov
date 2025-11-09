# Video Embed Popup Development Plan

## Overview

This document outlines the development plan for implementing clickable videos that play through TikTok embeds in a popup modal with minimal UI elements.

## Goals

1. Make all video cards clickable to trigger a popup modal
2. Embed TikTok videos using the official embed API
3. Minimize embedded elements - display only the video in its natural aspect ratio
4. Create a clean, distraction-free viewing experience

## Technical Approach

### Understanding TikTok Embed

Based on [TikTok's Embed Documentation](https://developers.tiktok.com/doc/embed-videos/):

- **oEmbed API**: `https://www.tiktok.com/oembed?url={video_url}`
- **Embed HTML**: Returns a blockquote with iframe-like structure
- **Aspect Ratio**: Native TikTok videos are 9:16 (portrait)
- **Customization**: Limited - TikTok controls the embed UI
- **Alternative**: We can use the direct iframe approach with minimal options

### Strategy for Minimal UI

Since TikTok controls the embed HTML and it includes author info, description, etc., we have two approaches:

**Option A**: Use TikTok oEmbed (recommended for compatibility)
- Extract just the video iframe from the embed response
- Apply custom CSS to hide unnecessary elements
- Better compatibility and official support

**Option B**: Direct iframe embedding
- Build TikTok video URL: `https://www.tiktok.com/embed/v2/{postId}`
- Custom iframe with minimal controls
- Faster but less reliable

**Recommendation**: Start with Option A for reliability, explore Option B for customization.

## Implementation Steps

### Phase 1: Create Modal Component

#### 1.1 Create Video Modal Component
**File**: `src/app/components/VideoModal.tsx`

**Features**:
- Full-screen overlay with backdrop
- Centered video player (maintaining 9:16 aspect ratio)
- Close button (X icon) in top-right corner
- Click outside to close
- Escape key to close
- Smooth animations using Framer Motion
- Loading state while fetching embed
- Error handling for failed embeds

**Key Considerations**:
- Use `aspect-ratio: 9/16` for native TikTok look
- Max width constraint (e.g., 360px for mobile) on small screens
- Responsive sizing on desktop (up to 540px wide)
- Dark backdrop (rgba black with backdrop blur)
- Prevent body scroll when modal is open

#### 1.2 Embed Implementation

**TikTok URL Construction**:
```typescript
const constructTikTokUrl = (video: Video) => {
  // Use postId to construct the TikTok URL
  return `https://www.tiktok.com/@${video.creator.username}/video/${video.postId}`;
};
```

**Fetching Embed HTML**:
```typescript
const fetchEmbed = async (url: string) => {
  const response = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
  const data = await response.json();
  return data.html; // This contains the embed HTML
};
```

**Rendering Embed**:
- Use `dangerouslySetInnerHTML` to inject embed HTML
- Need to ensure TikTok's embed.js script loads
- The embed script will automatically enhance the blockquote

**Custom Styling Approach**:
```css
/* Target TikTok embed elements to hide UI */
.tiktok-embed iframe {
  /* TikTok controls this, but we can try to minimize */
}

/* Hide embed metadata if possible */
.tiktok-embed section > a:not([title*="sound"]),
.tiktok-embed .tiktok-more-button {
  display: none !important;
}
```

**Note**: TikTok's embed has limited customization. We may need to accept some UI elements (like creator attribution) as they're part of TikTok's requirements.

### Phase 2: Update VideoCard Component

#### 2. Notable Changes
**File**: `src/app/components/VideoCard.tsx`

**Changes**:
1. Remove `Link` component navigation
2. Add click handler that calls `openModal('video-preview', video)`
3. Keep all existing UI/UX (thumbnail, stats, hover effects)
4. Add `cursor-pointer` class
5. Ensure onClick doesn't trigger on child elements (stopPropagation where needed)

### Phase 3: Integrate Modal into Layout

#### 3.1 Create Modal Renderer
**File**: `src/app/components/ModalRenderer.tsx`

**Purpose**:
- Reads `modalType` and `modalData` from ModalContext
- Renders appropriate modal based on type
- Currently handles: `video-preview`
- Extensible for future modal types

#### 位置: Insert in Layout
Update `src/app/layout.tsx` to include:
```tsx
import { ModalRenderer } from "./components/ModalRenderer";

// Inside Providers, after main content:
{children}
<ModalRenderer />
```

### Phase 4: Handle Edge Cases

#### 4.1 Video URL Validation
- Ensure `postId` exists on all videos
- Handle videos without valid TikTok URLs
- Provide fallback message: "Video unavailable"

#### 4.2 Loading States
- Show skeleton/spinner while fetching embed
- Handle slow network connections
- Timeout after 10 seconds

#### 4.3 Error Handling
- Network errors (fetch fails)
- Invalid embed responses
- Script loading failures
- Display user-friendly error message

#### 4.4 Mobile Considerations
- Full viewport on mobile
- Touch interactions work correctly
- Prevent zoom issues
- Consider mobile iframe restrictions

### Phase 5: TypeScript Type Updates

#### 5.1 Update Types
**File**: `src/app/types/data.ts`

Ensure Video type has:
```typescript
export interface Video {
  id: string;
  postId: string; // Required for TikTok URL
  videoUrl: string; // Direct video URL if available
  // ... rest of existing fields
}
```

#### 5.2 Modal Context Types
**File**: `src/app/contexts/ModalContext.tsx`

Update `modalData` type:
```typescript
interface ModalContextType {
  modalType: ModalType;
  modalData: Video | any; // Or create a union type
  // ... rest
}
```

## Testing Plan

### Manual Testing Checklist

- [x] Click video card opens modal
- [x] Video loads and plays in modal
- [x] Close button (X) works
- [x] Click outside modal closes it
- [x] Escape key closes modal
- [x] Body scroll is prevented when modal is open
- [x] Responsive on mobile (iPhone, Android)
- [x] Responsive on tablet
- [x] Responsive on desktop
- [x] Video displays in modal (TikTok controls aspect ratio)
- [x] Loading state appears during initialization
- [x] Modal handles video data properly
- [x] Multiple videos can be opened/closed quickly
- [ ] Error message shows for invalid videos (needs testing)
- [ ] Browser back/forward buttons work correctly (needs testing)
- [x] Works on Chrome
- [ ] Test Firefox, Safari, Edge

### Edge Case Testing

- [ ] Video with very long title
- [ ] Video without postId
- [ ] Slow internet connection
- [ ] No internet connection
- [ ] TikTok embed API down
- [ ] Video deleted on TikTok
- [ ] Private video
- [ ] Age-restricted video

## Design Specifications

### Modal Overlay
```css
Position: fixed
Background: rgba(0, 0, 0, 0.85) with backdrop-blur
Z-index: 50
Full viewport coverage
```

### Video Container
```css
Max width: 360px (mobile), 540px (desktop)
Aspect ratio: 9/16 (maintain TikTok native format)
Background: black
Border radius: 12px
Box shadow: large
Centered horizontally and vertically
```

### Close Button
```css
Position: absolute top-right
Size: 40x40px
Background: rgba(255, 255, 255, 0.15) with backdrop-blur
Border: none
Border radius: 50%
Icon: white X
Hover: scale(1.1), brighter background
```

### Animations
```typescript
Open: Scale from 0.95 to 1, opacity from 0 to 1 (150ms)
Close: Scale to 0.95, opacity to 0 (100ms)
Backdrop: Fade in/out (200ms)
```

## Future Enhancements

### Potential Improvements

1. **Video Navigation**
   - Previous/Next buttons to browse videos
   - Keyboard arrows (← →) support

2. **Analytics**
   - Track video views from modal
   - Record which videos are played

3. **Share Functionality**
   - Copy video link button
   - Share to social media

4. **Video Details Overlay**
   - Show video stats on hover
   - Creator profile link
   - Hashtag tags

5. **Autoplay**
   - Auto-play when modal opens
   - Respect user preference settings

6. **Playlist Mode**
   - Queue multiple videos
   - Auto-play next video

## Potential Challenges

### 1. TikTok Embed Limitations
**Challenge**: TikTok controls embed HTML and includes creator info, description, etc.
**Mitigation**: 
- Use custom CSS where possible
- Consider this part of TikTok attribution (required)
- Users can click through to TikTok for full experience

### 2. iframe Sandboxing
**Challenge**: Browsers restrict iframe interactions
**Mitigation**: 
- Ensure proper iframe attributes
- Handle click events on parent elements

### 3. Script Loading
**Challenge**: TikTok embed.js needs to load properly
**Mitigation**:
- Use React useEffect to ensure script loads
- Add error handling for script failures
- Consider loading script in document head

### 4. Mobile Performance
**Challenge**: Embeds can be heavy on mobile
**Mitigation**:
- Lazy load embed only when modal opens
- Optimize animation performance
- Test thoroughly on low-end devices

### 5. SEO Concerns
**Challenge**: Removing Link components affects SEO
**Mitigation**:
- Keep original video detail pages
- Consider adding canonical URLs
- Ensure proper meta tags

## Implementation Priority

### Must Have (MVP)
1. ✅ VideoModal component with basic functionality
2. ✅ Update VideoCard to trigger modal
3. ✅ Modal renderer integration
4. ✅ Close button functionality
5. ✅ Basic error handling

### Should Have
6. ✅ Loading states
7. ✅ Click outside to close
8. ✅ Escape key support
9. ✅ Responsive design

### Nice to Have
10. ⏳ Enhanced animations
11. ⏳ Video analytics tracking
12. ⏳ Share functionality
13. ⏳ Keyboard navigation

## Code Structure Overview

```
src/app/
├── components/
│   ├── VideoCard.tsx (updated)
│   ├── VideoModal.tsx (new)
│   └── ModalRenderer.tsx (new)
├── contexts/
│   └── ModalContext.tsx (already exists)
└── layout.tsx (updated to include ModalRenderer)
```

## References

- [TikTok Embed Documentation](https://developers.tiktok.com/doc/embed-videos/)
- [TikTok oEmbed API](https://developers.tiktok.com/doc/tiktok-embed-events/)
- [Framer Motion Documentation](https://www.framer.com/motion/)
- [React Modal Best Practices](https://react.dev/reference/react-dom/createPortal)

## Implementation Status

### ✅ Completed

1. ✅ Created `VideoModal.tsx` component
2. ✅ Created `ModalRenderer.tsx` component  
3. ✅ Updated `VideoCard.tsx` to use modal
4. ✅ Updated `layout.tsx` to render modals
5. ✅ Implemented direct TikTok iframe embedding (`https://www.tiktok.com/embed/v2/${postId}`)
6. ✅ Added Permissions-Policy headers to fix console violations
7. ✅ Added responsive design (max-width: 600px, height: 90vh)
8. ✅ Modal functionality working (click outside, ESC key, close button)
9. ✅ Loading and error states implemented

### Current Implementation Details

**Files Created/Modified**:
- `src/app/components/VideoModal.tsx` - Main modal component
- `src/app/components/ModalRenderer.tsx` - Modal renderer
- `src/app/components/VideoCard.tsx` - Updated to open modal
- `src/app/layout.tsx` - Added ModalRenderer
- `src/app/globals.css` - TikTok embed styling
- `next.config.js` - Added Permissions-Policy headers

**Technical Details**:
- Using direct iframe embed: `https://www.tiktok.com/embed/v2/{postId}`
- Framer Motion for animations
- Transparent backdrop with blur effect
- 90vh height with 800px max-height for larger video display
- Close button with glassmorphism effect

---

## Design Enhancement Plan

### Current Issues

1. **White Background**: TikTok's embed includes required attribution UI with white background that cannot be removed due to cross-origin restrictions
2. **Modal Sizing**: Current modal uses viewport-relative sizing which may not be optimal
3. **Visual Hierarchy**: Could improve the modal appearance and video prominence

### Reference Implementation

Based on a reference implementation from another codebase, here are design patterns we should consider adopting:

#### 1. Modal Container Improvements

```typescript
// Reference: bg-black/70 backdrop, rounded-token-lg, bg-base-200 panel
<div className="fixed inset-0 bg-black/70" onClick={handleBackgroundClick} />
<div className="flex min-h-full items-center justify-center p-4">
  <Dialog.Panel className="w-full max-w-[600px] transform overflow-hidden rounded-token-lg bg-base-200 p-6">
    {/* Content */}
  </Dialog.Panel>
</div>
```

**Recommendations**:
- Use `bg-black/70` instead of transparent backdrop for better visual separation
- Add panel with background color (`bg-base-200` or theme-aware color)
- Add padding around the content area (`p-6`)
- Consider rounded corners (`rounded-token-lg`)

#### 2. Video Container Sizing

```typescript
// Reference: Fixed height of 600px for modal video
className="w-full h-[600px] overflow-hidden"
```

**Recommendations**:
- Consider fixed height (600px) instead of viewport-relative
- Ensure full width (`w-full`)
- Proper overflow handling

#### 3. Close Button Placement

```typescript
// Reference: Inside the panel, not floating
<div className="flex items-center justify-between mb-4">
  <Dialog.Title>{title}</Dialog.Title>
  <button onClick={onClose}>
    <X className="h-5 w-5" />
  </button>
</div>
```

**Recommendations**:
- Move close button inside the modal panel
- Add a title bar with close button
- Better integration with modal content

### Proposed Design Updates

1. **Modal Backdrop**
   - Change from `bg-transparent` to `bg-black/70`
   - Keep `backdrop-blur-md` for depth effect
   
2. **Modal Panel**
   - Add colored panel background (use theme-aware color or `bg-white dark:bg-gray-900`)
   - Add `p-6` padding inside modal
   - Use `rounded-lg` or `rounded-2xl` for corners
   - Consider `shadow-2xl` for elevation
   
3. **Video Container**
   - Set fixed height to 600px (or 80vh with max-height)
   - Ensure proper aspect ratio handling
   - Remove extra spacing around iframe
   
4. **Close Button**
   - Move inside modal panel in top-right corner
   - Use icon component (currently using SVG inline)
   - Add title bar area if showing video info
   
5. **Typography & Spacing**
   - Consider adding video creator name or title above video
   - Better spacing between elements
   - Use consistent design tokens

### Implementation Steps

1. Update `VideoModal.tsx` backdrop styling
2. Add panel container with background and padding
3. Adjust video container sizing
4. Relocate close button inside panel
5. Add optional title/creator info section
6. Update CSS for better visual hierarchy

### Files to Modify

- `src/app/components/VideoModal.tsx` - Main styling updates
- `src/app/globals.css` - Add theme-aware modal styles if needed

---

**Estimated Development Time**: 4-6 hours (MVP) | 1-2 hours (Design enhancements)

**Priority**: Medium-High

**Status**: ✅ MVP Completed | ⏳ Design Enhancements Pending

