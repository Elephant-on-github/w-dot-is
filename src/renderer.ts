import type { EntityCategory, VerifyResult } from './types';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';

function wordWrap(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const words = text.split(' ');
  let current = '';

  for (const word of words) {
    if (`${current} ${word}`.trim().length > maxWidth) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current += ` ${word}`;
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

export function renderDisplay(
  name: string,
  asciiArt: string,
  asciiWidth: number,
  info: { category: EntityCategory; bioLines: string[] },
): void {
  const termWidth = getTerminalWidth();
  const title = ` ${name} `;

  const padLen = Math.max(0, Math.floor((termWidth - title.length) / 2));
  console.log(`${'─'.repeat(termWidth)}`);
  console.log(BOLD + CYAN + ' '.repeat(padLen) + title + RESET);
  console.log(`${'─'.repeat(termWidth)}`);

  const bioWidth = Math.floor(termWidth * 0.48);

  const catLabel = {
    person: 'person',
    place: 'place',
    living_thing: 'living thing',
    thing: 'thing',
  }[info.category];

  const artLines = asciiArt.split('\n');
  const leftPad = Math.max(0, Math.floor((termWidth - asciiWidth) / 2));
  for (const line of artLines) {
    process.stdout.write(`${' '.repeat(leftPad)}${line}\n`);
  }

  process.stdout.write(`${DIM}[${catLabel}]${RESET}\n`);
  for (const line of info.bioLines) {
    const wrapped = wordWrap(line, bioWidth);
    for (const wl of wrapped) {
      process.stdout.write(`${' '.repeat(2) + wl}\n`);
    }
  }

  console.log(`${'─'.repeat(termWidth)}`);
}

export function renderVerify(result: VerifyResult): void {
  if (result.result) {
    console.log(`${GREEN + BOLD}true${RESET}`);
  } else {
    console.log(`${RED + BOLD}false${RESET}`);
  }
}

function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}
