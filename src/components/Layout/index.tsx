import { Outlet } from 'react-router-dom';
import { Header } from './Header';

export function Layout() {
  return <div className="app-frame"><Header /><main className="app-sheet"><Outlet /></main></div>;
}
