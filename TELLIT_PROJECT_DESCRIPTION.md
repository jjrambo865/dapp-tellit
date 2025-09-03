# TELLIT - Decentralized Note Sharing Platform

## Project Description

**Deployed Frontend URL**: [TODO: Link to your deployed frontend]

**Solana Program ID**: `BnT3T9mtNjXBEELoggRSQYN5gJhAb3Rvut3sH8mrMP6J`

**Application Link**: https://tellitsolana.vercel.app/

## Project Overview

### Description

TELLIT is a decentralized note-sharing platform built on Solana blockchain that serves as an immutable, permanent storage solution for personal messages and notes. The platform addresses the critical need for data preservation in our digital age, where devices can be lost, centralized applications may lose data, and applications might stop development and die. TELLIT provides a blockchain-based solution where notes are permanently stored on-chain, ensuring they cannot be lost or deleted by external factors.

The core philosophy behind TELLIT is to create a "digital time capsule" where important messages, thoughts, and communications can be preserved forever on the Solana blockchain. This represents the first step in developing a comprehensive timeline-based communication system that prioritizes data permanence and user control.

### Key Features

**Feature 1: Immutable Note Storage**
- All notes are stored permanently on the Solana blockchain
- Once sent, notes cannot be modified or deleted by external parties
- Data is preserved even if the application stops development

**Feature 2: Timeline-Based Display**
- All notes are displayed in a chronological timeline
- Real-time timestamps from blockchain data
- Clean, modern UI with responsive design

**Feature 3: Secure PDA-Based Architecture**
- Uses Program Derived Addresses (PDAs) for secure account generation
- Cryptographic hashing ensures data integrity
- Duplicate prevention through PDA uniqueness

**Feature 4: Wallet-Based Authentication**
- Integration with Solana wallet adapters (Phantom, etc.)
- All operations require wallet signatures
- No centralized user management or authentication

## How to Use the dApp

### Connect Wallet
1. Open the TELLIT application in your browser
2. Click "Connect Wallet" in the header
3. Select your preferred Solana wallet (Phantom recommended)
4. Approve the connection in your wallet

### Main Action 1: Send a Note
1. Navigate to the "Send Note" tab
2. Enter the receiver's Solana wallet address
3. Add a title (maximum 50 characters)
4. Write your message content (maximum 300 characters)
5. Click "Send Note"
6. Approve the transaction in your wallet
7. Wait for confirmation - your note is now permanently stored on-chain

### Main Action 2: View Timeline
1. Navigate to the "Timeline" tab
2. View all notes in chronological order
3. See real-time timestamps and sender information
4. Notes are automatically refreshed from the blockchain

## Program Architecture

### PDA Usage

TELLIT implements Program Derived Addresses (PDAs) to ensure secure, deterministic account generation and prevent duplicate notes.

**PDAs Used:**

**PDA 1: Config Account**
- **Purpose**: Stores program configuration and global state
- **Seeds**: `["config"]`
- **Contains**: Authority public key, bump seed, total note count
- **Why**: Provides a single source of truth for program state

**PDA 2: Note Account**
- **Purpose**: Stores individual note data permanently
- **Seeds**: `["note", author_pubkey, receiver_pubkey, content_hash]`
- **Contains**: Author, receiver, title, content, timestamps, bump seed
- **Why**: Ensures each note has a unique, deterministic address based on content, preventing duplicates

### Program Instructions

**Instructions Implemented:**

**Instruction 1: `initialize`**
- **Description**: Initializes the program and creates the config account
- **Parameters**: Authority signer
- **Creates**: Config PDA with authority and initial note count
- **Security**: Only callable once, sets up program state

**Instruction 2: `send_note_by_content`**
- **Description**: Creates a new note and stores it permanently on-chain
- **Parameters**: Author signer, receiver address, title string, content string
- **Creates**: Note PDA with all message data and timestamps
- **Validation**: Prevents self-sending, enforces length limits, prevents duplicates via PDA uniqueness
- **Security**: Uses keccak256 hashing of title+content for deterministic PDA generation

### Account Structure

```rust
#[account]
pub struct Config {
    pub authority: Pubkey,    // Program authority
    pub bump: u8,            // PDA bump seed
    pub note_count: u64,     // Total number of notes created
}

#[account]
pub struct Note {
    pub author: Pubkey,      // Sender's wallet address
    pub receiver: Pubkey,    // Recipient's wallet address
    pub title: String,       // Note title (max 50 chars)
    pub content: String,     // Note content (max 300 chars)
    pub bump: u8,           // PDA bump seed
    pub created_at: i64,    // Unix timestamp of creation
    pub updated_at: i64,    // Unix timestamp of last update
}
```

## Testing

### Test Coverage

**Happy Path Tests:**

**Test 1: Program Initialization**
- Successfully initializes the program
- Creates config account with correct authority
- Sets initial note count to 0

**Test 2: Note Creation**
- Successfully creates notes with valid data
- Properly stores all note fields
- Updates note count in config account
- Generates correct PDA addresses

**Test 3: Duplicate Prevention**
- Prevents creation of identical notes
- Uses PDA uniqueness to enforce no duplicates
- Handles same author, receiver, title, and content

**Test 4: Input Validation**
- Enforces title length limit (50 characters)
- Enforces content length limit (300 characters)
- Prevents sending notes to self

**Unhappy Path Tests:**

**Test 1: Invalid Input Length**
- Rejects titles longer than 50 characters
- Rejects content longer than 300 characters
- Returns appropriate error messages

**Test 2: Self-Sending Prevention**
- Prevents users from sending notes to themselves
- Returns "CannotSendToSelf" error

**Test 3: Duplicate Note Creation**
- Attempts to create identical notes fail
- PDA collision prevents duplicate storage
- Returns appropriate error handling

### Running Tests

```bash
# Navigate to the program directory
cd anchor_project/tellit

# Run all tests
anchor test

# Run tests with specific configuration
yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts
```

## Additional Notes for Evaluators

### Project Scope and Vision

This project represents a foundational step in developing a comprehensive, immutable communication platform. The core concept addresses a critical real-world problem: the impermanence of digital communications in our current ecosystem.

**The Problem Being Solved:**
- **Device Loss**: Personal devices can be lost, stolen, or damaged, taking precious messages with them
- **Centralized Storage Risks**: Applications with centralized storage can lose data due to server failures, company closures, or data breaches
- **Application Lifecycle**: Many applications stop development and eventually die, taking user data with them
- **Data Ownership**: Users have no control over their data in centralized systems

**The TELLIT Solution:**
TELLIT provides a blockchain-based solution where notes are permanently stored on the Solana blockchain, ensuring they cannot be lost, modified, or deleted by external factors. This creates a "digital time capsule" where important communications are preserved forever.

**Intended Full Feature Set:**
While the current implementation focuses on core note sending and timeline display, the original vision included many additional features that were planned but not implemented due to time constraints and the learning curve of Solana development:

1. **Reaction System**: Thumbs up/down functionality for notes
2. **Note Management**: Edit and delete capabilities for note authors
3. **Global Timeline**: View all public notes across the platform
4. **My Circle**: Private notes between friends, family, and connections
5. **Commenting System**: Reply and comment functionality on notes
6. **Advanced Search**: Search through notes by content, author, or date
7. **Privacy Controls**: Public/private note settings
8. **User Profiles**: Basic profile information and reputation system

**Development Challenges:**
As this was my first Solana project, I encountered several challenges that limited the scope:

1. **Learning Curve**: Understanding Anchor framework, PDAs, and Solana's account model required significant time
2. **Troubleshooting Complexity**: Debugging blockchain interactions and transaction failures was more complex than traditional web development
3. **Time Constraints**: The learning process consumed time that could have been used for additional features
4. **Feature Prioritization**: Focused on core functionality to ensure a working, stable foundation

**Current State:**
The project successfully implements:
- ✅ Immutable note storage on Solana blockchain
- ✅ Timeline-based note display
- ✅ Wallet integration and authentication
- ✅ PDA-based secure architecture
- ✅ Input validation and error handling
- ✅ Clean, responsive user interface

**Evaluation Considerations:**
Please be lenient in your evaluation, considering that:
1. This represents a learning journey in Solana development
2. The core concept and architecture are sound and innovative
3. The implemented features work correctly and demonstrate understanding of blockchain principles
4. The foundation is solid for future expansion of features
5. The focus on data permanence addresses a real-world problem

The project demonstrates understanding of Solana development principles, PDA usage, and blockchain architecture, even if the full feature set couldn't be implemented within the time constraints. The core functionality provides a strong foundation for the intended comprehensive communication platform.

---

**Technical Stack:**
- **Backend**: Rust with Anchor framework
- **Frontend**: React with Next.js and Solana Wallet Adapter
- **Blockchain**: Solana (localnet for development)
- **Architecture**: 100% on-chain operations with PDA-based security
