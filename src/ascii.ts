import sharp from 'sharp';

const SIMILARITY_THRESHOLD = 40;

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function colorSeq(fg: [number, number, number], bg?: [number, number, number]): string {
  const fgSeq = `\x1b[38;2;${fg[0]};${fg[1]};${fg[2]}m`;
  if (bg) return `${fgSeq}\x1b[48;2;${bg[0]};${bg[1]};${bg[2]}m`;
  return `${fgSeq}\x1b[49m`;
}

function fmtKey(c: [number, number, number] | null): string {
  return c ? c.join(',') : '';
}

export async function imageToAscii(
  imageUrl: string,
  targetChars: number,
  targetLines: number,
  _darkBg: boolean,
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
  const pixelH = lines * 2;

  const remainingChars = targetChars - chars;
  const padLeft = Math.floor(remainingChars / 2);

  const { data, info } = await sharp(buffer)
    .resize(pixelW, pixelH, {
      fit: 'fill',
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3,
    })
    .normalize()
    .sharpen()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;

  interface Pixel {
    r: number;
    g: number;
    b: number;
    lum: number;
  }

  const cols = chars;
  const rows = pixelH;
  const grid: Pixel[][] = [];

  for (let y = 0; y < rows; y++) {
    const row: Pixel[] = [];
    for (let x = 0; x < pixelW; x += 2) {
      const i1 = y * pixelW + x;
      const i2 = y * pixelW + Math.min(x + 1, pixelW - 1);
      const r = Math.round((data[i1 * channels]! + data[i2 * channels]!) / 2);
      const g = Math.round((data[i1 * channels + 1]! + data[i2 * channels + 1]!) / 2);
      const b = Math.round((data[i1 * channels + 2]! + data[i2 * channels + 2]!) / 2);
      row.push({ r, g, b, lum: luminance(r, g, b) });
    }
    grid.push(row);
  }

  const outLines: string[] = [];

  for (let y = 0; y < lines; y++) {
    let line = '';
    line += ' '.repeat(padLeft);

    let lastFg: [number, number, number] | null = null;
    let lastBg: [number, number, number] | null = null;

    const topRow = grid[y * 2]!;
    const botRow = grid[y * 2 + 1]!;

    for (let x = 0; x < cols; x++) {
      const top = topRow[x]!;
      const bot = botRow[x]!;
      const diff = Math.abs(top.lum - bot.lum);

      if (diff < SIMILARITY_THRESHOLD) {
        const fg: [number, number, number] = [
          Math.round((top.r + bot.r) / 2),
          Math.round((top.g + bot.g) / 2),
          Math.round((top.b + bot.b) / 2),
        ];
        if (fmtKey(lastFg) !== fmtKey(fg) || lastBg !== null) {
          line += colorSeq(fg);
          lastFg = fg;
          lastBg = null;
        }
        line += '█';
      } else if (top.lum > bot.lum) {
        const fg: [number, number, number] = [top.r, top.g, top.b];
        const bg: [number, number, number] = [bot.r, bot.g, bot.b];
        if (fmtKey(lastFg) !== fmtKey(fg) || fmtKey(lastBg) !== fmtKey(bg)) {
          line += colorSeq(fg, bg);
          lastFg = fg;
          lastBg = bg;
        }
        line += '▀';
      } else {
        const fg: [number, number, number] = [bot.r, bot.g, bot.b];
        const bg: [number, number, number] = [top.r, top.g, top.b];
        if (fmtKey(lastFg) !== fmtKey(fg) || fmtKey(lastBg) !== fmtKey(bg)) {
          line += colorSeq(fg, bg);
          lastFg = fg;
          lastBg = bg;
        }
        line += '▄';
      }
    }

    line += '\x1b[0m';
    outLines.push(line);
  }

  return outLines.join('\n');
}

const SYMBOLIC_CHARS = ' .-:=+*#%@\u2591\u2592\u2593\u2588';

export async function imageToAsciiSymbolic(
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
      kernel: sharp.kernel.lanczos3,
    })
    .normalize()
    .sharpen()
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
        line += `\x1b[38;2;${r};${g};${b}m`;
        lastR = r;
        lastG = g;
        lastB = b;
      }

      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const idx = darkBg
        ? Math.floor((lum / 255) * (SYMBOLIC_CHARS.length - 1))
        : Math.floor((1 - lum / 255) * (SYMBOLIC_CHARS.length - 1));
      line += SYMBOLIC_CHARS[Math.min(idx, SYMBOLIC_CHARS.length - 1)]!;
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
