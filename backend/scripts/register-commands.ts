/**
 * Register slash commands with Discord API.
 * Usage: npx tsx scripts/register-commands.ts [guildId]
 * Without guildId, registers globally (takes up to 1 hour to propagate).
 */
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config();

const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const guildId = process.argv[2];

if (!APPLICATION_ID || !BOT_TOKEN) {
  console.error('DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN are required');
  process.exit(1);
}

const commands = JSON.parse(
  readFileSync(join(__dirname, 'register-commands.json'), 'utf8')
);

const url = guildId
  ? `https://discord.com/api/v10/applications/${APPLICATION_ID}/guilds/${guildId}/commands`
  : `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`;

async function register() {
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${BOT_TOKEN}`,
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Failed to register commands: ${response.status} ${text}`);
    process.exit(1);
  }

  const result = await response.json();
  console.log(`Registered ${result.length} commands${guildId ? ` for guild ${guildId}` : ' globally'}`);
  console.log(result.map((c: { name: string }) => `  /${c.name}`).join('\n'));
}

register();
