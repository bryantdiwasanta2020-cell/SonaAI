import { GoogleGenAI } from '@google/genai';

let cachedGeminiKey = process.env.GEMINI_API_KEY || '';
let cachedGroqKey = process.env.GROQ_API_KEY || '';
let cachedOpenRouterKey = process.env.OPENROUTER_API_KEY || '';

export function setApiKey(key) {
  cachedGeminiKey = key;
}

export function getApiKey() {
  return cachedGeminiKey || process.env.GEMINI_API_KEY || '';
}

export function setGroqApiKey(key) {
  cachedGroqKey = key;
}

export function getGroqApiKey() {
  return cachedGroqKey || process.env.GROQ_API_KEY || '';
}

export function setOpenRouterApiKey(key) {
  cachedOpenRouterKey = key;
}

export function getOpenRouterApiKey() {
  return cachedOpenRouterKey || process.env.OPENROUTER_API_KEY || '';
}

const SYSTEM_INSTRUCTION = `Kamu adalah SonaAI (atau dipanggil Sona), asisten kecerdasan buatan berbasis web yang cerdas, modern, ramah, dan serbaguna.
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
- PEMAHAMAN BAHASA GAUL & SLANG:
  * Pahami dengan baik bahasa gaul, singkatan, dan slang santai Indonesia (seperti: "ea", "wkwk", "mantap", "bjir", "gokil", "santai", "cie", "yoi", dll).
  * Jika pengguna menyapa atau bercanda dengan bahasa santai/gaul, balaslah dengan gaya yang ramah, asyik, ceria, dan bersahabat (tidak kaku seperti robot), sambil tetap cerdas dan sopan.
- ATURAN TENTANG PENCIPTA / PEMBUAT:
  * Brand dan namamu adalah SonaAI (atau Sona).
  * Kamu diciptakan dan dikembangkan oleh Bryant.
  * PENTING: JANGAN PERNAH menyebut nama Bryant atau penciptamu secara tiba-tiba/spontan saat menyapa biasa ("halo", "hai", dll). Balas sapaan dengan natural dan fokus pada bantuan untuk pengguna.
  * HANYA sebutkan bahwa kamu dibuat oleh Bryant JIKA dan HANYA JIKA pengguna secara spesifik bertanya tentang siapa pembuatmu, siapa yang menciptakanmu, atau asal-usulmu (misalnya: "kamu dibuat siapa?", "siapa penciptamu?", "who created you?").`;

// Build localized language prompt guidance
function buildLanguageInstruction(language) {
  let instruction = SYSTEM_INSTRUCTION;
  if (language && language.startsWith('en')) {
    instruction += '\n\n[PANDUAN BAHASA SESI INI]: Pengguna sedang berinteraksi dalam Bahasa Inggris (English). Kamu WAJIB menjawab 100% menggunakan Bahasa Inggris yang fasih, ramah, dan natural.';
  } else if (language && language.startsWith('id')) {
    instruction += '\n\n[PANDUAN BAHASA SESI INI]: Pengguna sedang berinteraksi dalam Bahasa Indonesia. Kamu WAJIB menjawab menggunakan Bahasa Indonesia yang ramah dan solutif.';
  }
  return instruction;
}

// Convert history to OpenAI standard format
function formatOpenAiMessages(history, prompt, language) {
  const messages = [
    { role: 'system', content: buildLanguageInstruction(language) }
  ];

  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    });
  }

  if (prompt && prompt.trim()) {
    messages.push({ role: 'user', content: prompt });
  }

  return messages;
}

// === GROQ INTEGRATION ===
// 1. Groq Whisper Audio Transcription (Ultra-fast <200ms)
async function transcribeAudioWithGroq(audioBase64, mimeType, groqKey, language) {
  const binaryBuffer = Buffer.from(audioBase64, 'base64');
  const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('wav') ? 'wav' : 'webm';
  const audioBlob = new Blob([binaryBuffer], { type: mimeType });

  const formData = new FormData();
  formData.append('file', audioBlob, `speech.${ext}`);
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'json');
  formData.append('temperature', '0');
  if (language) {
    formData.append('language', language.startsWith('en') ? 'en' : 'id');
  }

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqKey}`
    },
    body: formData
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Groq Whisper Audio Error [${res.status}]: ${errorText}`);
  }

  const json = await res.json();
  return json.text || '';
}

// 2. Groq Chat API
async function generateGroqResponse({ model, prompt, history, groqKey, language }) {
  let realModel = model.replace(/^groq:/, '').trim() || 'qwen/qwen3.8-27b';
  // Graceful alias mapping if legacy names are selected
  if (realModel === 'llama-3.3-70b-versatile' || realModel.includes('llama')) {
    realModel = 'qwen/qwen3.8-27b';
  }

  const messages = formatOpenAiMessages(history, prompt, language);

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: realModel,
      messages,
      temperature: 0.7,
      max_tokens: 4096
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Groq API Error [${res.status}]: ${errorText}`);
  }

  const json = await res.json();
  const choice = json.choices?.[0];
  const reply = (choice?.message?.content && choice.message.content.trim())
    ? choice.message.content
    : (choice?.message?.reasoning || 'Maaf, Groq tidak memberikan jawaban.');
  return reply;
}

// === OPENROUTER INTEGRATION ===
async function generateOpenRouterResponse({ model, prompt, history, openrouterKey, language }) {
  let realModel = model.replace(/^openrouter:/, '').trim() || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
  if (realModel.includes('deepseek') && realModel.includes(':free')) {
    realModel = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
  }
  const messages = formatOpenAiMessages(history, prompt, language);

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openrouterKey}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'SonaAI',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: realModel,
      messages,
      temperature: 0.7,
      max_tokens: 4096
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenRouter API Error [${res.status}]: ${errorText}`);
  }

  const json = await res.json();
  const choice = json.choices?.[0];
  let reply = (choice?.message?.content && choice.message.content.trim())
    ? choice.message.content
    : (choice?.message?.reasoning || 'Maaf, OpenRouter tidak memberikan respon.');
  return reply;
}


// === UNIFIED MAIN GENERATE CHAT RESPONSE GATEWAY ===
export async function generateChatResponse({
  prompt,
  audioBase64 = null,
  audioMimeType = null,
  history = [],
  model = 'gemini-3.5-flash-lite',
  apiKey = null,
  groqApiKey = null,
  openrouterApiKey = null,
  webSearch = false,
  language = null
}) {
  const targetModel = model || 'gemini-3.5-flash-lite';
  const hasAudio = !!(audioBase64 && audioBase64.trim());

  // ----------------------------------------------------
  // ROUTE 1: GROQ PROVIDER
  // ----------------------------------------------------
  if (targetModel.startsWith('groq:')) {
    const activeGroqKey = (groqApiKey || getGroqApiKey()).trim();

    if (!activeGroqKey) {
      return {
        text: '⚡ **Groq API Key Diperlukan**\n\nUntuk menggunakan model super kilat Groq (Llama 3.3 70B & 8B), silakan masukkan **Groq API Key** Anda di menu **Pengaturan (⚙️ Settings)**.\n\nAPI Key Groq bisa didapatkan **100% Gratis** tanpa kartu kredit di: [console.groq.com](https://console.groq.com/).',
        isDemo: true,
        model: targetModel
      };
    }

    let resolvedPrompt = prompt;
    let userTranscription = '';

    try {
      if (hasAudio) {
        userTranscription = await transcribeAudioWithGroq(audioBase64, audioMimeType || 'audio/webm', activeGroqKey, language);
        resolvedPrompt = userTranscription;
      }

      const replyText = await generateGroqResponse({
        model: targetModel,
        prompt: resolvedPrompt,
        history,
        groqKey: activeGroqKey,
        language
      });

      return {
        text: replyText,
        userTranscription,
        model: targetModel,
        isDemo: false,
        sources: [],
        queries: []
      };
    } catch (err) {
      console.error('Groq Execution Error:', err);

      // Intelligent Auto-Fallback: if Groq is rate-limited (429 spam) or busy, seamlessly route to Gemini Flash
      const geminiKey = (apiKey || getApiKey()).trim();
      if (geminiKey) {
        try {
          const fallbackRes = await generateChatResponse({
            prompt: resolvedPrompt || prompt,
            audioBase64: null,
            history,
            model: 'gemini-3.5-flash-lite',
            apiKey: geminiKey,
            language
          });
          return {
            text: `> 💡 *Catatan: Server Groq sedang mencapai batas pesan/spam (${err.message.includes('429') ? '429 Rate Limit' : 'Server Sibuk'}), SonaAI otomatis mengalihkan jawaban ke Gemini Flash agar percakapan tetap lancar.* \n\n${fallbackRes.text}`,
            userTranscription,
            model: 'gemini-3.5-flash-lite (Auto-Fallback)',
            isDemo: false,
            sources: fallbackRes.sources || [],
            queries: fallbackRes.queries || []
          };
        } catch (fbErr) {
          console.error('Auto-fallback from Groq to Gemini error:', fbErr);
        }
      }

      return {
        text: `⚠️ **Gagal memproses via Groq**: ${err.message}`,
        model: targetModel,
        isDemo: false
      };
    }
  }

  // ----------------------------------------------------
  // ROUTE 2: OPENROUTER PROVIDER
  // ----------------------------------------------------
  if (targetModel.startsWith('openrouter:')) {
    const activeOpenRouterKey = (openrouterApiKey || getOpenRouterApiKey()).trim();

    if (!activeOpenRouterKey) {
      return {
        text: '🌐 **OpenRouter API Key Diperlukan**\n\nUntuk menggunakan model-model OpenRouter (seperti DeepSeek R1/V3, Claude, GPT-4o), silakan masukkan **OpenRouter API Key** Anda di menu **Pengaturan (⚙️ Settings)**.\n\nDapatkan API Key Anda di: [openrouter.ai/keys](https://openrouter.ai/keys).',
        isDemo: true,
        model: targetModel
      };
    }

    let resolvedPrompt = prompt;
    let userTranscription = '';

    try {

      // If audio is provided, try Groq Whisper first, then Gemini if available
      if (hasAudio) {
        const groqKey = (groqApiKey || getGroqApiKey()).trim();
        const geminiKey = (apiKey || getApiKey()).trim();

        if (groqKey) {
          userTranscription = await transcribeAudioWithGroq(audioBase64, audioMimeType || 'audio/webm', groqKey, language);
          resolvedPrompt = userTranscription;
        } else if (geminiKey) {
          const geminiAi = new GoogleGenAI({ apiKey: geminiKey });
          const geminiRes = await geminiAi.models.generateContent({
            model: 'gemini-3.5-flash-lite',
            contents: [{
              role: 'user',
              parts: [
                { inlineData: { mimeType: audioMimeType || 'audio/webm', data: audioBase64 } },
                { text: 'Transkrip suara ini dengan persis tanpa komentar apa pun.' }
              ]
            }]
          });
          userTranscription = (geminiRes.text || '').trim();
          resolvedPrompt = userTranscription;
        }
      }

      const replyText = await generateOpenRouterResponse({
        model: targetModel,
        prompt: resolvedPrompt,
        history,
        openrouterKey: activeOpenRouterKey,
        language
      });

      return {
        text: replyText,
        userTranscription,
        model: targetModel,
        isDemo: false,
        sources: [],
        queries: []
      };
    } catch (err) {
      console.error('OpenRouter Execution Error:', err);

      // Intelligent Auto-Fallback: if OpenRouter is rate-limited (429) or busy, seamlessly route to Gemini
      const geminiKey = (apiKey || getApiKey()).trim();
      if (geminiKey) {
        try {
          const fallbackRes = await generateChatResponse({
            prompt: resolvedPrompt || prompt,
            audioBase64: null,
            history,
            model: 'gemini-3.5-flash-lite',
            apiKey: geminiKey,
            language
          });
          return {
            text: `> 💡 *Catatan: Server gratis OpenRouter sedang padat antrean/limit (${err.message.includes('429') ? '429 Rate Limit' : 'Busy'}), SonaAI otomatis mengalihkan jawaban ke Gemini 3.5 Flash-Lite agar obrolanmu tidak terhenti.* \n\n${fallbackRes.text}`,
            userTranscription,
            model: 'gemini-3.5-flash-lite (Auto-Fallback)',
            isDemo: false,
            sources: fallbackRes.sources || [],
            queries: fallbackRes.queries || []
          };
        } catch (fbErr) {
          console.error('Auto-fallback to Gemini error:', fbErr);
        }
      }

      return {
        text: `⚠️ **Gagal memproses via OpenRouter**: ${err.message}`,
        model: targetModel,
        isDemo: false
      };
    }
  }

  // ----------------------------------------------------
  // ROUTE 3: GOOGLE GEMINI PROVIDER (DEFAULT & NATIVE AUDIO)
  // ----------------------------------------------------
  const activeKey = apiKey || getApiKey();

  if (!activeKey || !activeKey.trim()) {
    return {
      text: 'Halo! Saya SonaAI. ✨\n\nUntuk mulai mengobrol dan mendengar suara saya, silakan masukkan **Gemini API Key** Anda melalui tombol **Pengaturan (⚙️ Settings)** di kiri bawah.\n\nAPI Key bisa didapatkan secara gratis di [Google AI Studio](https://aistudio.google.com/).',
      isDemo: true
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: activeKey.trim() });

    // Format chat history for Google GenAI SDK
    const formattedContents = [];

    // Add recent history
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      formattedContents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }

    // Append current user prompt or audio
    const userParts = [];
    if (audioBase64) {
      userParts.push({
        inlineData: {
          mimeType: audioMimeType || 'audio/webm',
          data: audioBase64
        }
      });
      if (prompt && prompt.trim()) {
        userParts.push({ text: prompt });
      } else {
        userParts.push({
          text: `Dengarkan rekaman suara pengguna ini dengan teliti.
FORMAT OUTPUT (WAJIB DIIKUTI):
---TRANSKRIPSI---
[Tuliskan transkripsi persis kata demi kata dari apa yang diucapkan pengguna]
---JAWABAN---
[Tuliskan jawaban lengkapmu atas ucapan atau pertanyaan pengguna tersebut]`
        });
      }
    } else {
      userParts.push({ text: prompt || '' });
    }

    formattedContents.push({
      role: 'user',
      parts: userParts
    });

    // Build configuration with optional Google Search Grounding
    const tools = [];
    if (webSearch) {
      tools.push({ googleSearch: {} });
    }

    const dynamicInstruction = buildLanguageInstruction(language);

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

    const delay = ms => new Promise(res => setTimeout(res, ms));

    const fetchWithRetry = async (modelName, activeConfig = config, timeoutMs = 10000, maxRetries = 1) => {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const callPromise = ai.models.generateContent({
            model: modelName,
            contents: formattedContents,
            config: activeConfig
          });

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout setelah ${timeoutMs}ms`)), timeoutMs)
          );

          return await Promise.race([callPromise, timeoutPromise]);
        } catch (err) {
          const isRateLimit = err.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED'));
          const is503 = err.message && (err.message.includes('503') || err.message.includes('UNAVAILABLE'));

          // If Google Search Grounding quota is exhausted (429), immediately retry without search tool in 0ms!
          if (isRateLimit && activeConfig.tools && activeConfig.tools.length > 0) {
            console.warn('⚠️ Google Search Grounding kuota penuh (429). Otomatis beralih tanpa web search agar cepat...');
            const configWithoutTools = { ...activeConfig };
            delete configWithoutTools.tools;
            return await fetchWithRetry(modelName, configWithoutTools, timeoutMs, 0);
          }

          if ((isRateLimit || is503) && attempt < maxRetries) {
            const waitTime = 800;
            console.log(`⏳ [Retry]: Model ${modelName} antre/sibuk. Mencoba ulang dalam ${waitTime}ms...`);
            await delay(waitTime);
            continue;
          }
          throw err;
        }
      }
    };

    const parseTranscriptionAndAnswer = (rawText) => {
      let replyText = rawText || 'Maaf, SonaAI tidak dapat menghasilkan respon.';
      let userTranscription = '';

      if (replyText.includes('---JAWABAN---')) {
        const parts = replyText.split('---JAWABAN---');
        userTranscription = parts[0].replace('---TRANSKRIPSI---', '').trim();
        replyText = parts[1] ? parts[1].trim() : replyText;
      } else if (replyText.includes('---TRANSKRIPSI---')) {
        const parts = replyText.split('---TRANSKRIPSI---');
        replyText = (parts[0] || parts[1] || '').trim();
      }

      return { replyText, userTranscription };
    };

    try {
      const response = await fetchWithRetry(targetModel, config, 12000, 1);
      const parsed = parseTranscriptionAndAnswer(response.text);
      const grounding = extractGrounding(response);
      return {
        text: parsed.replyText,
        userTranscription: parsed.userTranscription,
        model: targetModel,
        isDemo: false,
        sources: grounding.sources,
        queries: grounding.queries
      };
    } catch (err) {
      console.warn(`Model utama ${targetModel} terkendala (${err.message}). Mencoba model cadangan...`);
      const fallbackModels = ['gemini-3.8-flash', 'gemini-3.5-flash'];
      for (const altModel of fallbackModels) {
        if (altModel === targetModel) continue;
        try {
          const fallbackConfig = { ...config };
          delete fallbackConfig.tools; // Fallbacks without tools to guarantee speed
          const fallbackResponse = await fetchWithRetry(altModel, fallbackConfig, 8000, 0);
          const parsed = parseTranscriptionAndAnswer(fallbackResponse.text);
          const grounding = extractGrounding(fallbackResponse);
          return {
            text: parsed.replyText,
            userTranscription: parsed.userTranscription,
            model: altModel,
            isDemo: false,
            sources: grounding.sources,
            queries: grounding.queries
          };
        } catch (altErr) {
          console.warn(`Model cadangan ${altModel} gagal:`, altErr.message);
        }
      }
      throw err;
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
