import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './AppRouter';
import '../styles/global.css';

const emptyHome = {
  target: 125,
  strong: 0,
  uncertain: 0,
  weak: 0,
  remaining: 125,
  dueReviews: 0,
  activeSession: null,
};

export function App() {
  return <BrowserRouter><AppRouter homeViewModel={emptyHome} /></BrowserRouter>;
}
