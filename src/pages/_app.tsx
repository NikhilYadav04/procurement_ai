import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useEffect } from "react";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useTheme } from "next-themes";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { installDevApi } from "@/lib/dev/mockApi";
import { syncDevSessionFromUrl } from "@/lib/dev/session";

// Runs at import time, before React renders anything. It has to: child effects
// fire before parent effects, so a useEffect here would land after the
// dashboard has already read the session cookie and bounced to /login.
if (typeof window !== "undefined") {
  syncDevSessionFromUrl();
}

const displaySans = Archivo({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const figureMono = IBM_Plex_Mono({
  subsets: ["latin"],
  // IBM Plex Mono is not a variable font, so weights must be explicit.
  weight: ["400", "500", "600"],
  variable: "--font-figure",
  display: "swap",
});

const THEME_BACKGROUND = {
  // Must track --background in globals.css for each surface.
  light: "#F7F0E1", // Ledger cream
  dark: "#17130E",  // Ledger night
} as const;

/** Keeps the browser chrome colour in sync with whichever theme is active. */
function ThemeColorMeta() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const background =
      resolvedTheme === "dark" ? THEME_BACKGROUND.dark : THEME_BACKGROUND.light;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", background);
  }, [resolvedTheme]);

  return null;
}

/** A page may pin itself to one surface regardless of the user's setting. */
type ThemedPage = AppProps['Component'] & { forcedTheme?: 'light' | 'dark' };

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Only initialize PostHog if the key is present and we're not in development with missing config
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

    if (posthogKey && posthogKey.length > 0) {
      try {
        posthog.init(posthogKey, {
          api_host:
            process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
          persistence: "memory", // Use memory to avoid localStorage issues
          autocapture: false, // Disable autocapture to reduce network calls
          capture_pageview: false, // Disable automatic pageview capture
          loaded: (posthog) => {
            if (process.env.NODE_ENV === "development") {
              console.log("PostHog loaded successfully");
            }
          },
          disable_session_recording: true, // Disable session recording by default
        });
      } catch (error) {
        // Silently fail - analytics is not critical
        if (process.env.NODE_ENV === "development") {
          console.warn("PostHog initialization failed (non-critical):", error);
        }
      }
    }
  }, []);

  // The font loader also runs in _app.tsx per the design spec, but the
  // generated CSS variables need to reach <html> so Radix portals (dialogs,
  // selects, toasts) that mount outside the wrapper div below still inherit
  // them, not just the wrapper's own descendants.
  // Development harness. No-op in a production build: DEV_ENABLED is inlined
  // by Next, so the whole module's branches are dead-stripped.
  useEffect(() => {
    installDevApi();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(displaySans.variable, figureMono.variable);
    return () => {
      root.classList.remove(displaySans.variable, figureMono.variable);
    };
  }, []);

  return (
    <PostHogProvider client={posthog}>
      <>
        <Head>
          <title>Procurix, The AI Procurement Agent</title>
          <meta
            name="description"
            content="Procurix runs your sourcing end to end. It writes the RFP, runs the auction, negotiates the price, and makes sure you never miss an MSME payment deadline."
          />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="theme-color" content={THEME_BACKGROUND.light} />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
          /* Broadsheet is the product surface, so light is forced rather than
             merely defaulted. defaultTheme only applies when nothing is stored,
             and next-themes persists the choice: anyone whose browser still
             holds `theme: dark` from when the app forced dark would otherwise
             be stuck there, because ThemeToggle.tsx was deleted in 424fbaa and
             nothing in the app calls setTheme. A page opts out explicitly by
             declaring a static `forcedTheme`. */
          forcedTheme={(Component as ThemedPage).forcedTheme ?? "light"}
        >
          <ThemeColorMeta />
          <div className={`${displaySans.variable} ${figureMono.variable} contents`}>
            <Component {...pageProps} />
            <Toaster />
          </div>
        </ThemeProvider>
      </>
    </PostHogProvider>
  );
}
