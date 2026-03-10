# WiseMove Connect — API Reference

## Base URL
```
http://localhost:5000
```

---

## Health Check

```
GET /health
```
Returns `{ "status": "ok" }`

---

## Public Endpoints

### Submit a Lead
```
POST /api/leads
Content-Type: application/json

{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "07700123456",
  "postcode": "SW1A 1AA",
  "category": "<category_id>",
  "description": "Looking for a mortgage adviser",
  "introducer_id": "<introducer_id>"   // optional
}
```
**Response:** `{ "message": "Thanks — we'll match you shortly." }`

---

### Get All Categories
```
GET /api/categories
```
Returns list of active categories. Regulated categories include a `disclaimer` field.

### Get Category Suggestions
```
GET /api/categories/:id/suggestions
```
Returns 3–5 related categories (static rules-based).

---

## Admin Endpoints

> All admin endpoints require: `Authorization: Bearer <token>`

### Login
```
POST /admin/auth/login
Content-Type: application/json

{ "username": "admin", "password": "yourpassword" }
```
**Response:** `{ "token": "<jwt>" }`

---

### Partners

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/partners` | List all partners |
| GET | `/admin/partners/:id` | Get single partner |
| POST | `/admin/partners` | Create partner |
| PUT | `/admin/partners/:id` | Update partner |
| PATCH | `/admin/partners/:id/status` | Activate / deactivate |
| DELETE | `/admin/partners/:id` | Delete partner |

**Create Partner body:**
```json
{
  "name": "ABC Mortgages Ltd",
  "email": "partner@example.com",
  "phone": "+441234567890",
  "whatsappNumber": "+441234567890",
  "categories": ["<category_id>"],
  "postcodes": ["SW1A", "EC1A", "W1"],
  "priority": 1,
  "status": "active"
}
```

---

### Leads

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/leads` | All leads (paginated, filterable by `status`, `category`) |
| GET | `/admin/leads/unassigned` | Unassigned leads only |
| GET | `/admin/leads/:id` | Single lead detail |
| PATCH | `/admin/leads/:id/assign` | Manually assign partner |
| PATCH | `/admin/leads/:id/notes` | Add admin notes |
| DELETE | `/admin/leads/:id` | GDPR deletion |

---

### Commissions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/commissions` | All commission records |
| GET | `/admin/commissions/:id` | Single commission |
| POST | `/admin/commissions` | Record commission (partner reports deal) |
| PATCH | `/admin/commissions/:id` | Update status (paid/unpaid/reversed) |

**Record Commission body:**
```json
{
  "leadId": "<lead_id>",
  "partnerId": "<partner_id>",
  "partnerFee": 2500,
  "rdTaxYear": 1,    // only for R&D Tax Credits category
  "notes": "Partner confirmed deal closed"
}
```

---

### Reporting (MI)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/reports/partners` | Leads, commissions, conversion rate per partner |
| GET | `/admin/reports/categories` | Revenue and leads per category |
| GET | `/admin/reports/postcodes` | Leads per postcode |
| GET | `/admin/reports/export?type=partners` | CSV download (partners/categories/postcodes) |

---

### Categories (Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/categories` | All categories (including inactive) |
| POST | `/admin/categories` | Create category |
| PUT | `/admin/categories/:id` | Update category |
| GET | `/admin/categories/:id/relationships` | Get cross-category rules |
| PUT | `/admin/categories/:id/relationships` | Update cross-category rules |

---

## Query Parameters

- `GET /admin/leads?status=unassigned&category=<id>&page=1&limit=50`
- `GET /admin/commissions?status=paid&partnerId=<id>&page=1&limit=50`
- `GET /admin/reports/export?type=partners|categories|postcodes`
