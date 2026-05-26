import { spawn } from 'child_process';
import * as path from 'path';
import type { EnvironmentConfig } from '../../config/types';

export interface MaestroRunOptions {
  env?: Record<string, string>;
  timeoutMs?: number;
}

export interface MaestroResult {
  success: boolean;
  output: string;
  exitCode: number;
}

export class MaestroDriver {
  constructor(private config: EnvironmentConfig) {}

  async run(flowName: string, opts?: MaestroRunOptions): Promise<MaestroResult> {
    const flowPath = path.resolve(this.config.mobile.flowsDir, `${flowName}.yaml`);
    const timeoutMs = opts?.timeoutMs ?? this.config.mobile.timeoutMs;
    const maestroBin = this.config.mobile.maestroBin ?? 'maestro';

    const args = ['test', flowPath, '--format', 'plain'];
    if (this.config.mobile.deviceId) args.unshift('--device', this.config.mobile.deviceId);
    if (opts?.env) {
      for (const [k, v] of Object.entries(opts.env)) args.push('--env', `${k}=${v}`);
    }

    return new Promise((resolve) => {
      let output = '';
      const proc = spawn(maestroBin, args, { env: process.env });

      proc.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
      proc.stderr.on('data', (chunk: Buffer) => { output += chunk.toString(); });

      const timer = setTimeout(() => {
        proc.kill();
        resolve({ success: false, output: output + '\nTimeout exceeded', exitCode: -1 });
      }, timeoutMs);

      proc.on('close', (code) => {
        clearTimeout(timer);
        const exitCode = code ?? -1;
        const failed = exitCode !== 0 || output.includes('Flow Failed');
        resolve({ success: !failed, output, exitCode });
      });
    });
  }

  async runOrThrow(flowName: string, opts?: MaestroRunOptions): Promise<MaestroResult> {
    const result = await this.run(flowName, opts);
    if (!result.success) throw new Error(`Maestro flow "${flowName}" failed:\n${result.output}`);
    return result;
  }
}
