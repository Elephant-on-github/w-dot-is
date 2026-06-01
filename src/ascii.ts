import sharp from 'sharp';

const CHARS = ' .-:=+*#%@░▒▓█';

function rgbToAnsi(r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m`;
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function charForLuminance(lum: number, darkBg: boolean): string {
  const idx = darkBg
    ? Math.floor((lum / 255) * (CHARS.length - 1))
    : Math.floor((1 - lum / 255) * (CHARS.length - 1));
  return CHARS[Math.min(idx, CHARS.length - 1)]!;
}

export async function imageToAscii(
  imageUrl: string,
  targetChars: number,
  targetLines: number,
  darkBg: boolean,
): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`failed to fetch image: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());

  const meta = await sharp(buffer).metadata();
  const imgW = meta.width ?? 800;
  const imgH = meta.height ?? 600;

  const charAspect = (imgW / imgH) * 2;

  let chars: number;
  let lines: number;

  if (charAspect >= targetChars / targetLines) {
    chars = Math.min(targetChars, Math.max(1, Math.ceil(imgW / 2)));
    lines = Math.max(1, Math.round(chars / charAspect));
    if (lines > targetLines) {
      lines = targetLines;
      chars = Math.max(1, Math.round(lines * charAspect));
    }
  } else {
    lines = Math.min(targetLines, Math.max(1, Math.ceil(imgH)));
    chars = Math.max(1, Math.round(lines * charAspect));
    if (chars > targetChars) {
      chars = targetChars;
      lines = Math.max(1, Math.round(chars / charAspect));
    }
  }

  if (chars > targetChars) chars = targetChars;
  if (lines > targetLines) lines = targetLines;

  const pixelW = chars * 2;
  const pixelH = lines;

  const remainingChars = targetChars - chars;
  const padLeft = Math.floor(remainingChars / 2);

  const { data, info } = await sharp(buffer)
    .resize(pixelW, pixelH, {
      fit: 'fill',
      withoutEnlargement: false,
      kernel: sharp.kernel.cubic,
    })
    .normalize()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const linesOut: string[] = [];

  for (let y = 0; y < pixelH; y++) {
    let line = '';
    let lastR = -1;
    let lastG = -1;
    let lastB = -1;

    line += ' '.repeat(padLeft);

    for (let x = 0; x < pixelW; x += 2) {
      const px1 = (y * pixelW + x) * channels;
      const px2 = (y * pixelW + Math.min(x + 1, pixelW - 1)) * channels;
      const r = Math.round((data[px1]! + data[px2]!) / 2);
      const g = Math.round((data[px1 + 1]! + data[px2 + 1]!) / 2);
      const b = Math.round((data[px1 + 2]! + data[px2 + 2]!) / 2);

      if (r !== lastR || g !== lastG || b !== lastB) {
        line += rgbToAnsi(r, g, b);
        lastR = r;
        lastG = g;
        lastB = b;
      }

      const lum = luminance(r, g, b);
      line += charForLuminance(lum, darkBg);
    }

    line += '\x1b[0m';
    linesOut.push(line);
  }

  return linesOut.join('\n');
}

export function getAsciiDimensions(
  terminalWidth: number,
  terminalHeight: number,
): {
  chars: number;
  lines: number;
} {
  const chars = Math.floor((terminalWidth - 4) * 0.85);
  const lines = Math.floor((terminalHeight - 8) * 0.8);
  return { chars, lines };
}
