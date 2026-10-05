import type { Metadata } from 'next';
import './globals.css';
// v0.8 sticker skin; its :root-prefixed selectors outrank the older layers.
import './skin.css';
// Per-area UI layers (each owned by one design track).
import './ui-menu.css';
import './ui-board-hud.css';
import './ui-vote-results.css';
import './ui-minigame-hud.css';
export const metadata: Metadata = {
  title: 'Party Planets · Across the Galaxy',
  description:
    'Twenty-eight action minigames, four hand-built boards across four planets, and your own custom alien. An original 3D party game.',
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
