declare module "@zxing/library" {
  export class Result {
    getText(): string;
    text?: string;
    result?: string;
  }

  export class BrowserMultiFormatReader {
    constructor(hints?: unknown, timeBetweenDecodingAttempts?: number);
    decodeFromVideoElement(video: HTMLVideoElement): Promise<Result> | Result;
    decodeFromVideoDevice(deviceId: string | null, videoElement: HTMLVideoElement): Promise<Result> | Result;
    reset(): void;
  }

  export class BrowserQRCodeReader extends BrowserMultiFormatReader {}

  export default BrowserMultiFormatReader;
}
