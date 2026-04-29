import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QuickActionBar } from '../QuickActionBar';

const renderWithRouter = (component: React.ReactNode) => {
  return render(
    <BrowserRouter>
      <Routes>
        <Route path="/" element={component} />
        <Route path="/send" element={<div>Send Page</div>} />
        <Route path="/request" element={<div>Request Page</div>} />
        <Route path="/scan" element={<div>Scan Page</div>} />
      </Routes>
    </BrowserRouter>
  );
};

describe('QuickActionBar', () => {
  it('should render all action buttons', () => {
    renderWithRouter(<QuickActionBar />);
    
    expect(screen.getByLabelText('Send')).toBeInTheDocument();
    expect(screen.getByLabelText('Request')).toBeInTheDocument();
    expect(screen.getByLabelText('Scan')).toBeInTheDocument();
  });

  it('should navigate to /send when Send button is clicked', () => {
    renderWithRouter(<QuickActionBar />);
    
    fireEvent.click(screen.getByLabelText('Send'));
    expect(screen.getByText('Send Page')).toBeInTheDocument();
  });

  it('should navigate to /request when Request button is clicked', () => {
    renderWithRouter(<QuickActionBar />);
    
    fireEvent.click(screen.getByLabelText('Request'));
    expect(screen.getByText('Request Page')).toBeInTheDocument();
  });

  it('should navigate to /scan when Scan button is clicked', () => {
    renderWithRouter(<QuickActionBar />);
    
    fireEvent.click(screen.getByLabelText('Scan'));
    expect(screen.getByText('Scan Page')).toBeInTheDocument();
  });
});
