'use client';
import dynamic from 'next/dynamic';
const Party = dynamic(() => import('@/game/Party'), {
  ssr: false,
  loading: () => (
    <main className="boot">
      <h1>PARTY PLANETS</h1>
      <p>Charting your next destination…</p>
    </main>
  ),
});
export default function Home() {
  return <Party />;
}
