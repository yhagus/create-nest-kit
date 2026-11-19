import { stripVTControlCharacters } from 'node:util';
import { spawn, type IPty } from '@lydell/node-pty';
import { onTestFinished } from 'vitest';
import { testEnvironment } from './cli.ts';
import { CLI_PATH } from './paths.ts';

/** Long enough for a slow CI runner to render a prompt; wizard tests set a longer test timeout. */
const WAIT_TIMEOUT_MS = 10_000;
/** For tests that drive the wizard: several prompts, each allowed `WAIT_TIMEOUT_MS`. */
export const WIZARD_TEST_TIMEOUT_MS = 60_000;

export const KEYS = {
  enter: '\r',
  down: '\u001B[B',
  ctrlC: '\u0003',
} as const;

/** The CLI running in a pseudo-terminal, so its prompts are the real interactive ones. */
export interface Terminal {
  /**
   * Resolves once `text` appears in the output after the previous match, so waiting for a prompt
   * never matches an earlier render of it.
   */
  waitFor: (text: string) => Promise<void>;
  /** Sends keystrokes, as a user typing. */
  press: (...keys: string[]) => void;
  /** The exit code, once the CLI exits; fails if it is still running (say, at a prompt) after a while. */
  waitForExit: () => Promise<number>;
  /** Everything the CLI printed so far, without colours or cursor movements. */
  output: () => string;
}

export function startCli(
  args: string[],
  options: { cwd: string; env?: Record<string, string | undefined> },
): Terminal {
  const pty: IPty = spawn(process.execPath, [CLI_PATH, ...args], {
    cwd: options.cwd,
    env: testEnvironment({ TERM: 'xterm-256color', ...options.env }),
    // Wide enough that no prompt wraps, even with a long temporary path in it.
    cols: 400,
    rows: 40,
  });
  let rawOutput = '';
  let searchFrom = 0;
  const listeners = new Set<() => void>();
  pty.onData((data) => {
    rawOutput += data;
    for (const listener of listeners) listener();
  });
  let hasExited = false;
  const exited = new Promise<number>((resolve) => {
    pty.onExit(({ exitCode }) => {
      hasExited = true;
      for (const listener of listeners) listener();
      resolve(exitCode);
    });
  });
  onTestFinished(() => {
    if (!hasExited) pty.kill();
  });

  const output = () => stripVTControlCharacters(rawOutput);

  const waitFor = (text: string) =>
    new Promise<void>((resolve, reject) => {
      const check = () => {
        const index = output().indexOf(text, searchFrom);
        if (index !== -1) {
          searchFrom = index + text.length;
          finish();
          resolve();
        } else if (hasExited) {
          finish();
          reject(new Error(`The CLI exited before printing "${text}". Output:\n${output()}`));
        }
      };
      const timer = setTimeout(() => {
        finish();
        reject(new Error(`Timed out waiting for "${text}". Output:\n${output()}`));
      }, WAIT_TIMEOUT_MS);
      const finish = () => {
        clearTimeout(timer);
        listeners.delete(check);
      };
      listeners.add(check);
      check();
    });

  return {
    waitFor,
    press: (...keys) => {
      for (const key of keys) pty.write(key);
    },
    waitForExit: () =>
      new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`The CLI is still running. Output:\n${output()}`));
        }, WAIT_TIMEOUT_MS);
        void exited.then((exitCode) => {
          clearTimeout(timer);
          resolve(exitCode);
        });
      }),
    output,
  };
}
