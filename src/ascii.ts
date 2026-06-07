import sharp from 'sharp';

const LUM_THRESHOLD = 128;

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function colorSeq(fg: [number, number, number], bg?: [number, number, number]): string {
  const fgSeq = `\x1b[38;2;${fg[0]};${fg[1]};${fg[2]}m`;
  return bg ? `${fgSeq}\x1b[48;2;${bg[0]};${bg[1]};${bg[2]}m` : fgSeq;
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
  const rows = pixelH;
  const cols = chars;

  const avgPixels: { r: number; g: number; b: number; lum: number }[] = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < pixelW; x += 2) {
      const i1 = y * pixelW + x;
      const i2 = y * pixelW + Math.min(x + 1, pixelW - 1);
      const r = Math.round((data[i1 * channels]! + data[i2 * channels]!) / 2);
      const g = Math.round((data[i1 * channels + 1]! + data[i2 * channels + 1]!) / 2);
      const b = Math.round((data[i1 * channels + 2]! + data[i2 * channels + 2]!) / 2);
      avgPixels.push({ r, g, b, lum: luminance(r, g, b) });
    }
  }

  const dithered = avgPixels.map((p) => p.lum);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const oldLum = dithered[i]!;
      const newLum = oldLum > LUM_THRESHOLD ? 255 : 0;
      const error = oldLum - newLum;
      dithered[i] = newLum;

      if (x + 1 < cols) dithered[y * cols + x + 1]! += error * (7 / 16);
      if (y + 1 < rows) {
        if (x > 0) dithered[(y + 1) * cols + x - 1]! += error * (3 / 16);
        dithered[(y + 1) * cols + x]! += error * (5 / 16);
        if (x + 1 < cols) dithered[(y + 1) * cols + x + 1]! += error * (1 / 16);
      }
    }
  }

  function px(y: number, x: number) {
    return avgPixels[y * cols + x]!;
  }

  function isBright(y: number, x: number) {
    return dithered[y * cols + x]! > LUM_THRESHOLD;
  }

  const outLines: string[] = [];

  for (let y = 0; y < lines; y++) {
    let line = '';
    line += ' '.repeat(padLeft);

    let lastFg: [number, number, number] | null = null;
    let lastBg: [number, number, number] | null = null;

    const topRow = y * 2;
    const botRow = y * 2 + 1;

    for (let x = 0; x < cols; x++) {
      const topPx = px(topRow, x);
      const botPx = px(botRow, x);
      const topBright = isBright(topRow, x);
      const botBright = isBright(botRow, x);

      if (!topBright && !botBright) {
        if (lastFg !== null || lastBg !== null) {
          line += '\x1b[0m';
          lastFg = null;
          lastBg = null;
        }
        line += ' ';
        continue;
      }

      if (topBright && botBright) {
        const fg: [number, number, number] = [
          Math.round((topPx.r + botPx.r) / 2),
          Math.round((topPx.g + botPx.g) / 2),
          Math.round((topPx.b + botPx.b) / 2),
        ];
        if (fmtKey(lastFg) !== fmtKey(fg) || lastBg !== null) {
          line += colorSeq(fg);
          lastFg = fg;
          lastBg = null;
        }
        line += '█';
        continue;
      }

      if (topBright && !botBright) {
        const fg: [number, number, number] = [topPx.r, topPx.g, topPx.b];
        const bg: [number, number, number] = [botPx.r, botPx.g, botPx.b];
        if (fmtKey(lastFg) !== fmtKey(fg) || fmtKey(lastBg) !== fmtKey(bg)) {
          line += colorSeq(fg, bg);
          lastFg = fg;
          lastBg = bg;
        }
        line += '▀';
        continue;
      }

      {
        const fg: [number, number, number] = [botPx.r, botPx.g, botPx.b];
        const bg: [number, number, number] = [topPx.r, topPx.g, topPx.b];
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
