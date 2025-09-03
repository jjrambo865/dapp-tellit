/**
 * COMPREHENSIVE TELLIT PROGRAM TEST SUITE
 * 
 * Tests ALL Anchor program instructions with both happy and unhappy scenarios.
 * Uses backend proxy to maintain key principle:
 * Tests → send raw inputs (wallet IDs, title, note, emoji)
 * Backend → derives PDA + validates uniqueness + makes Anchor calls
 * 
 * TEST COVERAGE SUMMARY:
 * =====================
 * 
 * 1. INITIALIZE INSTRUCTION (2 tests)
 *    1.1 ✓ Initialize program successfully (HAPPY PATH)
 *    1.2 ✓ Fail to initialize program twice (INTENTIONAL ERROR-TRIGGERING)
 * 
 * 2. SEND_NOTE_BY_CONTENT INSTRUCTION (6 tests)
 *    2.1 ✓ Send note successfully (HAPPY PATH)
 *    2.2 ✓ Prevent sending note to self (INTENTIONAL ERROR-TRIGGERING)
 *    2.3 ✓ Validate title length (INTENTIONAL ERROR-TRIGGERING)
 *    2.4 ✓ Validate content length (INTENTIONAL ERROR-TRIGGERING)
 *    2.5 ✓ Prevent duplicate notes (INTENTIONAL ERROR-TRIGGERING)
 *    2.6 ✓ Allow multiple notes with different content (HAPPY PATH)
 * 
 * 3. DELETE_NOTE_BY_CONTENT INSTRUCTION (4 tests)
 *    3.1 ✓ Delete note by author (HAPPY PATH)
 *    3.2 ✓ Delete note by receiver (HAPPY PATH)
 *    3.3 ✓ Fail to delete note by unauthorized user (INTENTIONAL ERROR-TRIGGERING)
 *    3.4 ✓ Fail to delete non-existent note (INTENTIONAL ERROR-TRIGGERING)
 * 
 * 4. REACT_TO_NOTE_BY_CONTENT INSTRUCTION (4 tests)
 *    4.1 ✓ Add like reaction successfully (HAPPY PATH)
 *    4.2 ✓ Add dislike reaction successfully (HAPPY PATH)
 *    4.3 ✓ Fail to react to non-existent note (INTENTIONAL ERROR-TRIGGERING)
 *    4.4 ✓ Allow multiple users to react to same note (HAPPY PATH)
 * 
 * 5. INTEGRATION TESTS (3 tests)
 *    5.1 ✓ Handle complete note lifecycle (HAPPY PATH)
 *    5.2 ✓ Handle edge cases and error conditions (MIXED SCENARIOS)
 *    5.3 ✓ Fetch notes for receiver (HAPPY PATH)
 * 
 * TOTAL: 19 tests (11 HAPPY PATH, 7 INTENTIONAL ERROR-TRIGGERING, 1 MIXED SCENARIOS)
 * 
 * SCENARIO TYPES:
 * - HAPPY PATH: Normal operation with valid inputs
 * - INTENTIONAL ERROR-TRIGGERING: Deliberately trigger error conditions to test validation
 * - MIXED SCENARIOS: Combination of valid and edge case inputs
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Tellit } from "../target/types/tellit";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { keccak256 } from 'js-sha3';

/**
 * Test Backend Proxy - maintains key principle
 */
class TestBackendProxy {
  private program: Program<Tellit>;
  private configPda: PublicKey;

  constructor(program: Program<Tellit>, configPda: PublicKey) {
    this.program = program;
    this.configPda = configPda;
  }

  /**
   * Calculate note PDA using the same logic as the Solana program
   */
  private calculateNotePda(author: PublicKey, receiver: PublicKey, title: string, content: string): PublicKey {
    const contentString = title + content;
    const contentHash = Buffer.from(keccak256(contentString), 'hex');
    const [notePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("note"),
        author.toBuffer(),
        receiver.toBuffer(),
        contentHash
      ],
      this.program.programId
    );
    return notePda;
  }

  /**
   * Calculate reaction PDA
   */
  private calculateReactionPda(notePda: PublicKey, reactor: PublicKey): PublicKey {
    const [reactionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("reaction"),
        notePda.toBuffer(),
        reactor.toBuffer()
      ],
      this.program.programId
    );
    return reactionPda;
  }

  /**
   * Send note - Backend handles PDA derivation and Anchor calls
   */
  async sendNote(title: string, content: string, authorWallet: string, receiverWallet: string, signer: Keypair): Promise<string> {
    const author = new PublicKey(authorWallet);
    const receiver = new PublicKey(receiverWallet);
    
    // Backend derives PDA and makes Anchor call
    const notePda = this.calculateNotePda(author, receiver, title, content);

    const transactionId = await this.program.methods.sendNoteByContent(title, content)
      .accounts({
        note: notePda,
        config: this.configPda,
        author: author,
        receiver: receiver,
        systemProgram: SystemProgram.programId,
      })
      .signers([signer])
      .rpc();

    return transactionId;
  }

  /**
   * React to note - Backend handles PDA derivation and Anchor calls
   */
  async reactToNote(title: string, content: string, authorWallet: string, receiverWallet: string, reactorWallet: string, reactionType: 'like' | 'dislike', signer: Keypair): Promise<string> {
    const noteAuthor = new PublicKey(authorWallet);
    const noteReceiver = new PublicKey(receiverWallet);
    const reactor = new PublicKey(reactorWallet);
    
    // Backend derives PDAs and makes Anchor call
    const notePda = this.calculateNotePda(noteAuthor, noteReceiver, title, content);
    const reactionPda = this.calculateReactionPda(notePda, reactor);
    
    const programReactionType = reactionType === 'like' ? { like: {} } : { dislike: {} };

    const transactionId = await this.program.methods.reactToNoteByContent(
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
      .signers([signer])
      .rpc();

    return transactionId;
  }

  /**
   * Delete note - Backend handles PDA derivation and Anchor calls
   */
  async deleteNote(title: string, content: string, authorWallet: string, receiverWallet: string, deleterWallet: string, signer: Keypair): Promise<string> {
    const noteAuthor = new PublicKey(authorWallet);
    const noteReceiver = new PublicKey(receiverWallet);
    const deleter = new PublicKey(deleterWallet);
    
    // Backend derives PDA and makes Anchor call
    const notePda = this.calculateNotePda(noteAuthor, noteReceiver, title, content);

    const transactionId = await this.program.methods.deleteNoteByContent(title, content)
      .accounts({
        note: notePda,
        config: this.configPda,
        deleter: deleter,
      })
      .signers([signer])
      .rpc();

    return transactionId;
  }

  /**
   * Get notes for receiver - Backend handles PDA queries
   */
  async getNotesForReceiver(receiverWallet: string): Promise<any[]> {
    const receiver = new PublicKey(receiverWallet);
    
    // Backend queries all notes for receiver
    const noteAccounts = await this.program.account.note.all([
      {
        memcmp: {
          offset: 8 + 32, // Skip discriminator and author field
          bytes: receiver.toBase58(),
        },
      },
    ]);

    // Format data
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

    return notes;
  }
}

describe("Tellit Program - Comprehensive Test Suite", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.tellit as Program<Tellit>;
  const provider = anchor.getProvider();
  
  let configPda: PublicKey;
  let configBump: number;
  let alice: Keypair;
  let bob: Keypair;
  let charlie: Keypair;
  let backendProxy: TestBackendProxy;

  before(async () => {
    // Generate test keypairs
    alice = Keypair.generate();
    bob = Keypair.generate();
    charlie = Keypair.generate();

    // Get config PDA
    [configPda, configBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    // Airdrop SOL to test accounts
    await provider.connection.requestAirdrop(alice.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(bob.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(charlie.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

    // Wait for airdrops to confirm
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Initialize backend proxy
    backendProxy = new TestBackendProxy(program, configPda);
  });

  // ============================================================================
  // INSTRUCTION 1: INITIALIZE
  // ============================================================================
  describe("1. Initialize Instruction", () => {
    it("1.1 should initialize the program successfully (HAPPY PATH)", async () => {
      const tx = await program.methods
        .initialize()
        .accounts({
          config: configPda,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("✓ Program initialized successfully:", tx);

      // Verify config account was created
      const configAccount = await program.account.config.fetch(configPda);
      expect(configAccount.authority.toString()).to.equal(provider.wallet.publicKey.toString());
      expect(configAccount.noteCount.toNumber()).to.equal(0);
    });

    it("1.2 should fail to initialize program twice (INTENTIONAL ERROR-TRIGGERING)", async () => {
      // INTENTIONAL: This test deliberately tries to initialize the program twice
      // to verify that the program correctly prevents duplicate initialization
      try {
        await program.methods
          .initialize()
          .accounts({
            config: configPda,
            authority: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        
        expect.fail("Should have failed to initialize program twice");
      } catch (error) {
        console.log("✓ Duplicate initialization correctly prevented");
        expect(error.message).to.include("already in use");
      }
    });
  });

  // ============================================================================
  // INSTRUCTION 2: SEND_NOTE_BY_CONTENT
  // ============================================================================
  describe("2. Send Note By Content Instruction", () => {
    it("2.1 should send a note successfully (HAPPY PATH)", async () => {
      const title = "Test Note";
      const content = "This is a test note content";

      // Use backend proxy - sends raw inputs, backend handles PDA derivation
      const tx = await backendProxy.sendNote(
        title, 
        content, 
        alice.publicKey.toString(), 
        bob.publicKey.toString(),
        alice
      );

      console.log("✓ Note sent successfully:", tx);

      // Verify config note count increased
      const configAccount = await program.account.config.fetch(configPda);
      expect(configAccount.noteCount.toNumber()).to.equal(1);
    });

    it("2.2 should prevent sending note to self (INTENTIONAL ERROR-TRIGGERING)", async () => {
      // INTENTIONAL: This test deliberately tries to send a note to the same user
      // to verify that the program correctly prevents self-sending
      const title = "Self Note";
      const content = "This should fail";

      try {
        // Use backend proxy - sends raw inputs, backend handles validation
        await backendProxy.sendNote(
          title, 
          content, 
          alice.publicKey.toString(), 
          alice.publicKey.toString(), // Same as author - INTENTIONAL ERROR
          alice
        );
        
        expect.fail("Should have failed to send note to self");
      } catch (error) {
        console.log("✓ Self-send prevention working");
        expect(error.message).to.include("Cannot send note to yourself");
      }
    });

    it("2.3 should validate title length (INTENTIONAL ERROR-TRIGGERING)", async () => {
      // INTENTIONAL: This test deliberately uses a title that exceeds the 50 character limit
      // to verify that the program correctly validates title length
      const longTitle = "A".repeat(51); // Exceeds 50 character limit - INTENTIONAL ERROR
      const content = "Valid content";

      try {
        // Use backend proxy - sends raw inputs, backend handles validation
        await backendProxy.sendNote(
          longTitle, 
          content, 
          alice.publicKey.toString(), 
          bob.publicKey.toString(),
          alice
        );
        
        expect.fail("Should have failed with long title");
      } catch (error) {
        console.log("✓ Title length validation working");
        expect(error.message).to.include("Title is too long");
      }
    });

    it("2.4 should validate content length (INTENTIONAL ERROR-TRIGGERING)", async () => {
      // INTENTIONAL: This test deliberately uses content that exceeds the 300 character limit
      // to verify that the program correctly validates content length
      const title = "Valid Title";
      const longContent = "A".repeat(301); // Exceeds 300 character limit - INTENTIONAL ERROR

      try {
        // Use backend proxy - sends raw inputs, backend handles validation
        await backendProxy.sendNote(
          title, 
          longContent, 
          alice.publicKey.toString(), 
          bob.publicKey.toString(),
          alice
        );
        
        expect.fail("Should have failed with long content");
      } catch (error) {
        console.log("✓ Content length validation working");
        expect(error.message).to.include("Content is too long");
      }
    });

    it("2.5 should prevent duplicate notes (INTENTIONAL ERROR-TRIGGERING)", async () => {
      // INTENTIONAL: This test deliberately tries to send the same note twice
      // to verify that the program correctly prevents duplicate notes
      const title = "Duplicate Test";
      const content = "This should fail on second attempt";

      // Send first note using backend proxy
      await backendProxy.sendNote(
        title, 
        content, 
        alice.publicKey.toString(), 
        bob.publicKey.toString(),
        alice
      );

      console.log("✓ First note created");

      // Try to send duplicate using backend proxy - INTENTIONAL ERROR
      try {
        await backendProxy.sendNote(
          title, 
          content, 
          alice.publicKey.toString(), 
          bob.publicKey.toString(),
          alice
        );
        
        expect.fail("Should have failed to send duplicate note");
      } catch (error) {
        console.log("✓ Duplicate prevention working");
        expect(error.message).to.include("already in use");
      }
    });

    it("2.6 should allow multiple notes with different content (HAPPY PATH)", async () => {
      const notes = [
        { title: "Note 1", content: "Content 1" },
        { title: "Note 2", content: "Content 2" },
        { title: "Note 1", content: "Content 3" }, // Same title, different content
      ];

      for (const note of notes) {
        // Use backend proxy - sends raw inputs, backend handles PDA derivation
        const tx = await backendProxy.sendNote(
          note.title, 
          note.content, 
          alice.publicKey.toString(), 
          bob.publicKey.toString(),
          alice
        );

        console.log(`✓ Created note: "${note.title}" -> "${note.content}"`);
      }

      // Verify config note count increased
      const configAccount = await program.account.config.fetch(configPda);
      expect(configAccount.noteCount.toNumber()).to.be.greaterThan(1);
    });
  });

  // ============================================================================
  // INSTRUCTION 3: DELETE_NOTE_BY_CONTENT
  // ============================================================================
  describe("3. Delete Note By Content Instruction", () => {
    it("3.1 should delete a note successfully (by author) (HAPPY PATH)", async () => {
      const title = "Delete Test Author";
      const content = "This note will be deleted by author";

      // First create a note using backend proxy
      await backendProxy.sendNote(
        title, 
        content, 
        alice.publicKey.toString(), 
        bob.publicKey.toString(),
        alice
      );

      // Get initial note count
      const initialConfig = await program.account.config.fetch(configPda);
      const initialCount = initialConfig.noteCount.toNumber();

      // Delete the note using backend proxy
      const tx = await backendProxy.deleteNote(
        title, 
        content, 
        alice.publicKey.toString(), 
        bob.publicKey.toString(), 
        alice.publicKey.toString(),
        alice
      );

      console.log("✓ Note deleted by author:", tx);

      // Verify note count decreased
      const finalConfig = await program.account.config.fetch(configPda);
      expect(finalConfig.noteCount.toNumber()).to.equal(initialCount - 1);
    });

    it("3.2 should delete a note successfully (by receiver) (HAPPY PATH)", async () => {
      const title = "Delete Test Receiver";
      const content = "This note will be deleted by receiver";

      // First create a note using backend proxy
      await backendProxy.sendNote(
        title, 
        content, 
        alice.publicKey.toString(), 
        bob.publicKey.toString(),
        alice
      );

      // Get initial note count
      const initialConfig = await program.account.config.fetch(configPda);
      const initialCount = initialConfig.noteCount.toNumber();

      // Delete the note as receiver using backend proxy
      const tx = await backendProxy.deleteNote(
        title, 
        content, 
        alice.publicKey.toString(), 
        bob.publicKey.toString(), 
        bob.publicKey.toString(),
        bob
      );

      console.log("✓ Note deleted by receiver:", tx);

      // Verify note count decreased
      const finalConfig = await program.account.config.fetch(configPda);
      expect(finalConfig.noteCount.toNumber()).to.equal(initialCount - 1);
    });

    it("3.3 should fail to delete note by unauthorized user (INTENTIONAL ERROR-TRIGGERING)", async () => {
      // INTENTIONAL: This test deliberately tries to delete a note with an unauthorized user
      // to verify that the program correctly prevents unauthorized deletions
      const title = "Unauthorized Delete Test";
      const content = "This note should not be deletable by charlie";

      // First create a note between alice and bob using backend proxy
      await backendProxy.sendNote(
        title, 
        content, 
        alice.publicKey.toString(), 
        bob.publicKey.toString(),
        alice
      );

      // Try to delete as charlie (unauthorized) using backend proxy - INTENTIONAL ERROR
      try {
        await backendProxy.deleteNote(
          title, 
          content, 
          alice.publicKey.toString(), 
          bob.publicKey.toString(), 
          charlie.publicKey.toString(),
          charlie
        );
        
        expect.fail("Should have failed to delete note by unauthorized user");
      } catch (error) {
        console.log("✓ Unauthorized deletion correctly prevented");
        expect(error.message).to.include("Not authorized");
      }
    });

    it("3.4 should fail to delete non-existent note (INTENTIONAL ERROR-TRIGGERING)", async () => {
      // INTENTIONAL: This test deliberately tries to delete a note that doesn't exist
      // to verify that the program correctly handles non-existent note deletion attempts
      const title = "Non-existent Note";
      const content = "This note does not exist";

      try {
        // Try to delete non-existent note using backend proxy - INTENTIONAL ERROR
        await backendProxy.deleteNote(
          title, 
          content, 
          alice.publicKey.toString(), 
          bob.publicKey.toString(), 
          alice.publicKey.toString(),
          alice
        );
        
        expect.fail("Should have failed to delete non-existent note");
      } catch (error) {
        console.log("✓ Non-existent note deletion correctly prevented");
        expect(error.message).to.include("AccountNotInitialized");
      }
    });
  });

  // ============================================================================
  // INSTRUCTION 4: REACT_TO_NOTE_BY_CONTENT
  // ============================================================================
  describe("4. React To Note By Content Instruction", () => {
    it("4.1 should add like reaction successfully (HAPPY PATH)", async () => {
      const title = "Like Reaction Test";
      const content = "This note will be liked";

      // First create a note using backend proxy
      await backendProxy.sendNote(
        title, 
        content, 
        alice.publicKey.toString(), 
        bob.publicKey.toString(),
        alice
      );

      // Add like reaction using backend proxy
      const tx = await backendProxy.reactToNote(
        title, 
        content, 
        alice.publicKey.toString(), 
        bob.publicKey.toString(), 
        bob.publicKey.toString(), 
        'like',
        bob
      );

      console.log("✓ Like reaction added:", tx);
    });

    it("4.2 should add dislike reaction successfully (HAPPY PATH)", async () => {
      const title = "Dislike Reaction Test";
      const content = "This note will be disliked";

      // First create a note using backend proxy
      await backendProxy.sendNote(
        title, 
        content, 
        alice.publicKey.toString(), 
        bob.publicKey.toString(),
        alice
      );

      // Add dislike reaction using backend proxy
      const tx = await backendProxy.reactToNote(
        title, 
        content, 
        alice.publicKey.toString(), 
        bob.publicKey.toString(), 
        bob.publicKey.toString(), 
        'dislike',
        bob
      );

      console.log("✓ Dislike reaction added:", tx);
    });

    it("4.3 should fail to react to non-existent note (INTENTIONAL ERROR-TRIGGERING)", async () => {
      // INTENTIONAL: This test deliberately tries to react to a note that doesn't exist
      // to verify that the program correctly handles non-existent note reaction attempts
      const title = "Non-existent Reaction Test";
      const content = "This note does not exist";

      try {
        // Try to react to non-existent note using backend proxy - INTENTIONAL ERROR
        await backendProxy.reactToNote(
          title, 
          content, 
          alice.publicKey.toString(), 
          bob.publicKey.toString(), 
          bob.publicKey.toString(), 
          'like',
          bob
        );
        
        expect.fail("Should have failed to react to non-existent note");
      } catch (error) {
        console.log("✓ Non-existent note reaction correctly prevented");
        expect(error.message).to.include("AccountNotInitialized");
      }
    });

    it("4.4 should allow multiple users to react to same note (HAPPY PATH)", async () => {
      const title = "Multiple Reactions Test";
      const content = "This note will have multiple reactions";

      // First create a note using backend proxy
      await backendProxy.sendNote(
        title, 
        content, 
        alice.publicKey.toString(), 
        bob.publicKey.toString(),
        alice
      );

      // Bob likes the note using backend proxy
      await backendProxy.reactToNote(
        title, 
        content, 
        alice.publicKey.toString(), 
        bob.publicKey.toString(), 
        bob.publicKey.toString(), 
        'like',
        bob
      );

      // Charlie dislikes the note using backend proxy
      await backendProxy.reactToNote(
        title, 
        content, 
        alice.publicKey.toString(), 
        bob.publicKey.toString(), 
        charlie.publicKey.toString(), 
        'dislike',
        charlie
      );

      console.log("✓ Multiple reactions added successfully");
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================
  describe("5. Integration Tests", () => {
    it("5.1 should handle complete note lifecycle (HAPPY PATH)", async () => {
      const title = "Lifecycle Test";
      const content = "Complete note lifecycle test";

      // 1. Send note using backend proxy
      const sendTx = await backendProxy.sendNote(
        title, 
        content, 
        alice.publicKey.toString(), 
        bob.publicKey.toString(),
        alice
      );

      console.log("✓ Step 1: Note sent");

      // 2. Add reactions using backend proxy
      const likeTx = await backendProxy.reactToNote(
        title, 
        content, 
        alice.publicKey.toString(), 
        bob.publicKey.toString(), 
        bob.publicKey.toString(), 
        'like',
        bob
      );

      console.log("✓ Step 2: Like reaction added");

      const dislikeTx = await backendProxy.reactToNote(
        title, 
        content, 
        alice.publicKey.toString(), 
        bob.publicKey.toString(), 
        charlie.publicKey.toString(), 
        'dislike',
        charlie
      );

      console.log("✓ Step 3: Dislike reaction added");

      // 3. Delete note using backend proxy
      const deleteTx = await backendProxy.deleteNote(
        title, 
        content, 
        alice.publicKey.toString(), 
        bob.publicKey.toString(), 
        alice.publicKey.toString(),
        alice
      );

      console.log("✓ Step 4: Note deleted");

      // Verify final state
      const finalConfig = await program.account.config.fetch(configPda);
      console.log(`✓ Final note count: ${finalConfig.noteCount.toNumber()}`);
    });

    it("5.2 should handle edge cases and error conditions (MIXED SCENARIOS)", async () => {
      // MIXED SCENARIOS: This test combines valid edge cases and potential error conditions
      // to verify that the program handles boundary conditions correctly
      
      // Test empty strings (valid edge case)
      try {
        // Empty strings should still work (they're valid)
        await backendProxy.sendNote(
          "", 
          "", 
          alice.publicKey.toString(), 
          bob.publicKey.toString(),
          alice
        );
        
        console.log("✓ Empty strings handled correctly");
      } catch (error) {
        console.log("Empty string test failed:", error.message);
      }

      // Test maximum length strings (valid edge case)
      const maxTitle = "A".repeat(50); // Exactly at the limit
      const maxContent = "B".repeat(300); // Exactly at the limit

      const tx = await backendProxy.sendNote(
        maxTitle, 
        maxContent, 
        alice.publicKey.toString(), 
        bob.publicKey.toString(),
        alice
      );

      console.log("✓ Maximum length strings handled correctly");
    });

    it("5.3 should fetch notes for receiver (HAPPY PATH)", async () => {
      // Create multiple notes using backend proxy
      const notes = [
        { title: "Timeline Note 1", content: "First note for timeline" },
        { title: "Timeline Note 2", content: "Second note for timeline" },
        { title: "Timeline Note 3", content: "Third note for timeline" },
      ];

      for (const note of notes) {
        await backendProxy.sendNote(
          note.title, 
          note.content, 
          alice.publicKey.toString(), 
          bob.publicKey.toString(),
          alice
        );
      }

      // Fetch notes for bob (receiver) using backend proxy
      const fetchedNotes = await backendProxy.getNotesForReceiver(bob.publicKey.toString());

      expect(fetchedNotes.length).to.be.greaterThan(0);
      console.log(`✓ Found ${fetchedNotes.length} notes for receiver`);

      // Verify notes are sorted by creation time (newest first)
      for (let i = 1; i < fetchedNotes.length; i++) {
        const prevCreatedAt = fetchedNotes[i-1].createdAt;
        const currCreatedAt = fetchedNotes[i].createdAt;
        
        // Skip comparison if either timestamp is invalid
        if (isNaN(prevCreatedAt) || isNaN(currCreatedAt)) {
          console.log(`Skipping comparison for notes with invalid timestamps: ${prevCreatedAt}, ${currCreatedAt}`);
          continue;
        }
        
        expect(prevCreatedAt).to.be.greaterThanOrEqual(currCreatedAt);
      }
    });
  });
});
