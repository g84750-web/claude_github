# Templates API

Templates are reusable content structures that can contain variables for dynamic rendering.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/templates` | List all templates |
| `GET` | `/v1/templates/:id` | Get a template |
| `POST` | `/v1/templates` | Create a template |
| `PUT` | `/v1/templates/:id` | Update a template |
| `DELETE` | `/v1/templates/:id` | Delete a template |
| `POST` | `/v1/templates/:id/render` | Render a template with variables |
| `GET` | `/v1/templates/:id/preview` | Preview a template |

---

## Template Object

```json
{
  "id": "tmpl_01H9XKZJ3F4Y5N6M7P8Q",
  "name": "Welcome Email",
  "description": "Sent to new users upon registration",
  "content": "Hello, {{name}}! Welcome to {{product_name}}.",
  "variables": [
    {
      "key": "name",
      "type": "string",
      "required": true,
      "description": "Recipient's name"
    },
    {
      "key": "product_name",
      "type": "string",
      "required": true,
      "default": "Our Platform"
    }
  ],
  "tags": ["email", "onboarding"],
  "status": "active",
  "created_at": "2026-01-15T09:00:00Z",
  "updated_at": "2026-02-20T14:30:00Z"
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique template identifier |
| `name` | string | Human-readable name |
| `description` | string | Optional description |
| `content` | string | Template content with `{{variable}}` placeholders |
| `variables` | array | Variable definitions used in the template |
| `variables[].key` | string | Variable name (matches placeholder in content) |
| `variables[].type` | string | Data type: `string`, `number`, `boolean`, `date` |
| `variables[].required` | boolean | Whether this variable must be provided at render time |
| `variables[].default` | any | Default value if variable is not provided |
| `variables[].description` | string | Optional description of the variable |
| `tags` | array | List of string tags for categorization |
| `status` | string | `active` or `archived` |
| `created_at` | string | ISO 8601 creation timestamp |
| `updated_at` | string | ISO 8601 last update timestamp |

---

## List Templates

```
GET /v1/templates
```

Returns a paginated list of templates.

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer | Items per page (default: `20`, max: `100`) |
| `cursor` | string | Pagination cursor |
| `status` | string | Filter by status: `active`, `archived` |
| `tags` | string | Comma-separated list of tags to filter by |
| `q` | string | Search query (matches name and description) |

### Example Request

```bash
curl -X GET "https://api.example.com/v1/templates?status=active&tags=email&limit=10" \
  -H "Authorization: Bearer <token>"
```

### Example Response

```json
{
  "data": [
    {
      "id": "tmpl_01H9XKZJ3F4Y5N6M7P8Q",
      "name": "Welcome Email",
      "description": "Sent to new users upon registration",
      "tags": ["email", "onboarding"],
      "status": "active",
      "created_at": "2026-01-15T09:00:00Z",
      "updated_at": "2026-02-20T14:30:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 10,
    "next_cursor": "eyJpZCI6InRtcGxfMDFIOVhLWkoifQ==",
    "has_more": true
  }
}
```

---

## Get Template

```
GET /v1/templates/:id
```

Returns a single template including full content and variable definitions.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Template ID |

### Example Request

```bash
curl -X GET "https://api.example.com/v1/templates/tmpl_01H9XKZJ3F4Y5N6M7P8Q" \
  -H "Authorization: Bearer <token>"
```

### Example Response

```json
{
  "id": "tmpl_01H9XKZJ3F4Y5N6M7P8Q",
  "name": "Welcome Email",
  "description": "Sent to new users upon registration",
  "content": "Hello, {{name}}! Welcome to {{product_name}}.",
  "variables": [
    {
      "key": "name",
      "type": "string",
      "required": true,
      "description": "Recipient's name"
    },
    {
      "key": "product_name",
      "type": "string",
      "required": true,
      "default": "Our Platform"
    }
  ],
  "tags": ["email", "onboarding"],
  "status": "active",
  "created_at": "2026-01-15T09:00:00Z",
  "updated_at": "2026-02-20T14:30:00Z"
}
```

### Error Responses

| Code | Description |
|------|-------------|
| `404` | Template not found |

---

## Create Template

```
POST /v1/templates
```

Creates a new template.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Template name (max 255 characters) |
| `content` | string | Yes | Template content with `{{variable}}` placeholders |
| `description` | string | No | Optional description (max 1000 characters) |
| `variables` | array | No | Variable definitions. If omitted, variables are auto-detected from content |
| `tags` | array | No | List of tag strings |

### Example Request

```bash
curl -X POST "https://api.example.com/v1/templates" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Password Reset",
    "description": "Email sent when a user requests a password reset",
    "content": "Hi {{name}},\n\nClick the link below to reset your password:\n{{reset_link}}\n\nThis link expires in {{expiry_hours}} hours.",
    "variables": [
      {
        "key": "name",
        "type": "string",
        "required": true
      },
      {
        "key": "reset_link",
        "type": "string",
        "required": true,
        "description": "Password reset URL"
      },
      {
        "key": "expiry_hours",
        "type": "number",
        "required": false,
        "default": 24
      }
    ],
    "tags": ["email", "auth"]
  }'
```

### Example Response

```json
{
  "id": "tmpl_02J0YLAK4G5Z6O7N8R9S",
  "name": "Password Reset",
  "description": "Email sent when a user requests a password reset",
  "content": "Hi {{name}},\n\nClick the link below to reset your password:\n{{reset_link}}\n\nThis link expires in {{expiry_hours}} hours.",
  "variables": [
    {
      "key": "name",
      "type": "string",
      "required": true
    },
    {
      "key": "reset_link",
      "type": "string",
      "required": true,
      "description": "Password reset URL"
    },
    {
      "key": "expiry_hours",
      "type": "number",
      "required": false,
      "default": 24
    }
  ],
  "tags": ["email", "auth"],
  "status": "active",
  "created_at": "2026-04-07T10:00:00Z",
  "updated_at": "2026-04-07T10:00:00Z"
}
```

### Error Responses

| Code | Description |
|------|-------------|
| `400` | Invalid request body |
| `409` | A template with the same name already exists |
| `422` | Variable key referenced in content is not defined, or vice versa |

---

## Update Template

```
PUT /v1/templates/:id
```

Replaces an existing template. All fields are overwritten with the provided values.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Template ID |

### Request Body

Same fields as [Create Template](#create-template). All fields are optional; only provided fields are updated.

### Example Request

```bash
curl -X PUT "https://api.example.com/v1/templates/tmpl_02J0YLAK4G5Z6O7N8R9S" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Password Reset",
    "content": "Hi {{name}},\n\nReset your password here: {{reset_link}}\n\nExpires in {{expiry_hours}} hours.",
    "tags": ["email", "auth", "security"]
  }'
```

### Example Response

Returns the updated [Template Object](#template-object).

### Error Responses

| Code | Description |
|------|-------------|
| `400` | Invalid request body |
| `404` | Template not found |
| `422` | Validation error |

---

## Delete Template

```
DELETE /v1/templates/:id
```

Permanently deletes a template. This action cannot be undone.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Template ID |

### Example Request

```bash
curl -X DELETE "https://api.example.com/v1/templates/tmpl_02J0YLAK4G5Z6O7N8R9S" \
  -H "Authorization: Bearer <token>"
```

### Example Response

```
HTTP/1.1 204 No Content
```

### Error Responses

| Code | Description |
|------|-------------|
| `404` | Template not found |

---

## Render Template

```
POST /v1/templates/:id/render
```

Renders a template by substituting the provided variable values into the template content.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Template ID |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `variables` | object | Yes | Key-value pairs matching the template's variable keys |

### Example Request

```bash
curl -X POST "https://api.example.com/v1/templates/tmpl_01H9XKZJ3F4Y5N6M7P8Q/render" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "variables": {
      "name": "Jane Doe",
      "product_name": "Acme App"
    }
  }'
```

### Example Response

```json
{
  "template_id": "tmpl_01H9XKZJ3F4Y5N6M7P8Q",
  "rendered": "Hello, Jane Doe! Welcome to Acme App.",
  "rendered_at": "2026-04-07T10:05:00Z"
}
```

### Error Responses

| Code | Description |
|------|-------------|
| `400` | Invalid request body |
| `404` | Template not found |
| `422` | A required variable is missing or a variable value fails type validation |

---

## Preview Template

```
GET /v1/templates/:id/preview
```

Returns the template with placeholder variable names shown inline, useful for displaying templates in a UI without rendering them.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Template ID |

### Example Request

```bash
curl -X GET "https://api.example.com/v1/templates/tmpl_01H9XKZJ3F4Y5N6M7P8Q/preview" \
  -H "Authorization: Bearer <token>"
```

### Example Response

```json
{
  "template_id": "tmpl_01H9XKZJ3F4Y5N6M7P8Q",
  "name": "Welcome Email",
  "preview": "Hello, [name]! Welcome to [product_name].",
  "variables": [
    {
      "key": "name",
      "type": "string",
      "required": true
    },
    {
      "key": "product_name",
      "type": "string",
      "required": true,
      "default": "Our Platform"
    }
  ]
}
```

### Error Responses

| Code | Description |
|------|-------------|
| `404` | Template not found |
