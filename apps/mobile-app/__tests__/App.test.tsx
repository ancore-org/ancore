import React from 'react';
import { render } from '@testing-library/react-native';
import App from '../src/App';

describe('App', () => {
  it('renders the onboarding navigator', () => {
    const { getByText } = render(<App />);
    expect(getByText(/set up your wallet/i)).toBeTruthy();
  });
});
