import { spawn } from 'child_process';
import * as path from 'path';
import type { EnvironmentConfig } from '../../config/types';

export interface MaestroRunOptions {
  env?: Record<string, string>;
  timeoutMs?: number;
  reinstallDriver?: boolean;
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
    const stream = process.env.DEBUG_MAESTRO !== '0' && process.env.DEBUG_MAESTRO !== 'false';

    const args = ['test', flowPath];
    if (opts?.reinstallDriver) args.push('--reinstall-driver');
    if (this.config.mobile.deviceId) args.unshift('--device', this.config.mobile.deviceId);
    if (opts?.env) {
      for (const [k, v] of Object.entries(opts.env)) args.push('--env', `${k}=${v}`);
    }

    if (stream) {
      const envSummary = opts?.env ? ' ' + Object.entries(opts.env).map(([k, v]) => `${k}=${v}`).join(' ') : '';
      process.stderr.write(`\n[maestro] ▶ ${flowName}${envSummary}\n`);
    }

    return new Promise((resolve) => {
      let output = '';
      let buffer = '';
      const proc = spawn(maestroBin, args, { env: process.env });

      const onData = (chunk: Buffer) => {
        const text = chunk.toString();
        output += text;
        if (!stream) return;
        buffer += text;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.trim()) process.stderr.write(`[maestro]   ${line}\n`);
        }
      };
      proc.stdout.on('data', onData);
      proc.stderr.on('data', onData);

      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 2000);
        if (stream) process.stderr.write(`[maestro] ✖ ${flowName} — timeout after ${timeoutMs}ms\n`);
        resolve({ success: false, output: output + '\nTimeout exceeded', exitCode: -1 });
      }, timeoutMs);

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (stream && buffer.trim()) process.stderr.write(`[maestro]   ${buffer}\n`);
        const exitCode = code ?? -1;
        const failed = exitCode !== 0 || output.includes('Flow Failed');
        if (stream) process.stderr.write(`[maestro] ${failed ? '✖' : '✔'} ${flowName} (exit=${exitCode})\n`);
        resolve({ success: !failed, output, exitCode });
      });
    });
  }

  async runOrThrow(flowName: string, opts?: MaestroRunOptions): Promise<MaestroResult> {
    const result = await this.run(flowName, opts);
    if (!result.success) {
      // Only retry with --reinstall-driver on real on-device gRPC crashes, NOT on our own timeout
      const driverCrashed = /io\.grpc\.StatusRuntimeException: UNAVAILABLE|Command failed \(tcp:\d+\): closed/.test(result.output);
      if (driverCrashed && !opts?.reinstallDriver) {
        process.stderr.write(`[maestro] ⚠ device driver crashed — retrying with --reinstall-driver\n`);
        const retry = await this.run(flowName, { ...opts, reinstallDriver: true });
        if (retry.success) return retry;
      }
      throw new Error(`Maestro flow "${flowName}" failed:\n${result.output}`);
    }
    return result;
  }

  async takeScreenshot(name: string): Promise<string> {
    const outputDir = 'reports/screenshots';
    const screenshotPath = path.resolve(outputDir, `${name}.png`);
    const deviceArgs = this.config.mobile.deviceId ? ['-s', this.config.mobile.deviceId] : [];
    const adb = process.env.ANDROID_HOME
      ? path.join(process.env.ANDROID_HOME, 'platform-tools', 'adb')
      : 'adb';

    return new Promise((resolve, reject) => {
      const proc = spawn(adb, [...deviceArgs, 'exec-out', 'screencap', '-p'], { env: process.env });
      const chunks: Buffer[] = [];
      proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      proc.on('close', (code) => {
        if (code === 0 && chunks.length > 0) {
          const fs = require('fs');
          fs.mkdirSync(outputDir, { recursive: true });
          fs.writeFileSync(screenshotPath, Buffer.concat(chunks));
          resolve(screenshotPath);
        } else {
          reject(new Error(`adb screencap failed with code ${code}`));
        }
      });
    });
  }
}
