// Aigram runtime — single entry point for game code.
//
// Examples:
//   import {
//     setGameUuid, useGameScore, useGameSave, useGenImage, useUpload,
//   } from '@shared/runtime';

// Bridge primitives (rarely needed directly by games)
export {
  callAigramAPI,
  postAigramAPI,
  openAigramProfile,
  openAigramPost,
  api_origin,
  telegramId,
  isInAigram,
} from './bridge';
export type { AigramResponse } from './bridge';

// Game UUID resolution
export { setGameUuid, getGameUuid } from './game-id';

// Event reporting + stats
export { useGameEvent } from './useGameEvent';
export type { UseGameEvent } from './useGameEvent';
