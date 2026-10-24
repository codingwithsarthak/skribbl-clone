
import "../App.css";

function WordSelection({ choices, onChooseWord }) {
  if (!choices || choices.length === 0) {
    return null;
  }

  return (
    <div className="word-options">
      <h3>Select a word to draw</h3>

      <div className="word-buttons">
        {choices.map((word) => (
          <button
            key={word}
            type="button"
            onClick={() => onChooseWord(word)}
          >
            {word}
          </button>
        ))}
      </div>
    </div>
  );
}

export default WordSelection;
