import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTellit } from '../contexts/TellitContext';
import NoteItem from './NoteItem';
import './TimelineTab.css';

const TimelineTab: React.FC = () => {
  const { publicKey, connected } = useWallet();
  const { 
    notes, 
    loading, 
    error, 
    fetchNotes, 
    manualRefresh, 
    autoRefreshEnabled, 
    setAutoRefreshEnabled,
    lastFetchTime 
  } = useTellit();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (connected) {
      fetchNotes(true); // Force initial fetch
    }
  }, [connected]); // Remove fetchNotes from dependencies to prevent continuous refreshing

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await manualRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const toggleAutoRefresh = () => {
    setAutoRefreshEnabled(!autoRefreshEnabled);
  };

  if (!connected) {
    return (
      <div className="timeline-tab">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Timeline</h2>
          </div>
          <div className="connect-wallet-prompt">
            <p>Connect your Phantom wallet to view your notes timeline.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="timeline-tab">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Timeline</h2>
          <div className="refresh-controls">
            <button 
              className={`btn ${autoRefreshEnabled ? 'btn-auto-enabled' : 'btn-manual-enabled'}`}
              onClick={toggleAutoRefresh}
              title={autoRefreshEnabled ? 'Auto-refresh enabled (30s)' : 'Auto-refresh disabled'}
            >
              {autoRefreshEnabled ? 'Auto' : 'Manual'}
            </button>
            <button 
              className="btn btn-primary"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <span className="spinner"></span>
                  Refreshing...
                </>
              ) : (
                'Refresh Now'
              )}
            </button>
            {lastFetchTime > 0 && (
              <span className="last-fetch-time">
                Last updated: {new Date(lastFetchTime).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        
        {error && (
          <div className="error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading && !refreshing ? (
          <div className="loading">
            <span className="spinner"></span>
            Loading notes...
          </div>
        ) : notes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10,9 9,9 8,9"/>
              </svg>
            </div>
            <h3>No notes yet</h3>
            <p>You haven't received any notes yet. Share your wallet address with others to start receiving notes!</p>
            <div className="timeline-info">
              <div className="info-section">
                <h4>How it works:</h4>
                <ul>
                  <li>Share your wallet address with friends</li>
                  <li>They can send you encrypted notes</li>
                  <li>Notes appear here in chronological order</li>
                  <li>Your notes are Public</li>
                </ul>
              </div>
              <div className="info-section">
                <h4>Your Timeline:</h4>
                <p>This is where all your received notes will appear. Each note shows the sender, timestamp, and content.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="notes-list">
            {notes.map((note, index) => (
              <NoteItem key={index} note={note} />
            ))}
            <div className="timeline-footer">
              <p>Total notes received: {notes.length}</p>
              <p>Timeline updates automatically when new notes arrive</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelineTab;
