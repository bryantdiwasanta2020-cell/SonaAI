# 🎙️ SonaAI - Web-Based AI Assistant

**SonaAI** adalah asisten AI berbasis web generasi baru dengan interaksi suara dua arah real-time, dukungan **Multi-Model AI (100% Gratis)**, sistem *Intelligent Auto-Fallback*, dan integrasi **Database Cloud PostgreSQL (Supabase)** sehingga **0% data disimpan di disk lokal Anda**.

---

## ✨ Fitur Utama

### 1. 🎙️ Interaksi Suara Dua Arah (Voice Call & TTS)
- **Mode Suara (Voice Call)**: Layar interaktif fullscreen dengan visualisasi **3D Glowing Voice Orb** yang bereaksi terhadap suara secara dinamis.
- **Groq Whisper Turbo**: Transkripsi audio kilat (*<200ms latency*) dengan model `whisper-large-v3-turbo`.
- **Text-to-Speech Alami**: Sintesis suara responsif dalam Bahasa Indonesia & Inggris dengan kontrol kecepatan bicara (*speed pitch*).
- **Auto-Scroll Pintar**: Deteksi scroll hardware manual (mouse wheel/touchpad/layar sentuh) agar Anda tetap bisa leluasa membaca teks ke atas saat AI sedang mengetik, dilengkapi tombol mengambang *"Lihat Balasan Baru"*.

### 2. 🧠 Multi-Provider & Model Gateway (100% GRATIS)
Pilih model AI favorit Anda secara fleksibel lewat dropdown top-nav:
- ⚡ **Groq Direct (Ultra-Fast / Respon Kilat ~0.02s)**:
  - `Qwen 27B` – Paling instan dan hemat waktu.
  - `GPT OSS 120B` – Model penalaran besar 120 Miliar parameter untuk penulisan berbobot.
  - `GPT OSS 20B` – Ringan, cepat, dan responsif.
- 🌐 **OpenRouter (Free Tier)**:
  - `Nvidia Nemotron 30B` – Model penalaran dengan rantai pemikiran (*Chain of Thought*).
  - `Nvidia Nemotron 120B` – Model raksasa terbuka berkapasitas tinggi.
  - `Nvidia Nemotron 3.5` – Cepat dan serbaguna.
  - `Cohere Mini Code` – Dioptimalkan khusus untuk coding dan pemrograman.
- ✨ **Google Gemini (Google AI Studio)**:
  - `Gemini 3.5 Flash-Lite` – Paling hemat token & stabil.
  - `Gemini 3.8 Flash` – Model cerdas terbaru untuk penalaran multimodal.
  - `Gemini 3.1 Flash-Lite` & `Gemini 3.5 Flash`.

### 3. 🛡️ Intelligent Auto-Fallback System
- Jika server gratis tertentu sedang mengalami antrean padat atau batas kuota (*Rate Limit 429*), SonaAI secara cerdas dan otomatis mengalihkan jawaban ke **Gemini 3.5 Flash-Lite**. Obrolan Anda tidak akan pernah macet atau terhenti oleh pesan error merah!

### 4. ☁️ Database Cloud SQL (Supabase HTTPS REST / Port 443)
- Riwayat obrolan dan pesan disinkronkan secara instan ke Cloud PostgreSQL via protokol HTTPS (Port 443), aman dari pemblokiran firewall dan kendala IPv6.
- Dilengkapi mode *In-Memory Ephemeral* jika database cloud belum dikonfigurasi (aman tanpa menyentuh harddisk lokal).

### 5. 🎨 Desain Glassmorphism & Custom Dropdown
- Antarmuka futuristik bertema gelap (*Dark Aurora & Violet Glassmorphism*).
- **Custom Dropdown Component**: Menu model meluncur ke bawah (*strictly drops downward*) di dalam layar secara rapi tanpa terpotong atau menabrak address bar.
- Ekspor obrolan ke format Markdown (`.md`) sekali klik.

---

## 🚀 Cara Menjalankan

### 1. Kunjungi Demo Live
Aplikasi dapat diakses langsung di:
```
https://sona-ai-beta.vercel.app/
```

### 2. Menjalankan di Lokal (Localhost)
Clone repositori dan jalankan:
```bash
# Pasang dependensi
npm install

# Jalankan server
npm start
```
Buka browser di: `http://localhost:3000`

---

## ⚙️ Konfigurasi API Key & Database

Semua konfigurasi dapat diatur langsung lewat menu **Pengaturan (⚙️ Settings)** di pojok kiri bawah tampilan web, atau melalui file `.env`:

```env
PORT=3000

# 1. Google Gemini API Key (Wajib / Utama)
# Dapatkan gratis di: https://aistudio.google.com/
GEMINI_API_KEY=your_gemini_api_key

# 2. Groq API Key (Opsional untuk Respon Kilat & Whisper Turbo)
# Dapatkan gratis di: https://console.groq.com/
GROQ_API_KEY=your_groq_api_key

# 3. OpenRouter API Key (Opsional untuk Model Nemotron & Cohere)
# Dapatkan gratis di: https://openrouter.ai/keys
OPENROUTER_API_KEY=your_openrouter_api_key

# 4. Supabase Cloud Database (Opsional untuk Simpan Riwayat Cloud)
# Dapatkan gratis di: https://supabase.com/
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your_service_role_secret_key
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

---

## 📄 Lisensi
Dilisensikan di bawah lisensi [MIT](LICENSE). Dibuat dengan dedikasi untuk eksplorasi AI interaktif yang elegan dan efisien.

