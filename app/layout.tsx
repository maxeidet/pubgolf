import type { Metadata, Viewport } from "next";
import { Courier_Prime, Open_Sans, Oswald } from "next/font/google";
import "./globals.css";

const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"] });
const courier = Courier_Prime({
  variable: "--font-courier",
  subsets: ["latin"],
  weight: ["400", "700"],
});
const openSans = Open_Sans({ variable: "--font-open-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pubgolf",
  description: "Scorekort och topplista för kvällens pubgolf",
};

export const viewport: Viewport = {
  themeColor: "#a9d9d4",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="sv"
      className={`${oswald.variable} ${courier.variable} ${openSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col bg-turkos font-sans">
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col pt-[env(safe-area-inset-top)]">
          {children}
        </main>
      </body>
    </html>
  );
}
