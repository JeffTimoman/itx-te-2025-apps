export {};

declare global {
  interface BarcodeDetectorInstance {
    detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string }>>;
  }

  interface BarcodeDetectorConstructor {
    new (options?: { formats?: string[] }): BarcodeDetectorInstance;
    getSupportedFormats?: () => Promise<string[]>;
  }

  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}
