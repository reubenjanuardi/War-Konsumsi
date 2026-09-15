# Product Requirements Document (PRD)
# Consumption War Selection System

**Version:** 2.0  
**Status:** Verified & Production-Ready  
**Platform:** Mobile First Web App  
**Primary Users:** Participant / Peserta  
**Secondary Users:** Admin / Panitia  
**Database:** Native PostgreSQL on VPS  
**Domain:** Not required  
**Application Access:** Public Server IP over HTTPS (Let's Encrypt Public IP Certificate)  
**Core Concept:** Real Time Limited Quota Selection

---

## 1. Product Overview

Consumption War Selection System adalah aplikasi web untuk melakukan pemilihan jenis konsumsi dalam sebuah acara dengan mekanisme **quota terbatas dan real time**.

Setiap jenis konsumsi memiliki quota tertentu. Peserta dapat memilih salah satu jenis konsumsi selama quota masih tersedia. Ketika quota habis, kategori tersebut tidak dapat dipilih oleh peserta lain.

Sistem menggunakan konsep **war selection**, yaitu seluruh peserta dapat memilih pada waktu yang sama setelah pemilihan dibuka. Kecepatan memilih menjadi bagian dari pengalaman pengguna, tetapi sistem tetap harus menjamin bahwa satu quota hanya dapat diberikan kepada satu peserta.

Ketika peserta berhasil mengambil quota terakhir sebuah kategori, peserta lain yang sedang membuka aplikasi akan melihat perubahan status secara real time tanpa perlu melakukan refresh halaman.

---

## 2. Problem Statement

Pemilihan konsumsi secara manual memiliki beberapa permasalahan:

1. Panitia harus merekap pilihan peserta secara manual.
2. Peserta tidak mengetahui jumlah konsumsi yang masih tersedia.
3. Pilihan dapat melebihi jumlah konsumsi yang sebenarnya tersedia.
4. Pemilihan simultan sulit dikontrol secara manual.
5. Rekapitulasi hasil membutuhkan waktu tambahan.
6. Peserta tidak mendapatkan informasi real time mengenai perubahan quota.
7. Tidak terdapat mekanisme yang menjamin satu quota hanya diperoleh satu peserta ketika terjadi pemilihan bersamaan.

---

## 3. Product Goals

### Primary Goals

Aplikasi harus:

1. Memungkinkan peserta memilih jenis konsumsi dengan cepat.
2. Menampilkan quota setiap kategori secara real time.
3. Mencegah oversubscription.
4. Mencegah quota menjadi negatif.
5. Memastikan satu peserta hanya memiliki satu pilihan.
6. Menjamin hanya satu peserta yang memperoleh quota terakhir ketika terjadi concurrent request.
7. Memberikan feedback secara langsung setelah pemilihan.
8. Memberikan admin kemampuan untuk mengatur event dan quota.
9. Menyediakan hasil pemilihan yang dapat digunakan untuk distribusi konsumsi.

### Secondary Goals

Aplikasi diharapkan:

1. Mobile first.
2. Reactive.
3. Cepat dan ringan.
4. Mudah digunakan oleh peserta yang baru pertama kali mengakses aplikasi.
5. Tetap usable ketika banyak peserta mengakses secara bersamaan.
6. Memiliki desain dengan karakter visual sendiri dan tidak terasa seperti template SaaS atau AI generated UI.
7. Mudah di-deploy untuk event sekali pakai.

---

## 4. Non Goals

Versi MVP tidak mencakup:

1. Pembayaran.
2. Food delivery.
3. Marketplace.
4. Inventory management kompleks.
5. Aplikasi native Android.
6. Aplikasi native iOS.
7. Sistem membership atau account management kompleks.

Fokus utama adalah:

> **Pemilihan konsumsi dengan quota terbatas secara real time.**

---

## 5. Target Users

### 5.1 Participant

Peserta acara yang membutuhkan konsumsi.

**Kebutuhan utama:**

> Saya ingin memilih konsumsi yang saya inginkan sebelum quota habis.

Participant harus dapat menyelesaikan proses pemilihan dengan sesedikit mungkin interaksi.

### 5.2 Admin

Panitia atau administrator event.

**Kebutuhan utama:**

> Saya ingin mengatur jenis konsumsi dan quota serta memantau hasil pemilihan secara real time.

---

## 6. Core User Flow

```text
Landing
   │
   ▼
Masukkan Nama
   │
   ▼
Waiting Room
   │
   ▼
Countdown
   │
   ▼
Selection Open
   │
   ▼
Pilih Kategori
   │
   ▼
Server Validation
   │
   ├───────────────┐
   │               │
   ▼               ▼
Success           Failed
   │               │
   ▼               ▼
Confirmation    Quota Habis
                   │
                   ▼
              Pilih Kategori Lain
```

Setelah berhasil memilih:

```text
Selection
   │
   ▼
Confirmation
   │
   ▼
Completed
```

Participant tidak dapat melakukan pemilihan kedua.

---

## 7. Participant Experience

### 7.1 Landing / Join Screen

Peserta masuk ke aplikasi melalui URL berbasis IP server.

Contoh:

```text
http://103.xxx.xxx.xxx
```

Halaman menampilkan:

```text
PILIH KONSUMSI

Nama kamu

[________________]

[ MULAI ]
```

### Validation

- Nama wajib diisi.
- Minimal 2 karakter.
- Maksimal 100 karakter.
- Leading dan trailing whitespace dihapus.
- Input harus disanitasi.

### Recommendation

Untuk penggunaan production, identifikasi peserta sebaiknya menggunakan participant ID, access code, atau QR code untuk mencegah duplicate identity.

Namun input nama dapat digunakan untuk MVP.

---

## 8. Waiting Room

Sebelum pemilihan dibuka, peserta melihat waiting room.

Contoh:

```text
PILIHAN KONSUMSI

Hai, Reuben.

Pemilihan belum dimulai.

Dimulai dalam

02 : 14 : 32

Jangan tutup halaman ini.
```

Countdown harus berjalan secara reactive.

Ketika waktu mencapai waktu mulai:

```text
PEMILIHAN DIMULAI

PILIH SEKARANG
```

Aplikasi secara otomatis berpindah ke selection state.

---

## 9. Selection Screen

Selection screen merupakan halaman utama participant.

Prioritas informasi:

1. Status event.
2. Instruksi.
3. Quota.
4. Nama kategori.
5. Action.

Contoh mobile:

```text
PILIH KONSUMSI

Reuben

Pilih satu.
Kuota terbatas.

┌─────────────────────┐
│ 🍗                  │
│ AYAM                │
│                     │
│ 4 tersisa           │
│ ███████░░░          │
│                     │
│ PILIH               │
└─────────────────────┘

┌─────────────────────┐
│ 🥩                  │
│ SAPI                │
│                     │
│ 🔥 1 tersisa        │
│ ███░░░░░░           │
│                     │
│ PILIH SEKARANG      │
└─────────────────────┘

┌─────────────────────┐
│ 🐟                  │
│ IKAN                │
│                     │
│ HABIS               │
│                     │
│ TIDAK TERSEDIA      │
└─────────────────────┘
```

---

## 10. Category States

### 10.1 Available

```text
AYAM

8 tersisa

[ PILIH ]
```

### 10.2 Limited

Digunakan ketika quota berada di bawah threshold tertentu.

```text
AYAM

⚠ 2 tersisa

[ PILIH ]
```

Threshold dapat ditentukan oleh konfigurasi sistem.

### 10.3 Last One

Ketika quota tersisa satu:

```text
SAPI

🔥 1 TERSISA

[ PILIH SEKARANG ]
```

State ini digunakan sebagai bagian dari konsep war dan urgency.

### 10.4 Sold Out

Ketika quota menjadi nol:

```text
IKAN

HABIS

[ TIDAK TERSEDIA ]
```

Button harus disabled.

Frontend tidak boleh mengirim selection request untuk kategori yang telah diketahui habis.

Namun backend tetap wajib melakukan validasi karena status pada client dapat berubah sewaktu-waktu.

---

## 11. Realtime Requirement

Sistem harus mendukung perubahan quota secara real time.

Contoh:

Awalnya:

```text
SAPI
2 tersisa
```

User A berhasil memilih SAPI.

Semua client yang terhubung menerima:

```text
SAPI
1 tersisa
```

User B kemudian memperoleh quota terakhir.

Semua client menerima:

```text
SAPI
HABIS
```

Perubahan tersebut tidak membutuhkan browser refresh.

---

## 12. War Mechanism

Konsep war menjadi bagian dari user experience tetapi tidak boleh mengganggu usability.

Elemen utama:

### Countdown

Menentukan kapan pemilihan dibuka.

### Live Quota

Menunjukkan quota aktual.

### Urgency Indicator

Contoh:

```text
🔥 1 tersisa
```

### Immediate Feedback

Ketika berhasil:

```text
✓ BERHASIL

Kamu mendapatkan

SAPI
```

Ketika kalah dalam perebutan:

```text
SAPI BARU SAJA HABIS

Pilih konsumsi lainnya.
```

Feedback harus muncul tanpa reload halaman.

---

## 13. Selection Rules

### Rule 1

Satu participant hanya dapat memiliki satu selection dalam satu event.

### Rule 2

Satu category tidak dapat diberikan melebihi quota.

### Rule 3

Quota tidak boleh bernilai negatif.

### Rule 4

Participant tidak dapat memilih category dengan quota nol.

### Rule 5

Selection yang berhasil tidak dapat diubah oleh participant pada MVP.

### Rule 6

Setiap selection harus menyimpan timestamp.

### Rule 7

Backend dan database merupakan source of truth.

### Rule 8

Frontend tidak boleh menentukan sendiri apakah selection berhasil.

---

## 14. Concurrency Requirement

Sistem harus aman ketika beberapa participant memilih kategori yang sama secara hampir bersamaan.

Contoh:

```text
SAPI = 1
```

Kemudian:

```text
Reuben → SAPI
Andi   → SAPI
Budi   → SAPI
```

Server harus memastikan:

```text
1 participant → berhasil
2 participant → gagal
```

Bukan:

```text
3 participant → berhasil
```

atau:

```text
quota = -2
```

---

## 15. Atomic Quota Allocation

Quota harus dikelola menggunakan atomic operation pada PostgreSQL.

Contoh:

```sql
UPDATE categories
SET remaining_quota = remaining_quota - 1
WHERE id = $1
  AND remaining_quota > 0;
```

Jika:

```text
affected rows = 1
```

maka quota berhasil diamankan.

Jika:

```text
affected rows = 0
```

maka quota telah habis atau category tidak tersedia.

Proses pembuatan selection harus berada dalam transaction yang sama.

Contoh:

```text
BEGIN
   │
   ├── Validate participant
   │
   ├── Validate event
   │
   ├── Atomic quota decrement
   │
   ├── Create selection
   │
   └── COMMIT
```

Apabila salah satu operasi gagal:

```text
ROLLBACK
```

---

## 16. Realtime Architecture

Sistem realtime dapat menggunakan WebSocket atau teknologi equivalent.

Konsep arsitektur:

```text
Participant A
      │
      ▼
   Backend
      │
      ├──────────────► PostgreSQL
      │
      └──────────────► Realtime Gateway
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
                Client A    Client B    Client C
```

Event minimal:

```text
category.quota.updated
```

Payload contoh:

```json
{
  "categoryId": "123",
  "remainingQuota": 1,
  "status": "AVAILABLE"
}
```

Ketika habis:

```json
{
  "categoryId": "123",
  "remainingQuota": 0,
  "status": "SOLD_OUT"
}
```

---

## 17. PostgreSQL Requirement

PostgreSQL digunakan sebagai **source of truth** untuk seluruh data penting aplikasi.

PostgreSQL:

- native PostgreSQL
- berjalan pada VPS
- digunakan untuk event
- digunakan untuk participant
- digunakan untuk category
- digunakan untuk selection
- menangani transaction
- menangani concurrency
- menyimpan audit data

Database tidak boleh diakses langsung dari browser.

Arsitektur harus:

```text
Browser
   ↓
Backend
   ↓
PostgreSQL
```

Bukan:

```text
Browser
   ↓
PostgreSQL
```

---

## 18. Database Schema

### 18.1 events

```text
id
name
status
selection_starts_at
selection_ends_at
created_at
updated_at
```

Status:

```text
DRAFT
WAITING
OPEN
CLOSED
```

### 18.2 participants

```text
id
event_id
name
created_at
```

### 18.3 categories

```text
id
event_id
name
description
image_url
quota
remaining_quota
is_active
created_at
updated_at
```

### 18.4 selections

```text
id
event_id
participant_id
category_id
selected_at
```

Constraint:

```text
UNIQUE(event_id, participant_id)
```

Constraint tersebut memastikan seorang participant hanya memiliki satu selection pada event yang sama.

---

## 19. Event State Machine

Event memiliki lifecycle:

```text
DRAFT
  │
  ▼
WAITING
  │
  ▼
OPEN
  │
  ▼
CLOSED
```

### DRAFT

Admin melakukan konfigurasi.

### WAITING

Participant dapat masuk tetapi belum dapat memilih.

### OPEN

Selection aktif.

### CLOSED

Selection telah ditutup dan request baru tidak diperbolehkan.

---

## 20. Server Time Requirement

Server menjadi sumber waktu untuk event.

Frontend countdown hanya merupakan presentation layer.

Backend harus memvalidasi:

```text
current_time >= selection_starts_at
```

Sistem tidak boleh hanya mengandalkan JavaScript client untuk membuka selection.

Hal ini mencegah peserta mengubah waktu pada browser untuk mencoba memilih lebih awal.

---

## 21. Admin Dashboard

Admin dashboard menampilkan kondisi event dan quota secara real time.

Contoh:

```text
CONSUMPTION WAR

187 peserta
169 sudah memilih
18 belum memilih

────────────────────

AYAM
78 / 100
22 tersisa

SAPI
49 / 50
1 tersisa

IKAN
30 / 30
HABIS

BAKSO
12 / 25
13 tersisa
```

---

## 22. Admin Capabilities

### Event Management

Admin dapat:

- membuat event
- mengubah event
- menentukan waktu mulai
- membuka event
- menutup event

### Category Management

Admin dapat:

- membuat category
- mengubah category
- menentukan quota
- mengaktifkan category
- menonaktifkan category

### Selection Monitoring

Admin dapat:

- melihat jumlah participant
- melihat jumlah participant yang sudah memilih
- melihat quota
- melihat peserta yang mendapatkan category tertentu
- melihat timestamp selection

### Data Export

Admin dapat mengekspor hasil ke:

```text
CSV
XLSX
```

### Emergency Controls

Admin dapat melakukan:

- force close
- reset category quota
- cancel participant selection

Emergency action harus dibatasi berdasarkan role/permission.

---

## 23. API Requirements

Minimal REST endpoint:

### Get Event

```http
GET /api/events/:eventId
```

### Get Categories

```http
GET /api/events/:eventId/categories
```

### Join Event

```http
POST /api/events/:eventId/join
```

Body:

```json
{
  "name": "Reuben"
}
```

### Create Selection

```http
POST /api/events/:eventId/selections
```

Body:

```json
{
  "participantId": "...",
  "categoryId": "..."
}
```

### Get Participant Selection

```http
GET /api/events/:eventId/participants/:participantId/selection
```

---

## 24. Selection API Behavior

Ketika menerima selection request, backend melakukan:

```text
1. Validate event
2. Validate participant
3. Validate event status
4. Validate participant belum memilih
5. Validate category
6. Atomic quota allocation
7. Create selection
8. Commit transaction
9. Broadcast quota update
10. Return response
```

### Success

```json
{
  "success": true,
  "selection": {
    "category": "Sapi"
  }
}
```

### Quota Exhausted

```json
{
  "success": false,
  "code": "QUOTA_EXHAUSTED",
  "message": "Kategori baru saja habis."
}
```

### Already Selected

```json
{
  "success": false,
  "code": "ALREADY_SELECTED",
  "message": "Kamu sudah memiliki pilihan."
}
```

---

## 25. Frontend Requirements

Frontend harus:

- reactive
- mobile first
- fast
- lightweight
- responsive
- accessible
- realtime aware
- tidak bergantung pada page refresh

Frontend harus menangani state:

```text
loading
available
limited
last one
sold out
success
error
completed
disconnected
reconnecting
```

---

## 26. Optimistic UI Policy

Quota tidak boleh dikurangi secara optimistic pada client.

Contoh yang tidak diperbolehkan:

```text
User melihat:
SAPI = 1

User tap

Client langsung:
SAPI = 0
```

sebelum server memberikan konfirmasi.

Flow yang benar:

```text
Tap
 ↓
Loading
 ↓
Server transaction
 ↓
Server success
 ↓
Realtime state update
 ↓
UI update
```

Hal ini menghindari UI menampilkan quota yang belum benar benar berhasil diamankan.

---

## 27. Error Handling

Pesan error harus mudah dimengerti.

### Quota Exhausted

```text
Sapi baru saja diambil orang lain.

Pilih konsumsi lainnya.
```

### Network Failure

```text
Koneksi terputus.

Coba lagi.
```

### Event Closed

```text
Pemilihan sudah ditutup.
```

### Already Selected

```text
Kamu sudah memiliki pilihan.
```

### Server Error

```text
Terjadi kesalahan.

Silakan coba lagi.
```

Jangan menampilkan technical error seperti:

```text
HTTP 409 Conflict
```

kepada participant.

---

## 28. UI/UX Design Direction

Desain harus memiliki karakter:

**Fast**

**Clear**

**Tactile**

**Minimal**

**Confident**

**Event oriented**

Prioritas utama:

> Participant harus mengetahui apa yang tersedia, berapa quota yang tersisa, dan bagaimana memilih dalam waktu kurang dari beberapa detik.

---

## 29. No Slop Design Requirement

UI harus menghindari:

- generic SaaS dashboard
- gradient berlebihan
- glassmorphism yang tidak memiliki fungsi
- terlalu banyak rounded cards
- terlalu banyak shadow
- excessive icon usage
- warna khas template AI tanpa alasan desain
- excessive animation
- dashboard yang terlalu banyak statistik
- dekorasi yang tidak membantu proses pemilihan

Desain harus terasa seperti produk yang memang dibuat untuk event tersebut.

---

## 30. Visual Hierarchy

Informasi utama:

```text
STATUS
   ↓
QUOTA
   ↓
CATEGORY
   ↓
ACTION
```

Quota harus memiliki visual hierarchy yang kuat.

Contoh:

```text
SAPI

🔥 1 TERSISA

[ PILIH SEKARANG ]
```

lebih informatif daripada:

```text
Sapi

[ PILIH ]
```

---

## 31. Responsive Design

### Mobile

```text
1 column
```

### Tablet

```text
2 columns
```

### Desktop

```text
2 sampai 3 columns
```

Mobile merupakan primary experience.

Target utama:

```text
320 px
375 px
390 px
430 px
```

---

## 32. Interaction Requirements

Button harus mempunyai state:

```text
AVAILABLE
LOADING
SUCCESS
DISABLED
SOLD OUT
ERROR
```

Contoh:

```text
PILIH
  ↓
MEMPROSES
  ↓
✓ BERHASIL
```

Tidak boleh terjadi kondisi ketika user melakukan tap tetapi UI tidak memberikan feedback.

---

## 33. Accessibility

Minimal:

- button mempunyai accessible label
- contrast memenuhi standar yang layak
- tap target cukup besar
- keyboard navigation pada desktop
- status tidak hanya dibedakan melalui warna
- teks status tetap tersedia
- focus state terlihat
- form mempunyai label yang jelas

Contoh:

Tidak hanya menggunakan warna untuk status habis:

```text
Merah
```

Tetapi:

```text
HABIS
```

---

## 34. Performance Requirements

### Initial Load

Target ≤ 2 detik pada koneksi normal.

### Selection Response

Feedback diberikan segera setelah request dikirim.

### Realtime Update

Quota update harus diterima connected clients dengan latency serendah mungkin dan tidak membutuhkan reload.

### Concurrent Selection

Sistem harus mampu menangani multiple selection request secara bersamaan tanpa duplicate allocation.

---

## 35. Security Requirements

Backend tidak boleh mempercayai data dari client.

Backend harus melakukan validasi terhadap:

```text
event
participant
category
event status
participant selection status
quota
```

Database harus menjadi final authority terhadap allocation quota.

Admin endpoint harus menggunakan authentication dan authorization.

PostgreSQL tidak boleh terekspos bebas ke internet.

---

## 36. Audit Requirements

Setiap selection harus menyimpan:

```text
event
participant
category
selected_at
```

Admin harus dapat mengetahui:

```text
Siapa
Memilih apa
Kapan
```

Data tersebut digunakan untuk audit ketika terjadi dispute.

---

## 37. Recommended Technology Stack

Karena belum ada preference stack yang final, stack berikut menjadi **recommendation, bukan hard requirement**.

### Frontend

Recommended:

```text
Next.js
TypeScript
React
Tailwind CSS
```

UI component library bersifat optional.

### Backend

Recommended:

```text
NestJS
TypeScript
```

Alternative:

```text
Fastify
TypeScript
```

### Database

```text
PostgreSQL Native
```

### ORM

Recommended:

```text
Drizzle ORM
```

Alternative:

```text
Prisma
```

### Realtime

Recommended:

```text
WebSocket
atau
Socket.IO
```

### Reverse Proxy

Recommended:

```text
Nginx
```

---

## 38. Deployment Requirements

Karena aplikasi ditujukan untuk penggunaan **sekali pakai**, custom domain tidak menjadi requirement.

### Application Access

Aplikasi diakses melalui public IP server.

Contoh:

```text
http://103.xxx.xxx.xxx
```

URL tersebut dapat dimasukkan ke QR code untuk akses peserta.

---

## 39. Deployment Architecture

Deployment topology bersifat fleksibel.

Minimal:

```text
Internet
   │
   ▼
Public Server IP
   │
   ├── Frontend
   │
   ├── Backend
   │
   └── Realtime
            │
            ▼
      PostgreSQL VPS
```

Frontend, backend, dan realtime dapat:

1. berjalan pada server yang sama
2. berjalan pada server berbeda
3. menggunakan platform deployment yang berbeda

PostgreSQL tetap berada pada VPS yang telah tersedia.

---

## 40. Recommended Simple Deployment

Karena aplikasi hanya digunakan untuk satu event, setup sederhana lebih diutamakan daripada infrastructure yang terlalu kompleks.

Recommended starting point:

```text
                   VPS
        ┌─────────────────────────┐
        │                         │
        │        Nginx            │
        │           │             │
        │    Frontend / Backend   │
        │           │             │
        │       WebSocket         │
        │           │             │
        │      PostgreSQL         │
        │                         │
        └─────────────────────────┘
                    │
                    │
               Public IP
                    │
                    ▼
             Participant
```

Arsitektur dapat dipisahkan apabila diperlukan setelah dilakukan load testing.

---

## 41. PostgreSQL Network Security

Walaupun aplikasi diakses melalui public IP, PostgreSQL tidak boleh menjadi endpoint publik.

Ideal:

```text
Internet
   │
   ▼
Application Server
   │
   ▼
Private / Restricted Connection
   │
   ▼
PostgreSQL VPS
```

Firewall harus membatasi akses PostgreSQL hanya dari backend yang membutuhkan akses.

Port PostgreSQL tidak boleh dibuka untuk seluruh internet tanpa alasan.

---

## 42. QR Code Access

Karena aplikasi tidak menggunakan domain, QR code dapat diarahkan langsung ke IP aplikasi.

Contoh:

```text
http://103.xxx.xxx.xxx
```

Participant:

```text
Scan QR
   ↓
Landing Page
   ↓
Masukkan Nama
   ↓
Waiting Room
```

QR code akan menjadi mekanisme akses utama yang direkomendasikan untuk event.

---

## 43. MVP Scope

### Participant

MVP harus mencakup:

- join menggunakan nama
- waiting room
- countdown
- selection screen
- category quota
- live quota
- atomic selection
- one selection per participant
- confirmation page
- sold out state
- error handling
- reconnect handling

### Admin

MVP harus mencakup:

- create event
- set event time
- create category
- set quota
- open event
- close event
- live quota monitoring
- view selections
- export data

---

## 44. Post MVP

Fitur berikut dapat dipertimbangkan:

### QR Participant Identity

Setiap peserta memiliki QR atau code unik.

### Access Code

Peserta menggunakan kode yang diberikan panitia.

### Live Winner Feed

Contoh:

```text
Reuben mendapatkan SAPI
Andi mendapatkan AYAM
Dimas mendapatkan BAKSO
```

Fitur ini bersifat optional dan harus mempertimbangkan privasi.

### Waitlist

Peserta dapat masuk waiting list ketika kategori habis.

### Analytics

Contoh:

```text
Peak Selection Time
Most Popular Category
Average Selection Time
Selection Completion Rate
Quota Utilization
```

### Selection History

Admin dapat melihat timeline perubahan selection.

---

## 45. Acceptance Criteria

### Participant

**AC-01**  
Participant dapat mengakses aplikasi melalui public IP.

**AC-02**  
Participant dapat memasukkan nama.

**AC-03**  
Participant dapat masuk ke waiting room sebelum event dibuka.

**AC-04**  
Countdown dapat berjalan tanpa refresh.

**AC-05**  
Participant tidak dapat memilih sebelum event berstatus OPEN.

**AC-06**  
Participant dapat melihat seluruh kategori dan quota.

**AC-07**  
Participant dapat memilih kategori yang masih tersedia.

**AC-08**  
Participant hanya dapat memiliki satu selection.

**AC-09**  
Participant tidak dapat memilih category dengan quota 0.

**AC-10**  
Selection yang berhasil menampilkan confirmation.

**AC-11**  
Participant tidak dapat melakukan selection kedua setelah berhasil.

### Concurrency

**AC-12**  
Jika quota suatu category adalah 1 dan dua participant melakukan selection secara bersamaan, hanya satu participant yang berhasil.

**AC-13**  
Quota tidak pernah bernilai negatif.

**AC-14**  
Jumlah selection tidak pernah melebihi quota.

### Realtime

**AC-15**  
Perubahan quota dikirim ke connected clients tanpa refresh.

**AC-16**  
Category berubah menjadi SOLD OUT ketika quota mencapai 0.

**AC-17**  
Client dapat melakukan reconnect setelah koneksi terputus.

### Admin

**AC-18**  
Admin dapat membuat event.

**AC-19**  
Admin dapat menentukan category dan quota.

**AC-20**  
Admin dapat membuka dan menutup selection.

**AC-21**  
Admin dapat melihat quota secara real time.

**AC-22**  
Admin dapat melihat daftar participant dan selection.

**AC-23**  
Admin dapat mengekspor data selection.

---

## 46. Success Metrics

### Selection Completion Rate

```text
successful selections
---------------------- × 100%
total participants
```

Target:

```text
> 95%
```

dengan catatan tidak terjadi system error.

### Oversubscription Rate

Target:

```text
0%
```

### Double Allocation Rate

Target:

```text
0%
```

### System Error Rate

Target serendah mungkin selama event.

### Average Selection Time

Mengukur waktu dari selection dibuka sampai participant berhasil memperoleh konsumsi.

---

## 47. Final Architecture Summary

```text
                         INTERNET
                            │
                            ▼
                    PUBLIC SERVER IP
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
         FRONTEND WEB               BACKEND/API
              │                           │
              │                    ┌──────┴──────┐
              │                    │             │
              │                    ▼             ▼
              │               Selection       WebSocket
              │                Service          Gateway
              │                    │             │
              └────────────────────┼─────────────┘
                                   │
                                   ▼
                            PostgreSQL VPS
                                   │
                                   ▼
                              Source of Truth
```

### Prinsip arsitektur

```text
PostgreSQL
→ Source of truth

Backend
→ Business logic + concurrency control

WebSocket
→ Realtime propagation

Frontend
→ Reactive presentation

Public IP
→ Application access

QR Code
→ Participant entry point
```

---

## 48. Product Principle

Produk ini bukan sekadar **form pemilihan konsumsi**.

Core experience-nya adalah:

> **“Pilih cepat sebelum habis, tetapi sistem harus tetap adil dan akurat ketika semua orang memilih bersamaan.”**

Karena itu tiga hal yang paling kritis dalam implementasi adalah:

```text
1. Fast Mobile UX
2. Real Time Quota
3. Concurrency Safe Allocation
```

Ketiga aspek tersebut harus menjadi prioritas lebih tinggi daripada fitur tambahan.
