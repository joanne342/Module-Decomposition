
const BACKEND_URL = "wss://YOUR-BACKEND-HOST/ws";

const connectionEl = document.querySelector("#connection");
const messagesEl = document.querySelector("#messages");
const emptyEl = document.querySelector("#empty-state");
const countEl = document.querySelector("#message-count");
const form = document.querySelector("#chat-form");
const usernameInput = document.querySelector("#username");
const messageInput = document.querySelector("#message");
const sendButton = document.querySelector("#send-button");
const feedbackEl = document.querySelector("#feedback");
const replyPreview = document.querySelector("#reply-preview");
const replySummary = document.querySelector("#reply-summary");
const cancelReplyButton = document.querySelector("#cancel-reply");

const messages = new Map();

const clientId = getClientId();
let socket;
let reconnectTimer;
let reconnectDelay = 1000;
let selectedReply = null;
let manuallyClosed = false;

function getClientId() {
  const key = "gather-chat-client-id";
  let id = localStorage.getItem(key);

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }

  return id;
}

function setFeedback(text) {
  feedbackEl.textContent = text;
}

function setConnected(connected) {
  connectionEl.textContent = connected
    ? "● Connected"
    : "● Disconnected";

  connectionEl.classList.toggle("online", connected);
  sendButton.disabled = !connected;
}

function connect() {
  clearTimeout(reconnectTimer);
  connectionEl.textContent = "Connecting…";

  socket = new WebSocket(BACKEND_URL);

  socket.addEventListener("open", () => {
    reconnectDelay = 1000;
    setConnected(true);
    setFeedback("");
  });

  socket.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);
      handleServerEvent(data);
    } catch {
      setFeedback("Received an invalid server response.");
    }
  });

  socket.addEventListener("error", () => {
    setFeedback("Connection problem. Trying to reconnect…");
  });

  socket.addEventListener("close", () => {
    setConnected(false);

    if (!manuallyClosed) {
      reconnectTimer = setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 15000);
    }
  });
}

function handleServerEvent(data) {
  if (data.type === "message-history") {
    messages.clear();

    for (const message of data.messages) {
      messages.set(message.id, message);
    }

    renderAll();
  } else if (data.type === "message-added") {
    if (!messages.has(data.message.id)) {
      messages.set(data.message.id, data.message);
      renderAll();
    }
  } else if (data.type === "message-updated") {
    if (messages.has(data.message.id)) {
      messages.set(data.message.id, data.message);
      updateMessage(data.message);
    }
  } else if (data.type === "message-sent") {
    setFeedback("Message sent.");
  } else if (data.type === "error") {
    setFeedback(data.message);
  }
}

function sortedMessages() {
  return [...messages.values()].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );
}

function renderAll() {
  messagesEl.replaceChildren();
  const allMessages = sortedMessages();

  emptyEl.hidden = allMessages.length > 0;
  messagesEl.appendChild(emptyEl);

  for (const message of allMessages) {
    messagesEl.appendChild(createMessageElement(message));
  }

  countEl.textContent =
    `${allMessages.length} message${allMessages.length === 1 ? "" : "s"}`;

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function createMessageElement(message) {
  const article = document.createElement("article");
  const mine = message.username === usernameInput.value.trim();

  article.className = `message-card${mine ? " mine" : ""}`;
  article.dataset.messageId = message.id;

  const header = document.createElement("div");
  header.className = "message-header";

  const name = document.createElement("strong");
  name.className = "message-author";
  name.textContent = message.username;

  const time = document.createElement("time");
  time.dateTime = message.createdAt;
  time.textContent = formatTime(message.createdAt);
  time.title = new Date(message.createdAt).toLocaleString();

  header.append(name, time);
  article.append(header);

  if (message.replyTo) {
    const original = messages.get(message.replyTo);
    const reply = document.createElement("div");
    reply.className = "quoted-message";
    reply.textContent = original
      ? `${original.username}: ${original.text}`
      : "Reply to an earlier message";
    article.append(reply);
  }

  const text = document.createElement("p");
  text.className = "message-text";
  text.textContent = message.text;
  article.append(text);

  const actions = document.createElement("div");
  actions.className = "message-actions";

  const replyButton = document.createElement("button");
  replyButton.type = "button";
  replyButton.className = "action-button";
  replyButton.dataset.action = "reply";
  replyButton.dataset.id = message.id;
  replyButton.textContent = "↩ Reply";

  const likeButton = document.createElement("button");
  likeButton.type = "button";
  likeButton.className = "action-button";
  likeButton.dataset.action = "like";
  likeButton.dataset.id = message.id;
  likeButton.textContent = `👍 ${message.likes}`;

  const dislikeButton = document.createElement("button");
  dislikeButton.type = "button";
  dislikeButton.className = "action-button";
  dislikeButton.dataset.action = "dislike";
  dislikeButton.dataset.id = message.id;
  dislikeButton.textContent = `👎 ${message.dislikes}`;

  actions.append(replyButton, likeButton, dislikeButton);
  article.append(actions);

  return article;
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function updateMessage(message) {
  const old = messagesEl.querySelector(
    `[data-message-id="${CSS.escape(message.id)}"]`
  );

  if (old) {
    const replacement = createMessageElement(message);
    old.replaceWith(replacement);
  }
}

function sendRequest(request) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    setFeedback("Not connected. Please wait and try again.");
    return false;
  }

  socket.send(JSON.stringify(request));
  return true;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const username = usernameInput.value.trim();
  const text = messageInput.value.trim();

  if (username.length < 2 || username.length > 30) {
    setFeedback("Your name must be 2–30 characters.");
    return;
  }

  if (!text || text.length > 1000) {
    setFeedback("Your message must be 1–1,000 characters.");
    return;
  }

  const sent = sendRequest({
    type: "send-message",
    username,
    text,
    replyTo: selectedReply
  });

  if (sent) {
    messageInput.value = "";
    clearReply();
    messageInput.focus();
  }
});

messagesEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const message = messages.get(button.dataset.id);
  if (!message) return;

  if (button.dataset.action === "reply") {
    selectedReply = message.id;
    replySummary.textContent =
      `${message.username}: ${message.text}`;
    replyPreview.hidden = false;
    messageInput.focus();
    return;
  }

  sendRequest({
    type: "react",
    messageId: message.id,
    clientId,
    reaction: button.dataset.action
  });
});

function clearReply() {
  selectedReply = null;
  replySummary.textContent = "";
  replyPreview.hidden = true;
}

cancelReplyButton.addEventListener("click", clearReply);

window.addEventListener("beforeunload", () => {
  manuallyClosed = true;
  clearTimeout(reconnectTimer);
  socket?.close();
});

connect();
