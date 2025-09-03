import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Tellit } from "../target/types/tellit";
import { PublicKey, SystemProgram } from "@solana/web3.js";

describe("Initialize Program", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Tellit as Program<Tellit>;
  const provider = anchor.getProvider();

  it("Initialize the program", async () => {
    // Calculate the config PDA
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    console.log("Config PDA:", configPda.toString());
    console.log("Authority:", provider.wallet.publicKey.toString());

    try {
      // Initialize the program
      const tx = await program.methods.initialize()
        .accounts({
          config: configPda,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Program initialized successfully!");
      console.log("Transaction signature:", tx);
    } catch (error: any) {
      if (error.message.includes('already in use') || error.message.includes('already initialized')) {
        console.log("Program already initialized");
      } else {
        console.error("Error initializing program:", error);
        throw error;
      }
    }
  });
});
