/**
 * Program Configuration Constants
 * 
 * Centralized configuration for the Tellit program to avoid circular dependencies
 */

import { PublicKey } from '@solana/web3.js';

// Program configuration
export const TELLIT_PROGRAM_ID = new PublicKey('BnT3T9mtNjXBEELoggRSQYN5gJhAb3Rvut3sH8mrMP6J');
export const NETWORK = 'devnet';
export const RPC_ENDPOINT = 'https://api.devnet.solana.com';

// PDA seeds
export const CONFIG_SEED = 'config';
// NOTE_SEED and REACTION_SEED removed - backend handles all note/reaction PDA generation

// Validation limits
export const MAX_TITLE_LENGTH = 50;
export const MAX_CONTENT_LENGTH = 300;
