import { Outlet } from 'react-router-dom';
import { Header } from './Header';

export function Layout() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute -left-28 top-24 h-64 w-64 rounded-full bg-sky-300/35 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-10 h-56 w-56 rounded-full bg-orange-300/35 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 right-1/4 h-52 w-52 rounded-full bg-emerald-300/25 blur-3xl" />
      <Header />
      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
