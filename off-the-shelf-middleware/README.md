curl -X POST --data '["Bees"]' \
  -H "Content-Type: application/json" \
  -H "X-Username: Ahmed" \
  http://localhost:3000

gives

You are authenticated as Ahmed.

You have requested information about 1 subject: Bees.

===

curl -X POST --data '["Bees"]' \
  -H "Content-Type: application/json" \
  http://localhost:3000

gives

You are not authenticated.

You have requested information about 1 subject: Bees.

===

curl -X POST --data '["Birds","Bats","Lizards","Bees"]' \
  -H "Content-Type: application/json" \
  -H "X-Username: Ahmed" \
  http://localhost:3000

gives

You are authenticated as Ahmed.

You have requested information about 4 subjects: Birds, Bats, Lizards, Bees.

===

curl -X POST --data '[]' \
  -H "Content-Type: application/json" \
  -H "X-Username: Gemma" \
  http://localhost:3000

gives

You are authenticated as Gemma.

You have requested information about 0 subjects.

===

curl -X POST --data '["Bees",123]' \
  -H "Content-Type: application/json" \
  -H "X-Username: Ahmed" \
  http://localhost:3000

gives

HTTP 400 Bad Request with the message "All array elements must be strings."

