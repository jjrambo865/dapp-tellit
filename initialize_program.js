const anchor = require('@coral-xyz/anchor');
const { PublicKey, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');

async function initializeProgram() {
  // Load the IDL
  const idl = JSON.parse(fs.readFileSync('./anchor_project/tellit/target/idl/tellit.json', 'utf8'));
  
  // Set up the connection
  const connection = new anchor.web3.Connection('http://127.0.0.1:8899', 'confirmed');
  
  // Load the wallet
  const wallet = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(process.env.HOME + '/.config/solana/id.json', 'utf8')))
  );
  
  // Create the provider
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), {});
  anchor.setProvider(provider);
  
  // Create the program
  const programId = new PublicKey('BnT3T9mtNjXBEELoggRSQYN5gJhAb3Rvut3sH8mrMP6J');
  const program = new anchor.Program(idl, programId, provider);
  
  // Calculate the config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    programId
  );
  
  console.log('Config PDA:', configPda.toString());
  console.log('Authority:', wallet.publicKey.toString());
  
  try {
    // Initialize the program
    const tx = await program.methods.initialize()
      .accounts({
        config: configPda,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log('Program initialized successfully!');
    console.log('Transaction signature:', tx);
  } catch (error) {
    if (error.message.includes('already in use')) {
      console.log('Program already initialized');
    } else {
      console.error('Error initializing program:', error);
    }
  }
}

initializeProgram().catch(console.error);
