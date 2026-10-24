import { useEffect, useRef, useState } from "react";
import "../App.css";

function DrawingCanvas({ socket, roomCode, canDraw }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const isFirstSegmentRef = useRef(false);
  const historyRef = useRef([]);

  const [color, setColor] = useState("#222222");
  const [brushSize, setBrushSize] = useState(4);
  const [isErasing, setIsErasing] = useState(false);
  const [wordHint, setWordHint] = useState("");

  function clearCanvasLocally() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  useEffect(() => {
    clearCanvasLocally();
  }, []);

  function renderStroke(stroke) {
    const canvas = canvasRef.current;
    if (!canvas || !stroke) return;

    const context = canvas.getContext("2d");
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.size;
    context.lineCap = "round";
    context.lineJoin = "round";

    context.beginPath();
    context.moveTo(
      stroke.fromX * canvas.width,
      stroke.fromY * canvas.height
    );
    context.lineTo(
      stroke.toX * canvas.width,
      stroke.toY * canvas.height
    );
    context.stroke();
  }

  function redrawCanvas(history) {
    clearCanvasLocally();

    if (!Array.isArray(history)) return;

    history.forEach((action) => {
      if (!Array.isArray(action.strokes)) return;

      action.strokes.forEach((stroke) => {
        renderStroke(stroke);
      });
    });
  }

  useEffect(() => {
    if (!socket) return;

    function drawRemoteStroke(stroke) {
      renderStroke(stroke);
    }

    function clearRemoteCanvas() {
      historyRef.current = [];
      clearCanvasLocally();
    }

    function handleCanvasHistoryUpdated(history) {
      historyRef.current = Array.isArray(history) ? history : [];
      redrawCanvas(historyRef.current);
    }
    function handleWordHint(data) {
      setWordHint(data.hint);
    }

    socket.on("draw-stroke", drawRemoteStroke);
    socket.on("clear-canvas", clearRemoteCanvas);

    socket.on(
      "canvas-history-updated",
      handleCanvasHistoryUpdated
    );
    socket.on("word-hint", handleWordHint);

    return () => {
      socket.off("draw-stroke", drawRemoteStroke);
      socket.off("clear-canvas", clearRemoteCanvas);
      socket.off(
        "canvas-history-updated",
        handleCanvasHistoryUpdated
      );
      socket.off("word-hint", handleWordHint);
    };
  }, [socket]);

  function getPoint(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }

  function startDrawing(event) {
    if (!canDraw) return;

    event.preventDefault();

    drawingRef.current = true;
    isFirstSegmentRef.current = true;
    lastPointRef.current = getPoint(event);

    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function draw(event) {
    if (!canDraw || !drawingRef.current) return;

    event.preventDefault();

    const nextPoint = getPoint(event);
    const previousPoint = lastPointRef.current;

    if (!previousPoint) return;

    const stroke = {
      fromX: previousPoint.x,
      fromY: previousPoint.y,
      toX: nextPoint.x,
      toY: nextPoint.y,
      color: isErasing ? "#ffffff" : color,
      size: brushSize,
    };

    // Draw locally for an immediate response.
    renderStroke(stroke);

    // Send the stroke to the server.
    socket.emit("draw-stroke", {
      roomCode,
      ...stroke,
      action: isFirstSegmentRef.current ? "start" : "continue",
    });

    isFirstSegmentRef.current = false;
    lastPointRef.current = nextPoint;
  }

  function stopDrawing() {
    drawingRef.current = false;
    lastPointRef.current = null;
    isFirstSegmentRef.current = false;
  }

  function undoDrawing() {
    if (!canDraw || !socket) return;

    socket.emit("undo-drawing");
  }

  function clearCanvas() {
    if (!canDraw || !socket) return;

    socket.emit("clear-canvas", { roomCode });

    historyRef.current = [];
    clearCanvasLocally();
  }

  return (
    <section className="drawing-panel">
      
<div className="drawing-toolbar">
  <div className="toolbar-group toolbar-tools">
    <label className="color-control">
      <span>Color</span>
      <input
        type="color"
        value={color}
        disabled={!canDraw}
        onChange={(event) => {
          setColor(event.target.value);
          setIsErasing(false);
        }}
        title="Choose brush color"
      />
    </label>

    <label className="brush-control">
      <span>Size</span>
      <input
        type="range"
        min="2"
        max="18"
        value={brushSize}
        disabled={!canDraw}
        onChange={(event) =>
          setBrushSize(Number(event.target.value))
        }
        title={`Brush size: ${brushSize}`}
      />
      <span className="brush-value">{brushSize}</span>
    </label>
  </div>

  <div className="toolbar-group toolbar-actions">
    <button
      type="button"
      className="toolbar-button"
      disabled={!canDraw}
      onClick={undoDrawing}
      title="Undo last stroke"
    >
      ↶ Undo
    </button>

    <button
      type="button"
      className={`toolbar-button ${isErasing ? "tool-active" : ""}`}
      disabled={!canDraw}
      onClick={() => setIsErasing((previous) => !previous)}
      title="Switch between brush and eraser"
    >
      {isErasing ? "🖌️ Brush" : "🧽 Eraser"}
    </button>

    <button
      type="button"
      className="toolbar-button clear-button"
      disabled={!canDraw}
      onClick={clearCanvas}
      title="Clear the entire canvas"
    >
      Clear
    </button>
  </div>
</div>


      {!canDraw && (
        <p className="canvas-hint">
          Watch the drawer and guess the word!
        </p>
      )}
      <div className="word-hint">
        <span>Word hint:</span>
        <strong>{wordHint || "Waiting for hint..."}</strong>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={450}
        className={`drawing-canvas ${canDraw ? "draw-enabled" : ""
          }`}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        onPointerLeave={stopDrawing}
      />
    </section>
  );
}

export default DrawingCanvas;