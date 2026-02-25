const STORAGE_KEY = 'monopoly_session';
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface GameSession {
  roomCode: string;
  playerName: string;
}

interface StoredSession extends GameSession {
  savedAt: number;
}

export function saveGameSession(roomCode: string, playerName: string): void {
  try {
    const data: StoredSession = { roomCode, playerName, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be unavailable (private browsing, storage full)
  }
}

export function getGameSession(): GameSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.roomCode === 'string' && typeof parsed.playerName === 'string') {
      // Expire stale sessions (no savedAt = legacy, treat as expired)
      if (typeof parsed.savedAt === 'number' && Date.now() - parsed.savedAt > SESSION_TTL_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      if (typeof parsed.savedAt !== 'number') {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return { roomCode: parsed.roomCode, playerName: parsed.playerName };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearGameSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
