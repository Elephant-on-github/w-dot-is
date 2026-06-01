#!/usr/bin/env bun
import { getAsciiDimensions, imageToAscii } from './ascii';
import { extractInfo } from './bio';
import { CliError, CliHelp, parseArgs, printHelp } from './cli';
import { renderDisplay, renderVerify } from './renderer';
import { detectDarkBg } from './terminal';
import { verifyClaim } from './verify';
import { resolveEntity } from './wikipedia';

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.mode === 'verify') {
    const result = await verifyClaim(args.name, args.predicate!);
    renderVerify(result);
    return;
  }

  const [darkBg, { summary, categories }] = await Promise.all([
    detectDarkBg(),
    resolveEntity(args.name),
  ]);

  const info = extractInfo(summary, categories);

  const { width, height } = {
    width: process.stdout.columns || 80,
    height: process.stdout.rows || 24,
  };
  const dims = getAsciiDimensions(width, height);

  let asciiArt = '';
  if (info.imageUrl) {
    try {
      asciiArt = await imageToAscii(info.imageUrl, dims.chars, dims.lines, darkBg);
    } catch {
      asciiArt = `[image not available for ${summary.title}]`;
    }
  } else {
    asciiArt = `[no image available for ${summary.title}]`;
  }

  renderDisplay(summary.title, asciiArt, dims.chars, {
    category: info.category,
    bioLines: info.bioLines,
  });
}

main().catch((err) => {
  if (err instanceof CliHelp) {
    printHelp();
    process.exit(0);
  }
  if (err instanceof CliError) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
  console.error('error:', err.message);
  process.exit(1);
});
