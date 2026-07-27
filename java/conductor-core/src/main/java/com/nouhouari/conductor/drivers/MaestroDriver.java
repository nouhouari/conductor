package com.nouhouari.conductor.drivers;

import com.nouhouari.conductor.config.EnvironmentConfig;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/** Java port of src/drivers/MaestroDriver.ts — shells out to the Maestro CLI. */
public class MaestroDriver {

    public record Result(boolean success, String output, int exitCode) {
    }

    private static final Pattern DRIVER_CRASH =
            Pattern.compile("io\\.grpc\\.StatusRuntimeException: UNAVAILABLE|Command failed \\(tcp:\\d+\\): closed");

    private final EnvironmentConfig config;

    public MaestroDriver(EnvironmentConfig config) {
        this.config = config;
    }

    public Result run(String flowName) {
        return run(flowName, Map.of(), null, false);
    }

    public Result run(String flowName, Map<String, String> env) {
        return run(flowName, env, null, false);
    }

    public Result run(String flowName, Map<String, String> env, Long timeoutOverrideMs, boolean reinstallDriver) {
        Path flowPath = Paths.get(config.mobile().flowsDir(), flowName + ".yaml").toAbsolutePath();
        long timeoutMs = timeoutOverrideMs != null ? timeoutOverrideMs : config.mobile().timeoutMs();
        String bin = config.mobile().maestroBin() != null ? config.mobile().maestroBin() : "maestro";

        List<String> cmd = new ArrayList<>();
        cmd.add(bin);
        if (config.mobile().deviceId() != null) {
            cmd.add("--device");
            cmd.add(config.mobile().deviceId());
        }
        cmd.add("test");
        cmd.add(flowPath.toString());
        if (reinstallDriver) {
            cmd.add("--reinstall-driver");
        }
        if (env != null) {
            env.forEach((k, v) -> {
                cmd.add("--env");
                cmd.add(k + "=" + v);
            });
        }

        boolean streamOutput = !"0".equals(System.getenv("DEBUG_MAESTRO")) && !"false".equals(System.getenv("DEBUG_MAESTRO"));

        try {
            Process proc = new ProcessBuilder(cmd).redirectErrorStream(true).start();
            StringBuilder output = new StringBuilder();
            Thread pump = pumpStream(proc, output, streamOutput);

            boolean exited = proc.waitFor(timeoutMs, TimeUnit.MILLISECONDS);
            if (!exited) {
                proc.destroy();
                if (!proc.waitFor(2, TimeUnit.SECONDS)) {
                    proc.destroyForcibly();
                }
                pump.join(1000);
                return new Result(false, output + "\nTimeout exceeded", -1);
            }
            pump.join(1000);
            int exitCode = proc.exitValue();
            boolean failed = exitCode != 0 || output.toString().contains("Flow Failed");
            return new Result(!failed, output.toString(), exitCode);
        } catch (IOException | InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Failed to run Maestro flow " + flowName, e);
        }
    }

    public Result runOrThrow(String flowName) {
        return runOrThrow(flowName, Map.of());
    }

    public Result runOrThrow(String flowName, Map<String, String> env) {
        Result result = run(flowName, env, null, false);
        if (!result.success()) {
            if (DRIVER_CRASH.matcher(result.output()).find()) {
                Result retry = run(flowName, env, null, true);
                if (retry.success()) {
                    return retry;
                }
                result = retry;
            }
            throw new RuntimeException("Maestro flow \"" + flowName + "\" failed:\n" + result.output());
        }
        return result;
    }

    public byte[] takeScreenshot(String name) {
        String androidHome = System.getenv("ANDROID_HOME");
        String adbBin = androidHome != null
                ? Paths.get(androidHome, "platform-tools", "adb").toString()
                : "adb";

        List<String> cmd = new ArrayList<>();
        cmd.add(adbBin);
        if (config.mobile().deviceId() != null) {
            cmd.add("-s");
            cmd.add(config.mobile().deviceId());
        }
        cmd.add("exec-out");
        cmd.add("screencap");
        cmd.add("-p");

        try {
            Process proc = new ProcessBuilder(cmd).start();
            byte[] png = proc.getInputStream().readAllBytes();
            proc.waitFor(30, TimeUnit.SECONDS);

            Path outDir = Paths.get("reports/screenshots");
            Files.createDirectories(outDir);
            Path outFile = outDir.resolve(name + ".png");
            Files.write(outFile, png);
            return png;
        } catch (IOException | InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Failed to capture mobile screenshot", e);
        }
    }

    private static Thread pumpStream(Process proc, StringBuilder sink, boolean streamToStderr) {
        Thread thread = new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(proc.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    sink.append(line).append('\n');
                    if (streamToStderr) {
                        System.err.println(line);
                    }
                }
            } catch (IOException ignored) {
                // process ended / stream closed
            }
        }, "maestro-stdout");
        thread.setDaemon(true);
        thread.start();
        return thread;
    }
}
