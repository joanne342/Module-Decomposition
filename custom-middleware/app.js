
import express from "express";
import usernameMiddleware from "./middleware/usernameMiddleware.js";
import jsonArrayMiddleware from "./middleware/jsonArrayMiddleware.js";

const app = express();
const port = process.env.PORT || 3000;

app.post(
  "/",
  usernameMiddleware,
  jsonArrayMiddleware,
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
  }
);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
