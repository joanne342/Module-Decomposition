## Example Requests and Responses

The API accepts a JSON array of subjects and an optional `X-Username` header for authentication.

### 1. Authenticated Request

**Request**

```bash
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -H "X-Username: Ahmed" \
  --data '["Bees"]'
```

**Response**

```text
You are authenticated as Ahmed.

You have requested information about 1 subject: Bees.
```

### 2. Unauthenticated Request

The `X-Username` header is optional.

**Request**

```bash
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  --data '["Bees"]'
```

**Response**

```text
You are not authenticated.

You have requested information about 1 subject: Bees.
```

### 3. Requesting Multiple Subjects

The API supports requesting multiple subjects in a single request.

**Request**

```bash
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -H "X-Username: Ahmed" \
  --data '["Birds","Bats","Lizards","Bees"]'
```

**Response**

```text
You are authenticated as Ahmed.

You have requested information about 4 subjects: Birds, Bats, Lizards, Bees.
```

### 4. Requesting Zero Subjects

An empty array is valid.

**Request**

```bash
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -H "X-Username: Gemma" \
  --data '[]'
```

**Response**

```text
You are authenticated as Gemma.

You have requested information about 0 subjects.
```

### 5. Invalid Request Body

All elements in the JSON array must be strings. Including a non-string value results in a `400 Bad Request` response.

**Request**

```bash
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -H "X-Username: Ahmed" \
  --data '["Bees",123]'
```

**Response**

```text
All array elements must be strings.
```
