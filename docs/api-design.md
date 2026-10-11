# QuickNotes REST API Design

## Overview

This document describes the proposed **real QuickNotes backend API**, not the JSONPlaceholder practice API used by the browser client. All endpoints use `/api/v1`, JSON request and response bodies, HTTPS, and bearer-token authentication where a user-specific resource is accessed.

A successful response uses the status shown in the endpoint table. Error responses use a consistent JSON shape. The server must verify ownership before returning, changing, or deleting a user's notes.

## REST endpoints

| Method | Path | Description | Success status |
|---|---|---|---:|
| `POST` | `/api/v1/auth/register` | Create a user account | `201 Created` |
| `POST` | `/api/v1/auth/login` | Authenticate and issue an access token | `200 OK` |
| `GET` | `/api/v1/notes` | List the authenticated user's notes; supports `?limit=20&cursor=...` | `200 OK` |
| `POST` | `/api/v1/notes` | Create a note owned by the authenticated user | `201 Created` |
| `GET` | `/api/v1/notes/{noteId}` | Retrieve one note owned by the user | `200 OK` |
| `PATCH` | `/api/v1/notes/{noteId}` | Update a note's title or body | `200 OK` |
| `DELETE` | `/api/v1/notes/{noteId}` | Delete a note owned by the user | `204 No Content` |
| `GET` | `/api/v1/tags` | List the user's tags | `200 OK` |
| `PUT` | `/api/v1/notes/{noteId}/tags/{tagId}` | Attach an existing tag to a note; idempotent | `204 No Content` |
| `DELETE` | `/api/v1/notes/{noteId}/tags/{tagId}` | Remove a tag from a note | `204 No Content` |

The list endpoint should return a bounded page rather than every note at once. It should validate `limit`, impose a maximum (for example 100), and use cursor pagination for large collections.

## Creating a note

### Request

`POST /api/v1/notes`

Headers:

```http
Authorization: Bearer <access-token>
Content-Type: application/json
```

Body:

```json
{
  "title": "Plan the project",
  "body": "Break the work into small tasks."
}
```

The title is required and must be 1–100 characters after trimming. The body is optional. The authenticated user's identity is derived from the token rather than trusting a `userId` supplied by the client.

### Success response

Status: `201 Created`

```json
{
  "data": {
    "id": 1042,
    "userId": 17,
    "title": "Plan the project",
    "body": "Break the work into small tasks.",
    "createdAt": "2026-10-11T10:15:30Z",
    "updatedAt": "2026-10-11T10:15:30Z"
  }
}
```

The response should include a `Location: /api/v1/notes/1042` header.

## Listing notes

### Request

`GET /api/v1/notes?limit=20`

Headers:

```http
Authorization: Bearer <access-token>
Accept: application/json
```

### Success response

Status: `200 OK`

```json
{
  "data": [
    {
      "id": 1042,
      "userId": 17,
      "title": "Plan the project",
      "body": "Break the work into small tasks.",
      "createdAt": "2026-10-11T10:15:30Z",
      "updatedAt": "2026-10-11T10:15:30Z"
    },
    {
      "id": 1039,
      "userId": 17,
      "title": "Read chapter three",
      "body": "",
      "createdAt": "2026-10-10T08:00:00Z",
      "updatedAt": "2026-10-10T08:00:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "nextCursor": "eyJpZCI6MTAzOX0="
  }
}
```

An empty collection returns `200 OK` with `"data": []` and a null `nextCursor`, not a `404`.

## Error status codes

| Status | Meaning | Typical situation |
|---:|---|---|
| `400 Bad Request` | Invalid request data or malformed JSON | Missing title or invalid pagination limit |
| `401 Unauthorized` | Missing, invalid, or expired authentication | No valid bearer token |
| `403 Forbidden` | Authenticated user is not permitted to perform the action | Attempt to access an administrative function |
| `404 Not Found` | Resource does not exist or is not visible to the caller | Unknown note ID |
| `409 Conflict` | Request conflicts with current state | Duplicate unique tag name |
| `422 Unprocessable Content` | Well-formed request fails a business validation rule | Title exceeds 100 characters |
| `429 Too Many Requests` | Rate limit exceeded | Too many requests in a short period |
| `500 Internal Server Error` | Unexpected server failure | Unhandled application or database error |

### Example error body

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The title is required and must be no longer than 100 characters.",
    "details": [
      {
        "field": "title",
        "issue": "required"
      }
    ],
    "requestId": "req_8f31c2"
  }
}
```

The API must not return stack traces, SQL statements, credentials, or other internal secrets to clients. A request ID allows operators to correlate the error with server-side logs.

## API conventions and security

- Require HTTPS and validate authentication on every private endpoint.
- Authorize access at the resource level; knowing a note ID must not grant access to another user's note.
- Validate and normalize input on the server, even if the browser also validates it.
- Use parameterized SQL queries to prevent SQL injection.
- Use pagination and reasonable request-size limits.
- Apply per-user and per-IP rate limits and return `429` when limits are exceeded.
- Use consistent timestamps in UTC and document pagination behavior.
- Log failures with request IDs while avoiding passwords, access tokens, and sensitive note contents.
