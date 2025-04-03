declare module "https://cdn.skypack.dev/dexie" {
  import Dexie, { type EntityTable } from "dexie";
  export default Dexie;
  export { EntityTable };
}

declare module "https://cdn.jsdelivr.net/npm/@paralleldrive/cuid2@2.2.2/index.min.js" {
  function createId(): string;
  export default createId;
}

declare module "https://cdn.skypack.dev/pako" {
  export interface DeflateOptions {
    level?: number;
  }

  /**
   * Compress data using the deflate algorithm.
   * @param input - The string or binary data to compress.
   * @param options - Optional compression settings.
   * @returns A Uint8Array containing the compressed data.
   */
  export function deflate(
    input: string | Uint8Array,
    options?: DeflateOptions,
  ): Uint8Array;

  export interface InflateOptions {
    to?: "string";
  }

  /**
   * Decompress data using the inflate algorithm.
   * @param input - The compressed data as a Uint8Array or ArrayBuffer.
   * @param options - Optional inflate options.
   * @returns The decompressed data.
   */
  export function inflate(
    input: Uint8Array | ArrayBuffer,
    options?: InflateOptions,
  ): any;
}
