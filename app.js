
const express = require("express");
const socket = require("socket.io");
const http = require("http");
const Chess = require('chess.js').Chess;
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socket(server);
const chess = new Chess();
let players = {};
let currentPlayer = "w";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
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
        return;
      }
      
      const result = chess.move(move);
      
      if (result) {
        currentPlayer = chess.turn();
        io.emit("move", move);
        io.emit("boardState", chess.fen());
        
        // Check game-over conditions
        if (chess.isGameOver()) {
          let gameResult = {};
          
          if (chess.isCheckmate()) {
            const winner = chess.turn() === "w" ? "Black" : "White";
            gameResult = {
              type: "checkmate",
              winner: winner,
              message: `${winner} wins by checkmate! 🎉`,
              celebration: true
            };
           
          } else if (chess.isStalemate()) {
            gameResult = {
              type: "stalemate",
              winner: null,
              message: "Game ends in stalemate! 🤝",
              celebration: false
            };
          } else if (chess.isDraw()) {
            gameResult = {
              type: "draw",
              winner: null,
              message: "Game ends in a draw! 🤝",
              celebration: false
            };
          }
          
          // Emit game over with celebration data
          io.emit("gameOver", gameResult);
          
        } else if (chess.inCheck()) {
          const playerInCheck = chess.turn() === "w" ? "White" : "Black";
          io.emit("check", `${playerInCheck} is in check!`);
          io.emit("turn", chess.turn());
        } else {
          io.emit("turn", chess.turn());
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

  // Handle new game request
  socket.on("newGame", () => {
    chess.reset();
    currentPlayer = "w";
    io.emit("newGame");
    io.emit("boardState", chess.fen());
    io.emit("turn", chess.turn());
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

