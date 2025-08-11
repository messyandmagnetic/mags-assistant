import { render, screen } from '@testing-library/react';
import Header from '../components/Header';

describe('Header', () => {
  it('renders navigation links', () => {
    render(<Header />);
    expect(screen.getByText('Messy & Magnetic')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /about/i })).toBeInTheDocument();
  });
});
