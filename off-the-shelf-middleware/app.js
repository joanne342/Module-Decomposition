
import express from "express";
import usernameMiddleware from "./middleware/usernameMiddleware.js";

const app = express();
const port = process.env.PORT || 3000;

// Use Express's built-in JSON parser instead of our custom body parser.
app.use(express.json());

// Validate the parsed body, without parsing the raw request ourselves.
function validateJsonArray(req, res, next) {
  const subjects = req.body;

  if (!Array.isArray(subjects)) {
    return res
      .status(400)
      .type("text")
      .send(
        "Body must be a JSON array. " +
          "Check that Content-Type is application/json.",
      );
  }

  if (!subjects.every((item) => typeof item === "string")) {
    return res
      .status(400)
      .type("text")
      .send("All array elements must be strings.");
  }

  next();
}

app.post(
  "/",
  usernameMiddleware,
  validateJsonArray,
  (req, res) => {
    const { username, body: subjects } = req;
    const count = subjects.length;

    const authenticationMessage = username
      ? `You are authenticated as ${username}.`
      : "You are not authenticated.";

    let subjectsMessage;

    if (count === 0) {
      subjectsMessage =
        "You have requested information about 0 subjects.";
    } else if (count === 1) {
      subjectsMessage =
        `You have requested information about 1 subject: ${subjects[0]}.`;
    } else {
      subjectsMessage =
        `You have requested information about ${count} subjects: ${subjects.join(", ")}.`;
    }

    res
      .status(200)
      .type("text")
      .send(`${authenticationMessage}\n\n${subjectsMessage}`);
  },
);

// Return a readable error for malformed JSON.
// Express's JSON parser passes parsing errors to error-handling middleware.
app.use((err, req, res, next) => {
  if (err.status === 400 && err.type === "entity.parse.failed") {
    return res
      .status(400)
      .type("text")
      .send("Body must contain valid JSON.");
  }

  next(err);
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
