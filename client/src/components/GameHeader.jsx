
import { useEffect, useState } from "react";
import "../App.css";

function GameHeader({ game, drawerName, myWord }) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (game?.status !== "drawing" || !game?.roundEndsAt) {
      setSecondsLeft(0);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(
        0,
        Math.ceil((game.roundEndsAt - Date.now()) / 1000)
      );

      setSecondsLeft(remaining);
    };

    updateTimer();

    const interval = setInterval(updateTimer, 250);

    return () => clearInterval(interval);
  }, [game?.status, game?.roundEndsAt]);

  if (!game) return null;

  return (
    <div className="game-status">
      <span className="status-label">
        {game.status === "choosing"
          ? "WORD SELECTION"
          : game.status === "round-ended"
            ? "ROUND FINISHED"
            : game.status === "finished"
              ? "GAME FINISHED"
              : "ROUND IN PROGRESS"}
      </span>

      <h2>
        {game.status === "choosing"
          ? "Choose your word!"
          : `Round ${game.round} of ${game.maxRounds}`}
      </h2>

      <p>
        {game.status === "choosing"
          ? `${drawerName || "The drawer"} is choosing a word.`
          : game.status === "round-ended"
            ? "Get ready for the next round!"
            : game.status === "finished"
              ? "The game is over!"
              : `${drawerName || "The drawer"} is drawing.`}
      </p>

      {game.status === "drawing" && (
        <div className="round-timer">
          ⏱ Time left: <strong>{secondsLeft}s</strong>
        </div>
      )}

      {game.status === "drawing" && myWord && (
        <div className="secret-word">
          <span>YOUR SECRET WORD</span>
          <strong>{myWord}</strong>
          <p>Draw this word so others can guess it!</p>
        </div>
      )}

      {game.status === "drawing" && !myWord && (
        <div className="word-hint">
          Word: {"_ ".repeat(game.wordLength).trim()}
        </div>
      )}
    </div>
  );
}

export default GameHeader;
