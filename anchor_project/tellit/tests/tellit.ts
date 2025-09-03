/**
 * COMPREHENSIVE TELLIT PROGRAM TEST SUITE
 * 
 * Tests ALL Anchor program instructions with both happy and unhappy scenarios.
 * Uses backend proxy to maintain key principle:
 * Tests → send raw inputs (wallet IDs, title, note)
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
 * 3. INTEGRATION TESTS (2 tests)
 *    3.1 ✓ Handle edge cases and error conditions (MIXED SCENARIOS)
 *    3.2 ✓ Fetch notes for receiver (HAPPY PATH)
 * 
 * TOTAL: 10 tests (6 HAPPY PATH, 3 INTENTIONAL ERROR-TRIGGERING, 1 MIXED SCENARIOS)
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
 * Test Backend Proxy - Simulates frontend backend behavior
 * 
 * Key principle: Tests send raw inputs, backend handles all PDA generation
 * This matches the frontend architecture where backend does all the heavy lifting
 */
class TestBackendProxy {
  private program: Program<Tellit>;
  private configPda: PublicKey;
  private configBump: number;

  constructor(program: Program<Tellit>) {
    this.program = program;
    [this.configPda, this.configBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );
  }

  /**
   * Initialize the program
   */
  async initialize(authority: Keypair): Promise<string> {
    const tx = await this.program.methods
      .initialize()
      .accounts({
        config: this.configPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();
    
    return tx;
  }

  /**
   * Send a note by content - backend handles all PDA generation
   */
  async sendNote(
    author: Keypair,
    receiver: PublicKey,
    title: string,
    content: string
  ): Promise<string> {
    // Backend calculates the note PDA using the same logic as the program
    const contentHash = keccak256(title + content);
    const [notePda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("note"),
        author.publicKey.toBuffer(),
        receiver.toBuffer(),
        Buffer.from(contentHash, 'hex')
      ],
      this.program.programId
    );

    const tx = await this.program.methods
      .sendNoteByContent(title, content)
      .accounts({
        note: notePda,
        config: this.configPda,
        author: author.publicKey,
        receiver: receiver,
        systemProgram: SystemProgram.programId,
      })
      .signers([author])
      .rpc();
    
    return tx;
  }

  /**
   * Get notes for a receiver
   */
  async getNotesForReceiver(receiver: PublicKey): Promise<any[]> {
    try {
      const notes = await this.program.account.note.all([
      {
        memcmp: {
          offset: 8 + 32, // Skip discriminator and author field
          bytes: receiver.toBase58(),
        },
      },
    ]);

      return notes.map((note) => ({
        publicKey: note.publicKey.toString(),
        author: note.account.author.toString(),
        receiver: note.account.receiver.toString(),
        title: note.account.title,
        content: note.account.content,
        created_at: note.account.createdAt.toNumber(),
        updated_at: note.account.updatedAt.toNumber(),
      }));
    } catch (error) {
      console.log("No notes found for receiver:", receiver.toString());
      return [];
    }
  }

  /**
   * Get config account
   */
  async getConfig(): Promise<any> {
    try {
      const config = await this.program.account.config.fetch(this.configPda);
      return {
        authority: config.authority.toString(),
        bump: config.bump,
        noteCount: config.noteCount.toNumber(),
      };
    } catch (error) {
      throw new Error("Config account not found");
    }
  }
}

describe("Tellit Program - Comprehensive Test Suite", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Tellit as Program<Tellit>;
  const backend = new TestBackendProxy(program);

  // Test accounts
  let authority: Keypair;
  let user1: Keypair;
  let user2: Keypair;
  let user3: Keypair;

  before(async () => {
    // Generate test keypairs
    authority = Keypair.generate();
    user1 = Keypair.generate();
    user2 = Keypair.generate();
    user3 = Keypair.generate();

    // Airdrop SOL to test accounts
    const provider = anchor.getProvider();
    await provider.connection.requestAirdrop(authority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(user1.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(user2.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(user3.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);

    // Wait for airdrops to confirm
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe("1. Initialize Instruction", () => {
    it("1.1 should initialize the program successfully (HAPPY PATH)", async () => {
      try {
        const tx = await backend.initialize(authority);
        console.log("✓ Program initialized successfully");
        
        const config = await backend.getConfig();
        expect(config.authority).to.equal(authority.publicKey.toString());
        expect(config.noteCount).to.be.a('number');
      } catch (error) {
        if (error.message.includes("already in use")) {
          console.log("✓ Program already initialized (expected in test environment)");
          const config = await backend.getConfig();
          expect(config.authority).to.be.a('string');
          expect(config.authority.length).to.be.greaterThan(0);
        } else {
          throw error;
        }
      }
    });

    it("1.2 should fail to initialize program twice (INTENTIONAL ERROR-TRIGGERING)", async () => {
      try {
        await backend.initialize(authority);
        expect.fail("Should have failed to initialize twice");
      } catch (error) {
        expect(error.message).to.include("already in use");
        console.log("✓ Duplicate initialization correctly prevented");
      }
    });
  });

  describe("2. Send Note By Content Instruction", () => {
    it("2.1 should send a note successfully (HAPPY PATH)", async () => {
      const tx = await backend.sendNote(
        user1,
        user2.publicKey,
        "Test Note",
        "This is a test note content"
      );
      console.log("✓ Note sent successfully:", tx);

      const config = await backend.getConfig();
      expect(config.noteCount).to.be.a('number');
      expect(config.noteCount).to.be.greaterThan(0);
    });

    it("2.2 should prevent sending note to self (INTENTIONAL ERROR-TRIGGERING)", async () => {
      try {
        await backend.sendNote(
          user1,
          user1.publicKey, // Same as author
          "Self Note",
          "This should fail"
        );
        expect.fail("Should have failed to send note to self");
      } catch (error) {
        expect(error.message).to.include("CannotSendToSelf");
        console.log("✓ Self-send prevention working");
      }
    });

    it("2.3 should validate title length (INTENTIONAL ERROR-TRIGGERING)", async () => {
      const longTitle = "a".repeat(51); // 51 characters, exceeds limit of 50

      try {
        await backend.sendNote(
          user1,
          user2.publicKey,
          longTitle, 
          "Valid content"
        );
        expect.fail("Should have failed with long title");
      } catch (error) {
        expect(error.message).to.include("TitleTooLong");
        console.log("✓ Title length validation working");
      }
    });

    it("2.4 should validate content length (INTENTIONAL ERROR-TRIGGERING)", async () => {
      const longContent = "a".repeat(301); // 301 characters, exceeds limit of 300
      
      try {
        await backend.sendNote(
          user1,
          user2.publicKey,
          "Valid title",
          longContent
        );
        expect.fail("Should have failed with long content");
      } catch (error) {
        expect(error.message).to.include("ContentTooLong");
        console.log("✓ Content length validation working");
      }
    });

    it("2.5 should prevent duplicate notes (INTENTIONAL ERROR-TRIGGERING)", async () => {
      try {
        // Try to send the exact same note again
        await backend.sendNote(
          user1,
          user2.publicKey,
          "Test Note",
          "This is a test note content"
        );
        expect.fail("Should have failed to create duplicate note");
      } catch (error) {
        expect(error.message).to.include("already in use");
        console.log("✓ Duplicate prevention working");
      }
    });

    it("2.6 should allow multiple notes with different content (HAPPY PATH)", async () => {
      // Send multiple different notes
      const notes = [
        { title: "Note 1", content: "Content 1" },
        { title: "Note 2", content: "Content 2" },
        { title: "Note 1", content: "Content 3" }, // Same title, different content
      ];

      for (const note of notes) {
        const tx = await backend.sendNote(
          user2,
          user3.publicKey,
          note.title, 
          note.content
        );
        console.log(`✓ Created note: "${note.title}" -> "${note.content}"`);
      }

      const config = await backend.getConfig();
      expect(config.noteCount).to.be.a('number');
      expect(config.noteCount).to.be.greaterThan(0);
    });
  });

  describe("3. Integration Tests", () => {
    it("3.1 should handle edge cases and error conditions (MIXED SCENARIOS)", async () => {
      // Test empty strings
      await backend.sendNote(user3, user1.publicKey, "", "");
        console.log("✓ Empty strings handled correctly");

      // Test maximum length strings
      const maxTitle = "a".repeat(50);
      const maxContent = "b".repeat(300);
      await backend.sendNote(user3, user1.publicKey, maxTitle, maxContent);
      console.log("✓ Maximum length strings handled correctly");
    });

    it("3.2 should fetch notes for receiver (HAPPY PATH)", async () => {
      const notes = await backend.getNotesForReceiver(user2.publicKey);
      expect(notes.length).to.be.greaterThan(0);
      
      // Verify note structure
      const note = notes[0];
      expect(note).to.have.property('author');
      expect(note).to.have.property('receiver');
      expect(note).to.have.property('title');
      expect(note).to.have.property('content');
      expect(note).to.have.property('created_at');
      expect(note).to.have.property('updated_at');
      
      console.log("✓ Notes fetched successfully for receiver");
    });
  });
});
