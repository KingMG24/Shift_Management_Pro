import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from './App';

test('renders the login form when no session exists', () => {
  render(<App />);
  expect(screen.getByText('Sign in')).toBeDefined();
});
