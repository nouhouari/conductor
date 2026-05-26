export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export abstract class DatabaseDriver {
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;

  async queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null> {
    const result = await this.query<T>(sql, params);
    return result.rows[0] ?? null;
  }

  async execute(sql: string, params?: unknown[]): Promise<number> {
    const result = await this.query(sql, params);
    return result.rowCount;
  }
}
