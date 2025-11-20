'use client';

import { Typography } from './Typography';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[var(--color-background)] border-t border-[var(--color-border)] py-4">
      <div className="container-base max-w-[1440px] mx-auto w-full px-4">
        <Typography.Muted className="text-center text-xs">
          © {currentYear} Attention Engine Inc. All rights reserved.
        </Typography.Muted>
      </div>
    </footer>
  );
}

