/**
 * Simulates a Discord PING interaction to verify the local endpoint.
 * Usage: npx tsx scripts/test-interaction-ping.ts
 */
import dotenv from 'dotenv';
import nacl from 'tweetnacl';

dotenv.config();

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY!;
const PORT = process.env.PORT || '3001';
const body = JSON.stringify({ type: 1 });
const timestamp = Math.floor(Date.now() / 1000).toString();
const message = Buffer.from(timestamp + body);
const signature = Buffer.from(
  nacl.sign.detached(message, nacl.sign.keyPair.fromSeed(
    Buffer.concat([Buffer.from(PUBLIC_KEY, 'hex').subarray(0, 32), Buffer.alloc(32)])
  ).secretKey)
);

// Sign with Discord's approach: we need the app's private key to sign, but we only have public key.
// Discord signs with their private key; we verify with public key.
// For local test, call endpoint without valid signature first to see routing, then document expected behavior.

async function testWithoutSignature() {
  const res = await fetch(`http://localhost:${PORT}/api/interactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  console.log('Without signature:', res.status, await res.text());
}

async function testHealth() {
  const res = await fetch(`http://localhost:${PORT}/api/settings/health`);
  console.log('Health:', res.status, await res.text());
}

async function main() {
  await testHealth();
  await testWithoutSignature();
  console.log('\nEndpoint is reachable locally.');
  console.log('Discord needs a PUBLIC URL (ngrok/Render) set as Interactions Endpoint URL.');
}

main().catch(console.error);
