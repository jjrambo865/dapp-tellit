# TELLIT - Decentralized Note Sharing Platform

## Project Overview

TELLIT is a decentralized note-sharing platform built on Solana blockchain that allows users to send notes to each other, view them in a timeline, and react with likes/dislikes. The platform emphasizes simplicity and security with all operations happening on-chain.

## Core Features

### 1. Note Sending
- Users can send notes to other users by providing receiver address, title, and content
- All note data is stored on-chain with proper validation
- Duplicate notes (same author, receiver, title, and content) are prevented
- Maximum title length: 50 characters
- Maximum content length: 300 characters

### 2. Timeline View
- All notes are displayed in a chronological timeline
- Real-time timestamps from blockchain data (year, date, time)
- Auto-refresh and manual refresh capabilities
- Clean, modern UI with responsive design

### 3. Reactions System
- Users can like or dislike notes
- Reaction counts are tracked on-chain
- Real-time reaction updates

### 4. Note Management
- Users can delete their own notes or notes sent to them
- All operations are permission-based and secure

## Technical Architecture

### Backend (Solana Program)
- **Framework**: Anchor (Rust)
- **Program ID**: `BnT3T9mtNjXBEELoggRSQYN5gJhAb3Rvut3sH8mrMP6J`
- **Network**: Solana Devnet
- **Architecture**: 100% On-Chain Operations

#### Core Instructions
1. **`send_note_by_content`** - Send a new note
2. **`react_to_note_by_content`** - Add like/dislike reaction
3. **`delete_note_by_content`** - Delete a note
4. **`initialize`** - Initialize the program

#### Data Structures
- **Note**: Contains author, receiver, title, content, likes, dislikes, timestamps
- **Reaction**: Tracks user reactions to notes
- **Config**: Program configuration and note count

#### Security Features
- PDA-based account generation using Keccak-256 hashing
- Duplicate prevention through PDA uniqueness
- Authorization checks for all operations
- Input validation and length limits

### Frontend (React/Next.js)
- **Framework**: React with Next.js
- **Wallet Integration**: Solana Wallet Adapter
- **State Management**: React Context API
- **Styling**: CSS with modern design principles

#### Key Components
- **SendNoteTab**: Interface for sending new notes
- **TimelineTab**: Display of all notes with reactions
- **NoteItem**: Individual note display component
- **IntegrationMonitor**: Real-time status monitoring

#### Architecture Principles
- **Backend-Only Logic**: All complex operations (PDA generation, hashing) happen on-chain
- **Simple Frontend**: Frontend only sends raw inputs to backend
- **No Fallbacks**: Pure on-chain operations only
- **Real-time Updates**: Live blockchain data integration

## Development Setup

### Prerequisites
- Node.js 18+
- Rust 1.70+
- Solana CLI 1.16+
- Anchor Framework

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd task-05-program-jjrambo865

# Install dependencies
cd anchor_project/tellit
npm install

cd ../../frontend
npm install
```

### Running the Application
```bash
# Start Solana test validator
solana-test-validator --reset

# Build and deploy the program
cd anchor_project/tellit
anchor build
anchor deploy

# Run tests
anchor test

# Start frontend
cd ../../frontend
npm start
```

## Testing

### Test Coverage
- **Send Notes**: Success cases, duplicate prevention, validation
- **Reactions**: Like/dislike functionality
- **Timeline**: Note fetching and display
- **Validation**: Input length limits, authorization checks
- **Error Handling**: Comprehensive error scenarios

### Test Philosophy
- All tests run on-chain with real blockchain operations
- No mock data or fallback mechanisms
- Comprehensive happy and unhappy path testing
- Real-time validation of blockchain state

## Security Considerations

### On-Chain Security
- All operations validated on-chain
- PDA-based account security
- Cryptographic hashing for data integrity
- Authorization checks for all operations

### Frontend Security
- Wallet-based authentication
- No sensitive data stored locally
- All operations require wallet signatures
- Real-time blockchain validation

## Performance Optimizations

### Backend
- Efficient PDA generation using Keccak-256
- Optimized account space allocation
- Minimal compute unit usage
- Batch operations where possible

### Frontend
- Real-time data fetching
- Efficient state management
- Responsive UI design
- Minimal bundle size

## Future Enhancements

### Potential Features
- Note encryption for private messages
- Group messaging capabilities
- File attachment support
- Advanced search and filtering
- User profiles and reputation system

### Technical Improvements
- Cross-program invocation (CPI) support
- Advanced caching mechanisms
- Mobile app development
- Multi-chain support

## Contributing

### Development Guidelines
- Follow Rust best practices for backend development
- Maintain clean, readable React code
- Write comprehensive tests for all features
- Document all public APIs and functions
- Ensure all operations are on-chain

### Code Quality
- No hardcoded values or fallback mechanisms
- Comprehensive error handling
- Real-time logging and monitoring
- Performance optimization focus

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please refer to the project documentation or create an issue in the repository.

---

**Note**: This project emphasizes simplicity, security, and on-chain operations. All functionality is designed to work purely on the Solana blockchain without any off-chain dependencies or fallback mechanisms.
