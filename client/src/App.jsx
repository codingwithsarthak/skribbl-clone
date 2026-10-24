
import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import "./App.css";
import AvatarPicker, { AVATARS } from "./components/AvatarPicker";

import GameHeader from "./components/GameHeader";
import WordSelection from "./components/WordSelection";
import DrawingCanvas from "./components/DrawingCanvas";
import Chat from "./components/Chat";


function playSound(type) {
  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    const audio = new AudioContextClass();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    const sounds = {
      correct: [880, 1175],
      round: [523, 659],
      warning: [740],
      finished: [523, 659, 784, 1047],
    };

    const notes = sounds[type];
    if (!notes) {
      audio.close();
      return;
    }

    const now = audio.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(notes[0], now);

    notes.forEach((frequency, index) => {
      oscillator.frequency.setValueAtTime(
        frequency,
        now + index * 0.14
      );
    });

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gain.gain.setValueAtTime(
      0.15,
      now + notes.length * 0.14
    );
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      now + notes.length * 0.14 + 0.12
    );

    oscillator.connect(gain);
    gain.connect(audio.destination);

    oscillator.start(now);
    oscillator.stop(now + notes.length * 0.14 + 0.13);

    oscillator.onended = () => audio.close();
  } catch (error) {
    console.warn("Could not play sound:", error);
  }
}


const socket = io(
  import.meta.env.VITE_SERVER_URL || "http://localhost:5000",
  { autoConnect: false }
);
function getAvatarDetails(avatarId) {
  return AVATARS.find((avatar) => avatar.id === avatarId) || AVATARS[0];
}

function App() {
  const [connected, setConnected] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [choices, setChoices] = useState([]);
  const [myWord, setMyWord] = useState("");
  const [gameMessage, setGameMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const previousRoomRef = useRef(null);

  const [roundDuration, setRoundDuration] = useState(60);
  const [selectedAvatar, setSelectedAvatar] = useState("fox");

  useEffect(() => {
    const onConnect = () => setConnected(true);

    const onDisconnect = () => {
      setConnected(false);
      setRoom(null);
      setChoices([]);
      setMyWord("");
      setGameMessage("");
    };


    const onRoomUpdated = (updatedRoom) => {
      const previousRoom = previousRoomRef.current;
      const previousGame = previousRoom?.game;
      const currentGame = updatedRoom?.game;

      if (currentGame) {
        // A new drawing round has started.
        if (
          currentGame.status === "drawing" &&
          previousGame?.status !== "drawing"
        ) {
          playSound("round");
        }

        // Someone guessed correctly.
        const oldGuessers = previousGame?.correctGuessers || [];
        const newGuessers = currentGame.correctGuessers || [];

        if (
          newGuessers.some((id) => !oldGuessers.includes(id))
        ) {
          playSound("correct");
        }

        // The game has finished.
        if (
          currentGame.status === "finished" &&
          previousGame?.status !== "finished"
        ) {
          playSound("finished");
        }
      }

      previousRoomRef.current = updatedRoom;
      setRoom(updatedRoom);
    };


    const onWordChoices = (words) => {
      setChoices(words);
      setMyWord("");
      setError("");
    };

    const onYourWord = (word) => {
      setMyWord(word);
      setChoices([]);
    };

    const onRoundStarted = (data) => {
      setChoices([]);
      setGameMessage(
        `Round ${data.round}: ${data.wordLength} letters.`
      );
    };

    const onGameMessage = (message) => {
      setGameMessage(message);
    };
    const onChatMessage = (message) => {
      setMessages((previous) => [...previous, message]);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room-updated", onRoomUpdated);
    socket.on("word-choices", onWordChoices);
    socket.on("your-word", onYourWord);
    socket.on("round-started", onRoundStarted);
    socket.on("game-message", onGameMessage);
    socket.on("chat-message", onChatMessage);

    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room-updated", onRoomUpdated);
      socket.off("word-choices", onWordChoices);
      socket.off("your-word", onYourWord);
      socket.off("round-started", onRoundStarted);
      socket.off("game-message", onGameMessage);
      socket.off("chat-message", onChatMessage);
      socket.disconnect();
    };
  }, []);
  useEffect(() => {
    const game = room?.game;

    if (
      game?.status !== "drawing" ||
      !game.roundEndsAt
    ) {
      return;
    }

    const warningDelay = game.roundEndsAt - Date.now() - 10000;

    const timeout = setTimeout(() => {
      playSound("warning");
    }, Math.max(0, warningDelay));

    return () => clearTimeout(timeout);
  }, [room?.game?.status, room?.game?.roundEndsAt]);

  function createRoom(event) {
    event?.preventDefault();
    setError("");

    socket.emit(
      "create-room",
      { name, avatar: selectedAvatar },
      (result) => {
        if (result?.error) {
          setError(result.error);
          return;
        }

        setRoom(result.room);
      });
  }

  function joinRoom(event) {
    event?.preventDefault();
    setError("");

    socket.emit(
      "join-room",
      { name, code, avatar: selectedAvatar },
      (result) => {
        if (result?.error) {
          setError(result.error);
          return;
        }

        setRoom(result.room);
      });
  }


  function startGame() {
    setError("");
    setGameMessage("");

    socket.emit("start-game", { roundDuration }, (result) => {
      if (result?.error) {
        setError(result.error);
      }
    });
  }


  function chooseWord(word) {
    setError("");

    socket.emit("choose-word", word, (result) => {
      if (result?.error) {
        setError(result.error);
        return;
      }

      setChoices([]);
    });
  }

  function leaveRoom() {
    socket.emit("leave-room");
    setRoom(null);
    setChoices([]);
    setMyWord("");
    setGameMessage("");
    setError("");
    setMessages([]);
  }

  if (room?.game) {
    const game = room.game;
    const isHost = room.hostId === socket.id;
    const drawer = room.players.find(
      (player) => player.id === game.drawerId
    );

    const canDraw =
      game.status === "drawing" &&
      game.drawerId === socket.id &&
      Boolean(myWord);

    return (
      <main className="game-page">
        <header className="game-topbar">
          <div className="game-brand">
            <span>🎨</span>
            <h1>Skribbl</h1>
          </div>

          <div className="topbar-round">
            <span>ROUND</span>
            <strong>{game.round} / {game.maxRounds}</strong>
          </div>

          <div className="topbar-room">
            <span>ROOM CODE</span>
            <strong>{room.code}</strong>
          </div>

          <button
            className="exit-button"
            type="button"
            onClick={leaveRoom}
          >
            Leave Game
          </button>
        </header>

        <div className="game-layout">
          <aside className="game-sidebar">
            <section className="game-card">
              <h2>🏆 Players</h2>
              <p className="sidebar-subtitle">
                {room.players.length} players in this room
              </p>

              <ul className="game-player-list">
                {[...room.players]
                  .sort((a, b) => b.score - a.score)
                  .map((player, index) => (
                    <li
                      key={player.id}
                      className={[
                        player.id === game.drawerId ? "active-drawer" : "",
                        game.correctGuessers?.includes(player.id) ? "correct-guesser" : "",
                      ].filter(Boolean).join(" ")}
                    >
                      <span className="rank-number">
                        {index + 1}
                      </span>


                      <span
                        className="player-avatar"
                        style={{
                          backgroundColor: getAvatarDetails(player.avatar).color,
                        }}
                        title={getAvatarDetails(player.avatar).name}
                      >
                        {getAvatarDetails(player.avatar).emoji}
                      </span>


                      <div className="game-player-info">
                        <strong>
                          {player.name}
                          {player.id === socket.id && " (You)"}
                        </strong>
                        {player.id === game.drawerId && (
                          <small>✏️ Drawing</small>
                        )}
                      </div>

                      <strong className="game-score">
                        {player.score}
                      </strong>
                    </li>
                  ))}
              </ul>
            </section>

            <section className="game-card game-tips">
              <h3>How to play</h3>
              <p>🎨 Draw the secret word if you're the drawer.</p>
              <p>💬 Type your guess in the chat.</p>
              <p>⭐ Guess correctly to earn points.</p>
            </section>
          </aside>


          <section className="game-main">
            {game.status === "finished" ? (
              <div className="game-results">
                <div className="results-trophy">🏆</div>

                <span className="status-label">GAME COMPLETED</span>
                <h1>Game Over!</h1>
                <p>Great game! Here are the final results.</p>


                {room.players.length > 0 && (() => {
                  const sortedPlayers = [...room.players].sort(
                    (a, b) => b.score - a.score
                  );

                  const highestScore = sortedPlayers[0].score;

                  const winners = sortedPlayers.filter(
                    (player) => player.score === highestScore
                  );

                  return (
                    <div className="winner-card">
                      <span>
                        {winners.length > 1 ? "🤝 TIE GAME" : "👑 WINNER"}
                      </span>

                      <h2>
                        {winners.map((player) => player.name).join(" & ")}
                      </h2>

                      <strong>{highestScore} points</strong>
                    </div>
                  );
                })()}


                <div className="final-leaderboard">
                  <h3>🏆 Final Leaderboard</h3>

                  {[...room.players]
                    .sort((a, b) => b.score - a.score)
                    .map((player, index) => (
                      <div className="final-player" key={player.id}>
                        <span className="final-rank">
                          {index === 0
                            ? "🥇"
                            : index === 1
                              ? "🥈"
                              : index === 2
                                ? "🥉"
                                : index + 1}
                        </span>
                        <span
                          className="player-avatar"
                          style={{
                            backgroundColor: getAvatarDetails(player.avatar).color,
                          }}
                          title={getAvatarDetails(player.avatar).name}
                        >
                          {getAvatarDetails(player.avatar).emoji}
                        </span>

                        <span className="final-player-name">
                          {player.name}
                          {player.id === socket.id && " (You)"}
                        </span>

                        <strong>{player.score} pts</strong>
                      </div>
                    ))}
                </div>


                {isHost && (
                  <button
                    className="primary-button"
                    type="button"

                    onClick={() => {
                      socket.emit(
                        "play-again",
                        { roomCode: room.code },
                        (result) => {
                          if (result?.error) {
                            setError(result.error);
                          } else {
                            setError("");
                            setGameMessage("Starting a new game...");
                          }
                        }
                      );
                    }}

                  >
                    🔄 Play Again
                  </button>
                )}

                <button
                  className="secondary-button"
                  type="button"
                  onClick={leaveRoom}
                >
                  Back to Home
                </button>

              </div>
            ) : (
              <>


                <GameHeader
                  game={game}
                  drawerName={drawer?.name}
                  myWord={myWord}
                />

                {choices.length > 0 && (
                  <WordSelection
                    choices={choices}
                    onChooseWord={chooseWord}
                  />
                )}

                {game.status === "drawing" && (
                  <DrawingCanvas
                    socket={socket}
                    roomCode={room.code}
                    canDraw={canDraw}
                  />
                )}

                {gameMessage && (
                  <div className="game-notification">
                    ✨ {gameMessage}
                  </div>
                )}

                {error && <p className="error">{error}</p>}
              </>
            )}
          </section>


          <aside className="game-chat-sidebar">
            <Chat
              messages={messages}
              onSendMessage={(message) => {
                socket.emit("chat-message", message);
              }}
            />
          </aside>
        </div>
      </main>
    );
  }


  if (room) {
    const isHost = room.hostId === socket.id;
    const game = room.game;

    const drawer = room.players.find(
      (player) => player.id === game?.drawerId
    );

    const canDraw =
      game?.status === "drawing" &&
      game.drawerId === socket.id &&
      Boolean(myWord);

    return (
      <main className="page">
        <section className="panel lobby-panel">
          <div className="brand">
            <span className="brand-icon">🎨</span>
            <h1>Skribbl</h1>
          </div>

          {!game ? (
            <>
              <div className="room-code">
                <span>YOUR ROOM CODE</span>
                <h2>{room.code}</h2>

                <button
                  className="copy-button"
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(room.code);
                  }}
                >
                  Copy code
                </button>
              </div>

              <p className="subtitle">
                Invite your friends to play!
              </p>
            </>
          ) : (
            <>
              <GameHeader
                game={game}
                drawerName={drawer?.name}
                myWord={myWord}
              />

              {choices.length > 0 && (
                <WordSelection
                  choices={choices}
                  onChooseWord={chooseWord}
                />
              )}

              {game.status === "drawing" && (
                <DrawingCanvas
                  socket={socket}
                  roomCode={room.code}
                  canDraw={canDraw}
                />
              )}
            </>
          )}

          {gameMessage && (
            <p className="notice">{gameMessage}</p>
          )}


          {!game && isHost && (
            <>
              <div className="round-settings">
                <label htmlFor="round-duration">
                  Drawing time per round
                </label>

                <select
                  id="round-duration"
                  value={roundDuration}
                  onChange={(event) =>
                    setRoundDuration(Number(event.target.value))
                  }
                >
                  <option value={30}>30 seconds</option>
                  <option value={60}>60 seconds</option>
                  <option value={90}>90 seconds</option>
                  <option value={120}>120 seconds</option>
                </select>

                <p>
                  Total rounds: {room.players.length}
                </p>
              </div>

              <button
                className="primary-button"
                type="button"
                disabled={room.players.length < 2}
                onClick={startGame}
              >
                ▶ &nbsp; Start Game
              </button>
            </>
          )}


          {!game && room.players.length < 2 && (
            <p className="notice">
              Waiting for another player to join...
            </p>
          )}

          <div className="players-heading">
            <h3>Players</h3>
            <span>{room.players.length}/8</span>
          </div>

          <ul className="players">
            {room.players.map((player) => (
              <li key={player.id} className={
                game && player.id === game.drawerId
                  ? "active-drawer"
                  : game?.correctGuessers?.includes(player.id)
                    ? "correct-guesser"
                    : ""
              }>

                <span
                  className="player-avatar"
                  style={{
                    backgroundColor: getAvatarDetails(player.avatar).color,
                  }}
                  title={getAvatarDetails(player.avatar).name}
                >
                  {getAvatarDetails(player.avatar).emoji}
                </span>


                <span className="player-name">
                  {player.name}
                  {player.id === socket.id && " (You)"}
                </span>

                {player.id === room.hostId && (
                  <span className="host-badge">
                    👑 Host
                  </span>
                )}

                <span className="player-score">
                  {player.score} pts
                </span>
              </li>
            ))}
          </ul>

          {error && <p className="error">{error}</p>}
          <Chat
            messages={messages}
            disabled={game?.status === "finished"}
            onSendMessage={(message) => {
              socket.emit("chat-message", message);
            }}
          />

          <button
            className="secondary-button"
            type="button"
            onClick={leaveRoom}
          >
            Leave Room
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="decoration decoration-one">✎</div>
      <div className="decoration decoration-two">✧</div>
      <div className="decoration decoration-three">🎨</div>

      <section className="panel">
        <div className="brand">
          <span className="brand-icon">🎨</span>
          <h1>Skribbl</h1>
        </div>

        <p className="subtitle">
          Draw, guess, and have fun with your friends!
        </p>

        <div
          className={`server-status ${connected ? "online" : ""
            }`}
        >
          <span className="status-dot" />
          Server: {connected ? "Connected" : "Connecting..."}
        </div>
        <AvatarPicker
          selectedAvatar={selectedAvatar}
          onSelect={setSelectedAvatar}
        />

        <form onSubmit={createRoom}>
          <label htmlFor="player-name">Your name</label>

          <input
            id="player-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            required
          />


          <button
            className="primary-button"
            type="submit"
            disabled={!connected}
          >
            ✚ &nbsp; Create Room
          </button>
        </form>

        <div className="separator">
          <span />
          <strong>OR JOIN A ROOM</strong>
          <span />
        </div>

        <form onSubmit={joinRoom}>
          <label htmlFor="room-code" className="sr-only">
            Room code
          </label>

          <input
            id="room-code"
            value={code}
            onChange={(event) =>
              setCode(event.target.value.toUpperCase())
            }
            placeholder="Enter 6-character room code"
            maxLength={6}
            required
          />

          <button
            className="outline-button"
            type="submit"
            disabled={!connected}
          >
            ♧ &nbsp; Join Room
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        <p className="footer-note">
          ✨ Let your creativity flow!
        </p>
      </section>
    </main>
  );
}

export default App;
