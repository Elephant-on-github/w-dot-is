import type { ParsedArgs } from './types';

export function parseArgs(args: string[]): ParsedArgs {
  const helpFlags = ['--help', '-h'];

  if (args.length === 0 || args.some((a) => helpFlags.includes(a))) {
    throw new CliHelp();
  }

  const isIndex = args.indexOf('--is');
  const aIndex = args.indexOf('--a');

  if (isIndex !== -1 && aIndex !== -1) {
    const name = args[isIndex + 1];
    const predicate = args[aIndex + 1];
    if (!name || !predicate) {
      throw new CliError('--is and --a both require a value');
    }
    return { name, predicate, mode: 'verify' };
  }

  if (isIndex !== -1 || aIndex !== -1) {
    throw new CliError('--is and --a must be used together');
  }

  return { name: args[0]!, mode: 'display' };
}

export function printHelp(): void {
  console.log(`
w.is \u2014 who, what or where is x

usage:
  w.is <name>                    display info about <name>
  w.is --is <name> --a <desc>    check if "<name> is a <desc>"
  w.is --help                    show this help

<name> can be a Wikipedia title or a description (e.g. "wooden handheld board for paint mixing" finds "palette").

examples:
  w.is banana
  w.is "wooden handheld board for paint mixing"
  w.is --is banana --a fruit
`);
}

export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliError';
  }
}

export class CliHelp extends Error {
  constructor() {
    super('');
    this.name = 'CliHelp';
  }
}
