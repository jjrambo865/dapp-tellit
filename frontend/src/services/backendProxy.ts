/**
 * Backend Proxy Service
 * 
 * This service maintains the key principle:
 * Frontend → submits raw inputs (wallet IDs, title, note, emoji)
 * Backend → derives PDA + validates uniqueness + makes Anchor calls
 * 
 * This is a LOCAL backend proxy that handles PDA derivation and Anchor calls
 * while maintaining the architectural separation.
 */

import { PublicKey, Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { keccak256 } from 'js-sha3';

export interface SendNoteRequest {
  title: string;
  content: string;
  authorWallet: string;
  receiverWallet: string;
}





export interface BackendResponse {
  success: boolean;
  transactionId?: string;
  data?: any;
  error?: string;
}

class BackendProxy {
  private program: any | null = null;
  private provider: AnchorProvider | null = null;

  constructor() {
    // This will be initialized by the TellitService
  }

  /**
   * Initialize the backend proxy with program and provider
   */
  initialize(program: any, provider: AnchorProvider) {
    this.program = program;
    this.provider = provider;
    
    // Debug: Log program initialization
    console.log('Backend proxy initialized with program:', {
      programId: program.programId.toString(),
      hasMethods: !!program.methods,
      methodCount: Object.keys(program.methods || {}).length,
      availableMethods: Object.keys(program.methods || {})
    });
  }

  /**
   * Initialize the program (required before using other instructions)
   */
  async initializeProgram(): Promise<BackendResponse> {
    try {
      if (!this.program) {
        throw new Error('Backend proxy not initialized');
      }

      const configPda = this.getConfigPda();
      const authority = this.provider!.wallet.publicKey;

      console.log('Initializing program with:', {
        configPda: configPda.toString(),
        authority: authority.toString(),
        systemProgram: SystemProgram.programId.toString()
      });

      // For frontend with wallet adapters (Phantom), use .rpc() without .signers()
      const transactionId = await this.program.methods.initialize()
        .accounts({
          config: configPda,
          authority: authority,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return {
        success: true,
        transactionId: transactionId
      };
    } catch (error: any) {
      console.error('Program initialization failed:', error);
      
      // Check if the error is because the account is already initialized
      const errorMessage = error.message || '';
      if (errorMessage.includes('already in use') || 
          errorMessage.includes('already initialized') ||
          errorMessage.includes('AccountAlreadyInitialized')) {
        console.log('Program already initialized, continuing...');
        return {
          success: true,
          transactionId: 'already-initialized'
        };
      }
      
      return {
        success: false,
        error: error.message || 'Program initialization failed'
      };
    }
  }

  /**
   * Calculate note PDA using the same logic as the Solana program
   */
  private calculateNotePda(author: PublicKey, receiver: PublicKey, title: string, content: string): PublicKey {
    const contentHash = keccak256(title + content);
    const [notePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('note'),
        author.toBuffer(),
        receiver.toBuffer(),
        Buffer.from(contentHash, 'hex')
      ],
      this.program!.programId
    );
    return notePda;
  }



  /**
   * Get config PDA
   */
  private getConfigPda(): PublicKey {
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      this.program!.programId
    );
    return configPda;
  }

  /**
   * Send note - Frontend sends raw inputs, Backend handles PDA derivation and Anchor calls
   */
  async sendNote(request: SendNoteRequest, signer: Wallet): Promise<BackendResponse> {
    try {
      if (!this.program) {
        throw new Error('Backend proxy not initialized');
      }

      // Initialize program first if needed
      console.log('Initializing program...');
      const initResult = await this.initializeProgram();
      if (!initResult.success) {
        console.log('Program initialization failed:', initResult.error);
        // Don't return error if it's already initialized
        if (!initResult.error?.includes('already initialized') && !initResult.error?.includes('already in use')) {
          return initResult;
        }
      }
      console.log('Program initialization completed');

      // Debug: Log available methods
      console.log('Available program methods:', Object.keys(this.program.methods || {}));
      console.log('Looking for sendNoteByContent method:', !!this.program.methods?.sendNoteByContent);
      console.log('Program object details:', {
        programId: this.program.programId.toString(),
        hasMethods: !!this.program.methods,
        methodsType: typeof this.program.methods,
        methodsKeys: this.program.methods ? Object.keys(this.program.methods) : 'no methods',
        sendNoteByContentType: typeof this.program.methods?.sendNoteByContent,
        sendNoteByContentExists: !!this.program.methods?.sendNoteByContent
      });
      
      // Test if we can access the method
      if (!this.program.methods?.sendNoteByContent) {
        console.error('sendNoteByContent method not found! Available methods:', Object.keys(this.program.methods || {}));
        return {
          success: false,
          error: 'sendNoteByContent method not found in program'
        };
      }

      // Backend validates inputs
      if (request.title.length > 50) {
        return {
          success: false,
          error: 'Title is too long (max 50 characters)'
        };
      }

      if (request.content.length > 300) {
        return {
          success: false,
          error: 'Content is too long (max 300 characters)'
        };
      }

      if (request.authorWallet === request.receiverWallet) {
        return {
          success: false,
          error: 'Cannot send note to yourself'
        };
      }

      // Backend derives PDA
      const author = new PublicKey(request.authorWallet);
      const receiver = new PublicKey(request.receiverWallet);
      const notePda = this.calculateNotePda(author, receiver, request.title, request.content);
      const configPda = this.getConfigPda();

      // Ensure the author matches the wallet's public key (required for signing)
      const walletPublicKey = this.provider!.wallet.publicKey;
      if (!author.equals(walletPublicKey)) {
        return {
          success: false,
          error: 'Author wallet must match the connected wallet for signing'
        };
      }

      console.log('Backend proxy sendNote - Account details:', {
        notePda: notePda.toString(),
        configPda: configPda.toString(),
        author: author.toString(),
        receiver: receiver.toString(),
        systemProgram: this.program.programId.toString(),
        walletPublicKey: walletPublicKey.toString(),
        authorMatchesWallet: author.equals(walletPublicKey)
      });

      // Backend makes Anchor call
      console.log('About to call sendNoteByContent with:', {
        title: request.title,
        content: request.content,
        accounts: {
          note: notePda.toString(),
          config: configPda.toString(),
          author: author.toString(),
          receiver: receiver.toString(),
          systemProgram: SystemProgram.programId.toString()
        }
      });
      
      // For frontend with wallet adapters (Phantom), use .rpc() without .signers()
      const transactionId = await this.program.methods.sendNoteByContent(request.title, request.content)
        .accounts({
          note: notePda,
          config: configPda,
          author: author,
          receiver: receiver,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return {
        success: true,
        transactionId: transactionId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }





  /**
   * Get notes for receiver - Frontend sends raw inputs, Backend handles PDA derivation and Anchor calls
   */
  async getNotesForReceiver(receiverWallet: string): Promise<BackendResponse> {
    try {
      if (!this.program) {
        throw new Error('Backend proxy not initialized');
      }

      const receiver = new PublicKey(receiverWallet);
      
      // Backend queries accounts
      const notes = await this.program.account.note.all([
        {
          memcmp: {
            offset: 8 + 32, // Skip discriminator and author
            bytes: receiver.toBase58(),
          },
        },
      ]);

      // Backend processes and returns data
      const notesData = notes.map((note: any) => {
        // Debug: Log the raw timestamp values
        console.log('Raw timestamp values:', {
          created_at: note.account.created_at,
          created_at_type: typeof note.account.created_at,
          updated_at: note.account.updated_at,
          updated_at_type: typeof note.account.updated_at
        });

        // Convert timestamps properly
        let created_at: number;
        let updated_at: number;

        // Handle undefined timestamps (notes created before proper initialization)
        if (note.account.created_at === undefined || note.account.created_at === null) {
          created_at = Math.floor(Date.now() / 1000); // Current timestamp as fallback
          console.warn('Note has undefined created_at, using current timestamp as fallback');
        } else if (typeof note.account.created_at === 'bigint') {
          created_at = Number(note.account.created_at);
        } else if (typeof note.account.created_at === 'object' && note.account.created_at.toNumber) {
          created_at = note.account.created_at.toNumber();
        } else {
          created_at = Number(note.account.created_at);
        }

        if (note.account.updated_at === undefined || note.account.updated_at === null) {
          updated_at = Math.floor(Date.now() / 1000); // Current timestamp as fallback
          console.warn('Note has undefined updated_at, using current timestamp as fallback');
        } else if (typeof note.account.updated_at === 'bigint') {
          updated_at = Number(note.account.updated_at);
        } else if (typeof note.account.updated_at === 'object' && note.account.updated_at.toNumber) {
          updated_at = note.account.updated_at.toNumber();
        } else {
          updated_at = Number(note.account.updated_at);
        }

        console.log('Converted timestamps:', { created_at, updated_at });

        return {
          title: note.account.title,
          content: note.account.content,
          author: note.account.author.toString(),
          receiver: note.account.receiver.toString(),
          created_at,
          updated_at,
        };
      });

      return {
        success: true,
        data: notesData
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const backendProxy = new BackendProxy();
export default backendProxy;
