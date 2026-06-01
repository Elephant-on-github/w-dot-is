import { describe, expect, it } from 'bun:test';
import { CliError, CliHelp, parseArgs } from '../src/cli';

describe('parseArgs', () => {
  it('parses display mode with a single name', () => {
    const result = parseArgs(['banana']);
    expect(result).toEqual({ name: 'banana', mode: 'display' });
  });

  it('parses verify mode with --is and --a', () => {
    const result = parseArgs(['--is', 'banana', '--a', 'fruit']);
    expect(result).toEqual({ name: 'banana', predicate: 'fruit', mode: 'verify' });
  });

  it('parses verify mode with args in different order', () => {
    const result = parseArgs(['--a', 'fruit', '--is', 'banana']);
    expect(result).toEqual({ name: 'banana', predicate: 'fruit', mode: 'verify' });
  });

  it('throws CliHelp on --help', () => {
    expect(() => parseArgs(['--help'])).toThrow(CliHelp);
  });

  it('throws CliHelp on -h', () => {
    expect(() => parseArgs(['-h'])).toThrow(CliHelp);
  });

  it('throws CliHelp when no args given', () => {
    expect(() => parseArgs([])).toThrow(CliHelp);
  });

  it('throws CliError when only --is is provided', () => {
    expect(() => parseArgs(['--is', 'banana'])).toThrow(CliError);
  });

  it('throws CliError when only --a is provided', () => {
    expect(() => parseArgs(['--a', 'fruit'])).toThrow(CliError);
  });
});
