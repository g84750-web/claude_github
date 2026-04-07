# API Documentation

## Overview

This API follows REST conventions. All endpoints use JSON for request and response bodies.

## Base URL

```
https://api.example.com/v1
```

## Authentication

All API requests require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <your_api_token>
```

## Common Response Codes

| Code | Description |
|------|-------------|
| `200` | OK - Request succeeded |
| `201` | Created - Resource created successfully |
| `204` | No Content - Request succeeded, no body returned |
| `400` | Bad Request - Invalid request body or parameters |
| `401` | Unauthorized - Missing or invalid authentication |
| `403` | Forbidden - Insufficient permissions |
| `404` | Not Found - Resource does not exist |
| `409` | Conflict - Resource already exists |
| `422` | Unprocessable Entity - Validation error |
| `500` | Internal Server Error |

## Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request body is invalid.",
    "details": [
      {
        "field": "name",
        "message": "name is required"
      }
    ]
  }
}
```

## Pagination

List endpoints support cursor-based pagination via query parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer | Number of items per page (default: `20`, max: `100`) |
| `cursor` | string | Cursor from previous response to fetch next page |

Paginated responses include a `pagination` object:

```json
{
  "data": [...],
  "pagination": {
    "total": 100,
    "limit": 20,
    "next_cursor": "eyJpZCI6IjEyMyJ9",
    "has_more": true
  }
}
```

## Available Resources

- [Templates](./templates.md) - Manage reusable content templates
