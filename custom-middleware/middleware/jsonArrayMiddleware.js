
export default function jsonArrayMiddleware(req, res, next) {
  const chunks = [];

  req.on("data", (chunk) => {
    chunks.push(chunk);
  });

  req.on("error", (error) => {
    if (!res.headersSent) {
      res.status(400).send("Error reading request body.");
    }
  });

  req.on("end", () => {
    let parsedBody;

    try {
      const rawBody = Buffer.concat(chunks).toString("utf8");
      parsedBody = JSON.parse(rawBody);
    } catch {
      return res.status(400).send("Body must contain valid JSON.");
    }

    if (!Array.isArray(parsedBody)) {
      return res.status(400).send("Body must be a JSON array.");
    }

    if (!parsedBody.every((item) => typeof item === "string")) {
      return res
        .status(400)
        .send("All array elements must be strings.");
    }

    req.body = parsedBody;
    next();
  });
}
