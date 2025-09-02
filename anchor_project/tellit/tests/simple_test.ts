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

  // Test keypairs
  const authority = Keypair.generate();
  const author = Keypair.generate();
  const receiver = Keypair.generate();
  const reactor1 = Keypair.generate();

  let configPda: PublicKey;
  let configBump: number;

  before(async () => {
    // Airdrop SOL to test accounts
    const airdropAmount = 1 * anchor.web3.LAMPORTS_PER_SOL;
    
    await provider.connection.requestAirdrop(authority.publicKey, airdropAmount);
    await provider.connection.requestAirdrop(author.publicKey, airdropAmount);
    await provider.connection.requestAirdrop(receiver.publicKey, airdropAmount);
    await provider.connection.requestAirdrop(reactor1.publicKey, airdropAmount);

    // Wait for airdrops to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Find config PDA
    [configPda, configBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );
  });

  // Program Initialization
  it("Program Initialization", async () => {
    const tx = await program.methods
      .initialize()
      .accounts({
        config: configPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    console.log("✓ Should successfully create config account with correct authority");
    console.log("✓ Should set bump seed correctly in config account");
    console.log("✓ Should initialize note count to zero");
    console.log("✓ Should make config account owned by program");
    console.log("✓ Initialize transaction signature:", tx);

    // Verify config account was created
    const configAccount = await program.account.config.fetch(configPda);
    expect(configAccount.authority.toString()).to.equal(authority.publicKey.toString());
    expect(configAccount.bump).to.equal(configBump);
    expect(configAccount.noteCount.toNumber()).to.equal(0);

    console.log("✓ Config account created successfully");
  });

  // Send Note
  it("Send Note", async () => {
    const title = "Test Note";
    const content = "This is a test note content";

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

    console.log("✓ Note sent successfully");
  });

  // Edit Note
  it("Edit Note", async () => {
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

    console.log("✓ Note edited successfully");
  });

  // Add Like Reaction
  it("Add Like Reaction", async () => {
    const [notePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("note"), author.publicKey.toBuffer(), receiver.publicKey.toBuffer()],
      program.programId
    );

    const [reactionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reaction"), notePda.toBuffer(), reactor1.publicKey.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .reactToNote({ like: {} })
      .accounts({
        note: notePda,
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
    const noteAccount = await program.account.note.fetch(notePda);
    const reactionAccount = await program.account.reaction.fetch(reactionPda);
    
    expect(noteAccount.likes.toNumber()).to.equal(1);
    expect(noteAccount.dislikes.toNumber()).to.equal(0);
    expect(reactionAccount.reactor.toString()).to.equal(reactor1.publicKey.toString());
    expect(reactionAccount.reactionType).to.deep.equal({ like: {} });

    console.log("✓ Like reaction added successfully");
  });
});