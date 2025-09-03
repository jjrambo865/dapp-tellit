# Tellit Backend Server

This backend server maintains the **key principle** for the Tellit Solana program:

## Key Principle
- **Frontend** → submits raw inputs (wallet IDs, title, note, emoji)
- **Backend** → derives PDA + validates uniqueness + makes Anchor calls

## Architecture

```
Frontend (React) → HTTP API → Backend Server → Solana Program
     ↓                ↓              ↓              ↓
Raw inputs      JSON requests   PDA derivation   Blockchain
```

## Features

- ✅ **PDA Derivation**: Backend calculates all Program Derived Addresses
- ✅ **Hashing**: Backend handles Keccak-256 hashing for content uniqueness
- ✅ **Validation**: Backend validates all inputs and business logic
- ✅ **Anchor Calls**: Backend makes all Solana program calls
- ✅ **Error Handling**: Comprehensive error handling and logging
- ✅ **Rate Limiting**: Built-in rate limiting for API calls

## API Endpoints

### POST /api/send-note
Send a note from author to receiver.

**Request:**
```json
{
  "title": "Hello",
  "content": "This is a test note",
  "authorWallet": "wallet_address_here",
  "receiverWallet": "receiver_address_here"
}
```

**Response:**
```json
{
  "success": true,
  "transactionId": "transaction_signature_here"
}
```

### POST /api/react-to-note
Add a like or dislike reaction to a note.

**Request:**
```json
{
  "title": "Hello",
  "content": "This is a test note",
  "authorWallet": "author_address_here",
  "receiverWallet": "receiver_address_here",
  "reactorWallet": "reactor_address_here",
  "reactionType": "like"
}
```

### POST /api/delete-note
Delete a note (by author or receiver).

**Request:**
```json
{
  "title": "Hello",
  "content": "This is a test note",
  "authorWallet": "author_address_here",
  "receiverWallet": "receiver_address_here",
  "deleterWallet": "deleter_address_here"
}
```

### GET /api/get-notes/:receiverWallet
Get all notes for a specific receiver.

**Response:**
```json
{
  "success": true,
  "notes": [
    {
      "author": "author_address",
      "receiver": "receiver_address",
      "title": "Hello",
      "content": "This is a test note",
      "likes": 5,
      "dislikes": 1,
      "createdAt": 1234567890,
      "updatedAt": 1234567890
    }
  ]
}
```

## Setup

1. **Install dependencies:**
   ```bash
   cd backend-server
   npm install
   ```

2. **Configure environment:**
   ```bash
   export ANCHOR_PROVIDER_URL=http://127.0.0.1:8899
   export TELLIT_PROGRAM_ID=your_program_id_here
   ```

3. **Copy IDL:**
   ```bash
   cp ../anchor_project/tellit/target/idl/tellit.json ./idl.json
   ```

4. **Start server:**
   ```bash
   npm start
   ```

## Key Benefits

1. **Clean Separation**: Frontend only handles UI, backend handles all blockchain complexity
2. **Security**: All PDA derivation and validation happens on the backend
3. **Maintainability**: Centralized blockchain logic
4. **Scalability**: Backend can handle rate limiting, caching, etc.
5. **Testing**: Easier to test backend logic independently

## Error Handling

The server provides comprehensive error handling:
- Input validation errors
- Solana program errors
- Network errors
- PDA derivation errors

All errors are returned in a consistent format:
```json
{
  "success": false,
  "error": "Error message here"
}
```

## Development

For development with auto-restart:
```bash
npm run dev
```

The server will automatically restart when files change.
