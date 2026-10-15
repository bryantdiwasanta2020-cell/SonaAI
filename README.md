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
https://sona-ai-beta.vercel.app/
