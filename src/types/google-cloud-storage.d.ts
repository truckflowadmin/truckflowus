declare module '@google-cloud/storage' {
  export class Storage {
    constructor(options?: { projectId?: string; credentials?: { client_email?: string; private_key?: string } });
    bucket(name: string): Bucket;
  }

  export interface Bucket {
    file(name: string): File;
  }

  export interface File {
    exists(): Promise<[boolean]>;
    save(data: Buffer, options?: { contentType?: string; metadata?: Record<string, string> }): Promise<void>;
  }
}
