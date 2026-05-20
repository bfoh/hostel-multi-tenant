# Wiring the "Make an Enquiry" form on an external tenant site

External marketing sites (e.g. `www.abremponghostel.com`) can post directly
to the GH Hostels platform. The platform looks up the tenant by slug,
validates that the request origin matches `tenants.website_url` (so other
sites can't impersonate Abrempong), inserts a row into `waiting_list` with
`source='website'`, and notifies the tenant's admins by email + SMS.

## Endpoint

```
POST https://<APP_HOST>/api/public/<tenant-slug>/enquiry
Content-Type: application/json
```

`<APP_HOST>` is whichever platform domain the tenant uses. Examples for
Abrempong (any one works):
- Auto subdomain: `abrempong-hostel-666865.ghh.com`
- Custom domain:  `app.abremponghostel.com`

Tenant slug is the prefix of the auto subdomain — e.g. `abrempong-hostel-666865`.
Confirm in the platform's Tenants table or by running:

```sql
select slug from tenants where name ilike '%abrempong%';
```

## Required tenant setup (one-time)

In the platform → Settings → Hostel profile, set:

| Field         | Value                                           |
| ------------- | ----------------------------------------------- |
| `website_url` | `https://www.abremponghostel.com`               |
| `contact_phone` | The number that should receive the SMS alert |

The endpoint allows the request only when its `Origin` header matches
`website_url` (with or without `www.`). Subdomains of `gh-hostels.com` are
always allowed for previews.

## Request body

```ts
{
  full_name:         string   // required, 2–120 chars
  phone:             string   // required, 7–32 chars
  email?:            string   // optional, valid email
  preferred_move_in?: string  // optional, "YYYY-MM-DD"
  room_of_interest?: string   // optional, free-text label (e.g. "2-in-1 Standard")
  category_id?:      string   // optional UUID — link to a known room_categories row
  message?:          string   // optional, up to 2000 chars
  website?:          ''       // honeypot — must be empty (hide via CSS)
}
```

Successful response: `201 Created` with `{ ok: true, id: <uuid> }`.
Validation errors return `422` with details.

## Drop-in snippet (vanilla JS)

Add to the Abrempong landing page just before `</body>`. Assumes the form
uses `id="enquiryForm"` and named inputs matching the body keys above.

```html
<form id="enquiryForm" novalidate>
  <input name="full_name" required minlength="2" maxlength="120" />
  <input name="phone"     required minlength="7" maxlength="32" />
  <input name="email"     type="email" maxlength="160" />
  <input name="preferred_move_in" type="date" />
  <select name="room_of_interest">
    <option value="">Select room type</option>
    <option>1-in-1 Premium</option>
    <option>2-in-1 Standard</option>
    <option>4-in-1 Shared</option>
  </select>
  <textarea name="message" maxlength="500"></textarea>
  <!-- Honeypot: hidden from humans, bots fill it -->
  <input name="website" tabindex="-1" autocomplete="off"
         style="position:absolute;left:-9999px;height:0;width:0;opacity:0" />
  <button type="submit">Send Enquiry</button>
  <p id="enquiryStatus" role="status"></p>
</form>

<script>
  const ENQUIRY_URL = 'https://app.abremponghostel.com/api/public/abrempong-hostel-666865/enquiry'

  document.getElementById('enquiryForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    const status = document.getElementById('enquiryStatus')
    const btn = form.querySelector('button[type="submit"]')

    const data = Object.fromEntries(new FormData(form).entries())
    btn.disabled = true
    status.textContent = 'Sending…'

    try {
      const res = await fetch(ENQUIRY_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      })

      if (res.ok) {
        status.textContent = "Thanks — we'll get back to you within 24 hours."
        form.reset()
      } else {
        const body = await res.json().catch(() => ({}))
        status.textContent = body.error || 'Could not send. Please try again.'
      }
    } catch (err) {
      status.textContent = 'Network error — please try again.'
    } finally {
      btn.disabled = false
    }
  })
</script>
```

## Testing

1. Apply migration `20240001000075_waiting_list_enquiry.sql`.
2. Set `tenants.website_url` for the test tenant to your local origin
   (e.g. `http://localhost:3001`) or the production marketing domain.
3. From that origin, POST a sample payload:

```bash
curl -i -X POST https://app.abremponghostel.com/api/public/abrempong-hostel-666865/enquiry \
  -H 'Origin: https://www.abremponghostel.com' \
  -H 'Content-Type: application/json' \
  -d '{
    "full_name": "Kwame Asante",
    "phone": "0241234567",
    "email": "kwame@example.com",
    "preferred_move_in": "2026-09-01",
    "room_of_interest": "2-in-1 Standard",
    "message": "Is the WiFi included in the rent?"
  }'
```

Expect `201`. In the dashboard, open **Waiting List & Enquiries**; the
"Website" filter chip should show the new row with the message body
rendered inline. Tenant admins receive an email; the tenant manager (the
phone on `tenants.contact_phone`) receives an SMS.
