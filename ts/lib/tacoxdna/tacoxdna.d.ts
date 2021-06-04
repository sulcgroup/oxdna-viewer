import { Logger } from './libs/base';
declare function convertFromTo(inputs: string[], from: string, to: string, opts: any): string | [string, string];
declare function convertFromTo_async(inputs: Map<string, string>, from: string, to: string, opts: any): Promise<unknown>;
export { convertFromTo, convertFromTo_async, Logger };
