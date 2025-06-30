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

// Function to check if move is a pawn promotion
const isPawnPromotion = (source, target) => {
  const board = chess.board();
  const piece = board[source.row][source.col];

  if (!piece || piece.type !== "p") return false;

  // White pawn reaching rank 8 (row 0) or black pawn reaching rank 1 (row 7)
  return (
    (piece.color === "w" && target.row === 0) ||
    (piece.color === "b" && target.row === 7)
  );
};

// Function to show promotion dialog
const showPromotionDialog = (source, target, callback) => {
  const promotionOptions = [
    { piece: "q", symbol: playerRole === "w" ? "♕" : "♛", name: "Queen" },
    { piece: "r", symbol: playerRole === "w" ? "♖" : "♜", name: "Rook" },
    { piece: "b", symbol: playerRole === "w" ? "♗" : "♝", name: "Bishop" },
    { piece: "n", symbol: playerRole === "w" ? "♘" : "♞", name: "Knight" },
  ];

  // Create promotion dialog
  const dialog = document.createElement("div");
  dialog.className = "promotion-dialog";
  dialog.innerHTML = `
    <div class="promotion-content">
      <h3>Choose promotion piece:</h3>
      <div class="promotion-options">
        ${promotionOptions
          .map(
            (option) => `
          <button class="promotion-option" data-piece="${option.piece}">
            <span class="promotion-symbol">${option.symbol}</span>
            <span class="promotion-name">${option.name}</span>
          </button>
        `
          )
          .join("")}
      </div>
    </div>
  `;

  // Add styles
  const style = document.createElement("style");
  style.textContent = `
    .promotion-dialog {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    .promotion-content {
      background: white;
      padding: 20px;
      border-radius: 10px;
      text-align: center;
    }
    .promotion-options {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }
    .promotion-option {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 15px;
      border: 2px solid #ccc;
      background: white;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .promotion-option:hover {
      border-color: #007bff;
      background: #f8f9fa;
    }
    .promotion-symbol {
      font-size: 30px;
      margin-bottom: 5px;
    }
    .promotion-name {
      font-size: 12px;
      color: #666;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(dialog);

  // Handle option selection
  dialog.querySelectorAll(".promotion-option").forEach((button) => {
    button.addEventListener("click", () => {
      const selectedPiece = button.dataset.piece;
      document.body.removeChild(dialog);
      document.head.removeChild(style);
      callback(selectedPiece);
    });
  });
};

const handleMove = (source, target) => {
  const from = `${String.fromCharCode(97 + source.col)}${8 - source.row}`;
  const to = `${String.fromCharCode(97 + target.col)}${8 - target.row}`;

  // Check if this is a pawn promotion
  if (isPawnPromotion(source, target)) {
    showPromotionDialog(source, target, (promotionPiece) => {
      const move = { from, to, promotion: promotionPiece };
      socket.emit("move", move);
    });
  } else {
    // Regular move without promotion
    const move = { from, to };
    socket.emit("move", move);
  }
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
    // Note: This validation should be on the server side
    const result = chess.move(move);
    if (result) {
      renderBoard(); // Re-render the board after a successful move
    }
  } catch (error) {
    console.error("Error processing move:", error);
  }
});

// Game status and turn display
socket.on("turn", (turn) => {
  if (playerRole === turn) {
    statusElement.innerText = `Your Turn (${turn === "w" ? "White" : "Black"})`;
  } else {
    statusElement.innerText = `Opponent's Turn (${
      turn === "w" ? "White" : "Black"
    })`;
  }
});

socket.on("gameOver", (result) => {
  // Handle different game over scenarios
  let message = "";

  if (typeof result === "string") {
    message = result;
  } else if (result && result.winner) {
    message = `Game Over - ${result.winner} wins!`;
  } else if (result && result.draw) {
    message = "Game Over - Draw!";
  } else {
    message = "Game Over";
  }

  statusElement.innerText = message;

  // Add some debugging
  console.log("Creating rematch button...");

  const rematchBtn = document.createElement("button");
  rematchBtn.innerText = "Rematch";
  rematchBtn.style.display = "block"; // Force display
  rematchBtn.style.marginTop = "10px"; // Add some spacing

  rematchBtn.onclick = function () {
    console.log("Rematch button clicked!"); // Debug log
    location.reload(true);
    console.log("Working"); // Make sure this function exists and works
  };

  // Clear any existing buttons first
  const existingBtn = statusElement.querySelector("button");
  if (existingBtn) {
    existingBtn.remove();
  }

  statusElement.appendChild(rematchBtn);
  console.log("Button appended:", rematchBtn); // Verify it was added
});

socket.on("invalidMove", (move) => {
  console.log("Invalid move attempted:", move);
  statusElement.innerText = "Invalid move, try again!";
});

// Initial render
renderBoard();
