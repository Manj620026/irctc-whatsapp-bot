'use strict';

/**
 * Production Indian Railways WhatsApp Bot Starter
 * Powered by irctc.dev API and Baileys (WhatsApp Web Multi-Device Socket)
 *
 * Commands:
 *  !live <trainNo>           - Check live train GPS running delay & next station
 *  !pnr <10-digit-pnr>       - Check live PNR status, coach, and berth details
 *  !search <from> <to>       - Search direct trains between two station codes
 *  !help                     - Display available bot commands
 */

try {
  require('dotenv').config();
} catch (_) {}

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

function sanitizeBaseUrl(url) {
  const clean = (url || 'https://api.irctc.dev').trim().replace(/\/+$/, '');
  try {
    const parsed = new URL(clean);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'https://api.irctc.dev';
    }
    return clean;
  } catch (_) {
    return 'https://api.irctc.dev';
  }
}

const BASE_URL = sanitizeBaseUrl(process.env.IRCTC_API_BASE_URL);
const API_KEY = (process.env.IRCTC_API_KEY || '').trim(); // Claim 10,000 free credits at https://irctc.dev/dashboard

const FOOTER = '\n\n⚡ _Powered by irctc.dev (Sub-10ms Indian Railways IRCTC API)_';

// Anti-spam sliding window cooldown (prevents rapid credit draining)
const userCooldowns = new Map();
const COOLDOWN_MS = 2000;

function checkCooldown(userId) {
  const now = Date.now();
  if (userCooldowns.has(userId)) {
    const last = userCooldowns.get(userId);
    if (now - last < COOLDOWN_MS) {
      return false;
    }
  }
  userCooldowns.set(userId, now);
  if (userCooldowns.size > 1000) {
    for (const [k, v] of userCooldowns.entries()) {
      if (now - v > 60000) userCooldowns.delete(k);
    }
  }
  return true;
}

async function apiRequest(endpoint) {
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'irctc-whatsapp-bot-starter/1.0.0',
  };
  if (API_KEY) {
    headers['x-api-key'] = API_KEY;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || errorBody.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function handleCommand(text) {
  const parts = text.trim().split(/\s+/);
  const command = (parts[0] || '').toLowerCase();

  switch (command) {
    case '!live': {
      const trainNo = parts[1];
      if (!trainNo || !/^\d{4,5}$/.test(trainNo)) {
        return '⚠️ *Invalid Format*: Please provide a valid 4-5 digit train number.\n_Example: !live 12557_' + FOOTER;
      }

      try {
        const json = await apiRequest(`/api/v1/live/${trainNo}`);
        const d = json.data || {};
        const delay = d.currentDelayMin !== undefined && d.currentDelayMin !== null
          ? d.currentDelayMin
          : parseInt(d.delayMinutes || d.delay || 0, 10);
        const delayStr = d.currentDelayStr
          ? `*${d.currentDelayStr.toUpperCase()}*`
          : (delay <= 0 ? '🟢 *ON TIME*' : `🔴 *DELAYED BY ${delay} MINS*`);

        const locStatus = d.locationStatus ? `${d.locationStatus.toUpperCase()}: ` : '';
        const lastStn = `${locStatus}${d.currentLocation || d.currentStationName || d.lastStation || 'In Transit'}`;
        const nextStnObj = Array.isArray(d.stops) ? d.stops.find(s => s.status === 'upcoming') : null;
        const nextStn = d.nextStationName || d.nextStation || (nextStnObj ? nextStnObj.stationName : 'N/A');
        const platform = d.platform ? ` (Platform ${d.platform})` : '';

        return `🚂 *Live Train Status: ${trainNo} ${d.trainName || ''}*\n` +
          `────────────────────────\n` +
          `• *Status*: ${delayStr}\n` +
          `• *Current Location*: ${lastStn}\n` +
          `• *Next Station*: ${nextStn}${platform}\n` +
          `• *Last Updated*: ${d.lastUpdated || d.updatedAt || 'Just now'}` +
          FOOTER;
      } catch (err) {
        return `❌ *Error*: Could not fetch live status for train ${trainNo} (${err.message}).` + FOOTER;
      }
    }

    case '!pnr': {
      const pnr = (parts[1] || '').replace(/[\s-]/g, '');
      if (!/^\d{10}$/.test(pnr)) {
        return '⚠️ *Invalid Format*: Please provide a 10-digit Indian Railways PNR number.\n_Example: !pnr 2265248473_' + FOOTER;
      }

      try {
        const json = await apiRequest(`/api/v1/pnr/${pnr}`);
        const d = json.data || {};
        const train = `${d.trainNumber || ''} - ${d.trainName || ''}`;
        const fromStn = typeof d.from === 'object' ? (d.from?.name || d.from?.code || '') : (d.from || d.boardingStation || '');
        const toStn = typeof d.to === 'object' ? (d.to?.name || d.to?.code || '') : (d.to || d.destinationStation || '');
        const journey = `${fromStn} ➔ ${toStn}`;
        const isChartPrepared = d.chartStatus === 'chart_prepared' || d.chartPrepared === true || d.chartStatus === 'prepared';
        const chart = isChartPrepared ? '🟢 *Chart Prepared*' : '⏳ *Chart Not Prepared*';

        let passengers = '';
        if (Array.isArray(d.passengers)) {
          passengers = d.passengers.map((p, idx) => {
            const status = p.status || p.currentStatus || p.bookingStatus || 'CNF';
            const berth = p.berth && p.berth !== 'N.A' ? ` (${p.berth})` : '';
            const seatNum = p.seat || p.berthNumber || p.seatNumber;
            const seat = p.coach ? ` • Coach ${p.coach}${seatNum ? ` / Seat ${seatNum}` : ''}${berth}` : '';
            return `  • *Passenger ${idx + 1}*: ${status}${seat}`;
          }).join('\n');
        }

        return `🎫 *IRCTC PNR Status: ${pnr}*\n` +
          `────────────────────────\n` +
          `• *Train*: ${train}\n` +
          `• *Route*: ${journey}\n` +
          `• *Date*: ${d.dateOfJourney || d.journeyDate || 'N/A'}\n` +
          `• *Charting*: ${chart}\n` +
          `────────────────────────\n` +
          `*Passenger Breakdown:*\n${passengers || '  • No passenger data'}` +
          FOOTER;
      } catch (err) {
        return `❌ *Error*: PNR ${pnr} could not be resolved (${err.message}).` + FOOTER;
      }
    }

    case '!search': {
      const from = (parts[1] || '').trim().toUpperCase();
      const to = (parts[2] || '').trim().toUpperCase();
      if (!from || !to) {
        return '⚠️ *Invalid Format*: Please provide origin and destination station codes.\n_Example: !search NDLS PNBE_' + FOOTER;
      }
      if (!/^[A-Z]{2,6}$/.test(from) || !/^[A-Z]{2,6}$/.test(to)) {
        return '⚠️ *Invalid Station Code*: Please provide valid 2-6 letter station codes (e.g. `NDLS`, `PNBE`, `HWH`).\n_Example: !search NDLS PNBE_' + FOOTER;
      }

      try {
        const json = await apiRequest(`/api/v1/trains/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
        const trains = json.data || [];
        if (!trains.length) {
          return `ℹ️ *No direct trains found* between ${from} and ${to}.` + FOOTER;
        }

        const topTrains = trains.slice(0, 5).map((t) => {
          return `• *${t.trainNo} ${t.trainName}*\n  Dep: ${t.departure} | Arr: ${t.arrival} | Dur: ${t.durationStr || t.duration} | Runs: ${(t.runningDays || []).join(', ')}`;
        }).join('\n\n');

        return `🚆 *Trains between ${from} and ${to}* (${trains.length} trains found):\n` +
          `────────────────────────\n` +
          topTrains +
          (trains.length > 5 ? `\n\n_...and ${trains.length - 5} more trains._` : '') +
          FOOTER;
      } catch (err) {
        return `❌ *Error*: Train search failed (${err.message}).` + FOOTER;
      }
    }

    case '!help':
    default:
      return '🚂 *Indian Railways WhatsApp Bot*\n' +
        '────────────────────────\n' +
        'Send any of the following commands:\n\n' +
        '• `!live <trainNo>` — Check live running status & delay (e.g. `!live 12557`)\n' +
        '• `!pnr <10-digits>` — Check passenger confirmation & coach/berth (e.g. `!pnr 2265248473`)\n' +
        '• `!search <from> <to>` — Search running trains (e.g. `!search NDLS PNBE`)\n' +
        '• `!help` — Display this command menu' +
        FOOTER;
  }
}

async function startWhatsAppBot() {
  console.log('🤖 [WhatsApp Bot] Initializing Baileys session...');
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('👉 [WhatsApp Bot] Please scan this QR code with WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('[WhatsApp Bot] Connection closed. Reconnecting:', shouldReconnect);
      if (shouldReconnect) startWhatsAppBot();
    } else if (connection === 'open') {
      console.log('✅ [WhatsApp Bot] Connected successfully to WhatsApp! Listening for commands...');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      // Unpack text across standard, ephemeral, and view-once WhatsApp messages
      const inner = msg.message.ephemeralMessage?.message || msg.message.viewOnceMessage?.message || msg.message;
      const text = (inner.conversation || inner.extendedTextMessage?.text || '').trim();
      if (!text.startsWith('!')) continue;

      const chatJid = msg.key.remoteJid;
      // In group chats, rate limit by individual participant rather than blocking the whole group
      const userId = msg.key.participant || chatJid;

      if (!checkCooldown(userId)) {
        await sock.sendMessage(chatJid, {
          text: '⏳ *Slow down*: Please wait 2 seconds between commands to protect API credits.' + FOOTER
        }, { quoted: msg });
        continue;
      }

      console.log(`[WhatsApp Bot] Command received from ${userId} in ${chatJid}: ${text}`);
      const replyText = await handleCommand(text);

      await sock.sendMessage(chatJid, { text: replyText }, { quoted: msg });
    }
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 [WhatsApp Bot] Shutting down cleanly...');
    try {
      await sock.end();
    } catch (_) {}
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startWhatsAppBot().catch((err) => {
  console.error('[WhatsApp Bot] Fatal error:', err);
});
