/**
 * Backend Server for Tellit Solana Program
 * 
 * This server maintains the key principle:
 * Frontend → submits raw inputs (wallet IDs, title, note, emoji)
 * Backend → derives PDA + validates uniqueness + makes Anchor calls
 */

const express = require('express');
const cors = require('cors');
const { PublicKey, Connection, Keypair, SystemProgram } = require('@solana/web3.js');
const { Program, AnchorProvider, Wallet } = require('@coral-xyz/anchor');
const { keccak256 } = require('js-sha3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Solana configuration
const RPC_ENDPOINT = process.env.ANCHOR_PROVIDER_URL || 'http://127.0.0.1:8899';
const TELLIT_PROGRAM_ID = new PublicKey('BnT3T9mtNjXBEELoggRSQYN5gJhAb3Rvut3sH8mrMP6J');
const CONFIG_SEED = 'config';

// Load IDL first
const idl = require('./idl.json'); // You'll need to copy the IDL here

// Initialize connection and program
const connection = new Connection(RPC_ENDPOINT, 'confirmed');
const wallet = new Wallet(Keypair.generate()); // In production, use proper wallet
const provider = new AnchorProvider(connection, wallet, {});
const program = new Program(idl, provider);

/**
 * Calculate note PDA using the same logic as the Solana program
 */
function calculateNotePda(author, receiver, title, content) {
  const contentString = title + content;
  const contentHash = Buffer.from(keccak256(contentString), 'hex');
  const [notePda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("note"),
      new PublicKey(author).toBuffer(),
      new PublicKey(receiver).toBuffer(),
      contentHash
    ],
    TELLIT_PROGRAM_ID
  );
  return notePda;
}

/**
 * Calculate reaction PDA
 */
function calculateReactionPda(notePda, reactor) {
  const [reactionPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("reaction"),
      notePda.toBuffer(),
      new PublicKey(reactor).toBuffer()
    ],
    TELLIT_PROGRAM_ID
  );
  return reactionPda;
}

/**
 * Get config PDA
 */
function getConfigPda() {
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    TELLIT_PROGRAM_ID
  );
  return configPda;
}

// API Routes

/**
 * POST /api/send-note
 * Frontend sends raw inputs, Backend handles PDA derivation and Anchor calls
 */
app.post('/api/send-note', async (req, res) => {
  try {
    const { title, content, authorWallet, receiverWallet } = req.body;

    // Validate inputs
    if (!title || !content || !authorWallet || !receiverWallet) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, content, authorWallet, receiverWallet'
      });
    }

    if (title.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Title is too long (max 100 characters)'
      });
    }

    if (content.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Content is too long (max 1000 characters)'
      });
    }

    if (authorWallet === receiverWallet) {
      return res.status(400).json({
        success: false,
        error: 'Cannot send note to yourself'
      });
    }

    // Backend derives PDA and makes Anchor call
    const author = new PublicKey(authorWallet);
    const receiver = new PublicKey(receiverWallet);
    const notePda = calculateNotePda(author, receiver, title, content);
    const configPda = getConfigPda();

    // Make Anchor call with derived PDA
    const transactionId = await program.methods.sendNoteByContent(title, content)
      .accounts({
        note: notePda,
        config: configPda,
        author: author,
        receiver: receiver,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    res.json({
      success: true,
      transactionId: transactionId
    });

  } catch (error) {
    console.error('Error sending note:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/react-to-note
 * Frontend sends raw inputs, Backend handles PDA derivation and Anchor calls
 */
app.post('/api/react-to-note', async (req, res) => {
  try {
    const { title, content, authorWallet, receiverWallet, reactorWallet, reactionType } = req.body;

    // Validate inputs
    if (!title || !content || !authorWallet || !receiverWallet || !reactorWallet || !reactionType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    if (!['like', 'dislike'].includes(reactionType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reaction type. Must be "like" or "dislike"'
      });
    }

    // Backend derives PDAs and makes Anchor call
    const noteAuthor = new PublicKey(authorWallet);
    const noteReceiver = new PublicKey(receiverWallet);
    const reactor = new PublicKey(reactorWallet);
    
    const notePda = calculateNotePda(noteAuthor, noteReceiver, title, content);
    const reactionPda = calculateReactionPda(notePda, reactor);
    
    const programReactionType = reactionType === 'like' ? { like: {} } : { dislike: {} };

    // Make Anchor call with derived PDAs
    const transactionId = await program.methods.reactToNoteByContent(
      title, 
      content, 
      programReactionType
    )
      .accounts({
        note: notePda,
        reaction: reactionPda,
        reactor: reactor,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    res.json({
      success: true,
      transactionId: transactionId
    });

  } catch (error) {
    console.error('Error reacting to note:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/delete-note
 * Frontend sends raw inputs, Backend handles PDA derivation and Anchor calls
 */
app.post('/api/delete-note', async (req, res) => {
  try {
    const { title, content, authorWallet, receiverWallet, deleterWallet } = req.body;

    // Validate inputs
    if (!title || !content || !authorWallet || !receiverWallet || !deleterWallet) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Backend derives PDA and makes Anchor call
    const deleter = new PublicKey(deleterWallet);
    const configPda = getConfigPda();

    // Make Anchor call
    const transactionId = await program.methods.deleteNoteByContent(title, content)
      .accounts({
        config: configPda,
        deleter: deleter,
      })
      .rpc();

    res.json({
      success: true,
      transactionId: transactionId
    });

  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/get-notes/:receiverWallet
 * Backend handles PDA queries and returns formatted data
 */
app.get('/api/get-notes/:receiverWallet', async (req, res) => {
  try {
    const { receiverWallet } = req.params;

    if (!receiverWallet) {
      return res.status(400).json({
        success: false,
        error: 'Missing receiverWallet parameter'
      });
    }

    // Backend queries all notes for receiver
    const receiver = new PublicKey(receiverWallet);
    const noteAccounts = await program.account.note.all([
      {
        memcmp: {
          offset: 8 + 32, // Skip discriminator and author
          bytes: receiver.toBase58(),
        },
      },
    ]);

    // Format data for frontend
    const notes = noteAccounts.map((account) => {
      const noteData = account.account;
      return {
        author: noteData.author.toString(),
        receiver: noteData.receiver.toString(),
        title: noteData.title,
        content: noteData.content,
        likes: parseInt(noteData.likes.toString()),
        dislikes: parseInt(noteData.dislikes.toString()),
        createdAt: Number(noteData.created_at),
        updatedAt: Number(noteData.updated_at),
      };
    });

    // Sort by creation time (newest first)
    notes.sort((a, b) => b.createdAt - a.createdAt);

    res.json({
      success: true,
      notes: notes
    });

  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend server is running',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 RPC Endpoint: ${RPC_ENDPOINT}`);
  console.log(`🔑 Program ID: ${TELLIT_PROGRAM_ID.toString()}`);
  console.log(`✅ Key Principle: Frontend → raw inputs, Backend → PDA derivation + Anchor calls`);
});

module.exports = app;
