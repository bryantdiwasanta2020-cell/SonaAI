import { GoogleGenAI } from '@google/genai';

let cachedApiKey = process.env.GEMINI_API_KEY || '';

export function setApiKey(key) {
  cachedApiKey = key;
}

export function getApiKey() {
  return cachedApiKey || process.env.GEMINI_API_KEY || '';
}

const SYSTEM_INSTRUCTION = `Kamu adalah SonaAI, asisten AI berbasis web yang cerdas, modern, ramah, dan serbaguna.
Karakter dan Aturan Utama:
- Sangat komunikatif, hangat, dan ekspresif.
- Mahir dalam Bahasa Indonesia dan Bahasa Inggris.
- ATURAN KESESUAIAN BAHASA (SANGAT PENTING):
  * Jika pengguna berbicara, bertanya, atau menyapa dalam Bahasa Inggris (English), kamu WAJIB menjawab sepenuhnya dalam Bahasa Inggris (fluent, natural American English).
  * Jika pengguna berbicara dalam Bahasa Indonesia, kamu WAJIB menjawab dalam Bahasa Indonesia.
  * Selalu cocokkan bahasa jawabanmu 100% dengan bahasa yang digunakan pengguna!
- KELENGKAPAN JAWABAN:
  * Berikan jawaban yang komprehensif, kaya informasi, detail, dan tuntas.
  * Jika pengguna meminta resep, tutorial, tips, atau penjelasan teknis, berikan seluruh langkah dan bahan secara lengkap tanpa memotong atau meringkas berlebihan.
  * Format teks dengan struktur Markdown yang indah (paragraf jelas, teks tebal untuk judul poin, serta daftar bertingkat).
- PENGGUNAAN EMOJI:
  * Emoji hanya sebagai pemanis visual tulisan. JANGAN PERNAH mengeja nama atau mendeskripsikan emoji dalam bentuk kata-kata (seperti "(tersenyum)", "(senyum gigi lebar)", atau sejenisnya).
Nama pembuat atau brand-mu adalah SonaAI
Kamu di Buat Oleh Bryant`;


export async function generateChatResponse({
  prompt,
  history = [],
  model = 'gemini-3.1-flash-lite',
  apiKey = null,
  webSearch = false,
  language = null
}) {
  const activeKey = apiKey || getApiKey();
  const targetModel = model || 'gemini-3.1-flash-lite';

  if (!activeKey || !activeKey.trim()) {
    return {
      text: 'Halo! Saya SonaAI. ✨\n\nUntuk mulai mengobrol dan mendengar suara saya, silakan masukkan **Gemini API Key** Anda melalui tombol **Pengaturan (⚙️ Settings)** di atas.\n\nAPI Key bisa didapatkan secara gratis di [Google AI Studio](https://aistudio.google.com/).',
      isDemo: true
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: activeKey.trim() });

    // Format chat history for Google GenAI SDK
    const formattedContents = [];

    // Add recent history (up to last 10 messages for rich context)
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      formattedContents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }

    // Append current user prompt
    formattedContents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    // Build configuration with optional Google Search Grounding
    const tools = [];
    if (webSearch) {
      tools.push({ googleSearch: {} });
    }

    let dynamicInstruction = SYSTEM_INSTRUCTION;
    if (language && language.startsWith('en')) {
      dynamicInstruction += '\n\n[PANDUAN BAHASA SESI INI]: Pengguna sedang berinteraksi dalam Bahasa Inggris (English). Kamu WAJIB menjawab 100% menggunakan Bahasa Inggris yang fasih, ramah, dan natural.';
    } else if (language && language.startsWith('id')) {
      dynamicInstruction += '\n\n[PANDUAN BAHASA SESI INI]: Pengguna sedang berinteraksi dalam Bahasa Indonesia. Kamu WAJIB menjawab menggunakan Bahasa Indonesia yang ramah dan solutif.';
    }

    const config = {
      systemInstruction: dynamicInstruction,
      temperature: 0.7,
      maxOutputTokens: 4096,
      ...(tools.length > 0 ? { tools } : {})
    };

    // Helper to extract web sources
    const extractGrounding = (res) => {
      const gm = res?.candidates?.[0]?.groundingMetadata;
      const sources = [];
      if (gm?.groundingChunks) {
        for (const chunk of gm.groundingChunks) {
          if (chunk.web?.uri) {
            sources.push({
              title: chunk.web.title || chunk.web.uri,
              uri: chunk.web.uri
            });
          }
        }
      }
      return {
        sources,
        queries: gm?.webSearchQueries || []
      };
    };

    // Helper with timeout and automatic backoff retry
    const delay = ms => new Promise(res => setTimeout(res, ms));

    const fetchWithRetry = async (modelName, timeoutMs = 8000, maxRetries = 2) => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const callPromise = ai.models.generateContent({
            model: modelName,
            contents: formattedContents,
            config
          });

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout setelah ${timeoutMs}ms`)), timeoutMs)
          );

          return await Promise.race([callPromise, timeoutPromise]);
        } catch (err) {
          const isRateLimit = err.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED'));
          const is503 = err.message && (err.message.includes('503') || err.message.includes('UNAVAILABLE'));
          if ((isRateLimit || is503) && attempt < maxRetries) {
            const waitTime = (attempt + 1) * 3000;
            console.log(`⏳ [Retry]: Model ${modelName} antre/limit. Menunggu jeda ${waitTime}ms sebelum mencoba ulang...`);
            await delay(waitTime);
            continue;
          }
          throw err;
        }
      }
    };

    try {
      const response = await fetchWithRetry(targetModel, 25000);
      const replyText = response.text || 'Maaf, SonaAI tidak dapat menghasilkan respon.';
      const grounding = extractGrounding(response);
      return {
        text: replyText,
        model: targetModel,
        isDemo: false,
        sources: grounding.sources,
        queries: grounding.queries
      };
    } catch (err) {
      if (targetModel !== 'gemini-3.1-flash-lite') {
        console.log(`⚡ Beralih cepat ke gemini-3.1-flash-lite karena ${targetModel} lambat/sibuk: ${err.message}`);
        const fallbackResponse = await fetchWithRetry('gemini-3.1-flash-lite', 25000, 1);
        const grounding = extractGrounding(fallbackResponse);
        return {
          text: fallbackResponse.text || 'Maaf, SonaAI tidak dapat menghasilkan respon.',
          model: 'gemini-3.1-flash-lite',
          isDemo: false,
          sources: grounding.sources,
          queries: grounding.queries
        };
      } else {
        console.log(`⚡ Beralih ke gemini-3.5-flash karena gemini-3.1-flash-lite sibuk: ${err.message}`);
        const fallbackResponse = await fetchWithRetry('gemini-3.5-flash', 25000, 1);
        const grounding = extractGrounding(fallbackResponse);
        return {
          text: fallbackResponse.text || 'Maaf, SonaAI tidak dapat menghasilkan respon.',
          model: 'gemini-3.5-flash',
          isDemo: false,
          sources: grounding.sources,
          queries: grounding.queries
        };
      }
    }
  } catch (error) {
    console.error('❌ [AI Generation Error]:', error);
    if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('quota')) {
      return {
        text: '⚠️ **Batas Kuota Gemini API Tercapai (Rate Limit 429)**\n\nAkun Google AI Studio Anda sedang mencapai batas kuota per menit untuk model ini. Mohon tunggu sekitar 20–40 detik sebelum mengirim pesan berikutnya, atau gunakan model yang lebih hemat kuota.',
        model: targetModel,
        isDemo: false
      };
    }
    if (error.message.includes('503') || error.message.includes('UNAVAILABLE') || error.message.includes('high demand')) {
      return {
        text: '⚠️ **Server Google Gemini Sedang Sibuk (High Demand 503)**\n\nLayanan Google Gemini sedang mengalami lonjakan trafik global sesaat. Silakan tunggu beberapa detik dan coba kirim kembali.',
        model: targetModel,
        isDemo: false
      };
    }
    throw new Error(`Gagal memproses dengan model AI (${model}): ${error.message}`);
  }
}
