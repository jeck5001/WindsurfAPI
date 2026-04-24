import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

describe('config startup', () => {
  it('loads replica-isolated dataDir without crashing', () => {
    const tempDir = mkdtempSync(resolve(tmpdir(), 'windsurf-config-'));
    const configUrl = pathToFileURL(resolve(process.cwd(), 'src/config.js')).href;

    try {
      const result = spawnSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `const { config } = await import(${JSON.stringify(configUrl)}); console.log(config.dataDir);`,
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            DATA_DIR: tempDir,
            REPLICA_ISOLATE: '1',
            HOSTNAME: 'nas-test',
          },
          encoding: 'utf8',
        },
      );

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout.trim(), /replica-nas-test$/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
