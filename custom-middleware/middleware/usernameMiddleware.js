
export default function usernameMiddleware(req, res, next) {
  const username = req.get("X-Username");

  req.username = username || null;

  next();
}
