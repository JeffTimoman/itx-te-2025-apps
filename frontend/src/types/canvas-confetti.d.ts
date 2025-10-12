declare module 'canvas-confetti' {
  // Minimal runtime-friendly typings for canvas-confetti used in this project.
  // Keep types conservative and avoid `any` to satisfy lint rules.

  export type Origin = { x?: number; y?: number };

  export type ConfettiOptions = {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    ticks?: number;
    gravity?: number;
    scalar?: number;
    drift?: number;
    origin?: Origin;
    width?: number;
    height?: number;
    colors?: string[];
    zIndex?: number;
  } & Record<string, unknown>;

  export type ConfettiFn = (opts?: Record<string, unknown>) => void;

  // Default export: top-level confetti invoker
  const confetti: ConfettiFn;
  export default confetti;

  // create: bind a confetti instance to a specific element/canvas
  export function create(
    container?: Element | HTMLCanvasElement | undefined,
    opts?: { resize?: boolean; useWorker?: boolean } & Record<string, unknown>
  ): ConfettiFn;
}
