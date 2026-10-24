
import { useState } from "react";
import "../App.css";

function Chat({ messages, onSendMessage, disabled = false }) {
    const [message, setMessage] = useState("");

    function handleSubmit(event) {
        event.preventDefault();

        const text = message.trim();
        if (!text) return;

        onSendMessage(text);
        setMessage("");
    }

    return (
        <section className="chat-panel">
            <h3>Chat & Guesses</h3>

            <div className="chat-messages">
                {messages.map((item, index) => (
                    <p key={item.id || index}>
                        <strong>{item.name}: </strong>
                        {item.text}
                    </p>
                ))}
            </div>

            <form className="chat-form" onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Type your guess..."
                    maxLength={200}
                    aria-label="Type your guess"
                    disabled={disabled}
                />

                <button
                    type="submit"
                    disabled={disabled || !message.trim()}
                >
                    Send
                </button>
            </form>
        </section>
    );
}

export default Chat;
