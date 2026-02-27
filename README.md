# Gulugulu

A minimal WebRTC + Socket.IO app where 2+ users can:
- Join the same room for video call
- Keep camera/mic active
- Start screen sharing without closing camera video

## Run

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start server:
   ```bash
   npm start
   ```
3. Open in browser:
   ```
   http://localhost:3000
   ```
4. Open the same URL in two or more tabs/devices and join with the same Room ID.

## Notes

- For production, use HTTPS and proper TURN servers.
- Current setup uses public STUN server for basic connectivity.
