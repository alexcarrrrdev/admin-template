import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { DEFAULT_APP_NAME, getAppName } from "@/lib/app-settings";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Métadonnées dynamiques : le titre reflète le nom de l'application
// configuré par un administrateur (voir /administration/general). En cas
// d'échec (ex. base de données indisponible), on retombe silencieusement
// sur le nom par défaut plutôt que de faire échouer le rendu.
export async function generateMetadata(): Promise<Metadata> {
  let appName = DEFAULT_APP_NAME;
  try {
    appName = await getAppName();
  } catch {
    // Volontairement ignoré (voir commentaire ci-dessus).
  }

  return {
    title: appName,
    description: "Base commune pour les systèmes de gestion clients",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
