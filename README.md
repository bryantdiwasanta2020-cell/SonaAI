# 🎙️ SonaAI - Web-Based AI Assistant

**SonaAI** adalah asisten AI berbasis web dengan kemampuan interaksi suara dua arah (bisa berbicara dan mendengar), pemilihan model cerdas (Google Gemini), dan database SQL berbasis Cloud (Supabase / PostgreSQL) sehingga **0% data disimpan di disk lokal Anda**.

---

## ✨ Fitur Utama

1. **🎙️ Bisa Berbicara (Text-to-Speech) & Mendengar (Speech-to-Text)**:
   - **Mode Suara (Voice Call)**: Layar interaktif dengan animasi **Voice Orb 3D** yang merespons suara secara langsung.
   - **Tombol Mikrofon**: Bicara langsung dalam bahasa Indonesia di kolom chat tanpa harus mengetik.
   - **Putar Suara Otomatis**: Setiap jawaban SonaAI dapat langsung disuarakan dengan intonasi natural.
2. **🧠 Multi-Model Cerdas (Google Gemini)**:
   - `gemini-3.8-flash`: Sangat cepat, responsif, dan hemat kuota untuk obrolan sehari-hari.
   - `gemini-2.5-pro`: Penalaran mendalam (*deep reasoning*), analisis, dan coding tingkat tinggi.
3. **☁️ Database Cloud SQL (100% Bebas Disk Lokal)**:
   - Terintegrasi langsung dengan **Supabase PostgreSQL** via Connection String.
   - Jika belum memasukkan database cloud, SonaAI otomatis berjalan dalam mode *ephemeral in-memory* (RAM saja, tidak ada file SQL yang ditulis ke harddisk komputer Anda).
4. **🎨 Tampilan UI Futuristik & Responsif**:
   - Tema gelap modern dengan Glassmorphism, animasi partikel orb, dan dukungan mobile.

---

## 🚀 Cara Menjalankan

### 1. Jalankan Server
Buka terminal di folder ini dan jalankan:
```bash
npm start
```
Atau untuk mode development (auto-reload):
```bash
npm run dev
```

### 2. Buka di Browser
Kunjungi:
```
http://localhost:3000
```

---

## ⚙️ Pengaturan API Key & Cloud Database

Semua konfigurasi bisa dimasukkan langsung lewat **Tombol Pengaturan (⚙️ Settings)** di pojok kiri bawah tampilan web, atau melalui file `.env`:

### 1. Google Gemini API Key (Gratis)
1. Buka [Google AI Studio](https://aistudio.google.com/).
2. Buat API Key baru.
3. Masukkan ke SonaAI.

### 2. Supabase Cloud PostgreSQL (Gratis)
1. Buka [Supabase.com](https://supabase.com) dan buat proyek baru (Gratis).
2. Pergi ke **Project Settings** > **Database** > **Connection string** (pilih mode *URI* / *Session/Transaction Pooler*).
3. Salin connection string tersebut, contoh:
   ```
   postgresql://postgres.xxxx:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   ```
4. Masukkan ke pengaturan SonaAI. Tabel `conversations` dan `messages` akan otomatis dibuatkan di cloud!
