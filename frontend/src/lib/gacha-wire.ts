export type GachaCmd =
  | { type: "PING" }
  | { type: "HELLO"; who: "stage" | "control" }
  | { type: "ENTER_FULLSCREEN" }
  | { type: "EXIT_FULLSCREEN" }
  | { type: "DRAW"; spectacular: boolean }
  | { type: "DRAW_SLOT"; spectacular: boolean; slot: number }
  | { type: "SAVE" }
  | { type: "SET_WINNERS_COUNT"; value: number }
  | { type: "SET_GIFT_FOR_SLOT"; slot: number; giftId: number }
  | { type: "AUDIO_MUTE"; value: boolean }
  | { type: "AUDIO_VOLUME"; value: number };

export type GachaEvent =
  | { type: "PONG" }
  | { type: "STAGE_READY" }
  | { type: "STATE"; payload: unknown };

export interface GachaAPI {
  enterFullscreen?: () => Promise<void> | void;
  exitFullscreen?: () => Promise<void> | void;
  pickRandom?: (spectacular: boolean) => Promise<void> | void;
  pickRandomSlot?: (spectacular: boolean, slot: number) => Promise<void> | void;
  saveWinner?: () => Promise<void> | void;
  setWinnersCount?: (n: number) => void;
  setGiftForSlot?: (slot: number, giftId: number) => void;
  setMuted?: (m: boolean) => void;
  setVolume?: (v: number) => void;
  ensureCtx?: () => Promise<void> | void;
}

export const GACHA_CHANNEL = "gacha";
