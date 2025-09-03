import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletAdapter } from '@solana/wallet-adapter-base';
import { tellitService } from '../services/tellitService';
import { integrationLogger } from '../utils/integrationLogger';
import { TELLIT_PROGRAM_ID, NETWORK, RPC_ENDPOINT } from '../constants/programConfig';

// Re-export for backward compatibility
export { TELLIT_PROGRAM_ID, NETWORK };

// Types
export interface Note {
  author: string;
  receiver: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}



export interface NetworkInfo {
  cluster: string;
  programId: string;
  configPda: string;
}

interface TellitContextType {
  // Program state
  notes: Note[];
  loading: boolean;
  error: string | null;
  
  // Network info
  networkInfo: NetworkInfo;
  
  // Integration status
  isInitialized: boolean;
  integrationStatus: any;
  
  // Actions
  sendNote: (receiver: string, title: string, content: string) => Promise<void>;
  // editNote and reactToNote removed - keeping app simple

  fetchNotes: (forceRefresh?: boolean) => Promise<void>;
  getWalletBalance: (wallet: string) => Promise<number>;
  initializeService: () => Promise<void>;
  initializeProgram: () => Promise<void>;
  
  // Refresh controls
  lastFetchTime: number;
  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: (enabled: boolean) => void;
  manualRefresh: () => Promise<void>;
}

const TellitContext = createContext<TellitContextType | undefined>(undefined);

export const useTellit = () => {
  const context = useContext(TellitContext);
  if (!context) {
    throw new Error('useTellit must be used within a TellitProvider');
  }
  return context;
};

interface TellitProviderProps {
  children: ReactNode;
}

export const TellitProvider: React.FC<TellitProviderProps> = ({ children }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState(integrationLogger.getIntegrationStatus());
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  const { publicKey, connected, wallet } = useWallet();

  const networkInfo: NetworkInfo = {
    cluster: RPC_ENDPOINT,
    programId: TELLIT_PROGRAM_ID.toString(),
    configPda: tellitService.getConfigPda()[0].toString(),
  };

  // Initialize service when wallet connects
  const initializeService = async (retryCount: number = 0): Promise<void> => {
    const errorId = integrationLogger.generateErrorId('TellitContext', 'initializeService', 88);
    
    if (!connected || !publicKey || !wallet) {
      const error = new Error(`TELLIT_WALLET_CONNECTION_ERROR_${errorId}: Wallet not connected - connected: ${connected}, publicKey: ${!!publicKey}, wallet: ${!!wallet}`);
      integrationLogger.log('ERROR', 'TellitContext', 'initializeService', 'Wallet connection validation failed', {
        errorId,
        connected,
        hasPublicKey: !!publicKey,
        hasWallet: !!wallet,
        publicKeyValue: publicKey?.toString()
      }, error);
      throw error;
    }

    try {
      setLoading(true);
      setError(null);
      
      integrationLogger.log('INFO', 'TellitContext', 'initializeService', 'Initializing TellitService', {
        errorId,
        wallet: publicKey.toString(),
        walletName: (wallet as any)?.name || 'Unknown',
        retryCount
      });

      // The wallet object from useWallet contains the wallet adapter instance
      // We need to access the adapter property to get the actual wallet adapter
      const walletAdapter = (wallet as any)?.adapter || wallet;
      
      integrationLogger.log('DEBUG', 'TellitContext', 'initializeService', 'Using wallet adapter from useWallet hook', {
        errorId,
        walletAdapterPublicKey: walletAdapter?.publicKey?.toString(),
        useWalletPublicKey: publicKey.toString(),
        hasSignTransaction: !!walletAdapter?.signTransaction,
        hasSignAllTransactions: !!walletAdapter?.signAllTransactions,
        walletAdapterKeys: walletAdapter ? Object.keys(walletAdapter) : [],
        walletAdapterMethods: walletAdapter ? Object.getOwnPropertyNames(walletAdapter) : [],
        walletStructure: {
          hasAdapter: !!(wallet as any)?.adapter,
          walletKeys: wallet ? Object.keys(wallet) : [],
          walletMethods: wallet ? Object.getOwnPropertyNames(wallet) : []
        }
      });

      await tellitService.initialize(walletAdapter);
      setIsInitialized(true);
      
      integrationLogger.updateIntegrationStatus({
        walletConnected: true,
        backendConnected: true,
        lastSuccess: 'TellitService initialized successfully'
      });
      
      setIntegrationStatus(integrationLogger.getIntegrationStatus());
      
      // Fetch notes after initialization
      await fetchNotes();
      
    } catch (error) {
      const errorMessage = (error as Error).message;
      const catchErrorId = integrationLogger.generateErrorId('TellitContext', 'initializeService_catch', 140);
      
      // Retry initialization if it's a wallet-related error and we haven't retried too many times
      if (errorMessage.includes('Wallet public key not available') && retryCount < 3) {
        integrationLogger.log('WARN', 'TellitContext', 'initializeService', 'Retrying initialization', {
          errorId: catchErrorId,
          originalErrorId: errorId,
          error: errorMessage,
          retryCount: retryCount + 1
        });
        
        // Wait a bit longer before retrying
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
        return initializeService(retryCount + 1);
      }
      
      const finalError = new Error(`TELLIT_SERVICE_INIT_ERROR_${catchErrorId}: ${errorMessage}`);
      setError(finalError.message);
      integrationLogger.log('ERROR', 'TellitContext', 'initializeService', 'Failed to initialize service', {
        errorId: catchErrorId,
        originalErrorId: errorId,
        error: errorMessage,
        retryCount,
        connected,
        hasPublicKey: !!publicKey,
        hasWallet: !!wallet
      }, error as Error);
      throw finalError;
    } finally {
      setLoading(false);
    }
  };

  // Send a note
  const sendNote = async (receiver: string, title: string, content: string): Promise<void> => {
    if (!connected || !publicKey) {
      throw new Error('Wallet not connected');
    }

    if (!isInitialized) {
      throw new Error('TellitService not initialized');
    }

    // Duplicate detection is handled purely on-chain by PDA uniqueness
    // No frontend duplicate checking needed - let the blockchain handle it

    try {
      setLoading(true);
      setError(null);

      const receiverPubkey = new PublicKey(receiver);
      const transactionId = await tellitService.sendNote(publicKey, receiverPubkey, title, content);
      
      integrationLogger.log('INFO', 'TellitContext', 'sendNote', 'Note sent successfully', {
        transactionId,
        receiver,
        title
      });

      // Wait a moment for the blockchain to update, then refresh notes
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      await fetchNotes(true); // Force refresh to get updated notes
      
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      // Handle specific error types with user-friendly messages
      let finalErrorMessage = errorMessage;
      if (errorMessage.includes('TELLIT_DUPLICATE_NOTE_ERROR') || 
          errorMessage.includes('ConstraintSeeds') || 
          errorMessage.includes('account already in use') ||
          errorMessage.includes('already exists')) {
        finalErrorMessage = 'Note already exists. Please change the title or content.';
        setError(finalErrorMessage);
        integrationLogger.log('WARN', 'TellitContext', 'sendNote', 'Duplicate note attempt blocked by backend', {
          error: errorMessage,
          friendlyMessage: finalErrorMessage,
          receiver,
          title
        });
      } else {
        setError(finalErrorMessage);
        integrationLogger.log('ERROR', 'TellitContext', 'sendNote', 'Failed to send note', {
          error: errorMessage,
          receiver,
          title
        }, error as Error);
      }
      
      throw new Error(finalErrorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Edit note functionality removed - keeping app simple

  // React to a note




  // Fetch notes for the current user
  const fetchNotes = async (forceRefresh: boolean = false): Promise<void> => {
    if (!connected || !publicKey) {
      return;
    }

    if (!isInitialized) {
      return;
    }

    // Check if we should skip refresh based on timing
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime;
    const REFRESH_COOLDOWN = 5000; // 5 seconds minimum between fetches

    if (!forceRefresh && timeSinceLastFetch < REFRESH_COOLDOWN) {
      integrationLogger.log('DEBUG', 'TellitContext', 'fetchNotes', 'Skipping fetch due to cooldown', {
        timeSinceLastFetch,
        REFRESH_COOLDOWN
      });
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const fetchedNotes = await tellitService.getNotesForReceiver(publicKey);
      setNotes(fetchedNotes);
      setLastFetchTime(now);
      
      integrationLogger.log('INFO', 'TellitContext', 'fetchNotes', 'Notes fetched successfully', {
        noteCount: fetchedNotes.length,
        forceRefresh,
        timeSinceLastFetch
      });
      
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      // Handle rate limiting errors specifically
      if (errorMessage.includes('429')) {
        const userFriendlyError = 'Rate limit exceeded. Please wait a moment and try again.';
        setError(userFriendlyError);
        integrationLogger.log('WARN', 'TellitContext', 'fetchNotes', 'Rate limit error - will retry automatically', {
          error: errorMessage,
          userFriendlyError
        });
        
        // Auto-retry after 5 seconds for rate limit errors
        setTimeout(() => {
          if (connected && publicKey && isInitialized) {
            integrationLogger.log('INFO', 'TellitContext', 'fetchNotes', 'Auto-retrying after rate limit');
            fetchNotes(true); // Force refresh on retry
          }
        }, 5000);
      } else {
        setError(errorMessage);
        integrationLogger.log('ERROR', 'TellitContext', 'fetchNotes', 'Failed to fetch notes', {
          error: errorMessage
        }, error as Error);
      }
    } finally {
      setLoading(false);
    }
  };

  // Manual refresh method
  const manualRefresh = async (): Promise<void> => {
    await fetchNotes(true);
  };

  // Get wallet balance
  const getWalletBalance = async (wallet: string): Promise<number> => {
    try {
      console.log('TellitContext: Getting wallet balance for:', wallet);
      console.log('TellitContext: TellitService initialized:', tellitService.isReady());
      console.log('TellitContext: Context isInitialized:', isInitialized);
      
      // Wait for initialization if not ready
      if (!isInitialized || !tellitService.isReady()) {
        console.log('TellitContext: Service not ready, waiting for initialization...');
        // Wait for up to 10 seconds for initialization
        const maxWaitTime = 10000;
        const startTime = Date.now();
        
        while ((!isInitialized || !tellitService.isReady()) && (Date.now() - startTime) < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        if (!isInitialized || !tellitService.isReady()) {
          throw new Error('TellitService not initialized after waiting');
        }
        
        console.log('TellitContext: Service initialized, proceeding with balance request');
      }
      
      const walletPubkey = new PublicKey(wallet);
      const balance = await tellitService.getWalletBalance(walletPubkey);
      
      console.log('TellitContext: Retrieved balance:', balance);
      return balance;
    } catch (error) {
      console.error('TellitContext: Error getting wallet balance:', error);
      integrationLogger.log('ERROR', 'TellitContext', 'getWalletBalance', 'Failed to get wallet balance', {
        error: (error as Error).message,
        wallet
      }, error as Error);
      return 0;
    }
  };

  // Initialize the program
  const initializeProgram = async (): Promise<void> => {
    if (!connected || !publicKey) {
      throw new Error('Wallet not connected');
    }

    if (!isInitialized) {
      throw new Error('TellitService not initialized');
    }

    try {
      setLoading(true);
      setError(null);

      const transactionId = await tellitService.initializeProgram();
      
      integrationLogger.log('INFO', 'TellitContext', 'initializeProgram', 'Program initialized successfully', {
        transactionId
      });

      // Refresh notes after initialization
      await fetchNotes();
      
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(errorMessage);
      integrationLogger.log('ERROR', 'TellitContext', 'initializeProgram', 'Failed to initialize program', {
        error: errorMessage
      }, error as Error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Auto-initialize when wallet connects
  useEffect(() => {
    if (connected && publicKey && wallet && !isInitialized) {
      // Add a small delay to ensure wallet is fully ready
      const timer = setTimeout(() => {
        integrationLogger.log('INFO', 'TellitContext', 'useEffect', 'Attempting auto-initialization', {
          connected,
          publicKey: publicKey.toString(),
          walletName: (wallet as any)?.name,
          walletPublicKey: (wallet as any)?.publicKey?.toString()
        });
        
        initializeService().catch(error => {
          integrationLogger.log('ERROR', 'TellitContext', 'useEffect', 'Auto-initialization failed', {
            error: (error as Error).message,
            connected,
            publicKey: publicKey?.toString(),
            wallet: !!wallet,
            walletPublicKey: (wallet as any)?.publicKey?.toString()
          }, error as Error);
        });
      }, 1000); // 1 second delay

      return () => clearTimeout(timer);
    }
  }, [connected, publicKey, wallet, isInitialized]);

  // Update integration status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setIntegrationStatus(integrationLogger.getIntegrationStatus());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Auto-refresh timer (30 seconds)
  useEffect(() => {
    if (!autoRefreshEnabled || !connected || !isInitialized) {
      return;
    }

    const interval = setInterval(() => {
      integrationLogger.log('DEBUG', 'TellitContext', 'autoRefresh', 'Auto-refreshing notes', {
        autoRefreshEnabled,
        connected,
        isInitialized
      });
      fetchNotes();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, connected, isInitialized]);

  const value: TellitContextType = {
    notes,
    loading,
    error,
    networkInfo,
    isInitialized,
    integrationStatus,
    sendNote,
    // editNote and reactToNote removed - keeping app simple

    fetchNotes,
    getWalletBalance,
    initializeService,
    initializeProgram,
    lastFetchTime,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    manualRefresh,
  };

  return (
    <TellitContext.Provider value={value}>
      {children}
    </TellitContext.Provider>
  );
};
