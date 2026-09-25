import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TeamTick",
    template: "%s · TeamTick",
  },
  description: "Listas de tareas compartidas para proyectos en equipo.",
  applicationName: "TeamTick",
  // Al agregarla a la pantalla de inicio en iOS se abre sin la barra de Safari.
  appleWebApp: {
    capable: true,
    title: "TeamTick",
    statusBarStyle: "default",
  },
  other: {
    // Equivalente viejo de `mobile-web-app-capable` para versiones anteriores de iOS.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    // Mismo color que el header, así la barra de estado se funde con la app.
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
