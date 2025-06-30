const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");
const statusElement = document.querySelector(".status");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;

const renderBoard = () => {
  const board = chess.board();
  boardElement.innerHTML = "";

  board.forEach((row, rowIndex) => {
    row.forEach((square, colIndex) => {
      const squareElement = document.createElement("div");
      squareElement.classList.add(
        "square",
        (rowIndex + colIndex) % 2 === 0 ? "light" : "dark"
      );
      squareElement.dataset.row = rowIndex;
      squareElement.dataset.col = colIndex;

      if (square) {
        const pieceElement = document.createElement("div");
        pieceElement.classList.add(
          "piece",
          square.color === "w" ? "white" : "black"
        );
        pieceElement.innerText = getPieceUnicode(square);
        pieceElement.draggable = playerRole === square.color;

        pieceElement.addEventListener("dragstart", (e) => {
          if (pieceElement.draggable) {
            draggedPiece = pieceElement;
            sourceSquare = { row: rowIndex, col: colIndex };
            e.dataTransfer.setData("text/plain", "");
          }
        });

        pieceElement.addEventListener("dragend", () => {
          draggedPiece = null;
          sourceSquare = null;
        });

        squareElement.appendChild(pieceElement);
      }

      squareElement.addEventListener("dragover", (e) => e.preventDefault());

      squareElement.addEventListener("drop", () => {
        if (draggedPiece) {
          const targetSquare = {
            row: parseInt(squareElement.dataset.row),
            col: parseInt(squareElement.dataset.col),
          };
          handleMove(sourceSquare, targetSquare);
        }
      });

      boardElement.appendChild(squareElement);
    });
  });

  // Flip the entire board for black player
  if (playerRole === "b") {
    boardElement.classList.add("flipped");
  } else {
    boardElement.classList.remove("flipped");
  }
};

const handleMove = (source, target) => {
  const move = {
    from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
    to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
    promotion: "q", // Default promotion
  };
  socket.emit("move", move);
};

const getPieceUnicode = (piece) => {
  const unicodePieces = {
    p: "♟",
    r: "♜",
    n: "♞",
    b: "♝",
    q: "♛",
    k: "♚",
    P: "♙",
    R: "♖",
    N: "♘",
    B: "♗",
    Q: "♕",
    K: "♔",
  };
  return unicodePieces[piece.type] || "";
};

// Socket events
socket.on("playerRole", (role) => {
  playerRole = role;
  renderBoard();
});

socket.on("spectatorRole", () => {
  playerRole = null;
  renderBoard();
});

socket.on("boardState", (fen) => {
  chess.load(fen);
  renderBoard();
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

      // Check if game is over
      // Check if game is over
      if (chess.isGameOver()) {
        // Correct method for checking game over
        let winner = chess.turn() === "w" ? "Black wins" : "White wins";
        io.emit("gameOver", winner);
      } else {
        // Notify players whose turn it is
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

// Game status and turn display
socket.on("turn", (turn) => {
  const turnText = turn === "w" ? "Your Turn (White)" : "Your Turn (Black)";
  statusElement.innerText = turnText;
});

socket.on("gameOver", (message) => {
  statusElement.innerText = message;
});

// Initial render
renderBoard();
