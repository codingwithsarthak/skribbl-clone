
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
      setSecondsLeft(
        Math.max(
          0,
          Math.ceil((game.roundEndsAt - Date.now()) / 1000)
        )
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 250);

    return () => clearInterval(interval);
  }, [game?.status, game?.roundEndsAt]);

  if (!game) return null;

  const isDrawing = game.status === "drawing";
  const status =
    game.status === "choosing"
      ? "WORD SELECTION"
      : game.status === "round-ended"
        ? "ROUND FINISHED"
        : game.status === "finished"
          ? "GAME FINISHED"
          : `ROUND ${game.round} OF ${game.maxRounds}`;

  const description =
    game.status === "choosing"
      ? `${drawerName || "The drawer"} is choosing a word.`
      : game.status === "round-ended"
        ? "Get ready for the next round!"
        : game.status === "finished"
          ? "The game is over!"
          : `${drawerName || "The drawer"} is drawing.`;

  return (
    <section className="game-status compact-game-status">
      <div className="compact-status-row">
        <div className="compact-round-info">
          <span className="compact-status-label">{status}</span>
          <strong className="compact-drawer-name">
            {description}
          </strong>
        </div>

        {isDrawing && (
          <div className="round-timer compact-round-timer">
            ⏱ {secondsLeft}s
          </div>
        )}
      </div>

      {isDrawing && myWord && (
        <div className="secret-word compact-secret-word">
          <div className="compact-word-info">
            <span>YOUR SECRET WORD</span>
            <strong>{myWord}</strong>
          </div>
          <p>Draw so others can guess!</p>
        </div>
      )}

      {isDrawing && !myWord && (
        <div className="word-hint">
          Word: {"_ ".repeat(game.wordLength).trim()}
        </div>
      )}
    </section>
  );
}

export default GameHeader;
