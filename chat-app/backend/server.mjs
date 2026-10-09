
import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT || 8080);
const DATABASE_PATH = resolve(
  process.env.DATABASE_PATH || "./data/chat.sqlite"
);

const allowedOrigins = new Set([
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:5501",
  "http://127.0.0.1:5501",
  "http://localhost:5173",
  ...(process.env.FRONTEND_ORIGIN
    ? [process.env.FRONTEND_ORIGIN]
    : [])
]);

mkdirSync(dirname(DATABASE_PATH), { recursive: true });

const db = new Database(DATABASE_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    reply_to TEXT,
    FOREIGN KEY (reply_to) REFERENCES messages(id)
  );

  CREATE TABLE IF NOT EXISTS reactions (
    message_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
    PRIMARY KEY (message_id, client_id),
    FOREIGN KEY (message_id) REFERENCES messages(id)
      ON DELETE CASCADE
  );
`);

const app = express();

app.use(cors({
  origin(origin, callback) {
    // Allow non-browser tools with no Origin header.
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Origin not allowed"));
    }
  }
}));

app.use(express.json({ limit: "16kb" }));

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "chat-backend" });
});

app.get("/health", (_req, res) => {
  res.json({ status: "healthy" });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Chat server listening on ${PORT}`);
});

const wss = new WebSocketServer({
  noServer: true,
  maxPayload: 16 * 1024
});

server.on("upgrade", (request, socket, head) => {
  const origin = request.headers.origin;
  const pathname = new URL(
    request.url,
    `http://${request.headers.host}`
  ).pathname;

  if (
    pathname !== "/ws" ||
    !origin ||
    !allowedOrigins.has(origin)
  ) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

const insertMessage = db.prepare(`
  INSERT INTO messages (id, username, text, created_at, reply_to)
  VALUES (?, ?, ?, ?, ?)
`);

const selectMessage = db.prepare(`
  SELECT
    m.id,
    m.username,
    m.text,
    m.created_at AS createdAt,
    m.reply_to AS replyTo,
    (SELECT COUNT(*) FROM reactions r
      WHERE r.message_id = m.id AND r.reaction = 'like')
      AS likes,
    (SELECT COUNT(*) FROM reactions r
      WHERE r.message_id = m.id AND r.reaction = 'dislike')
      AS dislikes
  FROM messages m
  WHERE m.id = ?
`);

const selectHistory = db.prepare(`
  SELECT
    m.id,
    m.username,
    m.text,
    m.created_at AS createdAt,
    m.reply_to AS replyTo,
    (SELECT COUNT(*) FROM reactions r
      WHERE r.message_id = m.id AND r.reaction = 'like')
      AS likes,
    (SELECT COUNT(*) FROM reactions r
      WHERE r.message_id = m.id AND r.reaction = 'dislike')
      AS dislikes
  FROM messages m
  ORDER BY m.created_at ASC, m.rowid ASC
`);

const insertReaction = db.prepare(`
  INSERT INTO reactions (message_id, client_id, reaction)
  VALUES (?, ?, ?)
  ON CONFLICT(message_id, client_id)
  DO UPDATE SET reaction = excluded.reaction
`);

const messageExists = db.prepare(
  "SELECT 1 FROM messages WHERE id = ?"
);

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(data) {
  const payload = JSON.stringify(data);

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function sendError(ws, message) {
  send(ws, { type: "error", message });
}

function getMessage(id) {
  return selectMessage.get(id);
}

function handleNewMessage(ws, request) {
  if (
    typeof request.username !== "string" ||
    typeof request.text !== "string"
  ) {
    return sendError(ws, "Username and message are required.");
  }

  const username = request.username.trim();
  const text = request.text.trim();

  if (username.length < 2 || username.length > 30) {
    return sendError(ws, "Name must be 2–30 characters.");
  }

  if (text.length < 1 || text.length > 1000) {
    return sendError(ws, "Message must be 1–1000 characters.");
  }

  const replyTo = request.replyTo ?? null;

  if (
    replyTo !== null &&
    (typeof replyTo !== "string" || !messageExists.get(replyTo))
  ) {
    return sendError(ws, "The message you are replying to was not found.");
  }

  const message = {
    id: randomUUID(),
    username,
    text,
    createdAt: new Date().toISOString(),
    replyTo
  };

  insertMessage.run(
    message.id,
    message.username,
    message.text,
    message.createdAt,
    message.replyTo
  );

  const saved = getMessage(message.id);

  send(ws, { type: "message-sent", id: message.id });
  broadcast({ type: "message-added", message: saved });
}

function handleReaction(ws, request) {
  const { messageId, clientId, reaction } = request;

  if (
    typeof messageId !== "string" ||
    typeof clientId !== "string" ||
    !/^[a-zA-Z0-9-]{1,100}$/.test(clientId) ||
    !["like", "dislike"].includes(reaction)
  ) {
    return sendError(ws, "Invalid reaction.");
  }

  if (!messageExists.get(messageId)) {
    return sendError(ws, "Message not found.");
  }

  insertReaction.run(messageId, clientId, reaction);

  broadcast({
    type: "message-updated",
    message: getMessage(messageId)
  });
}

wss.on("connection", (ws) => {
  send(ws, {
    type: "message-history",
    messages: selectHistory.all()
  });

  ws.on("message", (buffer) => {
    try {
      const request = JSON.parse(buffer.toString());

      if (!request || typeof request !== "object" ||
          Array.isArray(request)) {
        return sendError(ws, "Invalid request.");
      }

      if (request.type === "send-message") {
        handleNewMessage(ws, request);
      } else if (request.type === "react") {
        handleReaction(ws, request);
      } else {
        sendError(ws, "Unknown request type.");
      }
    } catch (error) {
      console.error("Request processing failed:", error.message);
      sendError(ws, "Could not process that request.");
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error.message);
  });
});

function shutdown() {
  wss.clients.forEach((client) => client.close());
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
