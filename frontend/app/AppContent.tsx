'use client'

import React, { useState } from 'react';
import { WalletProvider } from '../src/contexts/WalletContext';
import { TellitProvider } from '../src/contexts/TellitContext';
import TimelineTab from '../src/components/TimelineTab';
import SendNoteTab from '../src/components/SendNoteTab';
import Header from '../src/components/Header';
// IntegrationMonitor removed - keeping app simple

export default function AppContent() {
  const [activeTab, setActiveTab] = useState<'timeline' | 'send'>('timeline');
  // IntegrationMonitor state removed - keeping app simple

  return (
    <WalletProvider>
      <TellitProvider>
        <div className="app">
          <Header />
          <div className="app-content">
            <div className="title-section">
              <h1 className="app-title">Tellit</h1>
              <p className="app-subtitle">Say it before it's too late</p>
            </div>
            
            <div className="tab-navigation">
              <button
                className={`tab-button ${activeTab === 'timeline' ? 'active' : ''}`}
                onClick={() => setActiveTab('timeline')}
              >
                Timeline
              </button>
              <button
                className={`tab-button ${activeTab === 'send' ? 'active' : ''}`}
                onClick={() => setActiveTab('send')}
              >
                Send Note
              </button>
            </div>
            
            <div className="tab-content">
              {activeTab === 'timeline' && <TimelineTab />}
              {activeTab === 'send' && <SendNoteTab />}
            </div>
          </div>
          
          {/* IntegrationMonitor removed - keeping app simple */}
        </div>
      </TellitProvider>
    </WalletProvider>
  );
}
