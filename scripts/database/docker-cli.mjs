import { spawnSync } from 'node:child_process';
import path from 'node:path';

function dockerCandidates() {
    const candidates = ['docker'];

    if (process.platform === 'win32') {
        if (process.env.LOCALAPPDATA) {
            candidates.push(
                path.join(
                    process.env.LOCALAPPDATA,
                    'Programs',
                    'DockerDesktop',
                    'resources',
                    'bin',
                    'docker.exe',
                ),
            );
        }
        if (process.env.ProgramFiles) {
            candidates.push(
                path.join(
                    process.env.ProgramFiles,
                    'Docker',
                    'Docker',
                    'resources',
                    'bin',
                    'docker.exe',
                ),
            );
        }
    }

    return [...new Set(candidates)];
}

export function findDocker() {
    for (const candidate of dockerCandidates()) {
        const result = spawnSync(candidate, ['version', '--format', '{{.Client.Version}}'], {
            stdio: 'ignore',
            windowsHide: true,
        });
        if (!result.error && result.status === 0) return candidate;
    }

    throw new Error(
        'Docker CLI was not found. Install/start Docker Desktop, then run this command again.',
    );
}

export function runDocker(docker, args, options = {}) {
    const result = spawnSync(docker, args, {
        windowsHide: true,
        maxBuffer: 256 * 1024 * 1024,
        ...options,
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
        const stderr = Buffer.isBuffer(result.stderr)
            ? result.stderr.toString('utf8')
            : String(result.stderr ?? '');
        throw new Error(stderr.trim() || `Docker exited with status ${result.status}`);
    }

    return result;
}
