package com.nouhouari.conductor.support;

import java.util.concurrent.Callable;

/** Java port of src/support/retry.ts. */
public final class Retry {

    public enum Backoff { FIXED, EXPONENTIAL }

    public record Options(int attempts, long delayMs, Backoff backoff) {
        public static Options defaults() {
            return new Options(3, 1000, Backoff.FIXED);
        }
    }

    private Retry() {
    }

    public static <T> T run(Callable<T> fn) throws Exception {
        return run(fn, Options.defaults());
    }

    public static <T> T run(Callable<T> fn, Options options) throws Exception {
        Exception lastError = null;
        for (int attempt = 0; attempt < options.attempts(); attempt++) {
            try {
                return fn.call();
            } catch (Exception e) {
                lastError = e;
                boolean isLastAttempt = attempt == options.attempts() - 1;
                if (isLastAttempt) {
                    break;
                }
                long delay = options.backoff() == Backoff.EXPONENTIAL
                        ? options.delayMs() * (1L << attempt)
                        : options.delayMs();
                Thread.sleep(delay);
            }
        }
        throw lastError;
    }
}
