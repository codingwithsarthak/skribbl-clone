
import express from "express";
import http from "http";
import cors from "cors";
import { randomInt } from "crypto";
import { Server } from "socket.io";

const app = express();
const httpServer = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = [
    "http://localhost:5173",
    "https://skribbl-clone-client-lbjg.onrender.com"
];

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

const io = new Server(httpServer, {
    cors: {
        origin: CLIENT_URL,
        methods: ["GET", "POST"]
    }
});

// Rooms and game state are stored in server memory.
const rooms = new Map();

const WORDS = [
    "apple",
    "elephant",
    "guitar",
    "rainbow",
    "pizza",
    "rocket",
    "butterfly",
    "castle",
    "turtle",
    "airplane",
    "banana",
    "sunflower",
    "football",
    "mountain",
    "dinosaur",
    "umbrella",
    "watermelon",
    "computer",
    "elephant",
    "giraffe",
    "penguin",
    "kangaroo",
    "butterfly",
    "dolphin",
    "crocodile",
    "octopus",
    "turtle",
    "peacock",
    "pizza",
    "burger",
    "sandwich",
    "watermelon",
    "pineapple",
    "popcorn",
    "ice cream",
    "chocolate",
    "pancake",
    "donut",
    "umbrella",
    "backpack",
    "toothbrush",
    "scissors",
    "telephone",
    "headphones",
    "flashlight",
    "suitcase",
    "key",
    "clock",
    "rainbow",
    "volcano",
    "waterfall",
    "mountain",
    "tornado",
    "snowflake",
    "cactus",
    "mushroom",
    "sunflower",
    "lightning",
    "airplane",
    "helicopter",
    "submarine",
    "bicycle",
    "train",
    "lighthouse",
    "castle",
    "bridge",
    "pyramid",
    "rocket",
    "astronaut",
    "superhero",
    "mermaid",
    "robot",
    "treasure",
    "ghost",
    "dragon",
    "wizard",
    "time machine",
    "magic wand"
];

function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code;

    do {
        code = Array.from(
            { length: 6 },
            () => chars[randomInt(chars.length)]
        ).join("");
    } while (rooms.has(code));

    return code;
}

function getPublicRoom(room) {
    return {
        code: room.code,
        hostId: room.hostId,
        players: room.players.map((player) => ({
            id: player.id,
            name: player.name,
            score: player.score
        })),
        game: room.game
            ? {
                status: room.game.status,
                drawerId: room.game.drawerId,
                round: room.game.round,
                maxRounds: room.game.maxRounds,
                roundDuration: room.game.roundDuration,
                wordLength: room.game.word?.length || 0,
                roundEndsAt: room.game.roundEndsAt || null,
                correctGuessers: room.game.correctGuessers || []
            }
            : null
    };
}

// Never send the secret word in the public room state.
function sendRoomState(room) {
    io.to(room.code).emit("room-updated", getPublicRoom(room));
}

function sendWordChoices(room) {
    const drawerSocket = io.sockets.sockets.get(
        room.game.drawerId
    );

    if (!drawerSocket) return;

    const choices = [...WORDS]
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

    // Choices go only to the drawer, never to the whole room.
    drawerSocket.emit("word-choices", choices);
}


function stopGame(room) {
    if (!room.game) return;

    clearTimeout(room.game.choiceTimeout);
    clearTimeout(room.game.roundTimeout);
    clearTimeout(room.game.nextRoundTimeout);
    clearInterval(room.game.hintTimeout);

    room.game = null;
    sendRoomState(room);
}


function leaveRoom(socket) {
    const code = socket.data.roomCode;

    if (!code) return;

    socket.data.roomCode = null;
    socket.leave(code);

    const room = rooms.get(code);

    if (!room) return;

    room.players = room.players.filter(
        (player) => player.id !== socket.id
    );

    if (room.players.length === 0) {
        stopGame(room);
        rooms.delete(code);
        return;
    }

    if (room.hostId === socket.id) {
        room.hostId = room.players[0].id;
    }

    if (room.game?.drawerId === socket.id) {
        stopGame(room);

        io.to(code).emit(
            "game-message",
            "The drawer left. The game has returned to the lobby."
        );
    }

    sendRoomState(room);

}

function startChoosingRound(room) {
    if (!room.game) return;

    clearTimeout(room.game.choiceTimeout);
    clearTimeout(room.game.roundTimeout);
    clearInterval(room.game.hintTimeout);
    room.game.hintTimeout = null;

    room.game.status = "choosing";
    room.game.word = null;
    room.game.correctGuessers = [];
    room.game.roundEndsAt = null;
    room.game.choiceTimeout = null;
    room.game.roundTimeout = null;

    sendRoomState(room);

    io.to(room.code).emit("round-ended", {
        round: room.game.round
    });

    sendWordChoices(room);

    room.game.choiceTimeout = setTimeout(() => {
        const currentRoom = rooms.get(room.code);

        if (
            !currentRoom?.game ||
            currentRoom.game.status !== "choosing"
        ) {
            return;
        }

        beginDrawing(
            currentRoom,
            WORDS[randomInt(WORDS.length)]
        );
    }, 15000);
}

function finishRound(room) {
    if (!room.game) return;

    const game = room.game;

    clearTimeout(game.roundTimeout);
    clearTimeout(game.choiceTimeout);
    clearInterval(game.hintTimeout);
    game.hintTimeout = null;

    game.roundTimeout = null;
    game.choiceTimeout = null;
    game.status = "round-ended";


    io.to(room.code).emit("round-ended", {
        word: game.word,
        round: game.round
    });

    sendRoomState(room);

    game.nextRoundTimeout = setTimeout(() => {
        const currentRoom = rooms.get(room.code);

        if (!currentRoom?.game) return;

        const currentGame = currentRoom.game;

        if (currentGame.round >= currentGame.maxRounds) {
            currentGame.status = "finished";
            currentGame.roundEndsAt = null;

            io.to(room.code).emit("game-finished", {
                players: [...currentRoom.players]
                    .sort((a, b) => b.score - a.score)
                    .map((player) => ({
                        name: player.name,
                        score: player.score
                    }))
            });

            sendRoomState(currentRoom);
            return;
        }

        currentGame.round += 1;

        const currentIndex = currentRoom.players.findIndex(
            (player) => player.id === currentGame.drawerId
        );

        const nextIndex =
            (currentIndex + 1) % currentRoom.players.length;

        currentGame.drawerId =
            currentRoom.players[nextIndex].id;

        startChoosingRound(currentRoom);
    }, 5000);
}


io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    socket.on("create-room", (data, callback) => {
        const name = String(data?.name || "")
            .trim()
            .slice(0, 20);

        if (!name) {
            return callback?.({
                error: "Please enter your name."
            });
        }

        if (socket.data.roomCode) {
            return callback?.({
                error: "Leave your current room first."
            });
        }

        const code = generateRoomCode();

        const room = {
            code,
            hostId: socket.id,
            players: [
                { id: socket.id, name, score: 0 }
            ],
            game: null
        };

        rooms.set(code, room);
        socket.join(code);
        socket.data.roomCode = code;

        callback?.({ room: getPublicRoom(room) });
        sendRoomState(room);
    });

    socket.on("join-room", (data, callback) => {
        const name = String(data?.name || "")
            .trim()
            .slice(0, 20);

        const code = String(data?.code || "")
            .trim()
            .toUpperCase();

        const room = rooms.get(code);

        if (!name) {
            return callback?.({
                error: "Please enter your name."
            });
        }

        if (!room) {
            return callback?.({
                error: "Room not found. Check the room code."
            });
        }

        if (room.game) {
            return callback?.({
                error: "This game has already started."
            });
        }

        if (socket.data.roomCode) {
            return callback?.({
                error: "Leave your current room first."
            });
        }

        if (room.players.length >= 8) {
            return callback?.({
                error: "This room is full."
            });
        }

        room.players.push({
            id: socket.id,
            name,
            score: 0
        });

        socket.join(code);
        socket.data.roomCode = code;

        callback?.({ room: getPublicRoom(room) });
        sendRoomState(room);
    });

    socket.on("start-game", (settings, callback) => {
        if (typeof settings === "function") {
            callback = settings;
            settings = {};
        }

        const allowedDurations = [30, 60, 90, 120];
        const requestedDuration = Number(settings?.roundDuration);

        const roundDuration = allowedDurations.includes(requestedDuration)
            ? requestedDuration
            : 60;
        const room = rooms.get(socket.data.roomCode);

        if (!room) {
            return callback?.({ error: "Room not found." });
        }

        if (socket.id !== room.hostId) {
            return callback?.({
                error: "Only the host can start the game."
            });
        }

        if (room.game) {
            return callback?.({
                error: "The game has already started."
            });
        }

        if (room.players.length < 2) {
            return callback?.({
                error: "At least 2 players are required."
            });
        }

        room.players.forEach((player) => {
            player.score = 0;
        });


        room.game = {
            status: "choosing",
            drawerId: room.players[0].id,
            round: 1,
            maxRounds: room.players.length,
            roundDuration,
            word: null,
            correctGuessers: [],
            choiceTimeout: null,
            roundTimeout: null,
            nextRoundTimeout: null,
            roundEndsAt: null,
            drawingHistory: [],
            currentStroke: null,
        };


        callback?.({ ok: true });
        sendRoomState(room);

        // Temporary fallback: choose a word if the drawer
        // does not select one within 15 seconds.
        room.game.choiceTimeout = setTimeout(() => {
            const currentRoom = rooms.get(room.code);

            if (
                !currentRoom?.game ||
                currentRoom.game.status !== "choosing"
            ) {
                return;
            }

            const word = WORDS[randomInt(WORDS.length)];

            beginDrawing(currentRoom, word);
        }, 15000);

        sendWordChoices(room);
    });

    socket.on("play-again", ({ roomCode }, callback) => {
        const room = rooms.get(roomCode);

        if (!room || !room.game) {
            callback?.({ error: "Room or game not found." });
            return;
        }

        // Only the host can restart the game.
        if (room.hostId !== socket.id) {
            callback?.({ error: "Only the host can restart the game." });
            return;
        }

        // Restart only after the game has finished.
        if (room.game.status !== "finished") {
            callback?.({ error: "The game has not finished yet." });
            return;
        }

        // Clear existing timers.
        clearTimeout(room.game.choiceTimeout);
        clearTimeout(room.game.roundTimeout);
        clearTimeout(room.game.nextRoundTimeout);

        // Clear the hints interval if your game uses one.
        if (room.game.hintTimeout) {
            clearInterval(room.game.hintTimeout);
        }

        // Reset scores.
        room.players.forEach((player) => {
            player.score = 0;
        });

        // Reset the game for a fresh match.
        room.game.status = "choosing";
        room.game.drawerId = room.players[0]?.id;
        room.game.round = 1;
        room.game.maxRounds = room.players.length;
        room.game.word = null;
        room.game.correctGuessers = [];
        room.game.roundEndsAt = null;
        room.game.choiceTimeout = null;
        room.game.roundTimeout = null;
        room.game.nextRoundTimeout = null;
        room.game.hintTimeout = null;
        room.game.hintRevealedCount = 0;
        room.game.drawingHistory = [];
        room.game.currentStroke = null;

        // Clear the old drawing for everyone.
        io.to(room.code).emit("clear-canvas");

        sendRoomState(room);

        // Start the next game's word-selection phase.
        startChoosingRound(room);

        callback?.({ success: true });
    });


    socket.on("choose-word", (word, callback) => {
        const room = rooms.get(socket.data.roomCode);

        if (!room?.game || room.game.status !== "choosing") {
            return callback?.({
                error: "Word selection is not active."
            });
        }

        if (socket.id !== room.game.drawerId) {
            return callback?.({
                error: "Only the active drawer can choose a word."
            });
        }

        if (typeof word !== "string" || !WORDS.includes(word)) {
            return callback?.({
                error: "That word is not a valid choice."
            });
        }

        clearTimeout(room.game.choiceTimeout);

        beginDrawing(room, word);

        callback?.({ ok: true });
    });

    socket.on("leave-room", () => {
        leaveRoom(socket);
    });

    socket.on("disconnect", () => {
        console.log("Player disconnected:", socket.id);
        leaveRoom(socket);
    });


    socket.on("draw-stroke", (stroke) => {
        const roomCode = socket.data.roomCode;
        const room = rooms.get(roomCode);

        if (
            !room?.game ||
            room.game.status !== "drawing" ||
            room.game.drawerId !== socket.id
        ) {
            return;
        }

        if (!stroke || typeof stroke !== "object") return;

        const {
            fromX,
            fromY,
            toX,
            toY,
            color,
            size,
            action
        } = stroke;

        const coordinates = [fromX, fromY, toX, toY];

        if (
            !coordinates.every(
                (value) =>
                    typeof value === "number" &&
                    Number.isFinite(value) &&
                    value >= 0 &&
                    value <= 1
            ) ||
            typeof color !== "string" ||
            !/^#[0-9a-fA-F]{6}$/.test(color) ||
            typeof size !== "number" ||
            !Number.isFinite(size)
        ) {
            return;
        }

        const safeStroke = {
            fromX,
            fromY,
            toX,
            toY,
            color,
            size: Math.max(2, Math.min(18, size)),
            action: typeof action === "string" ? action : null
        };

        if (action === "start") {
            room.game.currentStroke = {
                id: `${Date.now()}-${socket.id}`,
                strokes: []
            };

            room.game.drawingHistory.push(room.game.currentStroke);
        }

        if (!room.game.currentStroke) {
            room.game.currentStroke = {
                id: `${Date.now()}-${socket.id}`,
                strokes: []
            };

            room.game.drawingHistory.push(room.game.currentStroke);
        }

        room.game.currentStroke.strokes.push(safeStroke);

        socket.to(roomCode).emit("draw-stroke", safeStroke);
    });



    socket.on("clear-canvas", () => {
        const roomCode = socket.data.roomCode;
        const room = rooms.get(roomCode);

        if (
            !room?.game ||
            room.game.status !== "drawing" ||
            room.game.drawerId !== socket.id
        ) {
            return;
        }

        room.game.drawingHistory = [];
        room.game.currentStroke = null;

        io.to(roomCode).emit("clear-canvas");
    });

    socket.on("undo-drawing", () => {
        const roomCode = socket.data.roomCode;
        const room = rooms.get(roomCode);

        // Only the active drawer can undo during a drawing round.
        if (
            !room?.game ||
            room.game.status !== "drawing" ||
            room.game.drawerId !== socket.id
        ) {
            return;
        }

        const history = room.game.drawingHistory;

        if (!history || history.length === 0) {
            return;
        }

        // Remove the most recent complete drawing action.
        history.pop();

        // Start a fresh action after undoing.
        room.game.currentStroke = null;

        // Send the remaining drawing history to every player.
        io.to(roomCode).emit("canvas-history-updated", history);
    });




    socket.on("chat-message", (message) => {
        const roomCode = socket.data.roomCode;
        const room = rooms.get(roomCode);

        if (!room || typeof message !== "string") return;

        const text = message.trim().slice(0, 200);
        if (!text) return;

        const player = room.players.find(
            (item) => item.id === socket.id
        );

        if (!player) return;

        const game = room.game;

        if (game?.status === "drawing" && game.word) {
            const normalize = (value) => value.trim().toLowerCase();

            if (normalize(text) === normalize(game.word)) {
                // Never broadcast the secret word as ordinary chat.
                if (socket.id === game.drawerId) {
                    socket.emit("game-message", "You are the drawer!");
                    return;
                }

                game.correctGuessers ??= [];

                if (game.correctGuessers.includes(socket.id)) {
                    socket.emit(
                        "game-message",
                        "You have already guessed correctly!"
                    );
                    return;
                }

                game.correctGuessers.push(socket.id);
                player.score = (player.score || 0) + 10;

                const drawer = room.players.find(
                    (item) => item.id === game.drawerId
                );

                if (drawer) {
                    drawer.score = (drawer.score || 0) + 5;
                }

                sendRoomState(room);

                io.to(roomCode).emit("chat-message", {
                    id: `${Date.now()}-${socket.id}`,
                    name: "Game",
                    text: `${player.name} guessed correctly! +10 points`,
                });

                io.to(roomCode).emit(
                    "game-message",
                    `${player.name} guessed correctly!`
                );

                return;
            }
        }

        // Ordinary messages and incorrect guesses.
        io.to(roomCode).emit("chat-message", {
            id: `${Date.now()}-${socket.id}`,
            name: player.name,
            text,
        });
    });




});

function generateWordHint(word, revealedCount = 0) {
    if (!word) return "";

    return word
        .split("")
        .map((letter, index) => {
            if (letter === " ") return " ";
            if (index < revealedCount) return letter;
            return "_";
        })
        .join(" ");
}


function beginDrawing(room, word) {
    if (!room.game) return;

    clearTimeout(room.game.choiceTimeout);
    clearTimeout(room.game.roundTimeout);

    // Reset drawing history for the new round.
    room.game.drawingHistory = [];
    room.game.currentStroke = null;

    // Clear the canvas for all players.
    io.to(room.code).emit("clear-canvas");

    room.game.word = word;
    room.game.correctGuessers = [];
    room.game.status = "drawing";
    room.game.hintRevealedCount = 0;
    room.game.hintTimeout = null;
    room.game.hint = generateWordHint(word, 0);
    room.game.choiceTimeout = null;

    const durationMs = room.game.roundDuration * 1000;
    room.game.roundEndsAt = Date.now() + durationMs;

    const drawerId = room.game.drawerId;

    io.to(drawerId).emit("your-word", word);

    io.to(room.code).emit("round-started", {
        drawerId,
        round: room.game.round,
        wordLength: word.length,
        duration: room.game.roundDuration,
        endsAt: room.game.roundEndsAt
    });

    sendRoomState(room);
    io.to(room.code).emit("word-hint", {
        hint: room.game.hint,
        wordLength: word.length
    });

    room.game.hintTimeout = setInterval(() => {
        const currentRoom = rooms.get(room.code);

        if (
            !currentRoom?.game ||
            currentRoom.game.status !== "drawing"
        ) {
            return;
        }

        const game = currentRoom.game;
        const currentWord = game.word;

        if (game.hintRevealedCount >= currentWord.length - 1) {
            return;
        }

        game.hintRevealedCount += 1;
        game.hint = generateWordHint(
            currentWord,
            game.hintRevealedCount
        );

        io.to(currentRoom.code).emit("word-hint", {
            hint: game.hint,
            wordLength: currentWord.length
        });
    }, 15000);

    room.game.roundTimeout = setTimeout(() => {
        const currentRoom = rooms.get(room.code);

        if (
            currentRoom?.game &&
            currentRoom.game.status === "drawing"
        ) {
            finishRound(currentRoom);
        }
    }, durationMs);

    console.log(
        `Room ${room.code}: round ${room.game.round} started.`
    );
}


app.get("/", (req, res) => {
    res.json({
        message: "Skribbl API is running"
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
