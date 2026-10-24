
import "../App.css";

export const AVATARS = [
  { id: "fox", emoji: "🦊", name: "Fox", color: "#FFE4D6" },
  { id: "panda", emoji: "🐼", name: "Panda", color: "#E5E7EB" },
  { id: "cat", emoji: "🐱", name: "Cat", color: "#FCE7F3" },
  { id: "rabbit", emoji: "🐰", name: "Rabbit", color: "#F3E8FF" },
  { id: "bear", emoji: "🐻", name: "Bear", color: "#FDE68A" },
  { id: "frog", emoji: "🐸", name: "Frog", color: "#D1FAE5" },
  { id: "tiger", emoji: "🐯", name: "Tiger", color: "#FED7AA" },
  { id: "koala", emoji: "🐨", name: "Koala", color: "#DBEAFE" },
];

function AvatarPicker({ selectedAvatar, onSelect }) {
  return (
    <div className="avatar-picker">
      <div className="avatar-picker-heading">
        <strong>Choose your avatar</strong>
        <span>Pick your game character!</span>
      </div>

      <div className="avatar-grid">
        {AVATARS.map((avatar) => (
          <button
            key={avatar.id}
            type="button"
            className={`avatar-option ${
              selectedAvatar === avatar.id ? "selected" : ""
            }`}
            onClick={() => onSelect(avatar.id)}
            aria-label={`Choose ${avatar.name} avatar`}
            aria-pressed={selectedAvatar === avatar.id}
            title={avatar.name}
          >
            <span
              className="avatar-picture"
              style={{ backgroundColor: avatar.color }}
            >
              {avatar.emoji}
            </span>
            <span className="avatar-name">{avatar.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default AvatarPicker;
