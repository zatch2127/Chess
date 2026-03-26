# Chess

Realtime multiplayer chess app with room-based matches and spectator support.

## Stack

- Backend: Node.js + Express
- Realtime layer: Socket.IO
- Game rules: `chess.js`
- Frontend: plain HTML, CSS, and vanilla JavaScript
- Styling: custom CSS in [`views/index.html`](/D:/Chess/views/index.html)
- Package manager: npm

Note: `mongoose`, `react`, and `react-dom` are listed in [`package.json`](/D:/Chess/package.json), but the current app flow is driven by Express, Socket.IO, and static client files.

## How The Project Runs

Request flow:

1. `node app.js` starts the Express server on `http://localhost:3000`
2. Express serves static assets from [`public`](/D:/Chess/public) and returns [`views/index.html`](/D:/Chess/views/index.html) for `/`
3. The browser loads [`public/js/chessgame.js`](/D:/Chess/public/js/chessgame.js)
4. The client opens a Socket.IO connection to the server
5. Socket.IO events handle room creation, room joining, moves, turn updates, and game status
6. `chess.js` validates legal moves and tracks board state on both server and client

## Project Structure

```text
.
|- app.js                  # Express + Socket.IO server
|- package.json            # npm scripts and dependencies
|- public/
|  \- js/chessgame.js      # browser-side chess UI and socket events
|- views/
|  \- index.html           # main page markup and embedded styles
|- frontendSetup.yaml      # frontend notes
\- backendSetup.yaml       # backend notes
```

## Run Locally

Prerequisites:

- Node.js
- npm

Install dependencies:

```bash
npm install
```

Start the project:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## How To Use

1. Open the app in a browser
2. Click `Create Room` to play, or `Create Watch Room` to open a spectator room
3. Share the 6-character room code with another user
4. A second player joins with `Join To Play`
5. Additional users can join with `Join To Watch`
6. Use `New Match` to reset the board inside the current room

## Main Files

- [`app.js`](/D:/Chess/app.js): server setup, room management, move validation, realtime events
- [`views/index.html`](/D:/Chess/views/index.html): UI layout and styles
- [`public/js/chessgame.js`](/D:/Chess/public/js/chessgame.js): board rendering, interactions, and Socket.IO client logic

