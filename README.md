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

## Deploy on GitHub Pages

This app needs a signaling backend (`server.js`) for video calls. GitHub Pages hosts only frontend.

1. Deploy backend (`server.js`) on any Node host (Render/Railway/VPS).
2. In `public/config.js`, set:
   ```js
   window.SIGNALING_SERVER_URL = 'https://your-backend-url.com';
   ```
3. Push to `main`. GitHub Actions workflow will publish `public/` to Pages.
4. In GitHub repo settings, set **Pages → Source: GitHub Actions**.
