declare module 'canvas-confetti' {
  // Minimal typing: the package exports a default function that accepts options
  type Origin = { x?: number; y?: number };
  type ConfettiOptions = {
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
  } & Record<string, any>;

  function confetti(options?: ConfettiOptions): void;

  namespace confetti {}

  export default confetti;
}
