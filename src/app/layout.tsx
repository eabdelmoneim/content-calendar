import type { Metadata, Viewport } from "next";

import { DEFAULT_THEME_PREFERENCE, THEME_INIT_SCRIPT } from "@/shared/theme/theme";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Content Calendar",
  title: { default: "Content Calendar", template: "%s · Content Calendar" },
  description:
    "Plan, approve and track the team's X and LinkedIn posts on one shared calendar, with an image library and post analytics.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    // The inline script may change data-theme before hydration.
    <html lang="en" data-theme={DEFAULT_THEME_PREFERENCE} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
