/**
 * Custom type definitions for packages without official TypeScript support
 */

// If any package still has issues, we can add declarations here
// Example:
// declare module 'package-name' {
//   // Add type definitions here
//   export default any;
// }

// Fallback declarations for chance, textract, and user-agents if needed
declare module 'chance' {
  const Chance: any;
  export = Chance;
}

declare module 'textract' {
  export function fromFileWithPath(
    filePath: string, 
    options: any, 
    callback: (error: Error | null, text: string) => void
  ): void;
  
  export function fromBufferWithName(
    buffer: Buffer,
    fileName: string,
    options: any,
    callback: (error: Error | null, text: string) => void
  ): void;
  
  export function fromBufferWithMime(
    mimeType: string,
    buffer: Buffer,
    callback: (error: Error | null, text: string) => void
  ): void;
}

declare module 'user-agents' {
  export default class UserAgent {
    constructor(options?: any);
    toString(): string;
    random(): UserAgent;
  }
} 