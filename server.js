
require('dotenv').config();
const express = require('express');
const {Twilio} = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !fromNumber) {
  console.warn('TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER must be set in .env for calling functionality.');
}

let client = null;
if (accountSid && authToken) {
  client = new Twilio(accountSid, authToken);
}
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

let subscribers = [];
let callConfig = {};
let callsQueue = [];

app.post('/start-calls', (req, res) => {
  const {calls, message, language, voice} = req.body;
  if (!Array.isArray(calls) || !message || !language || !voice) {
    return res.status(400).json({error: 'Invalid request'});
  }
  callsQueue = calls;
  callConfig = {message, language, voice};
  res.json({started: true, total: callsQueue.length});
  processCalls();
});

app.get('/events', (req, res) => {
  res.setHeader('Content-Type','text/event-stream');
  res.setHeader('Cache-Control','no-cache');
  res.setHeader('Connection','keep-alive');
  res.flushHeaders();
  subscribers.push(res);
  req.on('close', () => {
    subscribers = subscribers.filter(s => s !== res);
  });
});

async function processCalls() {
  for (let i = 0; i < callsQueue.length; i++) {
    const {phone} = callsQueue[i];
    let status = 'NG';
    if (client && fromNumber) {
      try {
        const twiml = `<Response><Say voice="${callConfig.voice}" language="${callConfig.language}">${callConfig.message}</Say></Response>`;
        await client.calls.create({
          to: phone,
          from: fromNumber,
          twiml
        });
        status = 'OK';
      } catch (error) {
        console.error('Call failed', error);
        status = 'NG';
      }
    } else {
      console.warn('Cannot make call: Twilio client or fromNumber is missing');
    }
    broadcast('callResult', {index: i, status});
    broadcast('progress', {completed: i + 1, total: callsQueue.length});
  }
  broadcast('complete', {message: 'All calls completed'});
}

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  subscribers.forEach(res => res.write(payload));
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});