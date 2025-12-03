declare module 'better-sqlite3' {
  import { EventEmitter } from 'events';

  interface Statement {
    run(...params: any[]): this;
    all(...params: any[]): any[];
    get(...params: any[]): any;
  }

  class Database extends EventEmitter {
    constructor(filename: string, options?: { memory?: boolean; readonly?: boolean; fileMustExist?: boolean });
    prepare(sql: string): Statement;
    exec(sql: string): void;
    pragma(statement: string): unknown;
    close(): void;
  }

  export default Database;
}

declare module 'node-fetch' {
  import { RequestInit, Response, Headers, Request } from 'undici';
  export default function fetch(url: string | URL, init?: RequestInit): Promise<Response>;
  export { RequestInit, Response, Headers, Request };
}
