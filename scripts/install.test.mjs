import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { access, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const installer = resolve('src/install.sh');
const supported = process.platform === 'linux' && ['x64', 'arm64'].includes(process.arch);

describe.skipIf(!supported)('user-local installer', () => {
  let root, home, tools, report, archive, checksum, installed;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'kubarr-installer-test-'));
    home = join(root, 'home with spaces');
    tools = join(root, 'tools');
    report = join(root, 'wizard-launch');
    installed = join(home, '.local/bin/kubarr');
    await mkdir(home);
    await mkdir(tools);
    await writeFile(join(home, '.bashrc'), '# existing profile\n');
    await writeFile(join(root, 'kubarr'), `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == 'bootstrap --help' ]]; then
  printf '%s\\n' 'Web setup: --web-port <port>'
elif [[ "$*" == 'bootstrap --web' ]]; then
  printf '%s\\n' "$UID" "$HOME" "$KUBECONFIG" "$0" "$@" > "$KUBARR_INSTALL_TEST_REPORT"
else
  exit 99
fi
`);
    await chmod(join(root, 'kubarr'), 0o755);
    archive = join(root, `kubarr-linux-${process.arch === 'x64' ? 'x86_64' : 'aarch64'}.tar.gz`);
    checksum = `${archive}.sha256`;
    const tar = spawnSync('tar', ['-czf', archive, '-C', root, 'kubarr'], { encoding: 'utf8' });
    expect(tar.status, tar.stderr).toBe(0);
    await writeFile(checksum, createHash('sha256').update(await readFile(archive)).digest('hex') + '\n');
    await writeFile(join(tools, 'curl'), `#!/usr/bin/env bash
set -euo pipefail
output='' url=''
while (( $# )); do
  case "$1" in
    --output) shift; output=$1 ;;
    https://*) url=$1 ;;
  esac
  shift
done
case "$url" in
  https://github.com/smokeythebandit/kubarr-cli/releases/latest/download/*.sha256)
    cp "$KUBARR_INSTALL_TEST_CHECKSUM" "$output" ;;
  https://github.com/smokeythebandit/kubarr-cli/releases/latest/download/*.tar.gz)
    cp "$KUBARR_INSTALL_TEST_ARCHIVE" "$output" ;;
  *) exit 98 ;;
esac
`);
    await chmod(join(tools, 'curl'), 0o755);
  });

  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  function run(overrides = {}) {
    return spawnSync('bash', [installer], {
      encoding: 'utf8', timeout: 10_000,
      env: {
        ...process.env, HOME: home, TMPDIR: root, NO_COLOR: '1',
        PATH: `${tools}:${process.env.PATH}`,
        KUBECONFIG: join(home, 'selected cluster.yaml'),
        KUBARR_INSTALL_TEST_ARCHIVE: archive,
        KUBARR_INSTALL_TEST_CHECKSUM: checksum,
        KUBARR_INSTALL_TEST_REPORT: report,
        ...overrides,
      },
    });
  }

  async function expectUserLaunch(result) {
    expect(result.status, result.stderr).toBe(0);
    expect(await readFile(installed, 'utf8')).toBe(await readFile(join(root, 'kubarr'), 'utf8'));
    expect((await readFile(report, 'utf8')).trimEnd().split('\n')).toEqual([
      String(process.getuid()), home, join(home, 'selected cluster.yaml'), installed, 'bootstrap', '--web',
    ]);
    expect(await readFile(join(home, '.bashrc'), 'utf8')).toBe('# existing profile\n');
    await expect(access(join(home, '.bash_profile'))).rejects.toThrow();
    expect(result.stdout).toContain(`CLI installed · ${installed}`);
  }

  it('installs and launches as the caller with their home and kubeconfig intact', async () => {
    const result = run();
    await expectUserLaunch(result);
    expect(result.stdout).toContain('export PATH="$HOME/.local/bin:$PATH"');
  });

  it('does not show a PATH hint when the new binary already resolves first', async () => {
    const result = run({ PATH: `${join(home, '.local/bin')}:${tools}:${process.env.PATH}` });
    await expectUserLaunch(result);
    expect(result.stdout).not.toContain('add this to your shell profile');
  });

  it('launches the new binary even when an older installation shadows it', async () => {
    const oldBin = join(root, 'older-bin');
    await mkdir(oldBin);
    await writeFile(join(oldBin, 'kubarr'), '#!/usr/bin/env bash\nexit 97\n');
    await chmod(join(oldBin, 'kubarr'), 0o755);
    const result = run({ PATH: `${oldBin}:${join(home, '.local/bin')}:${tools}:${process.env.PATH}` });
    await expectUserLaunch(result);
    expect(result.stdout).toContain('export PATH="$HOME/.local/bin:$PATH"');
  });

  it('preserves an existing installation when checksum verification fails', async () => {
    await mkdir(join(home, '.local/bin'), { recursive: true });
    await writeFile(installed, 'existing installation\n');
    await writeFile(checksum, '0'.repeat(64) + '\n');
    const result = run();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('SHA-256 check');
    expect(await readFile(installed, 'utf8')).toBe('existing installation\n');
    await expect(access(report)).rejects.toThrow();
  });

  it.each(['', 'relative/home'])('rejects an invalid HOME (%j) before installation', async value => {
    const result = run({ HOME: value });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('HOME must be set to an absolute path');
    await expect(access(installed)).rejects.toThrow();
  });
});
