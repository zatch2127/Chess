const express = require("express");
const socket = require("socket.io");
const http = require("http");
const Chess = require("chess.js").Chess;
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socket(server);

const rooms = new Map();

const createRoomId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const getRoomSummary = (roomId, room) => ({
  roomId,
  whiteReady: Boolean(room.players.white),
  blackReady: Boolean(room.players.black),
  spectators: room.spectators.size,
  status: room.players.white && room.players.black ? "live" : "waiting",
});

const emitRoomList = () => {
  const roomList = Array.from(rooms.entries()).map(([roomId, room]) =>
    getRoomSummary(roomId, room)
  );
  io.emit("roomList", roomList);
};

const createRoom = () => {
  let roomId = createRoomId();

  while (rooms.has(roomId)) {
    roomId = createRoomId();
  }

  rooms.set(roomId, {
    chess: new Chess(),
    players: {
      white: null,
      black: null,
    },
    spectators: new Set(),
  });

  emitRoomList();
  return roomId;
};

const getRoomStateMessage = (room) => {
  if (!room.players.white) {
    return "Waiting for a White player to join.";
  }

  if (!room.players.black) {
    return "Waiting for a Black player to join.";
  }

  return `${room.chess.turn() === "w" ? "White" : "Black"} to move.`;
};

const emitRoomState = (roomId) => {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  io.to(roomId).emit("boardState", room.chess.fen());
  io.to(roomId).emit("turn", room.chess.turn());
  io.to(roomId).emit("roomStatus", {
    message: getRoomStateMessage(room),
    whiteReady: Boolean(room.players.white),
    blackReady: Boolean(room.players.black),
    spectators: room.spectators.size,
    roomId,
  });
  emitRoomList();
};

const assignRole = (roomId, socketInstance, preferredMode) => {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  let assignedMode = preferredMode;

  if (preferredMode === "player") {
    if (!room.players.white) {
      room.players.white = socketInstance.id;
      socketInstance.emit("playerRole", "w");
    } else if (!room.players.black) {
      room.players.black = socketInstance.id;
      socketInstance.emit("playerRole", "b");
    } else {
      assignedMode = "spectator";
    }
  }

  if (assignedMode === "spectator") {
    room.spectators.add(socketInstance.id);
    socketInstance.emit("spectatorRole");
  }
};

const cleanupSocketFromRoom = (socketInstance) => {
  const roomId = socketInstance.data.roomId;
  if (!roomId || !rooms.has(roomId)) {
    return;
  }

  const room = rooms.get(roomId);

  if (room.players.white === socketInstance.id) {
    room.players.white = null;
  }

  if (room.players.black === socketInstance.id) {
    room.players.black = null;
  }

  room.spectators.delete(socketInstance.id);
  socketInstance.leave(roomId);
  socketInstance.data.roomId = null;
  socketInstance.data.role = null;

  if (!room.players.white && !room.players.black && room.spectators.size === 0) {
    rooms.delete(roomId);
    emitRoomList();
    return;
  }

  emitRoomState(roomId);
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socketInstance) => {
  socketInstance.data.roomId = null;
  socketInstance.data.role = null;

  socketInstance.emit(
    "roomList",
    Array.from(rooms.entries()).map(([roomId, room]) => getRoomSummary(roomId, room))
  );

  socketInstance.on("createRoom", ({ mode } = {}) => {
    cleanupSocketFromRoom(socketInstance);

    const roomId = createRoom();
    socketInstance.join(roomId);
    socketInstance.data.roomId = roomId;
    socketInstance.data.role = mode === "spectator" ? "spectator" : "player";

    assignRole(roomId, socketInstance, socketInstance.data.role);

    socketInstance.emit("roomJoined", { roomId, mode: socketInstance.data.role });
    emitRoomState(roomId);
  });

  socketInstance.on("joinRoom", ({ roomId, mode } = {}) => {
    const normalizedRoomId = (roomId || "").trim().toUpperCase();

    if (!normalizedRoomId || !rooms.has(normalizedRoomId)) {
      socketInstance.emit("roomError", "Room not found.");
      return;
    }

    cleanupSocketFromRoom(socketInstance);

    socketInstance.join(normalizedRoomId);
    socketInstance.data.roomId = normalizedRoomId;
    socketInstance.data.role = mode === "spectator" ? "spectator" : "player";

    assignRole(normalizedRoomId, socketInstance, socketInstance.data.role);

    socketInstance.emit("roomJoined", {
      roomId: normalizedRoomId,
      mode: socketInstance.data.role,
    });
    emitRoomState(normalizedRoomId);
  });

  socketInstance.on("leaveRoom", () => {
    cleanupSocketFromRoom(socketInstance);
    socketInstance.emit("leftRoom");
    socketInstance.emit(
      "roomList",
      Array.from(rooms.entries()).map(([roomId, room]) => getRoomSummary(roomId, room))
    );
  });

  socketInstance.on("requestRoomList", () => {
    socketInstance.emit(
      "roomList",
      Array.from(rooms.entries()).map(([roomId, room]) => getRoomSummary(roomId, room))
    );
  });

  socketInstance.on("move", (move) => {
    const roomId = socketInstance.data.roomId;
    if (!roomId || !rooms.has(roomId)) {
      socketInstance.emit("roomError", "Join a room before moving.");
      return;
    }

    const room = rooms.get(roomId);

    if (!room.players.white || !room.players.black) {
      socketInstance.emit("roomError", "Waiting for both players to join.");
      return;
    }

    if (
      (room.chess.turn() === "w" && socketInstance.id !== room.players.white) ||
      (room.chess.turn() === "b" && socketInstance.id !== room.players.black)
    ) {
      socketInstance.emit("invalidMove", move);
      return;
    }

    try {
      const result = room.chess.move(move);

      if (!result) {
        socketInstance.emit("invalidMove", move);
        return;
      }

      io.to(roomId).emit("move", move);
      io.to(roomId).emit("boardState", room.chess.fen());

      if (room.chess.isGameOver()) {
        let gameResult = {
          type: "gameOver",
          winner: null,
          message: "Game over.",
        };

        if (room.chess.isCheckmate()) {
          const winner = room.chess.turn() === "w" ? "Black" : "White";
          gameResult = {
            type: "checkmate",
            winner,
            message: `${winner} wins by checkmate!`,
          };
        } else if (room.chess.isStalemate()) {
          gameResult = {
            type: "stalemate",
            winner: null,
            message: "Game ends in stalemate.",
          };
        } else if (room.chess.isDraw()) {
          gameResult = {
            type: "draw",
            winner: null,
            message: "Game ends in a draw.",
          };
        }

        io.to(roomId).emit("gameOver", gameResult);
      } else if (room.chess.inCheck()) {
        io.to(roomId).emit(
          "check",
          `${room.chess.turn() === "w" ? "White" : "Black"} is in check!`
        );
      }

      emitRoomState(roomId);
    } catch (error) {
      console.error("Error processing move:", error);
      socketInstance.emit("invalidMove", move);
    }
  });

  socketInstance.on("newGame", () => {
    const roomId = socketInstance.data.roomId;
    if (!roomId || !rooms.has(roomId)) {
      socketInstance.emit("roomError", "Join a room before starting a new game.");
      return;
    }

    const room = rooms.get(roomId);

    if (socketInstance.id !== room.players.white && socketInstance.id !== room.players.black) {
      socketInstance.emit("roomError", "Only players in the room can restart the game.");
      return;
    }

    room.chess.reset();
    io.to(roomId).emit("newGame");
    emitRoomState(roomId);
  });

  socketInstance.on("disconnect", () => {
    cleanupSocketFromRoom(socketInstance);
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
