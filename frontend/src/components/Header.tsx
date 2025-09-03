import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton, WalletDisconnectButton } from '@solana/wallet-adapter-react-ui';
import { useTellit } from '../contexts/TellitContext';
import './Header.css';

const Header: React.FC = () => {
  const { publicKey, connected } = useWallet();
  const { networkInfo } = useTellit();

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <div className="network-info">
            <span className="network-indicator"></span>
            <span className="network-name">Solana Devnet</span>
          </div>
        </div>
        
        <div className="header-right">
          {connected && publicKey && (
            <div className="wallet-info">
              <div className="wallet-address">
                {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
              </div>
            </div>
          )}
          
          <div className="wallet-buttons">
            {connected ? (
              <WalletDisconnectButton className="wallet-disconnect-button" />
            ) : (
              <WalletMultiButton className="wallet-connect-button" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;