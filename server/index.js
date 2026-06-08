import { createServer } from 'http';
import { Server } from 'socket.io';

const PORT = process.env.PVP_PORT || 3001;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// --- Matchmaking queue ---
let waitingPlayer = null; // socket reference
let roomCounter = 0;

io.on('connection', (socket) => {
  console.log(`[PvP] Conectado: ${socket.id}`);

  // --- Matchmaking ---
  socket.on('pvp:join', (payload) => {
    const { playerName } = payload || {};
    socket.data.playerName = playerName || 'Jugador';

    if (waitingPlayer && waitingPlayer.id !== socket.id && waitingPlayer.connected) {
      // Match found — create a room
      roomCounter += 1;
      const roomId = `pvp-room-${roomCounter}`;

      waitingPlayer.join(roomId);
      socket.join(roomId);

      waitingPlayer.data.roomId = roomId;
      waitingPlayer.data.role = 'player1';
      socket.data.roomId = roomId;
      socket.data.role = 'player2';

      console.log(`[PvP] Sala creada: ${roomId} → ${waitingPlayer.data.playerName} vs ${socket.data.playerName}`);

      // Notify both players
      waitingPlayer.emit('pvp:matched', {
        roomId,
        role: 'player1',
        opponentName: socket.data.playerName,
      });

      socket.emit('pvp:matched', {
        roomId,
        role: 'player2',
        opponentName: waitingPlayer.data.playerName,
      });

      waitingPlayer = null;
    } else {
      // Queue this player
      waitingPlayer = socket;
      socket.emit('pvp:waiting');
      console.log(`[PvP] ${socket.data.playerName} esperando rival...`);
    }
  });

  // --- Cancel matchmaking ---
  socket.on('pvp:cancel', () => {
    if (waitingPlayer && waitingPlayer.id === socket.id) {
      waitingPlayer = null;
      console.log(`[PvP] ${socket.data.playerName} canceló la búsqueda.`);
    }
  });

  // --- Relay: player selected their active card ---
  socket.on('pvp:select-active', (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('pvp:opponent-select-active', data);
  });

  // --- Relay: player assigned energy ---
  socket.on('pvp:assign-energy', (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('pvp:opponent-assign-energy', data);
  });

  // --- Relay: player attacked ---
  socket.on('pvp:attack', (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('pvp:opponent-attack', data);
  });

  // --- Relay: player passed turn ---
  socket.on('pvp:pass-turn', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('pvp:opponent-pass-turn');
  });

  // --- Relay: player played a trainer card ---
  socket.on('pvp:play-trainer', (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('pvp:opponent-play-trainer', data);
  });

  // --- Relay: player evolved a Pokémon ---
  socket.on('pvp:evolve', (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('pvp:opponent-evolve', data);
  });

  // --- Relay: player switched active Pokémon ---
  socket.on('pvp:switch-active', (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('pvp:opponent-switch-active', data);
  });

  // --- Relay: player force-switched after KO ---
  socket.on('pvp:force-switch', (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('pvp:opponent-force-switch', data);
  });

  // --- Relay: player selected their deck ---
  socket.on('pvp:deck-selected', (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('pvp:opponent-deck-selected', data);
  });

  // --- Relay: full game state sync (used after initial setup) ---
  socket.on('pvp:sync-state', (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('pvp:state-update', data);
  });

  // --- Disconnect handling ---
  socket.on('disconnect', () => {
    console.log(`[PvP] Desconectado: ${socket.id}`);

    // If the disconnected player was waiting, clear the queue
    if (waitingPlayer && waitingPlayer.id === socket.id) {
      waitingPlayer = null;
    }

    // Notify the opponent if in a room
    const roomId = socket.data.roomId;
    if (roomId) {
      socket.to(roomId).emit('pvp:opponent-disconnected');
    }
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎮 Servidor PvP escuchando en puerto ${PORT}`);
  console.log(`   Conecta desde otro PC en la misma red usando la IP local.\n`);
});
