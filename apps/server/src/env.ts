import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

// Both src/env.ts and dist/env.js are three directories below the project root.
export const projectEnvPath = fileURLToPath(new URL('../../../.env', import.meta.url));

/** Native Node.js loader: existing environment variables have priority. */
export function loadProjectEnv(file = projectEnvPath): void {
  try {
    loadEnvFile(file);
  } catch (error) {
    // A local configuration file is optional. Do not hide permission/I/O errors.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
