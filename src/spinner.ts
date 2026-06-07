const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const COLORS = [31, 33, 32, 36, 34, 35];

export async function withSpinner<T>(msg: string, fn: () => Promise<T>): Promise<T> {
  if (!process.stdout.isTTY) return fn();

  let i = 0;
  const start = performance.now();
  const timer = setInterval(() => {
    const color = COLORS[i % COLORS.length]!;
    const frame = FRAMES[i % FRAMES.length]!;
    const elapsed = (performance.now() - start).toFixed(0);
    process.stdout.write(`\r\x1b[${color}m${frame}\x1b[0m ${msg} \x1b[90m${elapsed}ms\x1b[0m`);
    i++;
  }, 80);

  try {
    return await fn();
  } finally {
    clearInterval(timer);
    process.stdout.write('\r\x1b[K');
  }
}
