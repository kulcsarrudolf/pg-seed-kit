import fs from 'fs';
import path from 'path';
import { loadConfig } from '../config';

const TEMPLATE = `const seed = async (): Promise<void> => {
  // TODO: implement this seeder.
  // Keep it idempotent so re-runs are safe: check-before-insert,
  // or \`INSERT ... ON CONFLICT DO NOTHING\`.
};

export default seed;
`;

function generateTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

export async function createSeeder(name: string): Promise<void> {
  const config = await loadConfig();
  const timestamp = generateTimestamp();
  const filename = `${timestamp}-${name}.seeder.ts`;
  const filepath = path.join(config.seedersPath, filename);

  if (!fs.existsSync(config.seedersPath)) {
    fs.mkdirSync(config.seedersPath, { recursive: true });
  }

  fs.writeFileSync(filepath, TEMPLATE);
  console.log(`Created: ${filepath}`);
}
