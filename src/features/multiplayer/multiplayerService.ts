import { io, type Socket } from 'socket.io-client';

export type PvpRole = 'player1' | 'player2';

export type PvpMatchInfo = {
  roomId: string;
  role: PvpRole;
  opponentName: string;
};

export type MultiplayerCallbacks = {
  onWaiting: () => void;
  onMatched: (info: PvpMatchInfo) => void;
  onOpponentSelectActive: (data: { cardId: string; card: any }) => void;
  onOpponentAssignEnergy: () => void;
  onOpponentAttack: () => void;
  onOpponentPassTurn: () => void;
  onOpponentDisconnected: () => void;
};

/**
 * Multiplayer service that manages the Socket.io connection to the PvP server.
 * Each browser tab creates its own instance.
 */
export class MultiplayerService {
  private socket: Socket | null = null;
  private callbacks: MultiplayerCallbacks | null = null;
  private _matchInfo: PvpMatchInfo | null = null;
  private _connected = false;
  private _joinedQueue = false;

  get matchInfo(): PvpMatchInfo | null {
    return this._matchInfo;
  }

  get connected(): boolean {
    return this._connected;
  }

  get isPlayer1(): boolean {
    return this._matchInfo?.role === 'player1';
  }

  /**
   * Connect to the PvP WebSocket server.
   * Uses the same hostname as the page (so it works on LAN),
   * but on port 3001.
   */
  connect(callbacks: MultiplayerCallbacks): void {
    // Guard: if a socket already exists (even if still connecting), don't create another.
    // React StrictMode double-mounts components, which would create two sockets otherwise.
    if (this.socket) {
      this.callbacks = callbacks;
      return;
    }

    this.callbacks = callbacks;

    // Use the page's hostname so LAN play works automatically.
    // If the user accesses http://192.168.1.100:5173, the socket
    // will connect to http://192.168.1.100:3001.
    const serverUrl = `http://${window.location.hostname}:3001`;

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      this._connected = true;
      console.log('[PvP Client] Conectado al servidor:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      this._connected = false;
      console.log('[PvP Client] Desconectado del servidor');
    });

    this.socket.on('pvp:waiting', () => {
      this.callbacks?.onWaiting();
    });

    this.socket.on('pvp:matched', (info: PvpMatchInfo) => {
      this._matchInfo = info;
      this.callbacks?.onMatched(info);
    });

    this.socket.on('pvp:opponent-select-active', (data) => {
      this.callbacks?.onOpponentSelectActive(data);
    });

    this.socket.on('pvp:opponent-assign-energy', () => {
      this.callbacks?.onOpponentAssignEnergy();
    });

    this.socket.on('pvp:opponent-attack', () => {
      this.callbacks?.onOpponentAttack();
    });

    this.socket.on('pvp:opponent-pass-turn', () => {
      this.callbacks?.onOpponentPassTurn();
    });

    this.socket.on('pvp:opponent-disconnected', () => {
      this.callbacks?.onOpponentDisconnected();
    });
  }

  /** Request to join the PvP matchmaking queue */
  joinQueue(playerName?: string): void {
    if (this._joinedQueue) return;
    this._joinedQueue = true;
    this.socket?.emit('pvp:join', { playerName: playerName || 'Jugador' });
  }

  /** Cancel matchmaking */
  cancelQueue(): void {
    this.socket?.emit('pvp:cancel');
  }

  /** Notify opponent that this player selected their active card */
  emitSelectActive(cardId: string, card: any): void {
    this.socket?.emit('pvp:select-active', { cardId, card });
  }

  /** Notify opponent that this player assigned energy */
  emitAssignEnergy(): void {
    this.socket?.emit('pvp:assign-energy');
  }

  /** Notify opponent that this player attacked */
  emitAttack(): void {
    this.socket?.emit('pvp:attack');
  }

  /** Notify opponent that this player passed their turn */
  emitPassTurn(): void {
    this.socket?.emit('pvp:pass-turn');
  }

  /** Disconnect and clean up */
  disconnect(): void {
    this._matchInfo = null;
    this._connected = false;
    this._joinedQueue = false;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

/** Singleton instance for the app */
export const multiplayerService = new MultiplayerService();
