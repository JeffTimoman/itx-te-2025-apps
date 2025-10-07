# itx-te-2025-apps
Apps for itx-te-2025

## Run locally on your LAN (access from phone/tablet)

Follow these steps to run the backend and frontend on your PC and open the app from other devices on the same network.

1. Find your PC local IP (example output: `192.168.1.100`):

```powershell
ipconfig | Select-String 'IPv4 Address'
```

2. Start the backend (replace `192.168.1.100` with your IP):

```powershell
cd C:\Users\bcamaster\Documents\bca\itx-te-2025-apps\fast-tap-backend
#$env:CORS_ORIGIN = "http://192.168.1.100:3000"    # optional: set if testing from phone
#$env:ENABLE_REDIS = "false"                       # optional: disable redis for testing
node server.js
```

3. Start the frontend and point it to the backend (in another terminal):

```powershell
cd C:\Users\bcamaster\Documents\bca\itx-te-2025-apps\frontend
#$env:NEXT_PUBLIC_BACKEND_URL = "http://192.168.1.100:5000"
npm install
npm run dev -- --hostname 0.0.0.0
```

4. Open from phone in the same Wi‑Fi network:

http://192.168.1.100:3000

Firewall (Windows): allow ports 3000 and 5000 while testing:

```powershell
# Run as Admin
New-NetFirewallRule -DisplayName "FastTap Frontend" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "FastTap Backend" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

Notes
- If your phone can't connect, make sure it's on the same network and that the firewall allows the ports. Use the `/health` endpoint to verify the backend: `http://<PC_IP>:5000/health`.
- For production or wider testing, consider running a production build of the frontend (`npm run build && npm start`) and using a process manager or reverse proxy.
