# Tuscany Village Self Storage — API Documentation

## Base URL

```
http://localhost:3000/api
```

(development)

## Authentication

This API uses **NextAuth.js** with a **JWT session strategy** and the **Credentials** provider.

### How It Works

1. The client sends a `POST` to `/api/auth/callback/credentials` with `email` and `password` in the request body (form-encoded).
2. NextAuth verifies the credentials against the `Tenant` collection (bcrypt hash comparison).
3. On success, NextAuth sets an encrypted HTTP-only session cookie (`next-auth.session-token`).
4. The JWT payload includes `id` (MongoDB ObjectId string), `email`, `name`, and `role` (`"tenant"` | `"admin"`).
5. All subsequent requests automatically include the cookie. Server-side routes call `getServerSession(authOptions)` to read the session.

### Session Endpoint

```
GET /api/auth/session
```

Returns the current session object or `{}` if unauthenticated.

### Sign In

```
POST /api/auth/callback/credentials
Content-Type: application/x-www-form-urlencoded

email=user@example.com&password=secret123
```

### Sign Out

```
POST /api/auth/signout
```

### Roles

| Role | Description |
|---|---|
| `tenant` | Standard tenant. Can view/edit own profile, own leases, own payments. |
| `admin` | Full access. Can manage all tenants, units, leases, payments, and admin operations. |

### Middleware

The Next.js middleware protects these route patterns:

- `/portal/*` — requires any authenticated user
- `/admin/*` — requires `admin` role
- `/api/admin/*` — requires `admin` role

All other `/api/*` routes perform their own auth checks inline.

---

## Response Format

```json
// Success
{ "success": true, "data": "<T>" }

// Error
{ "success": false, "error": "Human-readable error message" }

// Paginated
{
  "success": true,
  "data": {
    "items": ["<T[]>"],
    "total": 142,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

All monetary amounts are stored and returned in **cents** (integer). For example, `15000` = $150.00.

---

## Endpoints

---

## 1. Auth (`/api/auth/*`)

NextAuth manages these routes automatically. They are listed here for reference.

### [GET] /api/auth/session

**Auth:** Public (returns empty object if unauthenticated)
**Description:** Returns the current user session.

**Response:**

```json
{
  "user": {
    "id": "664a1f...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "tenant"
  },
  "expires": "2026-05-07T00:00:00.000Z"
}
```

---

### [GET] /api/auth/providers

**Auth:** Public
**Description:** Lists available authentication providers.

**Response:**

```json
{
  "credentials": {
    "id": "credentials",
    "name": "credentials",
    "type": "credentials",
    "signinUrl": "/api/auth/signin/credentials",
    "callbackUrl": "/api/auth/callback/credentials"
  }
}
```

---

### [POST] /api/auth/callback/credentials

**Auth:** Public
**Description:** Authenticates a user with email and password. Sets the session cookie on success.

**Request Body:** (`application/x-www-form-urlencoded`)

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | Yes | Tenant email address |
| `password` | string | Yes | Tenant password |

**Response:** Redirects on success; returns error page on failure.

---

### [POST] /api/auth/signout

**Auth:** Required
**Description:** Clears the session cookie and signs the user out.

---

## 2. Tenants (`/api/tenants/*`)

---

### [GET] /api/tenants

**Auth:** Required (admin sees all; tenant sees only self)
**Description:** List tenants with optional filtering, search, and pagination.

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20) |
| `status` | string | No | Filter by status: `active`, `delinquent`, `locked_out`, `moved_out` |
| `search` | string | No | Case-insensitive search across `firstName`, `lastName`, `email`, `phone` |

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "_id": "664a1f...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "phone": "5551234567",
        "status": "active",
        "role": "tenant",
        "gateCode": "4821",
        "smsOptIn": true,
        "autopayEnabled": false,
        "createdAt": "2025-01-15T00:00:00.000Z",
        "updatedAt": "2025-06-01T00:00:00.000Z"
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 401 | Unauthorized — no valid session |
| 500 | Internal server error |

---

### [POST] /api/tenants

**Auth:** Admin only
**Description:** Create a new tenant account.

**Request Body:**

```json
{
  "firstName": "string (required, min 1)",
  "lastName": "string (required, min 1)",
  "email": "string (required, valid email)",
  "phone": "string (required, min 1)",
  "password": "string (required, min 6)",
  "alternatePhone": "string (optional)",
  "alternateEmail": "string (optional, valid email)",
  "address": "string (optional)",
  "city": "string (optional)",
  "state": "string (optional)",
  "zip": "string (optional)",
  "driversLicense": "string (optional)",
  "role": "\"tenant\" | \"admin\" (optional, default: tenant)",
  "smsOptIn": "boolean (optional)",
  "referralSource": "string (optional)"
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "_id": "664a1f...",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "5551234567",
    "role": "tenant",
    "status": "active",
    "createdAt": "2025-06-01T00:00:00.000Z"
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 400 | Validation error |
| 403 | Forbidden — not admin |
| 409 | Email already in use |
| 500 | Internal server error |

---

### [GET] /api/tenants/:id

**Auth:** Required (admin or own profile)
**Description:** Get a single tenant by ID.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | MongoDB ObjectId of the tenant |

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "664a1f...",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "5551234567",
    "status": "active",
    "role": "tenant",
    "gateCode": "4821",
    "smsOptIn": true,
    "autopayEnabled": false,
    "stripeCustomerId": "cus_...",
    "defaultPaymentMethodId": "pm_...",
    "createdAt": "2025-01-15T00:00:00.000Z",
    "updatedAt": "2025-06-01T00:00:00.000Z"
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 401 | Unauthorized |
| 403 | Forbidden — not admin and not own profile |
| 404 | Tenant not found |
| 500 | Internal server error |

---

### [PATCH] /api/tenants/:id

**Auth:** Required (admin or own profile; tenants cannot change `role`, `status`, `stripeCustomerId`, `defaultPaymentMethodId`)
**Description:** Update a tenant's profile.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | MongoDB ObjectId of the tenant |

**Request Body:** (all fields optional)

```json
{
  "firstName": "string (min 1)",
  "lastName": "string (min 1)",
  "email": "string (valid email)",
  "phone": "string (min 1)",
  "alternatePhone": "string",
  "alternateEmail": "string (valid email)",
  "address": "string",
  "city": "string",
  "state": "string",
  "zip": "string",
  "driversLicense": "string",
  "role": "\"tenant\" | \"admin\" (admin only)",
  "status": "\"active\" | \"delinquent\" | \"locked_out\" | \"moved_out\" (admin only)",
  "smsOptIn": "boolean",
  "autopayEnabled": "boolean",
  "stripeCustomerId": "string (admin only)",
  "defaultPaymentMethodId": "string (admin only)",
  "referralSource": "string"
}
```

**Response:**

```json
{
  "success": true,
  "data": { "...updated tenant object" }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 400 | Validation error |
| 401 | Unauthorized |
| 403 | Forbidden — not admin and not own profile |
| 404 | Tenant not found |
| 500 | Internal server error |

---

### [DELETE] /api/tenants/:id

**Auth:** Admin only
**Description:** Soft-delete a tenant by setting their status to `moved_out`. Does **not** remove the record.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | MongoDB ObjectId of the tenant |

**Response:**

```json
{
  "success": true,
  "data": { "...tenant object with status: \"moved_out\"" }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 403 | Forbidden — not admin |
| 404 | Tenant not found |
| 500 | Internal server error |

---

### [POST] /api/tenants/:id/gate-code

**Auth:** Required (admin or own profile)
**Description:** Regenerate the tenant's gate access code. Creates an `AccessLog` entry and logs an SMS notification in development mode.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | MongoDB ObjectId of the tenant |

**Request Body:** None

**Response:**

```json
{
  "success": true,
  "data": {
    "gateCode": "7293",
    "tenantId": "664a1f..."
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 401 | Unauthorized |
| 403 | Forbidden — not admin and not own profile |
| 404 | Tenant not found |
| 500 | Internal server error |

---

## 3. Units (`/api/units/*`)

---

### [GET] /api/units

**Auth:** Public (no authentication required)
**Description:** List units with optional filtering and pagination. Used for the public-facing unit availability view.

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20) |
| `status` | string | No | Filter: `available`, `occupied`, `maintenance`, `reserved` |
| `type` | string | No | Filter: `standard`, `climate_controlled`, `drive_up`, `vehicle_outdoor` |
| `size` | string | No | Filter by size string (e.g., `"10x10"`) |
| `minPrice` | number | No | Minimum price in cents |
| `maxPrice` | number | No | Maximum price in cents |

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "_id": "664b2a...",
        "unitNumber": "A101",
        "size": "10x10",
        "width": 10,
        "depth": 10,
        "sqft": 100,
        "type": "standard",
        "floor": "ground",
        "price": 15000,
        "status": "available",
        "features": ["interior", "electricity"],
        "notes": "",
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "total": 120,
    "page": 1,
    "limit": 20,
    "totalPages": 6
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 500 | Internal server error |

---

### [POST] /api/units

**Auth:** Admin only
**Description:** Create a new storage unit. Automatically calculates `sqft` from `width * depth`.

**Request Body:**

```json
{
  "unitNumber": "string (required, min 1)",
  "size": "string (required, min 1, e.g. \"10x10\")",
  "width": "number (required, positive)",
  "depth": "number (required, positive)",
  "type": "\"standard\" | \"climate_controlled\" | \"drive_up\" | \"vehicle_outdoor\" (required)",
  "floor": "\"ground\" | \"upper\" (required)",
  "price": "integer (required, positive, in cents)",
  "features": "string[] (optional)",
  "notes": "string (optional)"
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "_id": "664b2a...",
    "unitNumber": "A101",
    "size": "10x10",
    "width": 10,
    "depth": 10,
    "sqft": 100,
    "type": "standard",
    "floor": "ground",
    "price": 15000,
    "status": "available",
    "features": ["interior"],
    "createdAt": "2025-06-01T00:00:00.000Z"
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 400 | Validation error |
| 403 | Forbidden — not admin |
| 409 | Unit number already exists |
| 500 | Internal server error |

---

### [GET] /api/units/:id

**Auth:** Public
**Description:** Get a single unit by ID. Populates `currentTenantId` and `currentLeaseId` references.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | MongoDB ObjectId of the unit |

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "664b2a...",
    "unitNumber": "A101",
    "size": "10x10",
    "width": 10,
    "depth": 10,
    "sqft": 100,
    "type": "standard",
    "floor": "ground",
    "price": 15000,
    "status": "occupied",
    "features": ["interior"],
    "currentTenantId": { "_id": "664a1f...", "firstName": "John", "..." : "..." },
    "currentLeaseId": { "_id": "664c3b...", "monthlyRate": 15000, "..." : "..." }
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 404 | Unit not found |
| 500 | Internal server error |

---

### [PATCH] /api/units/:id

**Auth:** Admin only
**Description:** Update a unit. If `width` or `depth` is changed, `sqft` is automatically recalculated.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | MongoDB ObjectId of the unit |

**Request Body:** (all fields optional)

```json
{
  "unitNumber": "string (min 1)",
  "size": "string (min 1)",
  "width": "number (positive)",
  "depth": "number (positive)",
  "type": "\"standard\" | \"climate_controlled\" | \"drive_up\" | \"vehicle_outdoor\"",
  "floor": "\"ground\" | \"upper\"",
  "price": "integer (positive, in cents)",
  "status": "\"available\" | \"occupied\" | \"maintenance\" | \"reserved\"",
  "features": "string[]",
  "notes": "string"
}
```

**Response:**

```json
{
  "success": true,
  "data": { "...updated unit object" }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 400 | Validation error |
| 403 | Forbidden — not admin |
| 404 | Unit not found |
| 500 | Internal server error |

---

### [DELETE] /api/units/:id

**Auth:** Admin only
**Description:** Permanently delete a unit. Only units with `available` status can be deleted.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | MongoDB ObjectId of the unit |

**Response:**

```json
{
  "success": true,
  "data": { "deleted": true }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 400 | Can only delete units with available status |
| 403 | Forbidden — not admin |
| 404 | Unit not found |
| 500 | Internal server error |

---

## 4. Leases (`/api/leases/*`)

---

### [GET] /api/leases

**Auth:** Required (admin sees all; tenant sees only own leases)
**Description:** List leases with optional filtering and pagination.

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20) |
| `tenantId` | string | No | Filter by tenant ID (admin only) |
| `unitId` | string | No | Filter by unit ID |
| `status` | string | No | Filter: `active`, `ended`, `pending_moveout` |

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "_id": "664c3b...",
        "tenantId": "664a1f...",
        "unitId": "664b2a...",
        "startDate": "2025-01-15T00:00:00.000Z",
        "endDate": null,
        "moveOutDate": null,
        "monthlyRate": 15000,
        "deposit": 0,
        "proratedFirstMonth": 7258,
        "billingDay": 15,
        "status": "active",
        "signedAt": "2025-01-15T12:00:00.000Z",
        "leaseDocumentUrl": "/documents/leases/664c3b....pdf",
        "createdAt": "2025-01-15T00:00:00.000Z"
      }
    ],
    "total": 38,
    "page": 1,
    "limit": 20,
    "totalPages": 2
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 401 | Unauthorized |
| 500 | Internal server error |

---

### [POST] /api/leases

**Auth:** Admin only
**Description:** Create a new lease.

**Request Body:**

```json
{
  "tenantId": "string (required, MongoDB ObjectId)",
  "unitId": "string (required, MongoDB ObjectId)",
  "startDate": "string (required, ISO 8601 datetime)",
  "endDate": "string (optional, ISO 8601 datetime)",
  "monthlyRate": "integer (required, positive, in cents)",
  "deposit": "integer (optional, min 0, default: 0, in cents)",
  "proratedFirstMonth": "integer (optional, min 0, default: 0, in cents)",
  "billingDay": "integer (required, 1-28)",
  "status": "\"active\" | \"ended\" | \"pending_moveout\" (optional, default: active)"
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "_id": "664c3b...",
    "tenantId": "664a1f...",
    "unitId": "664b2a...",
    "startDate": "2025-06-01T00:00:00.000Z",
    "monthlyRate": 15000,
    "deposit": 0,
    "proratedFirstMonth": 0,
    "billingDay": 1,
    "status": "active",
    "createdAt": "2025-06-01T00:00:00.000Z"
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 400 | Validation error |
| 403 | Forbidden — not admin |
| 500 | Internal server error |

---

### [GET] /api/leases/:id

**Auth:** Required (admin or lease owner)
**Description:** Get a single lease by ID. Populates `tenantId` and `unitId` references.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | MongoDB ObjectId of the lease |

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "664c3b...",
    "tenantId": { "_id": "664a1f...", "firstName": "John", "..." : "..." },
    "unitId": { "_id": "664b2a...", "unitNumber": "A101", "..." : "..." },
    "startDate": "2025-01-15T00:00:00.000Z",
    "monthlyRate": 15000,
    "billingDay": 15,
    "status": "active",
    "signedAt": "2025-01-15T12:00:00.000Z",
    "leaseDocumentUrl": "/documents/leases/664c3b....pdf"
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 401 | Unauthorized |
| 403 | Forbidden — tenant does not own this lease |
| 404 | Lease not found |
| 500 | Internal server error |

---

### [PATCH] /api/leases/:id

**Auth:** Required (admin has full update access; tenant can only set `moveOutDate`)
**Description:** Update a lease. Admins can update any field. Tenants can only submit a `moveOutDate` on their own lease.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | MongoDB ObjectId of the lease |

**Request Body (admin):** (all fields optional)

```json
{
  "startDate": "string (ISO 8601 datetime)",
  "endDate": "string (ISO 8601 datetime)",
  "moveOutDate": "string (ISO 8601 datetime)",
  "monthlyRate": "integer (positive, in cents)",
  "deposit": "integer (min 0, in cents)",
  "proratedFirstMonth": "integer (min 0, in cents)",
  "billingDay": "integer (1-28)",
  "status": "\"active\" | \"ended\" | \"pending_moveout\"",
  "leaseDocumentUrl": "string",
  "lastRateChangeDate": "string (ISO 8601 datetime)"
}
```

**Request Body (tenant):**

```json
{
  "moveOutDate": "string (required, ISO 8601 datetime)"
}
```

**Response:**

```json
{
  "success": true,
  "data": { "...updated lease object" }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 400 | Validation error |
| 401 | Unauthorized |
| 403 | Forbidden — tenant does not own this lease |
| 404 | Lease not found |
| 500 | Internal server error |

---

### [POST] /api/leases/:id/sign

**Auth:** Required (admin or lease owner)
**Description:** Electronically sign a lease. Generates a PDF document and stores the signature. A lease can only be signed once.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | MongoDB ObjectId of the lease |

**Request Body:**

```json
{
  "signatureData": "string (required, min 1 — base64 signature image data)"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "664c3b...",
    "signatureData": "data:image/png;base64,...",
    "signedAt": "2025-06-01T14:30:00.000Z",
    "leaseDocumentUrl": "/documents/leases/664c3b....pdf",
    "...": "...other lease fields"
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 400 | Validation error or lease already signed |
| 401 | Unauthorized |
| 403 | Forbidden — tenant does not own this lease |
| 404 | Lease / Tenant / Unit not found |
| 500 | Internal server error |

---

## 5. Payments (`/api/payments/*`)

---

### [GET] /api/payments

**Auth:** Required (admin sees all; tenant sees only own payments)
**Description:** List payments with optional filtering and pagination.

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20) |
| `tenantId` | string | No | Filter by tenant ID (admin only) |
| `leaseId` | string | No | Filter by lease ID |
| `status` | string | No | Filter: `pending`, `succeeded`, `failed` |
| `type` | string | No | Filter: `rent`, `late_fee`, `deposit`, `prorated`, `other` |

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "_id": "664d4c...",
        "tenantId": "664a1f...",
        "leaseId": "664c3b...",
        "unitId": "664b2a...",
        "stripePaymentIntentId": "pi_...",
        "amount": 15000,
        "currency": "usd",
        "type": "rent",
        "status": "succeeded",
        "periodStart": "2025-06-01T00:00:00.000Z",
        "periodEnd": "2025-06-30T00:00:00.000Z",
        "attemptCount": 1,
        "lastAttemptAt": "2025-06-01T08:00:00.000Z",
        "createdAt": "2025-06-01T00:00:00.000Z"
      }
    ],
    "total": 156,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 401 | Unauthorized |
| 500 | Internal server error |

---

### [POST] /api/payments

**Auth:** Admin only
**Description:** Manually create a payment record (e.g., for recording offline payments).

**Request Body:**

```json
{
  "tenantId": "string (required, MongoDB ObjectId)",
  "leaseId": "string (required, MongoDB ObjectId)",
  "unitId": "string (required, MongoDB ObjectId)",
  "amount": "integer (required, positive, in cents)",
  "type": "\"rent\" | \"late_fee\" | \"deposit\" | \"prorated\" | \"other\" (required)",
  "stripePaymentIntentId": "string (required)",
  "periodStart": "string (required, ISO 8601 datetime)",
  "periodEnd": "string (required, ISO 8601 datetime)"
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "_id": "664d4c...",
    "tenantId": "664a1f...",
    "leaseId": "664c3b...",
    "unitId": "664b2a...",
    "stripePaymentIntentId": "pi_...",
    "amount": 15000,
    "currency": "usd",
    "type": "rent",
    "status": "pending",
    "attemptCount": 0,
    "periodStart": "2025-06-01T00:00:00.000Z",
    "periodEnd": "2025-06-30T00:00:00.000Z",
    "createdAt": "2025-06-01T00:00:00.000Z"
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 400 | Validation error |
| 403 | Forbidden — not admin |
| 500 | Internal server error |

---

### [POST] /api/payments/intent

**Auth:** Required
**Description:** Create a Stripe PaymentIntent for a lease payment. In development without `STRIPE_SECRET_KEY`, returns a mock intent. When Stripe is configured, creates a real PaymentIntent.

**Request Body:**

```json
{
  "leaseId": "string (required, MongoDB ObjectId)",
  "amount": "integer (required, positive, in cents)",
  "type": "\"rent\" | \"late_fee\" | \"deposit\" | \"prorated\" | \"other\" (required)",
  "saveCard": "boolean (optional — if true, sets up card for future off-session payments)"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "clientSecret": "pi_...secret_...",
    "paymentIntentId": "pi_..."
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 400 | Validation error |
| 401 | Unauthorized |
| 404 | Lease not found / Tenant not found |
| 500 | Internal server error |

---

## 6. Admin (`/api/admin/*`)

All admin endpoints are protected by both the NextAuth middleware and inline role checks.

---

### [GET] /api/admin/dashboard

**Auth:** Admin only
**Description:** Returns aggregated dashboard metrics for the admin overview panel.

**Response:**

```json
{
  "success": true,
  "data": {
    "occupancyRate": 87.5,
    "totalRevenue": 4500000,
    "availableUnits": 15,
    "delinquentCount": 3,
    "lockedOutCount": 1,
    "recurringBillingRate": 72.34,
    "waitingListCount": 8,
    "upcomingMoveOuts": 2
  }
}
```

| Field | Type | Description |
|---|---|---|
| `occupancyRate` | number | Percentage of occupied units (0-100, 2 decimal places) |
| `totalRevenue` | integer | Total succeeded payments this month (in cents) |
| `availableUnits` | integer | Count of units with `available` status |
| `delinquentCount` | integer | Tenants with `delinquent` status |
| `lockedOutCount` | integer | Tenants with `locked_out` status |
| `recurringBillingRate` | number | Percentage of active tenants with autopay enabled (0-100) |
| `waitingListCount` | integer | Waiting list entries with `waiting` status |
| `upcomingMoveOuts` | integer | Active/pending-moveout leases with `moveOutDate` within next 30 days |

**Error Codes:**

| Code | Description |
|---|---|
| 403 | Forbidden — not admin |
| 500 | Internal server error |

---

### [POST] /api/admin/move-in

**Auth:** Admin only
**Description:** Execute a full move-in workflow. This is a transactional operation that:
1. Validates the tenant exists and the unit is `available`
2. Calculates the prorated first month
3. Creates a `Lease` (status: `active`)
4. Updates the `Unit` (status: `occupied`, sets `currentTenantId` and `currentLeaseId`)
5. Creates a prorated `Payment` record (status: `pending`)
6. Generates a gate code and updates the tenant (status: `active`)
7. Creates an `AccessLog` entry

**Request Body:**

```json
{
  "tenantId": "string (required, MongoDB ObjectId)",
  "unitId": "string (required, MongoDB ObjectId)",
  "startDate": "string (required, ISO 8601 datetime)",
  "paymentMethodId": "string (optional)"
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "lease": {
      "_id": "664c3b...",
      "tenantId": "664a1f...",
      "unitId": "664b2a...",
      "startDate": "2025-06-01T00:00:00.000Z",
      "monthlyRate": 15000,
      "proratedFirstMonth": 7258,
      "billingDay": 1,
      "status": "active"
    },
    "tenant": {
      "_id": "664a1f...",
      "status": "active",
      "gateCode": "4821",
      "...": "..."
    },
    "unit": {
      "_id": "664b2a...",
      "status": "occupied",
      "currentTenantId": "664a1f...",
      "currentLeaseId": "664c3b...",
      "...": "..."
    }
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 400 | Validation error or unit is not available |
| 403 | Forbidden — not admin |
| 404 | Tenant not found / Unit not found |
| 500 | Internal server error |

---

### [POST] /api/admin/move-out

**Auth:** Admin only
**Description:** Execute a full move-out workflow. This is a transactional operation that:
1. Ends the lease (status: `ended`, sets `endDate` to now)
2. Releases the unit (status: `available`, unsets `currentTenantId` and `currentLeaseId`)
3. Updates the tenant (status: `moved_out`, removes `gateCode`)
4. Creates an `AccessLog` entry for gate code revocation

**Request Body:**

```json
{
  "leaseId": "string (required, MongoDB ObjectId)"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "lease": {
      "_id": "664c3b...",
      "status": "ended",
      "endDate": "2025-06-15T00:00:00.000Z"
    },
    "tenant": {
      "_id": "664a1f...",
      "status": "moved_out"
    },
    "unit": {
      "_id": "664b2a...",
      "status": "available"
    }
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 400 | Validation error |
| 403 | Forbidden — not admin |
| 404 | Lease not found |
| 500 | Internal server error |

---

### [GET] /api/admin/rate-management

**Auth:** Admin only
**Description:** List all pending rate-increase batches (in-memory storage).

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "batch_1717200000000_abc123",
      "createdAt": "2025-06-01T00:00:00.000Z",
      "status": "pending",
      "increasePercentage": 5,
      "items": [
        {
          "leaseId": "664c3b...",
          "tenantId": "664a1f...",
          "unitId": "664b2a...",
          "currentRate": 15000,
          "proposedRate": 15750,
          "unitNumber": "A101"
        }
      ]
    }
  ]
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 403 | Forbidden — not admin |
| 500 | Internal server error |

---

### [POST] /api/admin/rate-management

**Auth:** Admin only
**Description:** Generate a new rate-increase batch. Finds active leases where:
- Tenant has been renting for 12+ months
- No rate change in the last 12 months
- The unit type has 90%+ occupancy

**Request Body:**

```json
{
  "increasePercentage": "number (optional, positive, max 100, default: 5)"
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "batch_1717200000000_abc123",
    "createdAt": "2025-06-01T00:00:00.000Z",
    "status": "pending",
    "increasePercentage": 5,
    "items": [
      {
        "leaseId": "664c3b...",
        "tenantId": "664a1f...",
        "unitId": "664b2a...",
        "currentRate": 15000,
        "proposedRate": 15750,
        "unitNumber": "A101"
      }
    ]
  }
}
```

When no tenants are eligible:

```json
{
  "success": true,
  "data": {
    "message": "No eligible tenants found for rate increase",
    "batch": null
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 400 | Validation error |
| 403 | Forbidden — not admin |
| 500 | Internal server error |

---

### [PATCH] /api/admin/rate-management

**Auth:** Admin only
**Description:** Approve or reject a pending rate-increase batch. Approving updates all lease monthly rates and creates `rate_change_notice` notifications for each affected tenant.

**Request Body:**

```json
{
  "batchId": "string (required)",
  "action": "\"approve\" | \"reject\" (required)"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "batch_1717200000000_abc123",
    "status": "approved",
    "increasePercentage": 5,
    "items": ["..."]
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 400 | Validation error or batch already processed |
| 403 | Forbidden — not admin |
| 404 | Batch not found |
| 500 | Internal server error |

---

## 7. Waiting List (`/api/waiting-list/*`)

---

### [GET] /api/waiting-list

**Auth:** Required
**Description:** List waiting list entries with optional status filter and pagination.

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20) |
| `status` | string | No | Filter: `waiting`, `notified`, `converted`, `expired` |

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "_id": "664e5d...",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "phone": "5559876543",
        "preferredSize": "10x10",
        "preferredType": "climate_controlled",
        "desiredMoveInDate": "2025-07-01T00:00:00.000Z",
        "status": "waiting",
        "notes": "",
        "createdAt": "2025-06-01T00:00:00.000Z"
      }
    ],
    "total": 8,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 401 | Unauthorized |
| 500 | Internal server error |

---

### [POST] /api/waiting-list

**Auth:** Public (no authentication required)
**Description:** Add a new entry to the waiting list. This is a public-facing endpoint for prospective tenants.

**Request Body:**

```json
{
  "name": "string (required, min 1)",
  "email": "string (required, valid email)",
  "phone": "string (required, min 1)",
  "preferredSize": "string (required, min 1, e.g. \"10x10\")",
  "preferredType": "string (optional, e.g. \"climate_controlled\")",
  "desiredMoveInDate": "string (optional, ISO 8601 datetime)",
  "notes": "string (optional)"
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "_id": "664e5d...",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "phone": "5559876543",
    "preferredSize": "10x10",
    "status": "waiting",
    "createdAt": "2025-06-01T00:00:00.000Z"
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 400 | Validation error |
| 500 | Internal server error |

---

### [PATCH] /api/waiting-list/:id

**Auth:** Admin only
**Description:** Update a waiting list entry (e.g., mark as notified or converted).

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | MongoDB ObjectId of the waiting list entry |

**Request Body:** (all fields optional)

```json
{
  "status": "\"waiting\" | \"notified\" | \"converted\" | \"expired\"",
  "notifiedAt": "string (ISO 8601 datetime)",
  "notifiedUnitId": "string (MongoDB ObjectId)",
  "notes": "string"
}
```

**Response:**

```json
{
  "success": true,
  "data": { "...updated waiting list entry" }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 400 | Validation error |
| 403 | Forbidden — not admin |
| 404 | Waiting list entry not found |
| 500 | Internal server error |

---

### [DELETE] /api/waiting-list/:id

**Auth:** Admin only
**Description:** Permanently delete a waiting list entry.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | MongoDB ObjectId of the waiting list entry |

**Response:**

```json
{
  "success": true,
  "data": { "deleted": true }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 403 | Forbidden — not admin |
| 404 | Waiting list entry not found |
| 500 | Internal server error |

---

## 8. Notifications (`/api/notifications`)

---

### [POST] /api/notifications

**Auth:** Admin only
**Description:** Send a custom notification to a tenant via email, SMS, or both. In development mode, the notification is logged to the console and immediately marked as `sent`.

**Request Body:**

```json
{
  "tenantId": "string (required, MongoDB ObjectId)",
  "type": "\"custom\" (required, literal)",
  "channel": "\"email\" | \"sms\" | \"both\" (required)",
  "subject": "string (optional — used for email)",
  "body": "string (required, min 1)"
}
```

**Response:** `201 Created`

```json
{
  "success": true,
  "data": {
    "_id": "664f6e...",
    "tenantId": "664a1f...",
    "type": "custom",
    "channel": "email",
    "subject": "Reminder: Facility Closed July 4th",
    "body": "Please note the facility will be closed on July 4th.",
    "status": "pending",
    "sentAt": null,
    "createdAt": "2025-06-01T00:00:00.000Z"
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 400 | Validation error |
| 403 | Forbidden — not admin |
| 404 | Tenant not found |
| 500 | Internal server error |

---

## 9. Gate (`/api/gate`)

---

### [POST] /api/gate

**Auth:** Admin only
**Description:** Manually update a tenant's gate access code with a specified reason. Creates an `AccessLog` entry and queues an SMS notification to the tenant.

**Request Body:**

```json
{
  "tenantId": "string (required, MongoDB ObjectId)",
  "newCode": "string (required, 4-6 characters)",
  "reason": "\"manual\" | \"lockout\" | \"restoration\" (required)"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "tenantId": "664a1f...",
    "gateCode": "5923",
    "reason": "manual"
  }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 400 | Validation error |
| 403 | Forbidden — not admin |
| 404 | Tenant not found |
| 500 | Internal server error |

---

## 10. Webhooks (`/api/webhooks/*`)

---

### [POST] /api/webhooks/stripe

**Auth:** Verified via Stripe signature (no session auth)
**Description:** Receives Stripe webhook events. Verifies the `stripe-signature` header against `STRIPE_WEBHOOK_SECRET`. Processes the following event types:

**Required Headers:**

| Header | Description |
|---|---|
| `stripe-signature` | Stripe webhook signature for event verification |

**Handled Event Types:**

| Event | Behavior |
|---|---|
| `payment_intent.succeeded` | Updates matching `Payment` to `succeeded`, stores `stripeChargeId`, creates `payment_confirmation` notification |
| `payment_intent.payment_failed` | Updates matching `Payment` to `failed`, increments `attemptCount`, stores `failureReason` |

All other event types are acknowledged but not processed.

**Request Body:** Raw Stripe event JSON (do not parse — raw body is required for signature verification).

**Response:**

```json
{
  "success": true,
  "data": { "received": true }
}
```

**Error Codes:**

| Code | Description |
|---|---|
| 400 | Missing `stripe-signature` header or signature verification failed |
| 500 | Webhook secret not configured / Internal server error |

---

## 11. Cron (`/api/cron`)

---

### [GET] /api/cron

**Auth:** Public
**Description:** Returns metadata about all scheduled background jobs. This is an informational endpoint — the actual jobs are executed by the job runner (see `/jobs`), not by calling this endpoint.

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "jobs": [
      {
        "name": "generateMonthlyInvoices",
        "schedule": "0 0 * * *",
        "description": "Generate monthly rent invoices on each tenant billing day"
      },
      {
        "name": "checkLateFees",
        "schedule": "0 6 * * *",
        "description": "Apply late fees after grace period (5 days past due)"
      },
      {
        "name": "checkLockouts",
        "schedule": "0 6 * * *",
        "description": "Lock out tenants 10+ days past due"
      },
      {
        "name": "retryFailedPayments",
        "schedule": "0 8 * * *",
        "description": "Retry failed autopay payments"
      },
      {
        "name": "sendPaymentReminders",
        "schedule": "0 9 * * *",
        "description": "Send payment reminders 3 days before due date"
      },
      {
        "name": "processWaitingList",
        "schedule": "0 10 * * 1",
        "description": "Notify waiting list entries when matching units become available"
      }
    ]
  }
}
```

**Error Codes:**

None — this endpoint always returns 200.

---

## Enum Reference

### Tenant Status
`active` | `delinquent` | `locked_out` | `moved_out`

### Tenant Role
`tenant` | `admin`

### Unit Status
`available` | `occupied` | `maintenance` | `reserved`

### Unit Type
`standard` | `climate_controlled` | `drive_up` | `vehicle_outdoor`

### Unit Floor
`ground` | `upper`

### Lease Status
`active` | `ended` | `pending_moveout`

### Payment Status
`pending` | `succeeded` | `failed`

### Payment Type
`rent` | `late_fee` | `deposit` | `prorated` | `other`

### Waiting List Status
`waiting` | `notified` | `converted` | `expired`

### Notification Channel
`email` | `sms` | `both`

### Gate Code Change Reason
`manual` | `lockout` | `restoration`

---

## Notes

- **Monetary values** are stored as integers in cents (e.g., `15000` = $150.00).
- **Dates** are ISO 8601 strings in request bodies and JavaScript `Date` objects (serialized as ISO strings) in responses.
- **Pagination defaults:** `page=1`, `limit=20` when not specified.
- **Billing day** is constrained to 1-28 to avoid end-of-month edge cases.
- **Soft deletes:** Tenants are soft-deleted (status set to `moved_out`). Units with `available` status can be hard-deleted.
- **Rate management batches** are stored in-memory and do not persist across server restarts.
- **Stripe integration** falls back to mock payment intents when `STRIPE_SECRET_KEY` is not set.
