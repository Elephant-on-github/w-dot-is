#!/usr/bin/env node
import { getAsciiDimensions, imageToAscii, imageToAsciiSymbolic } from './ascii';
import { extractInfo } from './bio';
import { CliError, CliHelp, parseArgs, printHelp } from './cli';
import { renderDisplay, renderVerify } from './renderer';
import { withSpinner } from './spinner';
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

  const darkBg = await detectDarkBg();

  const { summary, bioInfo, asciiArt, asciiWidth } = await withSpinner('Loading...', async () => {
    const { summary, categories } = await resolveEntity(args.name);
    const bioInfo = extractInfo(summary, categories);

    const { width, height } = {
      width: process.stdout.columns || 80,
      height: process.stdout.rows || 24,
    };
    const dims = getAsciiDimensions(width, height);

    let asciiArt = '';
    if (bioInfo.imageUrl) {
      try {
        if (args.ascii) {
          asciiArt = await imageToAsciiSymbolic(bioInfo.imageUrl, dims.chars, dims.lines, darkBg);
        } else {
          asciiArt = await imageToAscii(bioInfo.imageUrl, dims.chars, dims.lines, darkBg);
        }
      } catch {
        asciiArt = `[image not available for ${summary.title}]`;
      }
    } else {
      asciiArt = `[no image available for ${summary.title}]`;
    }

    return { summary, bioInfo, asciiArt, asciiWidth: dims.chars };
  });

  renderDisplay(summary.title, asciiArt, asciiWidth, {
    category: bioInfo.category,
    bioLines: bioInfo.bioLines,
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
