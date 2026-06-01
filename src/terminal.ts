function detectBgFromEnv(): boolean | null {
  const colorfgbg = process.env.COLORFGBG;
  if (colorfgbg) {
    const parts = colorfgbg.split(';');
    const bg = Number(parts[parts.length - 1]);
    if (!Number.isNaN(bg)) return bg > 7;
  }

  const term = process.env.TERM;
  if (term) {
    if (term.includes('light') || term.includes('white')) return false;
    if (term.includes('dark') || term.includes('black')) return true;
  }

  return null;
}

export async function detectDarkBg(): Promise<boolean> {
  const fromEnv = detectBgFromEnv();
  if (fromEnv !== null) return fromEnv;

  if (process.platform === 'win32') return true;

  try {
    const result = await queryTerminalBg();
    if (result !== null) return result;
  } catch {}

  return true;
}

async function queryTerminalBg(): Promise<boolean | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 100);

    let buf = '';
    const onData = (chunk: Buffer) => {
      buf += chunk.toString();
      const m = buf.match(/rgb:([0-9a-f]{2,4})\/([0-9a-f]{2,4})\/([0-9a-f]{2,4})/i);
      if (m) {
        clearTimeout(timeout);
        cleanup();
        const r = parseInt(m[1]!, 16);
        const g = parseInt(m[2]!, 16);
        const b = parseInt(m[3]!, 16);
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        resolve(lum < 128);
      }
    };

    const cleanup = () => {
      process.stdin.off('data', onData);
      try {
        process.stdin.setRawMode?.(false);
      } catch {}
    };

    try {
      process.stdin.setRawMode?.(true);
      process.stdin.on('data', onData);
      process.stderr.write('\x1b]11;?\x1b\\');
    } catch {
      clearTimeout(timeout);
      resolve(null);
    }
  });
}
