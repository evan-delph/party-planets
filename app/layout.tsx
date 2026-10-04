import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Party Planets · Across the Galaxy',
  description:
    'Twenty-eight action minigames, nine sprawling boards across three planets, and your own custom character. An original, editable 3D party game.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
