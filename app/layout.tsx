import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Générateur de Planning de Tournois",
  description: "Application de génération automatique de plannings de combats pour tournois sportifs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
