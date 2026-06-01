# ARCANUM — Secure Military Communication Platform

Platform komunikasi taktis terenkripsi berbasis web dengan tema militer.

---

## Struktur proyek

```
arcanum/
├── server.js              # Entry point — Express + Socket.io
├── package.json
├── routes/
│   ├── auth.js            # Login, logout
│   └── pages.js           # Halaman + API endpoints
├── views/
│   ├── login.html         # Halaman autentikasi
│   ├── dashboard.html     # Command center
│   ├── channels.html      # Ops channel (real-time chat)
│   ├── sitrep.html        # Log laporan situasi
│   ├── grid.html          # Peta taktis
│   └── operators.html     # User management (placeholder)
└── public/
    ├── css/arcanum.css    # Design system global
    └── js/arcanum.js      # Shared utilities
```

---

## Setup & menjalankan

### 1. Install dependencies

```bash
npm install
```

### 2. Jalankan server

```bash
# Production
npm start

# Development (auto-reload)
npm run dev
```

### 3. Buka browser

```
http://localhost:3000
```

---

## Demo credentials

| Operator ID | Passphrase    | Role    | Clearance |
|-------------|---------------|---------|-----------|
| OPS-001     | arcanum2024   | CMD     | LVL 3     |
| OPS-002     | alpha2024     | OPS     | LVL 2     |
| OPS-003     | bravo2024     | RECON   | LVL 2     |

---

## Fitur yang sudah ada

- **Login** — autentikasi dengan Operator ID + passphrase + clearance level
- **Dashboard** — stat cards, channel list, mini map, sitrep log
- **Ops Channel** — real-time chat via Socket.io, burn after read mode, encrypted messages
- **Sitrep** — log laporan dengan filter status & priority, detail view, approve/reject flow
- **Grid Taktis** — peta dengan unit markers, zona terbatas, layer toggle, info panel

---

## Langkah pengembangan selanjutnya

### Database
Ganti mock data di `routes/pages.js` dengan database nyata:
```bash
npm install mongoose        # MongoDB
# atau
npm install pg              # PostgreSQL
# atau
npm install better-sqlite3  # SQLite (paling simpel untuk mulai)
```

### Enkripsi pesan nyata
```bash
npm install crypto-js
# atau gunakan built-in Node.js crypto module
```

### Authentication yang lebih kuat
```bash
npm install bcryptjs jsonwebtoken
```

### Environment variables
Buat file `.env`:
```
PORT=3000
SESSION_SECRET=ganti-dengan-secret-yang-kuat
DB_URL=mongodb://localhost/arcanum
```

Lalu install dotenv:
```bash
npm install dotenv
```

Dan tambahkan di baris pertama `server.js`:
```js
require('dotenv').config();
```

---

## Design system

Semua token warna, tipografi, spacing, dan komponen UI ada di:
- `public/css/arcanum.css` — CSS variables dan class utilities
- `public/js/arcanum.js`  — JS helpers (initTopbar, api, statusBadge, dll)

### Warna utama
| Token     | Hex       | Fungsi                    |
|-----------|-----------|---------------------------|
| --navy    | #042C53   | Background utama          |
| --cmd     | #185FA5   | Primary action / button   |
| --signal  | #378ADD   | Accent / link             |
| --ops     | #639922   | Status OK / online        |
| --siaga   | #EF9F27   | Warning / pending         |
| --threat  | #E24B4A   | Danger / unknown contact  |

---

Built with Node.js · Express · Socket.io
