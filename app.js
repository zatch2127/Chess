const express = require("express");
const socket = require("socket.io");
const http = require("http");
const Chess = require('chess.js').Chess; // Correct way to import the Chess class


const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socket(server);

const chess = new Chess();
let players = {}; // To store the players' socket IDs
let currentPlayer = "w";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => 
  {
  console.log("New connection established:", socket.id);

  // Assign roles to players
  if (!players.white) {
    players.white = socket.id;
    socket.emit("playerRole", "w");
  } else if (!players.black) {
    players.black = socket.id;
    socket.emit("playerRole", "b");
  } else {
    socket.emit("spectatorRole");
  }

  // Handle disconnection
  socket.on("disconnect", () => {
    if (socket.id === players.white) {
      delete players.white;
    } else if (socket.id === players.black) {
      delete players.black;
    }
    console.log("Player disconnected:", socket.id);
  });

// Handle move events
socket.on("move", (move) => {
  try {
    if (
      (chess.turn() === "w" && socket.id !== players.white) ||
      (chess.turn() === "b" && socket.id !== players.black)
    ) {
      return; // Ignore moves from players not in turn
    }

    const result = chess.move(move);
  
    if (result) {
      currentPlayer = chess.turn();
      io.emit("move", move);
      io.emit("boardState", chess.fen());

      // Check game-over conditions
      if (chess.isGameOver()) {
        let winner = chess.turn() === "w" ? "Black wins" : "White wins";
        io.emit("gameOver", `${winner} by checkmate or stalemate`);
      } else {
        io.emit("turn", chess.turn()); // It's the next player's turn
      }
    } else {
      console.log("Invalid move:", move);
      socket.emit("invalidMove", move);
    }
  } catch (error) {
    console.error("Error processing move:", error);
    socket.emit("invalidMove", move);
  }
});

});

app.get("/", (req, res) => {
  res.render("index", {
    title: "Chess Game",
    players,
    currentPlayer,
  });
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
