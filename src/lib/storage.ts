const HOST_SECRET_PREFIX = "avalon_host_secret_";
const HOST_SLOT_PREFIX = "avalon_host_slot_";
const PLAYER_TOKEN_PREFIX = "avalon_player_token_";

export function saveHostSecret(code: string, secret: string): void {
  localStorage.setItem(`${HOST_SECRET_PREFIX}${code}`, secret);
}

export function loadHostSecret(code: string): string | null {
  return localStorage.getItem(`${HOST_SECRET_PREFIX}${code}`);
}

export function clearHostSecret(code: string): void {
  localStorage.removeItem(`${HOST_SECRET_PREFIX}${code}`);
}

export function savePlayerToken(code: string, token: string): void {
  localStorage.setItem(`${PLAYER_TOKEN_PREFIX}${code}`, token);
}

export function loadPlayerToken(code: string): string | null {
  return localStorage.getItem(`${PLAYER_TOKEN_PREFIX}${code}`);
}

export function clearPlayerToken(code: string): void {
  localStorage.removeItem(`${PLAYER_TOKEN_PREFIX}${code}`);
}

export function saveHostSlotId(code: string, slotId: string): void {
  localStorage.setItem(`${HOST_SLOT_PREFIX}${code}`, slotId);
}

export function loadHostSlotId(code: string): string | null {
  return localStorage.getItem(`${HOST_SLOT_PREFIX}${code}`);
}
