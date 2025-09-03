/**
 * Tellit Service - Backend Integration Layer
 * 
 * This service provides complete integration with the Tellit Solana program
 * with comprehensive error handling, logging, and tracking.
 */

import { PublicKey, Connection, Keypair, SystemProgram, Transaction, VersionedTransaction } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import * as anchor from '@coral-xyz/anchor';
import { WalletAdapter } from '@solana/wallet-adapter-base';
import { TELLIT_PROGRAM_ID, RPC_ENDPOINT, CONFIG_SEED, MAX_TITLE_LENGTH, MAX_CONTENT_LENGTH } from '../constants/programConfig';
import { integrationLogger } from '../utils/integrationLogger';
import { getConfigPda } from '../utils/pdaUtils';
import { backendProxy, SendNoteRequest } from './backendProxy';
// Import IDL
import idlJson from '../idl/tellit.json';

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

class TellitService {
  private connection: Connection;
  private program: Program | null = null;
  private provider: AnchorProvider | null = null;
  private wallet: Wallet | null = null;
  private isInitialized: boolean = false;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue: boolean = false;
  private lastRequestTime: number = 0;
  private readonly REQUEST_DELAY = 1000; // 1 second between requests
  private methodNames: { [key: string]: string } = {};

  constructor() {
    this.connection = new Connection(RPC_ENDPOINT, 'confirmed');
    integrationLogger.log('INFO', 'TellitService', 'constructor', 'TellitService initialized', {
      network: RPC_ENDPOINT,
      programId: TELLIT_PROGRAM_ID.toString()
    });
  }

  /**
   * Rate-limited request execution to avoid 429 errors
   */
  private async executeWithRateLimit<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }

  /**
   * Process the request queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (timeSinceLastRequest < this.REQUEST_DELAY) {
        const delay = this.REQUEST_DELAY - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const request = this.requestQueue.shift();
      if (request) {
        try {
          await request();
        } catch (error) {
          integrationLogger.log('ERROR', 'TellitService', 'processQueue', 'Request failed in queue', {
            error: (error as Error).message
          }, error as Error);
        }
      }

      this.lastRequestTime = Date.now();
    }

    this.isProcessingQueue = false;
  }

  /**
   * Detect and store the correct method names from the program
   */
  private detectMethodNames(): void {
    if (!this.program?.methods) {
      integrationLogger.log('ERROR', 'TellitService', 'detectMethodNames', 'Program methods not available');
      return;
    }

    const availableMethods = Object.keys(this.program.methods);
    
    // Map logical names to actual method names
    const methodMappings = [
      { logical: 'sendNote', candidates: ['sendNote', 'send_note'] },
      { logical: 'sendNoteByContent', candidates: ['sendNoteByContent', 'send_note_by_content'] },
      { logical: 'reactToNote', candidates: ['reactToNote', 'react_to_note'] },
      { logical: 'reactToNoteByContent', candidates: ['reactToNoteByContent', 'react_to_note_by_content'] },
      // Edit note method removed - keeping app simple
      { logical: 'deleteNote', candidates: ['deleteNote', 'delete_note'] },
      { logical: 'deleteNoteByContent', candidates: ['deleteNoteByContent', 'delete_note_by_content'] },
      { logical: 'initialize', candidates: ['initialize'] }
    ];

    for (const mapping of methodMappings) {
      for (const candidate of mapping.candidates) {
        if (availableMethods.includes(candidate)) {
          this.methodNames[mapping.logical] = candidate;
          integrationLogger.log('DEBUG', 'TellitService', 'detectMethodNames', `Found method: ${mapping.logical} -> ${candidate}`);
          break;
        }
      }
    }

    integrationLogger.log('INFO', 'TellitService', 'detectMethodNames', 'Method names detected', {
      availableMethods,
      detectedMethods: this.methodNames
    });
  }

  /**
   * Get the correct method name for a logical operation
   */
  private getMethodName(logicalName: string): string {
    const methodName = this.methodNames[logicalName];
    if (!methodName) {
      throw new Error(`Method '${logicalName}' not found. Available methods: ${Object.keys(this.methodNames).join(', ')}`);
    }
    return methodName;
  }

  /**
   * Fetch notes with retry logic for rate limiting
   */
  private async fetchNotesWithRetry(receiver: PublicKey, maxRetries: number = 3): Promise<any[]> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        integrationLogger.log('DEBUG', 'TellitService', 'fetchNotesWithRetry', `Attempt ${attempt} to fetch notes`, {
          receiver: receiver.toString(),
          attempt
        });

        const noteAccounts = await (this.program as any).account.note.all([
          {
            memcmp: {
              offset: 8 + 32, // Skip discriminator and author field
              bytes: receiver.toBase58(),
            },
          },
        ]);

        integrationLogger.log('INFO', 'TellitService', 'fetchNotesWithRetry', 'Successfully fetched notes', {
          receiver: receiver.toString(),
          attempt,
          noteCount: noteAccounts.length
        });

        return noteAccounts;

      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError.message;
        
        integrationLogger.log('WARN', 'TellitService', 'fetchNotesWithRetry', `Attempt ${attempt} failed`, {
          receiver: receiver.toString(),
          attempt,
          error: errorMessage,
          isRateLimit: errorMessage.includes('429')
        });

        // If it's a rate limit error, wait longer before retry
        if (errorMessage.includes('429')) {
          const waitTime = Math.pow(2, attempt) * 2000; // Exponential backoff: 4s, 8s, 16s
          integrationLogger.log('INFO', 'TellitService', 'fetchNotesWithRetry', `Rate limited, waiting ${waitTime}ms before retry`, {
            receiver: receiver.toString(),
            attempt,
            waitTime
          });
          
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else if (attempt < maxRetries) {
          // For other errors, wait 1 second before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // If all retries failed, throw the last error
    throw new Error(`Failed to fetch notes after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Convert wallet adapter to Anchor wallet format
   */
  private createAnchorWallet(walletAdapter: any): Wallet {
    const errorId = integrationLogger.generateErrorId('TellitService', 'createAnchorWallet', 225);
    
    // Wait for wallet to be fully ready
    if (!walletAdapter) {
      const error = new Error(`TELLIT_WALLET_ADAPTER_ERROR_${errorId}: Wallet adapter not provided`);
      integrationLogger.log('ERROR', 'TellitService', 'createAnchorWallet', 'Wallet adapter not provided', {
        errorId,
        walletAdapter: !!walletAdapter
      }, error);
      throw error;
    }
    
    // Log the wallet adapter structure for debugging
    integrationLogger.log('DEBUG', 'TellitService', 'createAnchorWallet', 'Wallet adapter structure analysis', {
      errorId,
      walletAdapter: !!walletAdapter,
      hasPublicKey: !!walletAdapter.publicKey,
      hasSignTransaction: !!walletAdapter.signTransaction,
      hasSignAllTransactions: !!walletAdapter.signAllTransactions,
      walletKeys: walletAdapter ? Object.keys(walletAdapter) : [],
      walletMethods: walletAdapter ? Object.getOwnPropertyNames(walletAdapter) : [],
      walletPrototype: walletAdapter ? Object.getPrototypeOf(walletAdapter) : null,
      signTransactionType: typeof walletAdapter.signTransaction,
      signAllTransactionsType: typeof walletAdapter.signAllTransactions,
      walletAdapterConstructor: walletAdapter?.constructor?.name,
      walletAdapterPrototypeKeys: walletAdapter ? Object.keys(Object.getPrototypeOf(walletAdapter)) : []
    });
    
    // Check if we have the required properties on the original wallet adapter
    if (!walletAdapter.publicKey) {
      const error = new Error(`TELLIT_WALLET_PUBLIC_KEY_ERROR_${errorId}: Wallet public key not available - wallet may not be fully connected`);
      integrationLogger.log('ERROR', 'TellitService', 'createAnchorWallet', 'Wallet public key not available', {
        errorId,
        walletAdapter: !!walletAdapter,
        hasPublicKey: !!walletAdapter.publicKey,
        walletKeys: walletAdapter ? Object.keys(walletAdapter) : []
      }, error);
      throw error;
    }
    
    // Check if we have the required methods on the original wallet adapter
    if (!walletAdapter.signTransaction) {
      const error = new Error(`TELLIT_WALLET_SIGN_TRANSACTION_ERROR_${errorId}: Wallet signTransaction method not available - wallet adapter may not be properly connected`);
      integrationLogger.log('ERROR', 'TellitService', 'createAnchorWallet', 'Wallet signTransaction method not available', {
        errorId,
        hasSignTransaction: !!walletAdapter.signTransaction,
        walletMethods: walletAdapter ? Object.getOwnPropertyNames(walletAdapter) : []
      }, error);
      throw error;
    }
    
    if (!walletAdapter.signAllTransactions) {
      const error = new Error(`TELLIT_WALLET_SIGN_ALL_TRANSACTIONS_ERROR_${errorId}: Wallet signAllTransactions method not available - wallet adapter may not be properly connected`);
      integrationLogger.log('ERROR', 'TellitService', 'createAnchorWallet', 'Wallet signAllTransactions method not available', {
        errorId,
        hasSignAllTransactions: !!walletAdapter.signAllTransactions,
        walletMethods: walletAdapter ? Object.getOwnPropertyNames(walletAdapter) : []
      }, error);
      throw error;
    }

    integrationLogger.log('DEBUG', 'TellitService', 'createAnchorWallet', 'Wallet adapter validation successful', {
      errorId,
      publicKey: walletAdapter.publicKey.toString(),
      hasSignTransaction: !!walletAdapter.signTransaction,
      hasSignAllTransactions: !!walletAdapter.signAllTransactions
    });

    // Return the original wallet adapter directly - don't create a new object
    // This preserves the original context and methods
    return {
      publicKey: walletAdapter.publicKey,
      payer: walletAdapter.publicKey,
      signTransaction: walletAdapter.signTransaction.bind(walletAdapter),
      signAllTransactions: walletAdapter.signAllTransactions.bind(walletAdapter),
    };
  }

  /**
   * Initialize the service with wallet connection
   */
  async initialize(walletAdapter: any): Promise<void> {
    const startTime = Date.now();
    const requestId = integrationLogger.logRequest('initialize', { wallet: walletAdapter.publicKey?.toString() });

    try {
      // Comprehensive wallet debugging
      integrationLogger.log('DEBUG', 'TellitService', 'initialize', 'Wallet adapter received', {
        walletAdapter: !!walletAdapter,
        publicKey: walletAdapter.publicKey?.toString(),
        publicKeyType: typeof walletAdapter.publicKey,
        hasSignTransaction: !!walletAdapter.signTransaction,
        hasSignAllTransactions: !!walletAdapter.signAllTransactions,
        walletKeys: walletAdapter ? Object.keys(walletAdapter) : [],
        walletName: walletAdapter?.name,
        walletIcon: walletAdapter?.icon,
        walletUrl: walletAdapter?.url
      });

      integrationLogger.log('INFO', 'TellitService', 'initialize', 'Initializing TellitService with wallet', {
        wallet: walletAdapter.publicKey?.toString(),
        hasSignTransaction: !!walletAdapter.signTransaction,
        hasSignAllTransactions: !!walletAdapter.signAllTransactions
      });

      // Convert wallet adapter to Anchor wallet format
      const anchorWallet = this.createAnchorWallet(walletAdapter);

      // Store wallet for signing
      this.wallet = anchorWallet;

      // Create Anchor provider
      this.provider = new AnchorProvider(this.connection, anchorWallet, {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      });

      // Create program instance
      this.program = new Program(idlJson as any, this.provider);
      
      // Debug: Log program creation
      console.log('Program created:', {
        programId: this.program.programId.toString(),
        idlAddress: this.program.idl?.address,
        hasMethods: !!this.program.methods,
        methodCount: Object.keys(this.program.methods || {}).length,
        availableMethods: Object.keys(this.program.methods || {})
      });
      
      // Initialize backend proxy with program and provider
      backendProxy.initialize(this.program, this.provider);
      
      // Debug program creation
      const availableMethods = this.program?.methods ? Object.keys(this.program.methods) : [];
      const programInfo = {
        program: !!this.program,
        methods: !!this.program?.methods,
        availableMethods: availableMethods,
        programId: TELLIT_PROGRAM_ID.toString(),
        idlAddress: this.program?.idl?.address,
        idlInstructions: this.program?.idl?.instructions?.map((i: any) => i.name) || []
      };
      
      // Check all possible method name variations
      const methodChecks = {
        sendNote: !!this.program?.methods?.sendNote,
        send_note: !!this.program?.methods?.send_note,
        sendNoteByContent: !!this.program?.methods?.sendNoteByContent,
        send_note_by_content: !!this.program?.methods?.send_note_by_content,
        reactToNote: !!this.program?.methods?.reactToNote,
        react_to_note: !!this.program?.methods?.react_to_note,
        reactToNoteByContent: !!this.program?.methods?.reactToNoteByContent,
        react_to_note_by_content: !!this.program?.methods?.react_to_note_by_content,
        // Edit note methods removed - keeping app simple
        initialize: !!this.program?.methods?.initialize,
        deleteNote: !!this.program?.methods?.deleteNote,
        delete_note: !!this.program?.methods?.delete_note,
        deleteNoteByContent: !!this.program?.methods?.deleteNoteByContent,
        delete_note_by_content: !!this.program?.methods?.delete_note_by_content
      };
      
      integrationLogger.log('DEBUG', 'TellitService', 'initialize', 'Program created with detailed info', {
        ...programInfo,
        ...methodChecks
      });
      
      // Detect and store the correct method names
      this.detectMethodNames();
      
      this.isInitialized = true;
      
      const duration = Date.now() - startTime;
      integrationLogger.logBackendResponse('initialize', { wallet: walletAdapter.publicKey?.toString() }, {
        provider: !!this.provider,
        program: !!this.program,
        initialized: this.isInitialized
      }, undefined, duration, true);

      integrationLogger.updateIntegrationStatus({
        backendConnected: true,
        lastSuccess: 'TellitService initialized successfully'
      });

      integrationLogger.log('INFO', 'TellitService', 'initialize', 'TellitService initialization completed successfully', {
        duration,
        requestId
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorId = integrationLogger.generateErrorId('TellitService', 'initialize');
      
      integrationLogger.logBackendResponse('initialize', { wallet: walletAdapter.publicKey?.toString() }, undefined, error as Error, duration, false);
      integrationLogger.updateIntegrationStatus({
        backendConnected: false,
        lastError: `Initialization failed: ${(error as Error).message}`
      });

      integrationLogger.log('ERROR', 'TellitService', 'initialize', 'TellitService initialization failed', {
        error: (error as Error).message,
        duration,
        requestId,
        errorId
      }, error as Error);

      throw new Error(`TELLIT_SERVICE_INIT_ERROR_${errorId}: Failed to initialize TellitService - ${(error as Error).message}`);
    }
  }

  /**
   * Get the config PDA using centralized utility
   */
  getConfigPda(): [PublicKey, number] {
    return getConfigPda();
  }





  // Note: getNotePda method removed - ALL PDA generation now happens in backend

  // Note: getReactionPda method removed - ALL PDA generation now happens in backend

  /**
   * Initialize the program
   */
  async initializeProgram(): Promise<string> {
    const startTime = Date.now();
    const requestId = integrationLogger.logRequest('initializeProgram', {});

    try {
      if (!this.isInitialized || !this.program || !this.provider) {
        throw new Error('TellitService not initialized');
      }

      integrationLogger.log('INFO', 'TellitService', 'initializeProgram', 'Initializing program on blockchain', {});

      // Get PDAs
      const [configPda] = this.getConfigPda();
      const authority = this.provider.wallet.publicKey;

      // Validate program and methods
      if (!this.program) {
        throw new Error('Program not initialized');
      }
      
      if (!this.program.methods) {
        throw new Error('Program methods not available');
      }
      
      // Get the correct method name
      const initializeMethodName = this.getMethodName('initialize');
      
      if (!this.program.methods[initializeMethodName]) {
        throw new Error(`${initializeMethodName} method not available in program`);
      }

      // Initialize program using the correct method name
      const transactionId = await (this.program.methods as any)[initializeMethodName]()
        .accounts({
          config: configPda,
          authority: authority,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const duration = Date.now() - startTime;
      
      integrationLogger.logBlockchainTransaction('initializeProgram', transactionId, {}, {
        transactionId,
        configPda: configPda.toString(),
        authority: authority.toString()
      }, undefined, duration, true);

      integrationLogger.logBackendResponse('initializeProgram', {}, { transactionId }, undefined, duration, true);

      integrationLogger.updateIntegrationStatus({
        lastSuccess: `Program initialized successfully (TX: ${transactionId})`
      });

      integrationLogger.log('INFO', 'TellitService', 'initializeProgram', 'Program initialized successfully', {
        transactionId,
        duration,
        requestId
      });

      return transactionId;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorId = integrationLogger.generateErrorId('TellitService', 'initializeProgram');
      
      integrationLogger.logBackendResponse('initializeProgram', {}, undefined, error as Error, duration, false);

      integrationLogger.updateIntegrationStatus({
        lastError: `Program initialization failed: ${(error as Error).message}`
      });

      integrationLogger.log('ERROR', 'TellitService', 'initializeProgram', 'Failed to initialize program', {
        error: (error as Error).message,
        duration,
        requestId,
        errorId
      }, error as Error);

      throw new Error(`TELLIT_INITIALIZE_PROGRAM_ERROR_${errorId}: Failed to initialize program - ${(error as Error).message}`);
    }
  }

  /**
   * Send a note from author to receiver
   * Frontend sends raw inputs, Backend handles PDA derivation and Anchor calls
   */
  async sendNote(
    author: PublicKey,
    receiver: PublicKey,
    title: string,
    content: string
  ): Promise<string> {
    const startTime = Date.now();
    const requestId = integrationLogger.logRequest('sendNote', { 
      author: author.toString(), 
      receiver: receiver.toString(), 
      title, 
      content 
    });

    try {
      // Validate inputs
      if (title.length > MAX_TITLE_LENGTH) {
        throw new Error(`Title is too long (max ${MAX_TITLE_LENGTH} characters)`);
      }
      if (content.length > MAX_CONTENT_LENGTH) {
        throw new Error(`Content is too long (max ${MAX_CONTENT_LENGTH} characters)`);
      }
      if (author.equals(receiver)) {
        throw new Error('Cannot send note to yourself');
      }

      integrationLogger.log('INFO', 'TellitService', 'sendNote', 'Sending note via backend proxy', {
        author: author.toString(),
        receiver: receiver.toString(),
        title,
        content,
        contentLength: content.length,
        titleLength: title.length
      });

      // Frontend sends raw inputs to backend proxy
      // Backend handles PDA derivation, hashing, validation, and Anchor calls
      const request: SendNoteRequest = {
        title,
        content,
        authorWallet: author.toString(),
        receiverWallet: receiver.toString()
      };

      const result = await backendProxy.sendNote(request, this.wallet!);

      if (!result.success) {
        throw new Error(result.error || 'Failed to send note');
      }

      const duration = Date.now() - startTime;
      
      integrationLogger.logBlockchainTransaction('sendNote', result.transactionId!, {
        author: author.toString(),
        receiver: receiver.toString(),
        title,
        contentLength: content.length
      }, {
        transactionId: result.transactionId
      }, undefined, duration, true);

      integrationLogger.logBackendResponse('sendNote', { 
        author: author.toString(), 
        receiver: receiver.toString(), 
        title, 
        content 
      }, { transactionId: result.transactionId }, undefined, duration, true);

      integrationLogger.updateIntegrationStatus({
        lastSuccess: `Note sent successfully (TX: ${result.transactionId})`
      });

      integrationLogger.log('INFO', 'TellitService', 'sendNote', 'Note sent successfully via backend proxy', {
        transactionId: result.transactionId,
        duration,
        requestId
      });

      return result.transactionId!;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorId = integrationLogger.generateErrorId('TellitService', 'sendNote');
      const errorMessage = (error as Error).message;
      
      integrationLogger.logBackendResponse('sendNote', { 
        author: author.toString(), 
        receiver: receiver.toString(), 
        title, 
        content 
      }, undefined, error as Error, duration, false);

      integrationLogger.updateIntegrationStatus({
        lastError: `Send note failed: ${errorMessage}`
      });

      integrationLogger.log('ERROR', 'TellitService', 'sendNote', 'Failed to send note via backend proxy', {
        error: errorMessage,
        duration,
        requestId,
        errorId
      }, error as Error);

      throw new Error(errorMessage);
    }
  }

  // Edit note functionality removed - keeping app simple





  /**
   * Fetch a note account
   */
  async getNote(author: PublicKey, receiver: PublicKey): Promise<Note | null> {
    console.log('getNote called - integration pending:', { 
      author: author.toString(), 
      receiver: receiver.toString() 
    });
    // TODO: Implement when integration is confirmed
    return null;
  }



  /**
   * Get all notes for a specific receiver (for timeline functionality)
   * Frontend sends raw inputs, Backend handles PDA queries and data formatting
   */
  async getNotesForReceiver(receiver: PublicKey): Promise<Note[]> {
    const startTime = Date.now();
    const requestId = integrationLogger.logRequest('getNotesForReceiver', { 
      receiver: receiver.toString() 
    });

    try {
      integrationLogger.log('INFO', 'TellitService', 'getNotesForReceiver', 'Fetching notes via backend proxy', {
        receiver: receiver.toString()
      });

      // Frontend sends raw inputs to backend proxy
      // Backend handles PDA queries, data formatting, and returns structured data
      const result = await backendProxy.getNotesForReceiver(receiver.toString());

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch notes');
      }

      const notes = result.data || [];

      const duration = Date.now() - startTime;
      
      integrationLogger.logBackendResponse('getNotesForReceiver', { 
        receiver: receiver.toString() 
      }, { 
        noteCount: notes.length,
        notes: notes.map((note: any) => ({
          author: note.author,
          title: note.title,
          createdAt: note.created_at
        }))
      }, undefined, duration, true);

      integrationLogger.updateIntegrationStatus({
        lastSuccess: `Fetched ${notes.length} notes for receiver via backend proxy`
      });

      integrationLogger.log('INFO', 'TellitService', 'getNotesForReceiver', 'Successfully fetched notes via backend proxy', {
        receiver: receiver.toString(),
        noteCount: notes.length,
        duration,
        requestId
      });

      // Transform notes to match Note interface
      const transformedNotes: Note[] = notes.map((note: any) => ({
        author: note.author,
        receiver: note.receiver,
        title: note.title,
        content: note.content,
        likes: note.likes,
        dislikes: note.dislikes,
        createdAt: note.created_at,
        updatedAt: note.updated_at,
      }));

      return transformedNotes;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorId = integrationLogger.generateErrorId('TellitService', 'getNotesForReceiver');
      
      integrationLogger.logBackendResponse('getNotesForReceiver', { 
        receiver: receiver.toString() 
      }, undefined, error as Error, duration, false);

      integrationLogger.updateIntegrationStatus({
        lastError: `Failed to fetch notes: ${(error as Error).message}`
      });

      integrationLogger.log('ERROR', 'TellitService', 'getNotesForReceiver', 'Failed to fetch notes via backend proxy', {
        error: (error as Error).message,
        duration,
        requestId,
        errorId
      }, error as Error);

      throw new Error(`TELLIT_GET_NOTES_ERROR_${errorId}: Failed to fetch notes - ${(error as Error).message}`);
    }
  }

  /**
   * Get network information
   */
  getNetworkInfo(): NetworkInfo {
    const [configPda] = this.getConfigPda();
    return {
      cluster: RPC_ENDPOINT,
      programId: TELLIT_PROGRAM_ID.toString(),
      configPda: configPda.toString(),
    };
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(wallet: PublicKey): Promise<number> {
    try {
      const requestId = Math.random().toString(36).substr(2, 9);
      console.log(`TellitService [${requestId}]: Getting balance for wallet:`, wallet.toString());
      console.log(`TellitService [${requestId}]: Connection endpoint:`, this.connection.rpcEndpoint);
      console.log(`TellitService [${requestId}]: Service initialized:`, this.isInitialized);
      
      // Use 'confirmed' commitment to ensure we get the most recent balance
      const lamports = await this.connection.getBalance(wallet, 'confirmed');
      console.log(`TellitService [${requestId}]: Raw balance in lamports:`, lamports);
      
      const solBalance = lamports / 1e9; // Convert lamports to SOL
      console.log(`TellitService [${requestId}]: Converted balance in SOL:`, solBalance);
      
      // Validate the balance is reasonable (not negative, not extremely large)
      if (solBalance < 0) {
        console.warn(`TellitService [${requestId}]: Negative balance detected:`, solBalance);
        return 0;
      }
      
      if (solBalance > 1000000) { // More than 1M SOL seems unreasonable for testing
        console.warn(`TellitService [${requestId}]: Unusually large balance detected:`, solBalance);
      }
      
      return solBalance;
    } catch (error) {
      console.error('TellitService: Error getting wallet balance:', error);
      integrationLogger.log('ERROR', 'TellitService', 'getWalletBalance', 'Failed to get wallet balance', {
        error: (error as Error).message,
        wallet: wallet.toString()
      }, error as Error);
      return 0;
    }
  }

  /**
   * Check if service is ready for integration
   */
  isReady(): boolean {
    return this.isInitialized && this.program !== null && this.provider !== null;
  }

  /**
   * Clear the request queue (useful for resetting after errors)
   */
  clearRequestQueue(): void {
    this.requestQueue = [];
    this.isProcessingQueue = false;
    integrationLogger.log('INFO', 'TellitService', 'clearRequestQueue', 'Request queue cleared');
  }

  /**
   * Get queue status for debugging
   */
  getQueueStatus(): { queueLength: number; isProcessing: boolean; lastRequestTime: number } {
    return {
      queueLength: this.requestQueue.length,
      isProcessing: this.isProcessingQueue,
      lastRequestTime: this.lastRequestTime
    };
  }

  /**
   * Get detected method names for debugging
   */
  getDetectedMethodNames(): { [key: string]: string } {
    return { ...this.methodNames };
  }

  /**
   * Get connection status
   */
  async getConnectionStatus(): Promise<boolean> {
    try {
      const version = await this.connection.getVersion();
      return version !== null;
    } catch (error) {
      console.error('Connection error:', error);
      return false;
    }
  }
}

// Export singleton instance
export const tellitService = new TellitService();
export default tellitService;
