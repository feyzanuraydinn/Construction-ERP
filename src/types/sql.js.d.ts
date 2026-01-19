declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }

  export interface ParamsObject {
    [key: string]: unknown;
  }

  export interface ParamsCallback {
    (obj: ParamsObject): void;
  }

  export class Statement {
    bind(params?: ParamsObject | unknown[]): boolean;
    step(): boolean;
    getAsObject(params?: ParamsObject): Record<string, unknown>;
    get(params?: ParamsObject | unknown[]): unknown[];
    getColumnNames(): string[];
    free(): boolean;
    reset(): void;
    run(params?: ParamsObject | unknown[]): void;
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null);
    run(sql: string, params?: ParamsObject | unknown[]): Database;
    exec(sql: string, params?: ParamsObject | unknown[]): QueryExecResult[];
    each(
      sql: string,
      params: ParamsObject | unknown[],
      callback: ParamsCallback,
      done?: () => void
    ): Database;
    each(sql: string, callback: ParamsCallback, done?: () => void): Database;
    prepare(sql: string, params?: ParamsObject | unknown[]): Statement;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
    create_function(name: string, func: (...args: unknown[]) => unknown): Database;
    create_aggregate(
      name: string,
      init: () => unknown,
      step: (state: unknown, ...args: unknown[]) => unknown,
      finalize: (state: unknown) => unknown
    ): Database;
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<SqlJsStatic>;
}
