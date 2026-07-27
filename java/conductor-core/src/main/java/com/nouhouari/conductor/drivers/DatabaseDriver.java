package com.nouhouari.conductor.drivers;

import java.util.List;
import java.util.Optional;

/**
 * Java port of src/drivers/DatabaseDriver.ts. Pure plugin contract — no
 * concrete implementation is shipped, matching the TS side (consumers
 * subclass this and register an instance via {@code ConductorWorld.setDb}).
 */
public abstract class DatabaseDriver {

    public record QueryResult<T>(List<T> rows, int rowCount) {
    }

    public abstract void connect();

    public abstract void disconnect();

    public abstract <T> QueryResult<T> query(String sql, Object... params);

    public <T> Optional<T> queryOne(String sql, Object... params) {
        List<T> rows = this.<T>query(sql, params).rows();
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public int execute(String sql, Object... params) {
        return query(sql, params).rowCount();
    }
}
