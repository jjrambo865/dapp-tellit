import React from 'react';
import dynamic from 'next/dynamic';
import '../src/App.css';

// Dynamically import the main app component to avoid SSR issues
const AppContent = dynamic(() => import('./AppContent'), {
  ssr: false,
  loading: () => (
    <div className="app">
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    </div>
  )
});

export default function Home() {
  return <AppContent />;
}
