# P2P WebShare

**Serverless, browser-to-browser file sharing via WebRTC.**

Drop a file, share the link, and transfer directly — peer-to-peer. The signaling server only brokers the connection handshake; **zero file bytes ever touch the backend**.

---

## Architecture

```
[Sender Browser]                 [Signaling Server]                [Receiver Browser]
     |  1. Create Room                  |                                  |
     |--------------------------------->|                                  |
     |        Room ID / link            |                                  |
     |<---------------------------------|                                  |
     |                                  |   2. Receiver joins Room ID      |
     |                                  |<---------------------------------|
     |  3. SDP Offer  -------------------------------------------------->|
     |                                  |         (relayed via socket)     |
     |  4. SDP Answer <--------------------------------------------------|
     |  5. ICE Candidates <---------------------------------------------->|
     |                                                                     |
     |==================== 6. Direct WebRTC DataChannel ==================|
     |         (file chunks + hashes flow ONLY here, peer-to-peer)        |
```

### Key Design Decisions

- **Raw `RTCPeerConnection`** — no wrapper libraries. Direct access to `bufferedAmount` for backpressure control during chunked transfers.
- **Wire protocol** — control messages (metadata, complete, error) sent as JSON strings; chunk data sent as `ArrayBuffer` with a 4-byte LE uint32 index header. Receiver distinguishes them via `typeof` check (string vs ArrayBuffer).
- **SHA-256 integrity** — whole-file hash computed before transfer, verified on the receiver after reassembly via Web Crypto API (`SubtleCrypto`).
- **64 KB chunks** — within the safe DataChannel message size ceiling (~256KB varies by browser), gives responsive progress updates.
- **Backpressure control** — sender pauses at 128KB `bufferedAmount` threshold, resumes on `bufferedamountlow` event (64KB). Rejects cleanly if the DataChannel closes or errors during the wait (no hanging promises).
- **Server hardening** — Socket.io `maxHttpBufferSize` capped at 64KB. Signaling payloads (SDP ~2-5KB, ICE ~200B) never exceed 20KB. This prevents relay abuse even via a malicious client.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS 3 |
| P2P Communication | Native WebRTC API (`RTCPeerConnection` + `RTCDataChannel`) |
| Signaling Backend | Node.js, Express, Socket.io |
| Crypto / Hashing | Web Crypto API (SubtleCrypto — SHA-256) |

---

## Project Structure

```
p2p-webshare/
├── client/                     # React + Tailwind SPA
│   ├── src/
│   │   ├── components/         # Dropzone, ProgressBar, StatusBadge, RoomLink, FileInfo, TransferPage
│   │   ├── hooks/              # useSocket, useWebRTC, useFileTransfer
│   │   ├── utils/              # hashing.js, chunking.js, protocol.js, crypto.js
│   │   ├── App.jsx             # Router: / (sender) and /room/:roomId (receiver)
│   │   ├── main.jsx            # React root + BrowserRouter
│   │   └── index.css           # Tailwind directives + custom styles
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── server/                     # Signaling-only backend
│   ├── index.js                # Express + Socket.io event handlers
│   ├── rooms.js                # In-memory room state management
│   └── package.json
├── package.json                # Root workspace scripts
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd p2p-webshare

# Install all dependencies (root + server + client)
npm run install:all
```

### Development

```bash
# Start both server (port 3001) and client (port 5173) concurrently
npm run dev
```

Or start them separately:

```bash
# Terminal 1: Signaling server
cd server && npm run dev

# Terminal 2: React client
cd client && npm run dev
```

Open `http://localhost:5173` in your browser.

### Production Build

```bash
# Build the client
npm run build

# Start the signaling server
npm start
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Signaling server port |
| `VITE_SIGNALING_URL` | `''` (empty = same origin via Vite proxy) | Signaling server URL for the client in production |

---

## How It Works

### Sender Flow
1. Drop a file on the dropzone (max 50 MB for MVP)
2. Click "Create Transfer Room"
3. Share the generated link with the receiver
4. When receiver connects, WebRTC handshake completes automatically
5. File is chunked (64 KB), SHA-256 hashed, and streamed over the DataChannel
6. Progress bar shows live transfer stats (%, speed, ETA)

### Receiver Flow
1. Open the shared link (`/room/:roomId`)
2. WebRTC connection establishes automatically
3. File chunks arrive, progress is tracked in real-time
4. On completion, whole-file SHA-256 is verified against the sender's hash
5. File auto-downloads to the browser

### Error Handling
- **Peer disconnect mid-transfer**: UI shows "Connection Lost" instead of hanging or freezing
- **Incomplete transfer**: If not all chunks arrived, a clear "Incomplete transfer — received X of Y chunks" message appears (distinct from hash mismatch)
- **Hash mismatch**: If all chunks arrived but data is corrupted, "File integrity check failed — SHA-256 hash mismatch" is shown
- **Room not found**: Receiver sees "Room Not Found" with an explanation and a back-to-home button
- **Room full**: Rejected with an error if a third peer tries to join

---

## Browser Compatibility

| Browser | Status | Tested |
|---|---|---|
| Chrome / Edge (Chromium) | ✅ Fully supported | ✅ Verified |
| Brave | ✅ Fully supported | ✅ Verified (sender) |
| Firefox | ✅ Fully supported | — |
| Safari | ⚠️ WebRTC support available but may have quirks with DataChannel reliability | — |
| Mobile Chrome/Firefox | ✅ Should work on same-network transfers | — |

---

## Test Results

End-to-end functional testing has been completed for the following scenarios:

| Test | Result | Details |
|---|---|---|
| Same-machine two-tab transfer | ✅ Pass | PDF file (791KB, 13 chunks), SHA-256 hash verified ✓, auto-download works |
| Sender-tab-kill mid-transfer | ✅ Pass | Receiver shows "Connection Lost", no crash/freeze |
| Receiver-tab-kill mid-transfer | ✅ Pass | Sender shows "Connection Lost", no crash/freeze |
| Oversized file (>50MB) rejection | ✅ Pass | "File is too large. Max size is 50 MB." |
| Invalid room ID | ✅ Pass | "Room not found" error surfaced correctly |
| Cross-browser (Brave → Edge) | ✅ Pass | Transfer completes across different Chromium browsers |
| Network tab audit | ✅ Pass | Code audit confirmed zero file bytes in signaling traffic; `maxHttpBufferSize` hardening applied |
| Cross-network (STUN) | ⏳ Deferred | Requires public deployment; not testable on localhost |

---

## Signaling Server Audit

The signaling server has been audited to confirm it is a **matchmaker, not a courier**:

- **6 socket event handlers**: `create-room`, `join-room`, `offer`, `answer`, `ice-candidate`, `disconnect`
- Each handler only relays signaling data (room IDs, SDP objects, ICE candidates)
- **Zero file data paths**: `useFileTransfer.js` has no references to `socket` or `emit` — file data flows exclusively through `dc.send()` on the `RTCDataChannel`
- **Server logs**: Only socket IDs, room IDs, and connection events. Never logs payload content.
- **Message size cap**: Socket.io `maxHttpBufferSize` set to 64KB (signaling payloads are typically 2-5KB)

To verify yourself:
1. Open browser DevTools → Network tab → WS filter
2. Inspect Socket.io frames during a transfer
3. You'll see only: `create-room`, `room-created`, `join-room`, `room-joined`, `offer`, `answer`, `ice-candidate`, `peer-joined`, `peer-left`
4. **Zero file bytes** appear in the WebSocket traffic

The `/health` endpoint confirms room count only:
```bash
curl http://localhost:3001/health
# {"status":"ok","rooms":0}
```

---

## Known Limitations

### NAT Traversal / TURN Servers

This is a **deliberate MVP scoping decision**, not an oversight.

- **STUN** (free, via Google's public servers) handles most home/office NAT scenarios — direct peer-to-peer connections work on the majority of consumer networks.
- **TURN** is required for symmetric NAT, strict corporate firewalls, and some mobile carriers. TURN relays traffic at the WebRTC layer (not the application layer), so file data still doesn't touch *our* signaling server, but it does pass through the TURN server.
- **Why we skip TURN for MVP**: Reliable TURN servers cost money to run. Free tiers (Metered.ca, Twilio) have limited bandwidth and are unsuitable for file transfers.
- **To enable TURN**: Edit `ICE_SERVERS` in [`useWebRTC.js`](client/src/hooks/useWebRTC.js) — uncomment the TURN config and add your credentials:

```js
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: 'turn:your-turn-server.com:3478',
    username: 'your-username',
    credential: 'your-credential',
  },
];
```

### Other Limitations

- **File size**: 50 MB max for MVP (in-memory buffering on receiver side)
- **Peers per room**: 2 (1 sender + 1 receiver)
- **No resume**: If the connection drops, the transfer must restart from scratch
- **No application-layer encryption**: File data is unencrypted at the application layer. WebRTC's DTLS provides transport-layer encryption, but there is no zero-knowledge encryption where only the sender and receiver can read the data.

---

## Stretch Features (Not Yet Implemented)

| Priority | Feature | Description |
|---|---|---|
| 🔴 High | Zero-knowledge encryption (S3) | AES-GCM via Web Crypto, key in URL fragment (`#key=...`) — never hits server. Crypto.js stubs already in place. |
| 🟡 Medium | Auto-resume (S4) | Track last verified chunk index, resume from `lastIndex + 1` on reconnect to same room |
| 🟡 Medium | Large file support (S2) | Streams API + OPFS/IndexedDB for 500MB+ files without blowing browser memory |
| 🟢 Low | Multi-peer mesh (S1) | Parallel chunk download from 2+ peers with chunk-range negotiation |

---

## License

MIT
