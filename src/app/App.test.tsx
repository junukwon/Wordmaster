import { render, screen } from '@testing-library/react';
import { App } from './App';

test('renders the WordMaster heading', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'WordMaster' })).toBeInTheDocument();
});
