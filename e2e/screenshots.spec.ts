/** Capture every atlas mode at the two required widths, in both languages. */
import { test, chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

test('atlas screenshots', () => {
  test.setTimeout(180000);
  const temp = resolve('.cache/tmp');
  mkdirSync(temp, { recursive: true });
  const result = spawnSync(
    process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3'),
    ['scripts/test-atlas.py', '--shots', '--browser', chromium.executablePath()],
    {
      encoding: 'utf8',
      env: { ...process.env, TEMP: temp, TMP: temp, PYTHONIOENCODING: 'utf-8' },
    },
  );
  process.stdout.write(result.stdout ?? '');
  if (result.error || result.status !== 0)
    throw new Error(result.error?.message ?? result.stderr);
});
