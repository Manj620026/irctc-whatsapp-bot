# 🚂 Indian Railways WhatsApp Bot Starter (Node.js + Baileys)

[![Powered by irctc.dev](https://img.shields.io/badge/IRCTC_API-irctc.dev-blue?style=flat-square&logo=train)](https://irctc.dev)
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

A production-ready, open-source WhatsApp bot for Indian Railways passenger enquiries. Built with [Baileys](https://github.com/WhiskeySockets/Baileys) (WhatsApp Web Multi-Device WebSocket API) and powered by the [irctc.dev](https://irctc.dev) high-speed IRCTC API (< 10ms search, 430ms PNR).

---

## ✨ Features

- **Live Train GPS Tracking (`!live 12557`):** Real-time delay in minutes, last passed station, and platform numbers.
- **PNR Status & Berth Allocations (`!pnr 2265248473`):** Instant passenger status, coach, and berth details (`S4 65 LOWER BERTH`), plus chart preparation state.
- **Direct Train Search (`!search NDLS PNBE`):** Fast route discovery with durations, running days, and scheduled departure/arrival times.
- **Zero API Bloat:** Built with native Node.js `fetch` and persistent Baileys credentials.

---

## 🚀 3-Minute Quickstart

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Manj620026/irctc-whatsapp-bot.git
cd irctc-whatsapp-bot
npm install
```

### 2. Configure Environment
Copy the example environment file and configure your API key:
```bash
cp .env.example .env
```

Edit `.env`:
```env
IRCTC_API_KEY=your_irctc_api_key_here
IRCTC_API_BASE_URL=https://api.irctc.dev
```
*(Claim **10,000 Free Credits** on 1-click Google signup at [https://irctc.dev/dashboard](https://irctc.dev/dashboard))*

### 3. Start the Bot & Scan QR Code
```bash
npm start
```
Scan the terminal QR code with your WhatsApp app (**Settings ➔ Linked Devices ➔ Link a Device**).

Once connected, send any command to your connected number from another WhatsApp account:
```text
!live 12557
!pnr 2265248473
!search NDLS PNBE
```

---

## 📄 License

MIT © [irctc.dev Developer Platform](https://irctc.dev)
