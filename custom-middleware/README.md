curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -H "X-Username: Ahmed" \
  -d '["Birds","Bats","Lizards","Bees"]'

gives

You are authenticated as Ahmed.

You have requested information about 4 subjects: Birds, Bats, Lizards, Bees.
