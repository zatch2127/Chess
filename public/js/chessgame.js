const socket = io();
const chess = new Chess();

const boardElement = document.querySelector(".chessboard");
const statusElement = document.querySelector("#statusText");
const roleBadgeElement = document.querySelector("#roleBadge");
const turnBadgeElement = document.querySelector("#turnBadge");
const connectionBadgeElement = document.querySelector("#connectionBadge");
const newGameButton = document.querySelector("#newGameButton");
const createRoomButton = document.querySelector("#createRoomButton");
const watchRoomButton = document.querySelector("#watchRoomButton");
const joinRoomButton = document.querySelector("#joinRoomButton");
const joinWatchButton = document.querySelector("#joinWatchButton");
const leaveRoomButton = document.querySelector("#leaveRoomButton");
const roomCodeInput = document.querySelector("#roomCodeInput");
const currentRoomCodeElement = document.querySelector("#currentRoomCode");
const roomAudienceTextElement = document.querySelector("#roomAudienceText");
const roomListElement = document.querySelector("#roomList");
const roomEmptyStateElement = document.querySelector("#roomEmptyState");

let draggedPiece = null;
let sourceSquare = null;
let selectedSquare = null;
let playerRole = null;
let lastMoveSquares = [];
let currentRoomId = null;
let roomState = {
  whiteReady: false,
  blackReady: false,
  spectators: 0,
};

const PIECE_UNICODE = {
  wp: "\u2659",
  wr: "\u2656",
  wn: "\u2658",
  wb: "\u2657",
  wq: "\u2655",
  wk: "\u2654",
  bp: "\u265F",
  br: "\u265C",
  bn: "\u265E",
  bb: "\u265D",
  bq: "\u265B",
  bk: "\u265A",
};

const PROMOTION_OPTIONS = {
  w: [
    { piece: "q", symbol: "\u2655", name: "Queen" },
    { piece: "r", symbol: "\u2656", name: "Rook" },
    { piece: "b", symbol: "\u2657", name: "Bishop" },
    { piece: "n", symbol: "\u2658", name: "Knight" },
  ],
  b: [
    { piece: "q", symbol: "\u265B", name: "Queen" },
    { piece: "r", symbol: "\u265C", name: "Rook" },
    { piece: "b", symbol: "\u265D", name: "Bishop" },
    { piece: "n", symbol: "\u265E", name: "Knight" },
  ],
};

const squareToNotation = (square) =>
  `${String.fromCharCode(97 + square.col)}${8 - square.row}`;

const notationToSquare = (notation) => ({
  row: 8 - parseInt(notation[1], 10),
  col: notation.charCodeAt(0) - 97,
});

const isSameSquare = (a, b) => a && b && a.row === b.row && a.col === b.col;
const isPlayersTurn = () => playerRole && chess.turn() === playerRole;

const updateStatus = (message) => {
  statusElement.textContent = message;
};

const updateRoleBadge = () => {
  let label = "No role yet";

  if (playerRole === "w") {
    label = "Playing as White";
  } else if (playerRole === "b") {
    label = "Playing as Black";
  } else if (currentRoomId) {
    label = "Watching room";
  }

  roleBadgeElement.innerHTML = '<span class="badge-dot"></span>' + label;
};

const updateTurnBadge = (turn) => {
  const side = turn === "w" ? "White" : "Black";
  turnBadgeElement.textContent = `${side} to move`;
};

const updateRoomPanel = () => {
  currentRoomCodeElement.textContent = currentRoomId || "NONE";

  if (!currentRoomId) {
    roomAudienceTextElement.textContent = "No room joined";
    return;
  }

  const playerCount = Number(roomState.whiteReady) + Number(roomState.blackReady);
  roomAudienceTextElement.textContent =
    `${playerCount}/2 players, ${roomState.spectators} watching`;
};

const pulseBoard = () => {
  boardElement.classList.remove("shake");
  void boardElement.offsetWidth;
  boardElement.classList.add("shake");
};

const clearSelection = () => {
  selectedSquare = null;
};

const markLastMove = (move) => {
  if (!move || !move.from || !move.to) {
    lastMoveSquares = [];
    return;
  }

  lastMoveSquares = [notationToSquare(move.from), notationToSquare(move.to)];
};

const canSelectSquare = (piece) =>
  piece && piece.color === playerRole && isPlayersTurn() && roomState.whiteReady && roomState.blackReady;

const getPieceUnicode = (piece) => PIECE_UNICODE[`${piece.color}${piece.type}`] || "";

const renderBoard = () => {
  const board = chess.board();
  boardElement.innerHTML = "";

  board.forEach((row, rowIndex) => {
    row.forEach((square, colIndex) => {
      const boardSquare = { row: rowIndex, col: colIndex };
      const squareElement = document.createElement("div");
      squareElement.classList.add(
        "square",
        (rowIndex + colIndex) % 2 === 0 ? "light" : "dark"
      );

      squareElement.dataset.row = rowIndex;
      squareElement.dataset.col = colIndex;

      if (lastMoveSquares.some((item) => isSameSquare(item, boardSquare))) {
        squareElement.classList.add("last-move");
      }

      if (selectedSquare && isSameSquare(selectedSquare, boardSquare)) {
        squareElement.classList.add("selected");
      }

      if (square && canSelectSquare(square)) {
        squareElement.classList.add("selectable");
      }

      if (square) {
        const pieceElement = document.createElement("div");
        pieceElement.classList.add("piece", square.color === "w" ? "white" : "black");
        pieceElement.innerText = getPieceUnicode(square);
        pieceElement.draggable = canSelectSquare(square);

        pieceElement.addEventListener("dragstart", (event) => {
          if (!pieceElement.draggable) {
            event.preventDefault();
            return;
          }

          draggedPiece = pieceElement;
          sourceSquare = boardSquare;
          selectedSquare = boardSquare;
          pieceElement.classList.add("dragging");
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", squareToNotation(boardSquare));
        });

        pieceElement.addEventListener("dragend", () => {
          pieceElement.classList.remove("dragging");
          draggedPiece = null;
          sourceSquare = null;
          clearSelection();
          renderBoard();
        });

        squareElement.appendChild(pieceElement);
      }

      squareElement.addEventListener("dragover", (event) => {
        if (draggedPiece) {
          event.preventDefault();
          squareElement.classList.add("target");
        }
      });

      squareElement.addEventListener("dragleave", () => {
        squareElement.classList.remove("target");
      });

      squareElement.addEventListener("drop", () => {
        squareElement.classList.remove("target");
        if (draggedPiece && sourceSquare) {
          handleMove(sourceSquare, boardSquare);
        }
        draggedPiece = null;
        sourceSquare = null;
      });

      squareElement.addEventListener("click", () => {
        handleSquareClick(boardSquare, square);
      });

      boardElement.appendChild(squareElement);
    });
  });

  if (playerRole === "b") {
    boardElement.classList.add("flipped");
  } else {
    boardElement.classList.remove("flipped");
  }
};

const handleSquareClick = (boardSquare, piece) => {
  if (!currentRoomId) {
    updateStatus("Create or join a room first.");
    return;
  }

  if (!roomState.whiteReady || !roomState.blackReady) {
    updateStatus("Waiting for both players to join this room.");
    return;
  }

  if (!playerRole) {
    updateStatus("You are watching this room as a spectator.");
    return;
  }

  if (!selectedSquare) {
    if (canSelectSquare(piece)) {
      selectedSquare = boardSquare;
      updateStatus("Piece selected. Choose a destination square.");
      renderBoard();
    }
    return;
  }

  if (isSameSquare(selectedSquare, boardSquare)) {
    clearSelection();
    updateStatus("Selection cleared.");
    renderBoard();
    return;
  }

  if (canSelectSquare(piece)) {
    selectedSquare = boardSquare;
    updateStatus("Piece selected. Choose a destination square.");
    renderBoard();
    return;
  }

  handleMove(selectedSquare, boardSquare);
};

const isPawnPromotion = (source, target) => {
  const board = chess.board();
  const piece = board[source.row][source.col];

  if (!piece || piece.type !== "p") {
    return false;
  }

  return (
    (piece.color === "w" && target.row === 0) ||
    (piece.color === "b" && target.row === 7)
  );
};

const showPromotionDialog = (callback) => {
  const options = PROMOTION_OPTIONS[playerRole || "w"];
  const dialog = document.createElement("div");
  dialog.className = "promotion-dialog";
  dialog.innerHTML = `
    <div class="promotion-content">
      <h3>Choose Your Promotion</h3>
      <p>Finish the move by picking the piece you want on the board.</p>
      <div class="promotion-options">
        ${options
          .map(
            (option) => `
          <button class="promotion-option" type="button" data-piece="${option.piece}">
            <span class="promotion-symbol">${option.symbol}</span>
            <span>
              <strong>${option.name}</strong>
              <span class="promotion-name">Power up this pawn</span>
            </span>
          </button>
        `
          )
          .join("")}
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  dialog.querySelectorAll(".promotion-option").forEach((button) => {
    button.addEventListener("click", () => {
      document.body.removeChild(dialog);
      callback(button.dataset.piece);
    });
  });
};

const handleMove = (source, target) => {
  const from = squareToNotation(source);
  const to = squareToNotation(target);

  clearSelection();
  renderBoard();

  if (isPawnPromotion(source, target)) {
    showPromotionDialog((promotionPiece) => {
      socket.emit("move", { from, to, promotion: promotionPiece });
    });
    return;
  }

  socket.emit("move", { from, to });
};

const resetLocalBoardState = () => {
  chess.reset();
  clearSelection();
  lastMoveSquares = [];
  renderBoard();
  updateTurnBadge(chess.turn());
};

const renderRoomList = (rooms) => {
  roomListElement.innerHTML = "";

  if (!rooms.length) {
    roomEmptyStateElement.style.display = "block";
    return;
  }

  roomEmptyStateElement.style.display = "none";

  rooms.forEach((room) => {
    const roomItem = document.createElement("li");
    roomItem.className = "room-item";
    roomItem.innerHTML = `
      <div class="room-item-header">
        <strong>${room.roomId}</strong>
        <span class="badge ${room.status === "live" ? "live" : "wait"}">
          <span class="badge-dot"></span>
          ${room.status === "live" ? "Live" : "Waiting"}
        </span>
      </div>
      <div class="room-meta">
        White: ${room.whiteReady ? "Ready" : "Open"} | Black: ${
      room.blackReady ? "Ready" : "Open"
    } | Spectators: ${room.spectators}
      </div>
      <div class="room-actions">
        <button class="secondary-button" type="button" data-action="play" data-room="${room.roomId}">
          Play
        </button>
        <button class="secondary-button" type="button" data-action="watch" data-room="${room.roomId}">
          Watch
        </button>
      </div>
    `;

    roomItem.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        socket.emit("joinRoom", {
          roomId: button.dataset.room,
          mode: button.dataset.action === "watch" ? "spectator" : "player",
        });
      });
    });

    roomListElement.appendChild(roomItem);
  });
};

createRoomButton.addEventListener("click", () => {
  socket.emit("createRoom", { mode: "player" });
});

watchRoomButton.addEventListener("click", () => {
  socket.emit("createRoom", { mode: "spectator" });
});

joinRoomButton.addEventListener("click", () => {
  socket.emit("joinRoom", { roomId: roomCodeInput.value, mode: "player" });
});

joinWatchButton.addEventListener("click", () => {
  socket.emit("joinRoom", { roomId: roomCodeInput.value, mode: "spectator" });
});

leaveRoomButton.addEventListener("click", () => {
  socket.emit("leaveRoom");
});

newGameButton.addEventListener("click", () => {
  socket.emit("newGame");
});

socket.on("connect", () => {
  connectionBadgeElement.className = "badge live";
  connectionBadgeElement.innerHTML = '<span class="badge-dot"></span>Connected';
  socket.emit("requestRoomList");
});

socket.on("disconnect", () => {
  connectionBadgeElement.className = "badge";
  connectionBadgeElement.innerHTML = '<span class="badge-dot"></span>Disconnected';
  updateStatus("Connection lost. Waiting to reconnect...");
});

socket.on("roomList", (rooms) => {
  renderRoomList(rooms);
});

socket.on("roomJoined", ({ roomId }) => {
  currentRoomId = roomId;
  roomCodeInput.value = roomId;
  updateRoomPanel();
  updateRoleBadge();
  updateStatus(`Joined room ${roomId}.`);
});

socket.on("leftRoom", () => {
  currentRoomId = null;
  playerRole = null;
  roomState = {
    whiteReady: false,
    blackReady: false,
    spectators: 0,
  };
  resetLocalBoardState();
  updateRoleBadge();
  updateRoomPanel();
  updateStatus("You left the room.");
});

socket.on("roomStatus", (nextRoomState) => {
  roomState = nextRoomState;
  currentRoomId = nextRoomState.roomId || currentRoomId;
  updateRoomPanel();
  updateRoleBadge();
  updateStatus(nextRoomState.message);
});

socket.on("roomError", (message) => {
  pulseBoard();
  updateStatus(message);
});

socket.on("playerRole", (role) => {
  playerRole = role;
  updateRoleBadge();
  updateStatus(role === "w" ? "You are White. Waiting for Black." : "You are Black. Match ready.");
  renderBoard();
});

socket.on("spectatorRole", () => {
  playerRole = null;
  updateRoleBadge();
  updateStatus("You are watching this room as a spectator.");
  renderBoard();
});

socket.on("boardState", (fen) => {
  chess.load(fen);
  updateTurnBadge(chess.turn());
  renderBoard();
});

socket.on("move", (move) => {
  try {
    const result = chess.move(move);
    if (result) {
      markLastMove(move);
      updateTurnBadge(chess.turn());
      renderBoard();
    }
  } catch (error) {
    console.error("Error processing move:", error);
  }
});

socket.on("turn", (turn) => {
  updateTurnBadge(turn);

  if (!roomState.whiteReady || !roomState.blackReady) {
    updateStatus(roomState.blackReady ? "Waiting for White player to join." : "Waiting for Black player to join.");
    return;
  }

  if (!playerRole) {
    updateStatus(`${turn === "w" ? "White" : "Black"} is thinking.`);
    return;
  }

  if (playerRole === turn) {
    updateStatus(`Your turn. Attack with ${turn === "w" ? "White" : "Black"}.`);
  } else {
    updateStatus(`Opponent's turn. Hold position.`);
  }
});

socket.on("check", (message) => {
  updateStatus(message);
});

socket.on("gameOver", (result) => {
  let message = "Game Over";

  if (typeof result === "string") {
    message = result;
  } else if (result && result.message) {
    message = result.message;
  } else if (result && result.winner) {
    message = `Game Over. ${result.winner} wins.`;
  }

  updateStatus(message);
});

socket.on("newGame", () => {
  chess.reset();
  clearSelection();
  lastMoveSquares = [];
  updateTurnBadge(chess.turn());
  updateStatus("New match started. White moves first.");
  renderBoard();
});

socket.on("invalidMove", () => {
  pulseBoard();
  updateStatus("Invalid move. Try another square.");
  clearSelection();
  renderBoard();
});

updateRoleBadge();
updateTurnBadge(chess.turn());
updateRoomPanel();
updateStatus("Create or join a room to start.");
renderBoard();
