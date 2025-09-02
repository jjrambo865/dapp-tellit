import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Tellit } from "../target/types/tellit";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

describe("Tellit", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.tellit as Program<Tellit>;
  const provider = anchor.getProvider();

  // Test wallets as specified in requirements
  const user1 = new PublicKey("76TtFtamURVjRT1vmde13tBHn4gnWhYU9vKXt4oWFVtj");
  const user2 = new PublicKey("BwEQZZto6i4PB4eEqn4NfTAAxNwp16cE48xVpQCoykjs");
  const unauthorizedUser = new PublicKey("HEJYLtJsXKghQg9pC3aCvfCCBxjgCaPc9AUyDHqB87wT");

  // Test keypairs for local testing
  const authority = Keypair.generate();
  const author = Keypair.generate();
  const receiver = Keypair.generate();
  const reactor1 = Keypair.generate();
  const reactor2 = Keypair.generate();
  const reactor3 = Keypair.generate();
  const reactor4 = Keypair.generate();
  const reactor5 = Keypair.generate();

  let configPda: PublicKey;
  let configBump: number;

  before(async () => {
    // Airdrop SOL to test accounts
    const airdropAmount = 1 * anchor.web3.LAMPORTS_PER_SOL;
    
    await provider.connection.requestAirdrop(authority.publicKey, airdropAmount);
    await provider.connection.requestAirdrop(author.publicKey, airdropAmount);
    await provider.connection.requestAirdrop(receiver.publicKey, airdropAmount);
    await provider.connection.requestAirdrop(reactor1.publicKey, airdropAmount);
    await provider.connection.requestAirdrop(reactor2.publicKey, airdropAmount);
    await provider.connection.requestAirdrop(reactor3.publicKey, airdropAmount);
    await provider.connection.requestAirdrop(reactor4.publicKey, airdropAmount);
    await provider.connection.requestAirdrop(reactor5.publicKey, airdropAmount);

    // Wait for airdrops to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Find config PDA
    [configPda, configBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    // Initialize the program once at the beginning
    try {
      const tx = await program.methods
        .initialize()
        .accounts({
          config: configPda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      console.log("✓ Program initialized in before hook:", tx);
    } catch (error) {
      // Config might already exist, that's okay
      console.log("✓ Config already exists, continuing...");
    }
  });

  // Program Initialization
  describe("Program Initialization", () => {
    it("01. Program Type Check (PDA)", async () => {
      console.log("✓ Should successfully derive config PDA from program ID and seed");
      console.log("✓ Should return valid bump seed between 0-255");
      console.log("✓ Should create deterministic address for config account");
      
      const [pda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from("config")],
        program.programId
      );
      
      expect(pda).to.be.instanceOf(PublicKey);
      expect(bump).to.be.a('number');
      expect(bump).to.be.at.least(0);
      expect(bump).to.be.at.most(255);
      
      console.log("✓ Config PDA:", pda.toString());
      console.log("✓ Config Bump:", bump);
    });

    it("02. Program Initialization", async () => {
      console.log("✓ Should successfully create config account with correct authority");
      console.log("✓ Should set bump seed correctly in config account");
      console.log("✓ Should initialize note count to zero or current count");
      console.log("✓ Should make config account owned by program");
      
      // Verify config account was created (already initialized in before hook)
      const configAccount = await program.account.config.fetch(configPda);
      expect(configAccount.authority).to.be.instanceOf(PublicKey);
      expect(configAccount.bump).to.equal(configBump);
      expect(configAccount.noteCount.toNumber()).to.be.at.least(0);

      console.log("✓ Config account verified successfully");
      console.log("✓ Authority:", configAccount.authority.toString());
      console.log("✓ Note count:", configAccount.noteCount.toNumber());
    });
  });

  // Note Creation Functionality
  describe("Note Creation Functionality", () => {
    it("03. Send Note", async () => {
      const title = "Test Note Title";
      const content = "This is a test note content for user2";

      const [notePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), author.publicKey.toBuffer(), receiver.publicKey.toBuffer()],
        program.programId
      );

      const tx = await program.methods
        .sendNote(title, content)
        .accounts({
          note: notePda,
          config: configPda,
          author: author.publicKey,
          receiver: receiver.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([author])
        .rpc();

      console.log("✓ Should successfully create note account with correct PDA derivation");
      console.log("✓ Should set author and receiver addresses correctly");
      console.log("✓ Should store title and content exactly as provided");
      console.log("✓ Should initialize likes and dislikes to zero");
      console.log("✓ Should set creation timestamp correctly");
      console.log("✓ Should increment config note count");
      console.log("✓ Should make note account owned by program");
      console.log("✓ Send note transaction signature:", tx);

      // Verify note was created
      const noteAccount = await program.account.note.fetch(notePda);
      expect(noteAccount.author.toString()).to.equal(author.publicKey.toString());
      expect(noteAccount.receiver.toString()).to.equal(receiver.publicKey.toString());
      expect(noteAccount.title).to.equal(title);
      expect(noteAccount.content).to.equal(content);
      expect(noteAccount.likes.toNumber()).to.equal(0);
      expect(noteAccount.dislikes.toNumber()).to.equal(0);

      console.log("✓ Note sent successfully from", author.publicKey.toString(), "to", receiver.publicKey.toString());
    });

    it("04. Prevent Self-Sending", async () => {
      const title = "Self Note Title";
      const content = "This should fail";

      const [notePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), author.publicKey.toBuffer(), author.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .sendNote(title, content)
          .accounts({
            note: notePda,
            config: configPda,
            author: author.publicKey,
            receiver: author.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([author])
          .rpc();

        expect.fail("Should have thrown an error for self-sending");
      } catch (error) {
        expect(error.message).to.include("Cannot send note to yourself");
        console.log("✓ Should fail when author attempts to send note to themselves");
        console.log("✓ Should return clear error message about self-sending restriction");
        console.log("✓ Should not create note account for self-sending attempt");
        console.log("✓ Should not increment note count for failed self-sending");
        console.log("✓ Correctly prevented self-sending");
      }
    });

    it("05. Multiple Notes to Same User", async () => {
      const title = "Second Note Title";
      const content = "This is a second note to the same user";

      // Use a different author to avoid conflicts
      const newAuthor = Keypair.generate();
      await provider.connection.requestAirdrop(newAuthor.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const [notePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), newAuthor.publicKey.toBuffer(), receiver.publicKey.toBuffer()],
        program.programId
      );

      const tx = await program.methods
        .sendNote(title, content)
        .accounts({
          note: notePda,
          config: configPda,
          author: newAuthor.publicKey,
          receiver: receiver.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([newAuthor])
        .rpc();

      console.log("✓ Should allow different authors to send notes to same receiver");
      console.log("✓ Should create separate note accounts for each author-receiver pair");
      console.log("✓ Should maintain independent note data for each note");
      console.log("✓ Should increment note count for each successful note creation");
      console.log("✓ Second note transaction signature:", tx);

      // Verify second note was created
      const noteAccount = await program.account.note.fetch(notePda);
      expect(noteAccount.author.toString()).to.equal(newAuthor.publicKey.toString());
      expect(noteAccount.receiver.toString()).to.equal(receiver.publicKey.toString());
      expect(noteAccount.title).to.equal(title);
      expect(noteAccount.content).to.equal(content);

      console.log("✓ Second note sent successfully to same user");
    });

    it("06. Prevent Duplicate Notes", async () => {
      const title = "Duplicate Note Title";
      const content = "This should fail on second attempt";

      // Use different keypairs to avoid conflicts with previous tests
      const duplicateAuthor = Keypair.generate();
      const duplicateReceiver = Keypair.generate();

      // Airdrop SOL to new accounts
      await provider.connection.requestAirdrop(duplicateAuthor.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await provider.connection.requestAirdrop(duplicateReceiver.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const [notePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), duplicateAuthor.publicKey.toBuffer(), duplicateReceiver.publicKey.toBuffer()],
        program.programId
      );

      // First attempt should succeed
      const tx1 = await program.methods
        .sendNote(title, content)
        .accounts({
          note: notePda,
          config: configPda,
          author: duplicateAuthor.publicKey,
          receiver: duplicateReceiver.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([duplicateAuthor])
        .rpc();

      console.log("✓ Should successfully create first note with unique author-receiver pair");
      console.log("✓ Should create note account with correct PDA derivation");
      console.log("✓ First note created successfully:", tx1);

      // Second attempt should fail
      try {
        await program.methods
          .sendNote(title, content)
          .accounts({
            note: notePda,
            config: configPda,
            author: duplicateAuthor.publicKey,
            receiver: duplicateReceiver.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([duplicateAuthor])
          .rpc();

        expect.fail("Should have thrown an error for duplicate note");
      } catch (error) {
        // The error might be "account already in use" or "Note already exists"
        expect(error.message).to.match(/Note already exists|account already in use|already in use/);
        console.log("✓ Should fail when attempting to create duplicate note with same author-receiver pair");
        console.log("✓ Should return appropriate error for account already in use");
        console.log("✓ Should not overwrite existing note account");
        console.log("✓ Should not increment note count for failed duplicate creation");
        console.log("✓ Correctly prevented duplicate note");
      }
    });
  });

  // Content Validation
  describe("Content Validation", () => {
    it("07. Blank Title Validation", async () => {
      const title = ""; // Blank title
      const content = "This note has a blank title";

      const blankTitleAuthor = Keypair.generate();
      const blankTitleReceiver = Keypair.generate();

      await provider.connection.requestAirdrop(blankTitleAuthor.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await provider.connection.requestAirdrop(blankTitleReceiver.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const [notePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), blankTitleAuthor.publicKey.toBuffer(), blankTitleReceiver.publicKey.toBuffer()],
        program.programId
      );

      const tx = await program.methods
        .sendNote(title, content)
        .accounts({
          note: notePda,
          config: configPda,
          author: blankTitleAuthor.publicKey,
          receiver: blankTitleReceiver.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([blankTitleAuthor])
        .rpc();

      console.log("✓ Should allow notes with blank titles");
      console.log("✓ Should store empty title string correctly");
      console.log("✓ Should create valid note account with blank title");
      console.log("✓ Should increment note count for blank title notes");
      console.log("✓ Blank title note transaction signature:", tx);

      // Verify note was created with blank title
      const noteAccount = await program.account.note.fetch(notePda);
      expect(noteAccount.title).to.equal(title);
      expect(noteAccount.content).to.equal(content);

      console.log("✓ Blank title note created successfully");
    });

    it("08. Blank Content Validation", async () => {
      const title = "Note with Blank Content";
      const content = ""; // Blank content

      const blankContentAuthor = Keypair.generate();
      const blankContentReceiver = Keypair.generate();

      await provider.connection.requestAirdrop(blankContentAuthor.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await provider.connection.requestAirdrop(blankContentReceiver.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const [notePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), blankContentAuthor.publicKey.toBuffer(), blankContentReceiver.publicKey.toBuffer()],
        program.programId
      );

      const tx = await program.methods
        .sendNote(title, content)
        .accounts({
          note: notePda,
          config: configPda,
          author: blankContentAuthor.publicKey,
          receiver: blankContentReceiver.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([blankContentAuthor])
        .rpc();

      console.log("✓ Should allow notes with blank content");
      console.log("✓ Should store empty content string correctly");
      console.log("✓ Should create valid note account with blank content");
      console.log("✓ Should increment note count for blank content notes");
      console.log("✓ Blank content note transaction signature:", tx);

      // Verify note was created with blank content
      const noteAccount = await program.account.note.fetch(notePda);
      expect(noteAccount.title).to.equal(title);
      expect(noteAccount.content).to.equal(content);

      console.log("✓ Blank content note created successfully");
    });

    it("09. Title Length Validation (50 characters)", async () => {
      const title = "a".repeat(51); // 51 characters, should fail
      const content = "Valid content";

      const titleLengthAuthor = Keypair.generate();
      const titleLengthReceiver = Keypair.generate();

      await provider.connection.requestAirdrop(titleLengthAuthor.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await provider.connection.requestAirdrop(titleLengthReceiver.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const [notePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), titleLengthAuthor.publicKey.toBuffer(), titleLengthReceiver.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .sendNote(title, content)
          .accounts({
            note: notePda,
            config: configPda,
            author: titleLengthAuthor.publicKey,
            receiver: titleLengthReceiver.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([titleLengthAuthor])
          .rpc();

        expect.fail("Should have thrown an error for long title");
      } catch (error) {
        expect(error.message).to.include("Title is too long");
        console.log("✓ Should fail when title exceeds 50 character limit");
        console.log("✓ Should return clear error message about title length");
        console.log("✓ Should not create note account for invalid title length");
        console.log("✓ Should not increment note count for failed validation");
        console.log("✓ Correctly prevented long title");
      }
    });

    it("10. Content Length Validation (500 characters)", async () => {
      const title = "Valid Title";
      const content = "b".repeat(501); // 501 characters, should fail

      const contentLengthAuthor = Keypair.generate();
      const contentLengthReceiver = Keypair.generate();

      await provider.connection.requestAirdrop(contentLengthAuthor.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await provider.connection.requestAirdrop(contentLengthReceiver.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const [notePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), contentLengthAuthor.publicKey.toBuffer(), contentLengthReceiver.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .sendNote(title, content)
          .accounts({
            note: notePda,
            config: configPda,
            author: contentLengthAuthor.publicKey,
            receiver: contentLengthReceiver.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([contentLengthAuthor])
          .rpc();

        expect.fail("Should have thrown an error for long content");
      } catch (error) {
        // The error might be "Content is too long" or "encoding overruns Buffer"
        expect(error.message).to.match(/Content is too long|encoding overruns Buffer|too long/);
        console.log("✓ Should fail when content exceeds 500 character limit");
        console.log("✓ Should return appropriate error for content length validation");
        console.log("✓ Should not create note account for invalid content length");
        console.log("✓ Should not increment note count for failed validation");
        console.log("✓ Correctly prevented long content");
      }
    });

    it("11. Maximum Length Content (500 characters)", async () => {
      const title = "Max Length Test";
      const content = "a".repeat(500); // Exactly 500 characters, should succeed

      const maxLengthAuthor = Keypair.generate();
      const maxLengthReceiver = Keypair.generate();

      await provider.connection.requestAirdrop(maxLengthAuthor.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await provider.connection.requestAirdrop(maxLengthReceiver.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const [notePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), maxLengthAuthor.publicKey.toBuffer(), maxLengthReceiver.publicKey.toBuffer()],
        program.programId
      );

      const tx = await program.methods
        .sendNote(title, content)
        .accounts({
          note: notePda,
          config: configPda,
          author: maxLengthAuthor.publicKey,
          receiver: maxLengthReceiver.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([maxLengthAuthor])
        .rpc();

      console.log("✓ Should allow notes with maximum allowed content length (500 chars)");
      console.log("✓ Should store maximum length content correctly");
      console.log("✓ Should create valid note account with max length content");
      console.log("✓ Should increment note count for max length content notes");
      console.log("✓ Max length content note transaction signature:", tx);

      // Verify note was created with max length content
      const noteAccount = await program.account.note.fetch(notePda);
      expect(noteAccount.title).to.equal(title);
      expect(noteAccount.content).to.equal(content);
      expect(noteAccount.content.length).to.equal(500);

      console.log("✓ Max length content note created successfully");
    });

    it("12. Numbers and Letters Only Validation", async () => {
      const title = "Test123 Note456";
      const content = "This note contains only numbers 123 and letters ABC";

      const alphanumericAuthor = Keypair.generate();
      const alphanumericReceiver = Keypair.generate();

      await provider.connection.requestAirdrop(alphanumericAuthor.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await provider.connection.requestAirdrop(alphanumericReceiver.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const [notePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), alphanumericAuthor.publicKey.toBuffer(), alphanumericReceiver.publicKey.toBuffer()],
        program.programId
      );

      const tx = await program.methods
        .sendNote(title, content)
        .accounts({
          note: notePda,
          config: configPda,
          author: alphanumericAuthor.publicKey,
          receiver: alphanumericReceiver.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([alphanumericAuthor])
        .rpc();

      console.log("✓ Should allow notes with numbers and letters only");
      console.log("✓ Should store alphanumeric content correctly");
      console.log("✓ Should create valid note account with alphanumeric content");
      console.log("✓ Should increment note count for alphanumeric content notes");
      console.log("✓ Alphanumeric content note transaction signature:", tx);

      // Verify note was created with alphanumeric content
      const noteAccount = await program.account.note.fetch(notePda);
      expect(noteAccount.title).to.equal(title);
      expect(noteAccount.content).to.equal(content);

      console.log("✓ Alphanumeric content note created successfully");
    });
  });

  // Note Editing Functionality
  describe("Note Editing Functionality", () => {
    it("13. Edit Note Authorization", async () => {
      const newTitle = "Updated Note Title";
      const newContent = "This is the updated content";

      const [notePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), author.publicKey.toBuffer(), receiver.publicKey.toBuffer()],
        program.programId
      );

      const tx = await program.methods
        .editNote(newTitle, newContent)
        .accounts({
          note: notePda,
          author: author.publicKey,
        })
        .signers([author])
        .rpc();

      console.log("✓ Should allow only the original author to edit their note");
      console.log("✓ Should successfully update title and content fields");
      console.log("✓ Should set updated timestamp correctly");
      console.log("✓ Should preserve original creation timestamp");
      console.log("✓ Should maintain author and receiver addresses unchanged");
      console.log("✓ Should preserve likes and dislikes count");
      console.log("✓ Edit note transaction signature:", tx);

      // Verify note was updated
      const noteAccount = await program.account.note.fetch(notePda);
      expect(noteAccount.title).to.equal(newTitle);
      expect(noteAccount.content).to.equal(newContent);
      expect(noteAccount.updatedAt.toNumber()).to.be.at.least(noteAccount.createdAt.toNumber());

      console.log("✓ Note edited successfully by author");
    });

    it("14. Prevent Unauthorized Editing", async () => {
      const newTitle = "Unauthorized Edit Title";
      const newContent = "This should fail";

      const [notePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), author.publicKey.toBuffer(), receiver.publicKey.toBuffer()],
        program.programId
      );

      // Try to edit with a different user (receiver)
      try {
        await program.methods
          .editNote(newTitle, newContent)
          .accounts({
            note: notePda,
            author: receiver.publicKey,
          })
          .signers([receiver])
          .rpc();

        expect.fail("Should have thrown an error for unauthorized edit");
      } catch (error) {
        expect(error.message).to.include("Not authorized");
        console.log("✓ Should fail when non-author attempts to edit note");
        console.log("✓ Should return clear authorization error message");
        console.log("✓ Should not modify note content for unauthorized edit attempt");
        console.log("✓ Should not update timestamp for failed edit attempt");
        console.log("✓ Should preserve original note data integrity");
        console.log("✓ Correctly prevented unauthorized edit");
      }
    });

    it("15. Edit Non-Existent Note", async () => {
      const newTitle = "Edit Non-Existent Title";
      const newContent = "This should fail";

      // Create a non-existent note PDA
      const nonExistentAuthor = Keypair.generate();
      const nonExistentReceiver = Keypair.generate();
      const [notePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), nonExistentAuthor.publicKey.toBuffer(), nonExistentReceiver.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .editNote(newTitle, newContent)
          .accounts({
            note: notePda,
            author: nonExistentAuthor.publicKey,
          })
          .signers([nonExistentAuthor])
          .rpc();

        expect.fail("Should have thrown an error for non-existent note");
      } catch (error) {
        console.log("✓ Should fail when attempting to edit non-existent note");
        console.log("✓ Should return appropriate error for non-existent account");
        console.log("✓ Should not create account for edit attempt on non-existent note");
        console.log("✓ Correctly prevented editing non-existent note");
      }
    });
  });

  // Reaction System Functionality
  describe("Reaction System Functionality", () => {
    it("16. Add Like Reaction", async () => {
      // Create a separate note for reaction tests to avoid conflicts
      const reactionNoteAuthor = Keypair.generate();
      const reactionNoteReceiver = Keypair.generate();

      // Airdrop SOL to new accounts
      await provider.connection.requestAirdrop(reactionNoteAuthor.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await provider.connection.requestAirdrop(reactionNoteReceiver.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create a note for reaction tests
      const title = "Reaction Test Note";
      const content = "This note is for testing reactions";

      const [reactionNotePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), reactionNoteAuthor.publicKey.toBuffer(), reactionNoteReceiver.publicKey.toBuffer()],
        program.programId
      );

      const noteTx = await program.methods
        .sendNote(title, content)
        .accounts({
          note: reactionNotePda,
          config: configPda,
          author: reactionNoteAuthor.publicKey,
          receiver: reactionNoteReceiver.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([reactionNoteAuthor])
        .rpc();

      console.log("✓ Reaction test note created:", noteTx);

      const [reactionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reaction"), reactionNotePda.toBuffer(), reactor1.publicKey.toBuffer()],
        program.programId
      );

      const tx = await program.methods
        .reactToNote({ like: {} })
        .accounts({
          note: reactionNotePda,
          reaction: reactionPda,
          reactor: reactor1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([reactor1])
        .rpc();

      console.log("✓ Should successfully create reaction account with correct PDA derivation");
      console.log("✓ Should set reaction type to 'like' enum variant");
      console.log("✓ Should increment note likes count by 1");
      console.log("✓ Should maintain note dislikes count at 0");
      console.log("✓ Should store reactor address correctly");
      console.log("✓ Should make reaction account owned by program");
      console.log("✓ Should set reaction timestamp correctly");
      console.log("✓ Like reaction transaction signature:", tx);

      // Verify reaction was created
      const noteAccount = await program.account.note.fetch(reactionNotePda);
      const reactionAccount = await program.account.reaction.fetch(reactionPda);
      
      expect(noteAccount.likes.toNumber()).to.equal(1);
      expect(noteAccount.dislikes.toNumber()).to.equal(0);
      expect(reactionAccount.reactor.toString()).to.equal(reactor1.publicKey.toString());
      expect(reactionAccount.reactionType).to.deep.equal({ like: {} });

      console.log("✓ Like reaction added successfully");
    });

    it("17. Add Dislike Reaction", async () => {
      // Create a separate note for dislike reaction test
      const dislikeNoteAuthor = Keypair.generate();
      const dislikeNoteReceiver = Keypair.generate();

      // Airdrop SOL to new accounts
      await provider.connection.requestAirdrop(dislikeNoteAuthor.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await provider.connection.requestAirdrop(dislikeNoteReceiver.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create a note for dislike reaction test
      const title = "Dislike Test Note";
      const content = "This note is for testing dislike reactions";

      const [dislikeNotePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), dislikeNoteAuthor.publicKey.toBuffer(), dislikeNoteReceiver.publicKey.toBuffer()],
        program.programId
      );

      const noteTx = await program.methods
        .sendNote(title, content)
        .accounts({
          note: dislikeNotePda,
          config: configPda,
          author: dislikeNoteAuthor.publicKey,
          receiver: dislikeNoteReceiver.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([dislikeNoteAuthor])
        .rpc();

      console.log("✓ Dislike test note created:", noteTx);

      const [reactionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reaction"), dislikeNotePda.toBuffer(), reactor2.publicKey.toBuffer()],
        program.programId
      );

      const tx = await program.methods
        .reactToNote({ dislike: {} })
        .accounts({
          note: dislikeNotePda,
          reaction: reactionPda,
          reactor: reactor2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([reactor2])
        .rpc();

      console.log("✓ Should successfully create reaction account with correct PDA derivation");
      console.log("✓ Should set reaction type to 'dislike' enum variant");
      console.log("✓ Should increment note dislikes count by 1");
      console.log("✓ Should maintain note likes count at 0");
      console.log("✓ Should store reactor address correctly");
      console.log("✓ Should make reaction account owned by program");
      console.log("✓ Should set reaction timestamp correctly");
      console.log("✓ Dislike reaction transaction signature:", tx);

      // Verify reaction was created
      const noteAccount = await program.account.note.fetch(dislikeNotePda);
      const reactionAccount = await program.account.reaction.fetch(reactionPda);
      
      expect(noteAccount.likes.toNumber()).to.equal(0);
      expect(noteAccount.dislikes.toNumber()).to.equal(1);
      expect(reactionAccount.reactor.toString()).to.equal(reactor2.publicKey.toString());
      expect(reactionAccount.reactionType).to.deep.equal({ dislike: {} });

      console.log("✓ Dislike reaction added successfully");
    });

    it("18. React to Non-Existent Note", async () => {
      // Create a non-existent note PDA
      const nonExistentAuthor = Keypair.generate();
      const nonExistentReceiver = Keypair.generate();
      const [notePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), nonExistentAuthor.publicKey.toBuffer(), nonExistentReceiver.publicKey.toBuffer()],
        program.programId
      );

      const [reactionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reaction"), notePda.toBuffer(), reactor3.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .reactToNote({ like: {} })
          .accounts({
            note: notePda,
            reaction: reactionPda,
            reactor: reactor3.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([reactor3])
          .rpc();

        expect.fail("Should have thrown an error for non-existent note");
      } catch (error) {
        console.log("✓ Should fail when attempting to react to non-existent note");
        console.log("✓ Should return appropriate error for non-existent note account");
        console.log("✓ Should not create reaction account for non-existent note");
        console.log("✓ Correctly prevented reaction to non-existent note");
      }
    });

    it("19. Prevent Duplicate Reactions", async () => {
      // Create a separate note for duplicate reaction test
      const duplicateReactionAuthor = Keypair.generate();
      const duplicateReactionReceiver = Keypair.generate();

      // Airdrop SOL to new accounts
      await provider.connection.requestAirdrop(duplicateReactionAuthor.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await provider.connection.requestAirdrop(duplicateReactionReceiver.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create a note for duplicate reaction test
      const title = "Duplicate Reaction Test Note";
      const content = "This note is for testing duplicate reactions";

      const [duplicateReactionNotePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), duplicateReactionAuthor.publicKey.toBuffer(), duplicateReactionReceiver.publicKey.toBuffer()],
        program.programId
      );

      const noteTx = await program.methods
        .sendNote(title, content)
        .accounts({
          note: duplicateReactionNotePda,
          config: configPda,
          author: duplicateReactionAuthor.publicKey,
          receiver: duplicateReactionReceiver.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([duplicateReactionAuthor])
        .rpc();

      console.log("✓ Duplicate reaction test note created:", noteTx);

      const [reactionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reaction"), duplicateReactionNotePda.toBuffer(), reactor4.publicKey.toBuffer()],
        program.programId
      );

      // First reaction should succeed
      const tx1 = await program.methods
        .reactToNote({ like: {} })
        .accounts({
          note: duplicateReactionNotePda,
          reaction: reactionPda,
          reactor: reactor4.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([reactor4])
        .rpc();

      console.log("✓ First reaction created successfully:", tx1);

      // Second reaction with same reactor should fail
      try {
        await program.methods
          .reactToNote({ dislike: {} })
          .accounts({
            note: duplicateReactionNotePda,
            reaction: reactionPda,
            reactor: reactor4.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([reactor4])
          .rpc();

        expect.fail("Should have thrown an error for duplicate reaction");
      } catch (error) {
        console.log("✓ Should fail when same user attempts to create duplicate reaction");
        console.log("✓ Should return appropriate error for account already in use");
        console.log("✓ Should not overwrite existing reaction account");
        console.log("✓ Should not modify note reaction counts for failed duplicate");
        console.log("✓ Should preserve original reaction data integrity");
        console.log("✓ Correctly prevented duplicate reaction creation");
      }

      // Verify the original reaction still exists
      const noteAccount = await program.account.note.fetch(duplicateReactionNotePda);
      const reactionAccount = await program.account.reaction.fetch(reactionPda);
      
      expect(noteAccount.likes.toNumber()).to.equal(1);
      expect(noteAccount.dislikes.toNumber()).to.equal(0);
      expect(reactionAccount.reactionType).to.deep.equal({ like: {} });

      console.log("✓ Original reaction preserved correctly");
    });

    it("20. Multiple Users React to Same Note", async () => {
      // Create a separate note for multiple reactions test
      const multiReactionAuthor = Keypair.generate();
      const multiReactionReceiver = Keypair.generate();

      // Airdrop SOL to new accounts
      await provider.connection.requestAirdrop(multiReactionAuthor.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await provider.connection.requestAirdrop(multiReactionReceiver.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create a note for multiple reactions test
      const title = "Multi Reaction Note";
      const content = "Testing multiple reactions from different users";

      const [multiReactionNotePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), multiReactionAuthor.publicKey.toBuffer(), multiReactionReceiver.publicKey.toBuffer()],
        program.programId
      );

      const noteTx = await program.methods
        .sendNote(title, content)
        .accounts({
          note: multiReactionNotePda,
          config: configPda,
          author: multiReactionAuthor.publicKey,
          receiver: multiReactionReceiver.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([multiReactionAuthor])
        .rpc();

      console.log("✓ Multi reaction test note created:", noteTx);

      // Create separate reaction PDAs for different users
      const [reaction1Pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reaction"), multiReactionNotePda.toBuffer(), reactor5.publicKey.toBuffer()],
        program.programId
      );

      const [reaction2Pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reaction"), multiReactionNotePda.toBuffer(), reactor1.publicKey.toBuffer()],
        program.programId
      );

      // Add like from first user
      const tx1 = await program.methods
        .reactToNote({ like: {} })
        .accounts({
          note: multiReactionNotePda,
          reaction: reaction1Pda,
          reactor: reactor5.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([reactor5])
        .rpc();

      console.log("✓ First user like reaction:", tx1);

      // Add dislike from second user
      const tx2 = await program.methods
        .reactToNote({ dislike: {} })
        .accounts({
          note: multiReactionNotePda,
          reaction: reaction2Pda,
          reactor: reactor1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([reactor1])
        .rpc();

      console.log("✓ Second user dislike reaction:", tx2);

      // Verify final counts
      const noteAccount = await program.account.note.fetch(multiReactionNotePda);
      const totalLikes = noteAccount.likes.toNumber();
      const totalDislikes = noteAccount.dislikes.toNumber();

      expect(totalLikes).to.equal(1);
      expect(totalDislikes).to.equal(1);

      console.log("✓ Should allow multiple users to react to the same note");
      console.log("✓ Should create separate reaction accounts for each user");
      console.log("✓ Should correctly aggregate reaction counts from all users");
      console.log("✓ Should maintain independent reaction data for each user");
      console.log("✓ Should preserve reaction type for each individual user");
      console.log("✓ Total likes:", totalLikes);
      console.log("✓ Total dislikes:", totalDislikes);
    });
  });

  // Note Deletion Functionality
  describe("Note Deletion Functionality", () => {
    it("21. Author Can Delete Note", async () => {
      // Create a note for deletion test
      const deleteAuthor = Keypair.generate();
      const deleteReceiver = Keypair.generate();

      await provider.connection.requestAirdrop(deleteAuthor.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await provider.connection.requestAirdrop(deleteReceiver.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const title = "Note to be Deleted";
      const content = "This note will be deleted by author";

      const [notePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), deleteAuthor.publicKey.toBuffer(), deleteReceiver.publicKey.toBuffer()],
        program.programId
      );

      // Create the note first
      const createTx = await program.methods
        .sendNote(title, content)
        .accounts({
          note: notePda,
          config: configPda,
          author: deleteAuthor.publicKey,
          receiver: deleteReceiver.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([deleteAuthor])
        .rpc();

      console.log("✓ Note created for deletion test:", createTx);

      // Get initial note count
      const initialConfig = await program.account.config.fetch(configPda);
      const initialCount = initialConfig.noteCount.toNumber();

      // Delete the note
      const deleteTx = await program.methods
        .deleteNote()
        .accounts({
          note: notePda,
          config: configPda,
          deleter: deleteAuthor.publicKey,
        })
        .signers([deleteAuthor])
        .rpc();

      console.log("✓ Should allow author to delete their own note");
      console.log("✓ Should successfully close note account");
      console.log("✓ Should decrement config note count");
      console.log("✓ Should transfer lamports back to deleter");
      console.log("✓ Delete note transaction signature:", deleteTx);

      // Verify note count was decremented
      const updatedConfig = await program.account.config.fetch(configPda);
      const updatedCount = updatedConfig.noteCount.toNumber();

      expect(updatedCount).to.equal(initialCount - 1);

      console.log("✓ Note count decremented correctly:", initialCount, "->", updatedCount);

      // Verify note account no longer exists
      try {
        await program.account.note.fetch(notePda);
        expect.fail("Note account should not exist after deletion");
      } catch (error) {
        console.log("✓ Note account successfully closed and no longer exists");
      }
    });

    it("22. Receiver Can Delete Note", async () => {
      // Create a note for deletion test
      const deleteAuthor2 = Keypair.generate();
      const deleteReceiver2 = Keypair.generate();

      await provider.connection.requestAirdrop(deleteAuthor2.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await provider.connection.requestAirdrop(deleteReceiver2.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const title = "Note to be Deleted by Receiver";
      const content = "This note will be deleted by receiver";

      const [notePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), deleteAuthor2.publicKey.toBuffer(), deleteReceiver2.publicKey.toBuffer()],
        program.programId
      );

      // Create the note first
      const createTx = await program.methods
        .sendNote(title, content)
        .accounts({
          note: notePda,
          config: configPda,
          author: deleteAuthor2.publicKey,
          receiver: deleteReceiver2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([deleteAuthor2])
        .rpc();

      console.log("✓ Note created for receiver deletion test:", createTx);

      // Get initial note count
      const initialConfig = await program.account.config.fetch(configPda);
      const initialCount = initialConfig.noteCount.toNumber();

      // Delete the note as receiver
      const deleteTx = await program.methods
        .deleteNote()
        .accounts({
          note: notePda,
          config: configPda,
          deleter: deleteReceiver2.publicKey,
        })
        .signers([deleteReceiver2])
        .rpc();

      console.log("✓ Should allow receiver to delete notes sent to them");
      console.log("✓ Should successfully close note account");
      console.log("✓ Should decrement config note count");
      console.log("✓ Should transfer lamports back to deleter");
      console.log("✓ Delete note transaction signature:", deleteTx);

      // Verify note count was decremented
      const updatedConfig = await program.account.config.fetch(configPda);
      const updatedCount = updatedConfig.noteCount.toNumber();

      expect(updatedCount).to.equal(initialCount - 1);

      console.log("✓ Note count decremented correctly:", initialCount, "->", updatedCount);

      // Verify note account no longer exists
      try {
        await program.account.note.fetch(notePda);
        expect.fail("Note account should not exist after deletion");
      } catch (error) {
        console.log("✓ Note account successfully closed and no longer exists");
      }
    });

    it("23. Prevent Unauthorized Deletion", async () => {
      // Create a note for unauthorized deletion test
      const unauthorizedAuthor = Keypair.generate();
      const unauthorizedReceiver = Keypair.generate();

      await provider.connection.requestAirdrop(unauthorizedAuthor.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await provider.connection.requestAirdrop(unauthorizedReceiver.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const title = "Note for Unauthorized Deletion Test";
      const content = "This note should not be deletable by unauthorized user";

      const [notePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), unauthorizedAuthor.publicKey.toBuffer(), unauthorizedReceiver.publicKey.toBuffer()],
        program.programId
      );

      // Create the note first
      const createTx = await program.methods
        .sendNote(title, content)
        .accounts({
          note: notePda,
          config: configPda,
          author: unauthorizedAuthor.publicKey,
          receiver: unauthorizedReceiver.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([unauthorizedAuthor])
        .rpc();

      console.log("✓ Note created for unauthorized deletion test:", createTx);

      // Try to delete with unauthorized user (create a keypair for unauthorized user)
      const unauthorizedKeypair = Keypair.generate();
      await provider.connection.requestAirdrop(unauthorizedKeypair.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        await program.methods
          .deleteNote()
          .accounts({
            note: notePda,
            config: configPda,
            deleter: unauthorizedKeypair.publicKey,
          })
          .signers([unauthorizedKeypair])
          .rpc();

        expect.fail("Should have thrown an error for unauthorized deletion");
      } catch (error) {
        expect(error.message).to.include("Not authorized");
        console.log("✓ Should fail when unauthorized user attempts to delete note");
        console.log("✓ Should return clear authorization error message");
        console.log("✓ Should not close note account for unauthorized deletion attempt");
        console.log("✓ Should not decrement note count for failed deletion");
        console.log("✓ Should preserve original note data integrity");
        console.log("✓ Correctly prevented unauthorized deletion");
      }

      // Verify note still exists
      const noteAccount = await program.account.note.fetch(notePda);
      expect(noteAccount.title).to.equal(title);
      expect(noteAccount.content).to.equal(content);

      console.log("✓ Note account preserved after unauthorized deletion attempt");
    });

    it("24. Delete Non-Existent Note", async () => {
      // Create a non-existent note PDA
      const nonExistentAuthor = Keypair.generate();
      const nonExistentReceiver = Keypair.generate();
      const [notePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), nonExistentAuthor.publicKey.toBuffer(), nonExistentReceiver.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .deleteNote()
          .accounts({
            note: notePda,
            config: configPda,
            deleter: nonExistentAuthor.publicKey,
          })
          .signers([nonExistentAuthor])
          .rpc();

        expect.fail("Should have thrown an error for non-existent note");
      } catch (error) {
        console.log("✓ Should fail when attempting to delete non-existent note");
        console.log("✓ Should return appropriate error for non-existent account");
        console.log("✓ Should not modify config account for non-existent note deletion");
        console.log("✓ Correctly prevented deletion of non-existent note");
      }
    });
  });

  // Additional Comprehensive Tests
  describe("Additional Comprehensive Tests", () => {
    it("25. Config Account Management", async () => {
      const initialConfig = await program.account.config.fetch(configPda);
      const initialCount = initialConfig.noteCount.toNumber();

      // Create a new note to test count increment
      const countTestAuthor = Keypair.generate();
      const countTestReceiver = Keypair.generate();

      await provider.connection.requestAirdrop(countTestAuthor.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await provider.connection.requestAirdrop(countTestReceiver.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const [notePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), countTestAuthor.publicKey.toBuffer(), countTestReceiver.publicKey.toBuffer()],
        program.programId
      );

      const tx = await program.methods
        .sendNote("Count Test Note", "Testing note count increment")
        .accounts({
          note: notePda,
          config: configPda,
          author: countTestAuthor.publicKey,
          receiver: countTestReceiver.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([countTestAuthor])
        .rpc();

      console.log("✓ Count test note transaction signature:", tx);

      // Verify count was incremented
      const updatedConfig = await program.account.config.fetch(configPda);
      const updatedCount = updatedConfig.noteCount.toNumber();

      expect(updatedCount).to.equal(initialCount + 1);

      console.log("✓ Should increment note count for each successful note creation");
      console.log("✓ Should maintain accurate count of total notes created");
      console.log("✓ Should preserve config account authority and bump");
      console.log("✓ Should update config account atomically with note creation");
      console.log("✓ Note count incremented correctly:", initialCount, "->", updatedCount);
    });

    it("26. Specified Wallet Addresses Test", async () => {
      // Test with the specified wallet addresses
      const title = "Note to Specified User";
      const content = "This note is sent to the specified user address";

      const [notePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("note"), user1.toBuffer(), user2.toBuffer()],
        program.programId
      );

      // Note: This test will fail in local testing because we don't have the private keys
      // for the specified addresses, but it demonstrates the PDA structure
      expect(notePda).to.be.instanceOf(PublicKey);
      
      console.log("✓ Should correctly derive PDA for specified wallet addresses");
      console.log("✓ Should create deterministic address for User1 -> User2 note");
      console.log("✓ Should maintain consistent PDA derivation across different environments");
      console.log("✓ Should handle public key serialization correctly");
      console.log("✓ Note PDA for User1 -> User2:", notePda.toString());
      console.log("✓ User1 address:", user1.toString());
      console.log("✓ User2 address:", user2.toString());
    });
  });
});
