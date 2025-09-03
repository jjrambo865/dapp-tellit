import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useTellit } from '../contexts/TellitContext';
import './SendNoteTab.css';

const SendNoteTab: React.FC = () => {
  const { publicKey, connected } = useWallet();
  const { sendNote, networkInfo } = useTellit();
  
  const [receiverAddress, setReceiverAddress] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connected || !publicKey) {
      setErrorMessage('Please connect your wallet first');
      return;
    }

    if (!receiverAddress.trim()) {
      setErrorMessage('Please enter a receiver address');
      return;
    }

    if (!title.trim()) {
      setErrorMessage('Please enter a note title');
      return;
    }

    if (!content.trim()) {
      setErrorMessage('Please enter note content');
      return;
    }

    if (title.length > 50) {
      setErrorMessage('Title must be 50 characters or less');
      return;
    }

    if (content.length > 300) {
      setErrorMessage('Content must be 300 characters or less');
      return;
    }

    if (receiverAddress === publicKey.toString()) {
      setErrorMessage('You cannot send a note to yourself');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await sendNote(receiverAddress.trim(), title.trim(), content.trim());
      setSuccessMessage('Note sent successfully!');
      setReceiverAddress('');
      setTitle('');
      setContent('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to send note');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = () => {
    setReceiverAddress('');
    setTitle('');
    setContent('');
    setErrorMessage('');
    setSuccessMessage('');
  };

  if (!connected) {
    return (
      <div className="send-note-tab">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Send Note</h2>
          </div>
          <div className="connect-wallet-prompt">
            <p>Connect your Phantom wallet to send notes to others.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="send-note-tab">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Send Note</h2>
        </div>



        {successMessage && (
          <div className="success">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="error">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="send-note-form">
          <div className="form-group">
            <label htmlFor="receiver" className="form-label">
              Receiver Address *
            </label>
            <input
              type="text"
              id="receiver"
              className="form-input"
              value={receiverAddress}
              onChange={(e) => setReceiverAddress(e.target.value)}
              placeholder="Enter the recipient's Solana wallet address"
              disabled={isSubmitting}
            />
            <div className="form-help">
              Enter the Solana wallet address of the person you want to send a note to
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="title" className="form-label">
              Note Title *
            </label>
            <input
              type="text"
              id="title"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for your note"
              maxLength={50}
              disabled={isSubmitting}
            />
            <div className="form-help">
              {title.length}/50 characters
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="content" className="form-label">
              Note Content *
            </label>
            <textarea
              id="content"
              className="form-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note content here..."
              maxLength={300}
              disabled={isSubmitting}
            />
            <div className="form-help">
              {content.length}/300 characters
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn"
              onClick={handleClear}
              disabled={isSubmitting}
            >
              Clear
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !receiverAddress.trim() || !title.trim() || !content.trim()}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner"></span>
                  Sending...
                </>
              ) : (
                'Send Note'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SendNoteTab;
