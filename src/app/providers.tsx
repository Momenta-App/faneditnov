'use client';

import { AuthProvider } from "./contexts/AuthContext";
import { SearchProvider } from "./contexts/SearchContext";
import { ModalProvider } from "./contexts/ModalContext";
import { ThemeProvider } from "./components/ThemeProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SearchProvider>
          <ModalProvider>
            {children}
          </ModalProvider>
        </SearchProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

