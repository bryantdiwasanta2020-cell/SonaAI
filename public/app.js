// SonaAI Frontend Logic
let currentConversationId = null;
let conversations = [];
let isVoiceCallActive = false;
let isSpeaking = false;
let isListening = false;
let speechRecognition = null;
let voices = [];
let currentUtterance = null;

// DOM Elements
const sidebar = document.getElementById('sidebar');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
const newChatBtn = document.getElementById('newChatBtn');
const searchConvInput = document.getElementById('searchConvInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const conversationsList = document.getElementById('conversationsList');
const dbStatusBadge = document.getElementById('dbStatusBadge');
const dbStatusDot = document.getElementById('dbStatusDot');
const dbStatusText = document.getElementById('dbStatusText');
const activeConvTitle = document.getElementById('activeConvTitle');
const exportChatBtn = document.getElementById('exportChatBtn');
const modelSelect = document.getElementById('modelSelect');
const startVoiceCallBtn = document.getElementById('startVoiceCallBtn');
const chatContainer = document.getElementById('chatContainer');
const welcomeHero = document.getElementById('welcomeHero');
const messagesStream = document.getElementById('messagesStream');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const micBtn = document.getElementById('micBtn');
const webSearchBtn = document.getElementById('webSearchBtn');
const sendBtn = document.getElementById('sendBtn');
const speechPreviewBar = document.getElementById('speechPreviewBar');
const speechPreviewText = document.getElementById('speechPreviewText');

// Preview Modal Elements
const previewModal = document.getElementById('previewModal');
const closePreviewBtn = document.getElementById('closePreviewBtn');
const previewTitle = document.getElementById('previewTitle');
const previewIframe = document.getElementById('previewIframe');

let isWebSearchActive = false;

// Voice Call Elements
const voiceCallOverlay = document.getElementById('voiceCallOverlay');
const closeVoiceCallBtn = document.getElementById('closeVoiceCallBtn');
const voiceOrbWrapper = document.getElementById('voiceOrbWrapper');
const voiceStatusBadge = document.getElementById('voiceStatusBadge');
const voiceBadgeText = document.getElementById('voiceBadgeText');
const voiceStatusSub = document.getElementById('voiceStatusSub');
const voiceStatusLabel = voiceStatusSub || voiceBadgeText; // backward compatibility
const voiceUserTranscript = document.getElementById('voiceUserTranscript');
const voiceAiTranscript = document.getElementById('voiceAiTranscript');
const callMicToggleBtn = document.getElementById('callMicToggleBtn');
const callInterruptBtn = document.getElementById('callInterruptBtn');
const callEndBtn = document.getElementById('callEndBtn');

// Settings Elements
const openSettingsBtn = document.getElementById('openSettingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const toggleApiKeyVisibility = document.getElementById('toggleApiKeyVisibility');
const databaseUrlInput = document.getElementById('databaseUrlInput');
const voiceSelect = document.getElementById('voiceSelect');
const voiceRate = document.getElementById('voiceRate');
const voiceRateVal = document.getElementById('voiceRateVal');
const autoSpeakCheck = document.getElementById('autoSpeakCheck');
const settingsFeedback = document.getElementById('settingsFeedback');

// Persistent auto-speak setting (default: false for silent chat mode)
if (autoSpeakCheck) {
  const savedAutoSpeak = localStorage.getItem('sona_auto_speak');
  autoSpeakCheck.checked = savedAutoSpeak === 'true'; // false by default
  autoSpeakCheck.addEventListener('change', () => {
    localStorage.setItem('sona_auto_speak', autoSpeakCheck.checked ? 'true' : 'false');
  });
}

// Feature Cards
const cardPromptVoice = document.getElementById('cardPromptVoice');
const cardPromptCloud = document.getElementById('cardPromptCloud');
const cardPromptPro = document.getElementById('cardPromptPro');

// Recommended US Female voices with natural career / executive presence
const CAREER_US_FEMALE_VOICES = [
  'samantha',
  'ava',
  'allison',
  'victoria',
  'susan',
  'zoe',
  'google us english',
  'jenny',
  'aria',
  'karen',
  'serena'
];

// 1. Initialize Speech Synthesis (Text to Speech)
function initTextToSpeech() {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech Synthesis tidak didukung oleh browser ini.');
    return;
  }

  // Restore saved voice rate and auto-speak
  const savedRate = localStorage.getItem('sona_voice_rate');
  if (savedRate && voiceRate) {
    voiceRate.value = savedRate;
    voiceRateVal.textContent = `${savedRate}x`;
  }
  const savedAutoSpeak = localStorage.getItem('sona_auto_speak');
  if (savedAutoSpeak !== null && autoSpeakCheck) {
    autoSpeakCheck.checked = savedAutoSpeak === 'true';
  }

  const loadVoices = () => {
    voices = window.speechSynthesis.getVoices();
    voiceSelect.innerHTML = '<option value="">Default Browser Voice (Auto)</option>';

    const savedVoiceName = localStorage.getItem('sona_voice') || '';

    // Classify and sort:
    // 1. Recommended US Female Career voices (Samantha, Ava, Allison, Victoria, Google US English)
    // 2. Indonesian voices
    // 3. Other English voices
    // 4. Other languages
    const getRank = (v) => {
      const nameLower = v.name.toLowerCase();
      const isCareerUsFemale = CAREER_US_FEMALE_VOICES.some(n => nameLower.includes(n)) && v.lang.startsWith('en');
      if (isCareerUsFemale) return 1;
      if (v.lang.includes('id')) return 2;
      if (v.lang.startsWith('en')) return 3;
      return 4;
    };

    const sorted = [...voices].sort((a, b) => getRank(a) - getRank(b));

    sorted.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v.name;
      const rank = getRank(v);
      if (rank === 1) {
        opt.textContent = `✨ ${v.name} (US Female - Karir & Elegan) ⭐`;
      } else if (rank === 2) {
        opt.textContent = `🇮🇩 ${v.name} (${v.lang})`;
      } else {
        opt.textContent = `${v.name} (${v.lang})`;
      }
      voiceSelect.appendChild(opt);
    });

    // Auto-select preferred voice: saved preference -> or first US Career female voice (Samantha / Ava)
    if (savedVoiceName && voices.some(v => v.name === savedVoiceName)) {
      voiceSelect.value = savedVoiceName;
    } else {
      const bestFemaleUs = sorted.find(v => getRank(v) === 1);
      if (bestFemaleUs) {
        voiceSelect.value = bestFemaleUs.name;
      }
    }
  };

  loadVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

// Detect whether text is primarily English or Indonesian
function detectTextLanguage(text) {
  if (!text) return currentSpeechLang.startsWith('en') ? 'en' : 'id';
  const clean = text.toLowerCase();
  const indoWords = /\b(yang|dan|di|ini|itu|dengan|untuk|tidak|saya|kamu|adalah|bisa|ada|dari|ke|akan|sudah|halo|bagaimana|apa|kenapa|mengapa|pagi|siang|sore|malam|baik|terima|kasih|oke|ya|nggak|bukan|hari|apakah|siapa|tentang|bagus|keren|buat|cara)\b/gi;
  const engWords = /\b(the|and|is|in|to|of|that|it|with|as|for|was|on|are|you|this|have|from|hello|hi|hey|how|what|why|when|where|who|good|morning|great|sure|can|will|yes|no|not|today|like|so|just|thank|thanks|welcome|voice|call|speak|english)\b/gi;

  const indoCount = (clean.match(indoWords) || []).length;
  const engCount = (clean.match(engWords) || []).length;

  if (engCount > indoCount) return 'en';
  if (indoCount > engCount) return 'id';
  return currentSpeechLang.startsWith('en') ? 'en' : 'id';
}

// Speak text using SpeechSynthesis with smart language matching
function speakText(text, onComplete = null) {
  if (!('speechSynthesis' in window)) {
    if (onComplete) onComplete();
    return;
  }

  stopSpeaking(); // stop any current audio

  // Clean emojis, markdown syntax, and URLs from text so TTS speaks only pure natural words
  const cleanAudioText = text
    .replace(/\p{Extended_Pictographic}/gu, '')  // Strip all emojis (e.g. 😊, 😁, ✨, 👍, 🍌)
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')       // Strip supplemental symbols & pictographs
    .replace(/[\u{2600}-\u{27EF}]/gu, '')        // Strip misc symbols and dingbats
    .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '')      // Strip skin tone modifiers
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')      // Strip country flag indicators
    .replace(/\uFE0F|\uFE0E/g, '')               // Strip emoji variation selectors
    .replace(/\u200D/g, '')                      // Strip zero-width joiner
    .replace(/```[\s\S]*?```/g, ' cuplikan kode ') // Handle code blocks
    .replace(/`[^`]+`/g, ' ')
    .replace(/[*#_~\[\]\(\)>]/g, ' ')
    .replace(/https?:\/\/\S+/g, ' tautan web ')
    .replace(/[•\-\+]\s+/g, ' ')
    .replace(/\s*([,.:;!?])\s*/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanAudioText) {
    if (onComplete) onComplete();
    return;
  }

  currentUtterance = new SpeechSynthesisUtterance(cleanAudioText);
  currentUtterance.rate = parseFloat(voiceRate.value) || 1.0;

  const detectedLang = detectTextLanguage(cleanAudioText);
  const selectedVoiceName = voiceSelect.value || localStorage.getItem('sona_voice');

  if (detectedLang === 'en') {
    // English text: Prioritize authentic US Career Female Voice (Samantha, Ava, Victoria, etc.)
    let chosen = null;
    if (selectedVoiceName) {
      chosen = voices.find(v => v.name === selectedVoiceName && v.lang.startsWith('en'));
    }
    if (!chosen) {
      chosen = voices.find(v => {
        const nameLower = v.name.toLowerCase();
        return CAREER_US_FEMALE_VOICES.some(n => nameLower.includes(n)) && v.lang.startsWith('en');
      }) || voices.find(v => v.lang.startsWith('en'));
    }
    if (chosen) {
      currentUtterance.voice = chosen;
      currentUtterance.lang = chosen.lang || 'en-US';
    }
  } else {
    // Indonesian text: Prioritize natural Indonesian Voice (Damayanti, Google Bahasa Indonesia, id-ID)
    const indoVoice = voices.find(v => v.lang.includes('id') || v.name.toLowerCase().includes('indonesia') || v.name.toLowerCase().includes('damayanti'));
    if (indoVoice) {
      currentUtterance.voice = indoVoice;
      currentUtterance.lang = indoVoice.lang || 'id-ID';
    } else if (selectedVoiceName) {
      const match = voices.find(v => v.name === selectedVoiceName);
      if (match) currentUtterance.voice = match;
    }
  }

  currentUtterance.onstart = () => {
    isSpeaking = true;
    updateSpeakingStateUI(true);
  };

  currentUtterance.onend = () => {
    isSpeaking = false;
    updateSpeakingStateUI(false);
    if (onComplete) onComplete();
  };

  currentUtterance.onerror = (e) => {
    console.warn('SpeechSynthesis error:', e);
    isSpeaking = false;
    updateSpeakingStateUI(false);
    if (onComplete) onComplete();
  };

  window.speechSynthesis.speak(currentUtterance);
}

function stopSpeaking() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  isSpeaking = false;
  updateSpeakingStateUI(false);
}

// Voice Stages & Lifecycle Controller: 'idle' | 'listening' | 'thinking' | 'speaking'
function setVoiceLifecycle(stage, subtitleText = '') {
  if (!voiceStatusBadge) return;

  voiceStatusBadge.className = `voice-status-badge stage-${stage}`;
  voiceOrbWrapper.classList.remove('listening', 'thinking', 'speaking');

  if (stage === 'listening') {
    voiceOrbWrapper.classList.add('listening');
    voiceBadgeText.textContent = 'Mendengarkan...';
    voiceStatusSub.textContent = subtitleText || 'Silakan bicara, jeda hening akan otomatis memproses';
  } else if (stage === 'thinking') {
    voiceOrbWrapper.classList.add('thinking');
    voiceBadgeText.textContent = 'Memproses & Berpikir...';
    voiceStatusSub.textContent = subtitleText || 'SonaAI sedang menganalisis jawaban...';
  } else if (stage === 'speaking') {
    voiceOrbWrapper.classList.add('speaking');
    voiceBadgeText.textContent = 'Sona Menjawab...';
    voiceStatusSub.textContent = subtitleText || 'Membacakan jawaban dengan suara...';
  } else {
    // idle
    voiceBadgeText.textContent = 'Tekan mic untuk berbicara';
    voiceStatusSub.textContent = subtitleText || 'SonaAI siap mendengarkan obrolan Anda';
  }
}

function updateSpeakingStateUI(active) {
  if (active) {
    setVoiceLifecycle('speaking');
  } else {
    if (isVoiceCallActive) {
      if (isListening) {
        setVoiceLifecycle('listening');
      } else {
        setVoiceLifecycle('idle');
      }
    }
  }

  // Update soundwave indicators in chat
  document.querySelectorAll('.btn-msg-audio').forEach(btn => {
    btn.classList.toggle('speaking', active && btn.dataset.speaking === 'true');
  });
}

// 2. Initialize Speech Recognition with VAD (Voice Activity Silence Detection)
let speechSilenceTimeout = null;
let currentRecognizedSpeech = '';
let accumulatedSpeech = '';
let isProcessingVoice = false;
let currentSpeechLang = localStorage.getItem('sona_speech_lang') || 'id-ID';
const SILENCE_TIMEOUT_MS = 1800; // 1.8s of silence lets users speak detailed sentences naturally with normal breathing

function updateSpeechLangUI() {
  document.querySelectorAll('.voice-lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentSpeechLang);
  });
  if (speechRecognition) {
    speechRecognition.lang = currentSpeechLang;
  }
}

function setSpeechLanguage(lang) {
  if (!lang || lang === currentSpeechLang) return;
  currentSpeechLang = lang;
  localStorage.setItem('sona_speech_lang', currentSpeechLang);
  updateSpeechLangUI();
  if (speechRecognition) {
    speechRecognition.lang = currentSpeechLang;
    if (isListening) {
      try {
        speechRecognition.stop();
      } catch (_) {}
      setTimeout(() => {
        if (isVoiceCallActive && !isSpeaking && !isProcessingVoice) {
          startListening();
        }
      }, 150);
    }
  }
}

function commitSpeechSubmission() {
  if (speechSilenceTimeout) {
    clearTimeout(speechSilenceTimeout);
    speechSilenceTimeout = null;
  }

  const soundwave = document.getElementById('voiceSoundwaveBars');
  if (soundwave) soundwave.classList.remove('active');

  if (isProcessingVoice) return;
  const textToSend = currentRecognizedSpeech.trim();
  if (!textToSend) return;

  currentRecognizedSpeech = '';
  accumulatedSpeech = '';
  isProcessingVoice = true;

  if (isVoiceCallActive) {
    // Immediately transform orb to THINKING state (YELLOW) without delay!
    const isEn = currentSpeechLang.startsWith('en');
    setVoiceLifecycle('thinking', isEn ? 'SonaAI is analyzing...' : 'Sedang berpikir...');
    try {
      if (speechRecognition) speechRecognition.stop();
    } catch (_) {}
    handleVoiceCallSubmit(textToSend);
  } else {
    stopListening();
    handleSendMessage(textToSend);
    isProcessingVoice = false;
  }
}

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.title = 'Speech Recognition tidak didukung di browser ini.';
    micBtn.disabled = true;
    return;
  }

  speechRecognition = new SpeechRecognition();
  speechRecognition.lang = currentSpeechLang;
  speechRecognition.continuous = true; // Keep listening continuously so user isn't cut off mid-thought
  speechRecognition.interimResults = true;

  speechRecognition.onstart = () => {
    // CRITICAL: Do NOT overwrite lifecycle if already thinking or speaking!
    if (isProcessingVoice || isSpeaking) return;

    isListening = true;
    micBtn.classList.add('active');
    callMicToggleBtn.classList.add('active');

    if (!isVoiceCallActive) {
      speechPreviewBar.classList.remove('hidden');
      speechPreviewText.textContent = 'Mendengarkan... Silakan bicara untuk mengetik';
    } else {
      const isEn = currentSpeechLang.startsWith('en');
      setVoiceLifecycle('listening', isEn ? 'Listening to your voice...' : 'Silakan bicara santai, jeda hening akan otomatis dijawab');
      if (!isProcessingVoice && (!voiceUserTranscript.textContent || voiceUserTranscript.textContent === '...')) {
        voiceUserTranscript.textContent = '';
      }
    }
  };

  speechRecognition.onresult = (event) => {
    let final = '';
    let interim = '';

    // Correctly accumulate both finalized chunks and active interim speech
    for (let i = 0; i < event.results.length; ++i) {
      const trans = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += trans + ' ';
      } else {
        interim += trans + ' ';
      }
    }

    const sessionText = (final + interim).trim();
    const liveText = accumulatedSpeech 
      ? (accumulatedSpeech + ' ' + sessionText).trim() 
      : sessionText;

    if (!liveText) return;

    currentRecognizedSpeech = liveText;

    if (isVoiceCallActive) {
      voiceUserTranscript.textContent = `"${currentRecognizedSpeech}"`;
      
      const soundwave = document.getElementById('voiceSoundwaveBars');
      if (soundwave) soundwave.classList.add('active');

      const isEn = currentSpeechLang.startsWith('en');
      setVoiceLifecycle('listening', isEn 
        ? 'Listening... pause to process' 
        : 'Mendengarkan... (berhenti bicara untuk memproses)');

      // Reset silence timer on every spoken word
      if (speechSilenceTimeout) {
        clearTimeout(speechSilenceTimeout);
      }

      // Auto-process once silence is detected for 1800ms
      speechSilenceTimeout = setTimeout(() => {
        if (soundwave) soundwave.classList.remove('active');
        commitSpeechSubmission();
      }, SILENCE_TIMEOUT_MS);
    } else {
      // In Chat Bar: Pure voice dictation into textarea (no aggressive auto-sending!)
      speechPreviewText.textContent = `🎙️ ${currentRecognizedSpeech}`;
      messageInput.value = currentRecognizedSpeech;
      autoResizeTextarea();

      if (speechSilenceTimeout) {
        clearTimeout(speechSilenceTimeout);
      }
      speechSilenceTimeout = setTimeout(() => {
        stopListening();
        speechPreviewText.textContent = 'Dikte selesai. Tekan tombol Kirim untuk mengirim.';
      }, 3500);
    }
  };

  speechRecognition.onerror = (event) => {
    console.warn('SpeechRecognition error:', event.error);
    const soundwave = document.getElementById('voiceSoundwaveBars');
    if (soundwave) soundwave.classList.remove('active');

    if (event.error !== 'no-speech') {
      stopListening();
    }
  };

  speechRecognition.onend = () => {
    isListening = false;
    micBtn.classList.remove('active');
    callMicToggleBtn.classList.remove('active');
    const soundwave = document.getElementById('voiceSoundwaveBars');
    if (soundwave) soundwave.classList.remove('active');

    // In Voice Call: do NOT cut off mid-speech when Chrome closes stream!
    // Save recognized words to accumulatedSpeech and keep listening active!
    if (isVoiceCallActive && !isSpeaking && !isProcessingVoice) {
      if (currentRecognizedSpeech) {
        accumulatedSpeech = currentRecognizedSpeech;
      }
      setTimeout(() => {
        if (isVoiceCallActive && !isSpeaking && !isProcessingVoice) {
          startListening();
        }
      }, 100);
    } else if (!isVoiceCallActive) {
      stopListening();
    }
  };
}

function startListening() {
  if (!speechRecognition) return;
  stopSpeaking(); // don't listen to SonaAI's own voice
  try {
    speechRecognition.start();
  } catch (_) {}
}

function stopListening() {
  isListening = false;
  micBtn.classList.remove('active');
  callMicToggleBtn.classList.remove('active');
  speechPreviewBar.classList.add('hidden');

  if (speechSilenceTimeout) {
    clearTimeout(speechSilenceTimeout);
    speechSilenceTimeout = null;
  }

  if (isVoiceCallActive) {
    if (!isSpeaking && !isProcessingVoice) {
      setVoiceLifecycle('idle');
    }
  }

  try {
    if (speechRecognition) speechRecognition.stop();
  } catch (_) {}
}

// 3. API & Data Handling
async function fetchSystemStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    // Database Badge
    if (data.db.connected) {
      dbStatusDot.className = 'status-dot active';
      dbStatusText.textContent = 'Cloud SQL: Connected (Postgres)';
      dbStatusBadge.title = data.db.message;
    } else {
      dbStatusDot.className = 'status-dot warning';
      dbStatusText.textContent = 'Cloud SQL: Ephemeral Safe';
      dbStatusBadge.title = data.db.message;
    }

    if (!data.ai.hasKey) {
      // Prompt user subtly if they haven't set an API key yet
      console.log('Gemini API key is not configured.');
    }
  } catch (err) {
    console.error('Gagal mengambil status:', err);
  }
}

async function loadConversations() {
  try {
    const res = await fetch('/api/conversations');
    conversations = await res.json();
    renderConversationsList();
  } catch (err) {
    console.error('Gagal memuat percakapan:', err);
    conversationsList.innerHTML = '<div class="conv-skeleton">Gagal memuat riwayat.</div>';
  }
}

function renderConversationsList() {
  conversationsList.innerHTML = '';
  if (conversations.length === 0) {
    conversationsList.innerHTML = '<div class="conv-skeleton">Belum ada obrolan.</div>';
    return;
  }

  const query = (searchConvInput?.value || '').trim().toLowerCase();
  let renderedCount = 0;

  conversations.forEach(conv => {
    const title = conv.title || 'Obrolan Baru';
    if (query && !title.toLowerCase().includes(query)) {
      return;
    }
    renderedCount++;

    const item = document.createElement('div');
    item.className = `conv-item ${conv.id === currentConversationId ? 'active' : ''}`;
    item.dataset.id = conv.id;

    const titleSpan = document.createElement('span');
    titleSpan.className = 'conv-title-text';
    titleSpan.textContent = title;

    const delBtn = document.createElement('button');
    delBtn.className = 'conv-delete-btn';
    delBtn.title = 'Hapus Obrolan';
    delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteConversation(conv.id);
    });

    item.appendChild(titleSpan);
    item.appendChild(delBtn);

    item.addEventListener('click', () => {
      selectConversation(conv.id, conv.title);
    });

    conversationsList.appendChild(item);
  });

  if (renderedCount === 0 && query) {
    conversationsList.innerHTML = '<div class="conv-skeleton">Tidak ada obrolan cocok.</div>';
  }
}

async function selectConversation(id, title) {
  currentConversationId = id;
  activeConvTitle.textContent = title || 'Obrolan';
  renderConversationsList();

  // On mobile, close sidebar
  sidebar.classList.remove('open');

  try {
    const res = await fetch(`/api/conversations/${id}/messages`);
    const messages = await res.json();
    renderMessages(messages);
  } catch (err) {
    console.error('Gagal memuat pesan:', err);
  }
}

async function deleteConversation(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus sesi obrolan ini dari database?')) return;
  try {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    conversations = conversations.filter(c => c.id !== id);
    if (currentConversationId === id) {
      startNewChat();
    } else {
      renderConversationsList();
    }
  } catch (err) {
    console.error('Gagal menghapus percakapan:', err);
  }
}

function startNewChat() {
  currentConversationId = null;
  activeConvTitle.textContent = 'Obrolan Baru';
  renderConversationsList();
  messagesStream.innerHTML = '';
  welcomeHero.classList.remove('hidden');
}

function renderMessages(messages) {
  messagesStream.innerHTML = '';
  if (!messages || messages.length === 0) {
    welcomeHero.classList.remove('hidden');
    return;
  }

  welcomeHero.classList.add('hidden');
  messages.forEach(msg => {
    appendMessageToStream(msg.role, msg.content, false);
  });
  scrollToBottom();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}

function openCodePreview(code, title = 'Sandbox Preview') {
  if (!previewModal) return;
  previewTitle.textContent = title;
  previewIframe.srcdoc = code;
  previewModal.classList.remove('hidden');
}

function closeCodePreview() {
  if (!previewModal) return;
  previewModal.classList.add('hidden');
  previewIframe.srcdoc = '';
}

function postProcessAiBubble(bubble, sources = []) {
  // Enhance code blocks with syntax highlighting & buttons
  const codeBlocks = bubble.querySelectorAll('pre code');
  codeBlocks.forEach(codeEl => {
    const preEl = codeEl.parentElement;
    if (!preEl || preEl.parentElement.classList.contains('code-block-container')) return;

    let lang = 'code';
    const classMatch = (codeEl.className || '').match(/language-([\w-]+)/);
    if (classMatch) {
      lang = classMatch[1];
    }

    if (window.hljs) {
      try {
        hljs.highlightElement(codeEl);
      } catch (e) {
        console.warn('Highlight failed:', e);
      }
    }

    const rawCode = codeEl.textContent;

    const container = document.createElement('div');
    container.className = 'code-block-container';

    const header = document.createElement('div');
    header.className = 'code-block-header';

    const langTag = document.createElement('span');
    langTag.className = 'code-lang-tag';
    langTag.textContent = lang;

    const actions = document.createElement('div');
    actions.className = 'code-actions';

    // HTML/SVG/XML live sandbox preview button
    if (['html', 'xml', 'svg'].includes(lang.toLowerCase())) {
      const previewBtn = document.createElement('button');
      previewBtn.type = 'button';
      previewBtn.className = 'btn-code-preview';
      previewBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        <span>Preview</span>
      `;
      previewBtn.addEventListener('click', () => {
        openCodePreview(rawCode, `${lang.toUpperCase()} Sandbox Preview`);
      });
      actions.appendChild(previewBtn);
    }

    // Copy code button
    const copyCodeBtn = document.createElement('button');
    copyCodeBtn.type = 'button';
    copyCodeBtn.className = 'btn-code-copy';
    copyCodeBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      <span>Salin Kode</span>
    `;
    copyCodeBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(rawCode).then(() => {
        copyCodeBtn.querySelector('span').textContent = 'Tersalin!';
        setTimeout(() => copyCodeBtn.querySelector('span').textContent = 'Salin Kode', 1800);
      });
    });
    actions.appendChild(copyCodeBtn);

    header.appendChild(langTag);
    header.appendChild(actions);

    preEl.parentNode.insertBefore(container, preEl);
    container.appendChild(header);
    container.appendChild(preEl);
  });

  // Render Grounding Sources if present
  if (sources && sources.length > 0) {
    const existing = bubble.querySelector('.grounding-sources-container');
    if (!existing) {
      const sourcesContainer = document.createElement('div');
      sourcesContainer.className = 'grounding-sources-container';

      const label = document.createElement('div');
      label.className = 'grounding-sources-label';
      label.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <span>Sumber Terkait (Google Search)</span>
      `;

      const pills = document.createElement('div');
      pills.className = 'grounding-pills';

      sources.slice(0, 5).forEach(src => {
        const a = document.createElement('a');
        a.className = 'grounding-pill';
        a.href = src.uri;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.title = src.title || src.uri;
        a.innerHTML = `
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          <span>${escapeHtml(src.title || src.uri)}</span>
        `;
        pills.appendChild(a);
      });

      sourcesContainer.appendChild(label);
      sourcesContainer.appendChild(pills);
      bubble.appendChild(sourcesContainer);
    }
  }
}

function appendMessageToStream(role, content, autoPlayAudio = false, sources = [], animateTypewriter = false) {
  welcomeHero.classList.add('hidden');

  const row = document.createElement('div');
  row.className = `message-row ${role === 'user' ? 'user' : 'ai'}`;

  if (role === 'user') {
    const bubble = document.createElement('div');
    bubble.className = 'user-bubble';
    bubble.textContent = content;
    row.appendChild(bubble);
  } else {
    const avatar = document.createElement('div');
    avatar.className = 'ai-avatar';
    avatar.textContent = 'Sona';

    const wrapper = document.createElement('div');
    wrapper.className = 'ai-bubble-wrapper';

    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble';

    const footer = document.createElement('div');
    footer.className = 'ai-bubble-footer';

    // Audio Play Button
    const audioBtn = document.createElement('button');
    audioBtn.className = 'btn-msg-audio';
    audioBtn.title = 'Dengarkan dengan Suara';
    audioBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
      <span>Dengarkan</span>
    `;

    audioBtn.addEventListener('click', () => {
      if (audioBtn.classList.contains('speaking')) {
        stopSpeaking();
        audioBtn.dataset.speaking = 'false';
      } else {
        document.querySelectorAll('.btn-msg-audio').forEach(b => b.dataset.speaking = 'false');
        audioBtn.dataset.speaking = 'true';
        speakText(content, () => {
          audioBtn.dataset.speaking = 'false';
        });
      }
    });

    // Copy Button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn-msg-copy';
    copyBtn.title = 'Salin Teks';
    copyBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      <span>Salin</span>
    `;
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(content).then(() => {
        copyBtn.querySelector('span').textContent = 'Tersalin!';
        setTimeout(() => copyBtn.querySelector('span').textContent = 'Salin', 1800);
      });
    });

    footer.appendChild(audioBtn);
    footer.appendChild(copyBtn);

    wrapper.appendChild(bubble);
    wrapper.appendChild(footer);

    row.appendChild(avatar);
    row.appendChild(wrapper);

    // If typewriter animation requested for live responses
    if (animateTypewriter && content.length > 5) {
      footer.style.opacity = '0';
      footer.style.pointerEvents = 'none';

      let charIndex = 0;
      const totalChars = content.length;

      // Pacing calibrated for buttery smoothness:
      // Short texts: 1 char per tick (~20ms) -> organic human-like typing
      // Medium texts: 1-2 chars per tick (~15ms)
      // Long texts: 2-3 chars per tick (~12ms) -> never gets boring or stuck
      const stepSize = totalChars > 1200 ? 3 : totalChars > 500 ? 2 : 1;
      const baseDelay = totalChars > 1200 ? 12 : totalChars > 500 ? 16 : 22;
      const cursorHtml = '<span class="typing-cursor"></span>';
      let isDone = false;
      let timerId = null;

      const finishTyping = () => {
        if (isDone) return;
        isDone = true;
        if (timerId) clearTimeout(timerId);

        if (window.marked) {
          bubble.innerHTML = marked.parse(content);
        } else {
          bubble.textContent = content;
        }

        postProcessAiBubble(bubble, sources);

        footer.style.opacity = '1';
        footer.style.pointerEvents = 'auto';
        bubble.style.cursor = 'default';
        bubble.title = '';
        scrollToBottom();

        if (autoPlayAudio && autoSpeakCheck && autoSpeakCheck.checked) {
          audioBtn.dataset.speaking = 'true';
          speakText(content, () => {
            audioBtn.dataset.speaking = 'false';
          });
        }
      };

      // Click bubble to finish instantly if user is in a hurry
      bubble.style.cursor = 'pointer';
      bubble.title = 'Klik untuk langsung menampilkan seluruh teks';
      bubble.addEventListener('click', () => {
        if (!isDone) finishTyping();
      }, { once: true });

      const typeNextSlice = () => {
        if (isDone) return;

        charIndex = Math.min(charIndex + stepSize, totalChars);
        const partialText = content.slice(0, charIndex);

        let rendered = window.marked ? marked.parse(partialText) : escapeHtml(partialText);

        // Keep cursor inline inside the last closing tag (e.g. </p>, </li>) so it never drops to a new line
        if (rendered.includes('</')) {
          rendered = rendered.replace(/(<\/(?:p|li|h[1-6]|div|span|blockquote|code)>\s*)$/i, `${cursorHtml}$1`);
        } else {
          rendered += cursorHtml;
        }

        bubble.innerHTML = rendered;
        scrollToBottom();

        if (charIndex >= totalChars) {
          finishTyping();
          return;
        }

        // Natural cadence with micro-pauses at punctuation marks
        let nextDelay = baseDelay;
        const lastChar = content[charIndex - 1];
        const nextChar = content[charIndex] || '';

        if (['.', '!', '?'].includes(lastChar) && (nextChar === ' ' || nextChar === '\n' || nextChar === '')) {
          nextDelay += 110; // Natural sentence breath pause
        } else if ([',', ';', ':'].includes(lastChar) && nextChar === ' ') {
          nextDelay += 55;  // Subtle clause pause
        } else if (lastChar === '\n') {
          nextDelay += 75;  // Paragraph break pause
        }

        timerId = setTimeout(typeNextSlice, nextDelay);
      };

      typeNextSlice();
    } else {
      // Instant render (history loads or short texts)
      if (window.marked) {
        bubble.innerHTML = marked.parse(content);
      } else {
        bubble.textContent = content;
      }
      postProcessAiBubble(bubble, sources);

      if (autoPlayAudio && autoSpeakCheck && autoSpeakCheck.checked) {
        audioBtn.dataset.speaking = 'true';
        speakText(content, () => {
          audioBtn.dataset.speaking = 'false';
        });
      }
    }
  }

  messagesStream.appendChild(row);
  scrollToBottom();
}

function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 4. Send Message Handler
async function handleSendMessage(text) {
  const message = text || messageInput.value.trim();
  if (!message) return;

  // Add user message to UI
  appendMessageToStream('user', message, false);
  messageInput.value = '';
  autoResizeTextarea();

  // Create loading placeholder for AI
  const loadingRow = document.createElement('div');
  loadingRow.className = 'message-row ai';
  loadingRow.id = 'aiLoadingRow';
  loadingRow.innerHTML = `
    <div class="ai-avatar">Sona</div>
    <div class="ai-bubble-wrapper">
      <div class="ai-bubble" style="color: var(--text-dim); display: flex; align-items: center; gap: 8px;">
        <span class="status-dot warning"></span> SonaAI sedang berpikir...
      </div>
    </div>
  `;
  messagesStream.appendChild(loadingRow);
  scrollToBottom();

  sendBtn.disabled = true;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: currentConversationId,
        message,
        model: modelSelect.value,
        webSearch: isWebSearchActive
      })
    });

    const data = await res.json();
    loadingRow.remove();

    if (data.error) {
      appendMessageToStream('model', `⚠️ Error: ${data.error}`, false);
      return;
    }

    // Update conversation state
    currentConversationId = data.conversationId;
    const shouldSpeak = autoSpeakCheck && autoSpeakCheck.checked;
    appendMessageToStream('model', data.reply, shouldSpeak, data.sources, true);

    // Refresh conversation list to get updated titles/times
    await loadConversations();
  } catch (err) {
    loadingRow.remove();
    appendMessageToStream('model', `⚠️ Gagal terhubung ke server SonaAI: ${err.message}`, false);
  } finally {
    sendBtn.disabled = false;
  }
}

// 5. Voice Call Mode Handler
function openVoiceCall() {
  isVoiceCallActive = true;
  isProcessingVoice = false;
  currentRecognizedSpeech = '';
  voiceCallOverlay.classList.remove('hidden');
  updateSpeechLangUI();
  const isEn = currentSpeechLang.startsWith('en');
  setVoiceLifecycle('listening', isEn 
    ? 'Listening... pause speaking to process answer' 
    : 'Silakan bicara, jeda hening akan otomatis memproses');
  voiceAiTranscript.textContent = isEn 
    ? '"Hello! I am SonaAI, how can I help you today?"' 
    : '"Halo! Saya SonaAI, mari mengobrol..."';
  voiceUserTranscript.textContent = '';
  startListening();
}

function closeVoiceCall() {
  isVoiceCallActive = false;
  isProcessingVoice = false;
  if (speechSilenceTimeout) {
    clearTimeout(speechSilenceTimeout);
    speechSilenceTimeout = null;
  }
  voiceCallOverlay.classList.add('hidden');
  stopListening();
  stopSpeaking();
  setVoiceLifecycle('idle');
}

async function handleVoiceCallSubmit(userSpeechText) {
  if (!userSpeechText || !userSpeechText.trim()) {
    isProcessingVoice = false;
    return;
  }

  isProcessingVoice = true;
  try {
    if (speechRecognition) speechRecognition.stop();
  } catch (_) {}

  const isEn = currentSpeechLang.startsWith('en');
  setVoiceLifecycle('thinking', isEn 
    ? 'SonaAI is analyzing & formulating a response...' 
    : 'Memproses & Berpikir... Sona sedang merangkai jawaban');
  voiceAiTranscript.innerHTML = `
    <div class="thinking-status-row">
      <span class="thinking-label">${isEn ? 'Sona is thinking' : 'Sedang berpikir'}</span>
      <span class="dot-typing"><span>.</span><span>.</span><span>.</span></span>
    </div>
  `;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: currentConversationId,
        message: userSpeechText,
        model: modelSelect.value,
        language: currentSpeechLang
      })
    });

    const data = await res.json();
    if (data.error) {
      voiceAiTranscript.textContent = `⚠️ ${data.error}`;
      setVoiceLifecycle('idle', `Error: ${data.error}`);
      isProcessingVoice = false;
      return;
    }

    currentConversationId = data.conversationId;

    // Render formatted markdown into structured HTML (matching chat formatting)!
    if (window.marked) {
      voiceAiTranscript.innerHTML = marked.parse(data.reply);
    } else {
      voiceAiTranscript.textContent = data.reply;
    }
    voiceAiTranscript.scrollTop = 0;

    // Stage 3: SPEAKING
    setVoiceLifecycle('speaking', isEn ? 'Sona is speaking...' : 'Sona Menjawab...');

    speakText(data.reply, () => {
      isProcessingVoice = false;
      if (isVoiceCallActive) {
        // Return seamlessly to Stage 1: LISTENING for uninterrupted hands-free conversation!
        setVoiceLifecycle('listening', isEn ? 'Listening... speak anytime' : 'Silakan bicara lagi, Sona siap mendengar...');
        voiceUserTranscript.textContent = '';
        startListening();
      } else {
        setVoiceLifecycle('idle');
      }
    });

    // Also sync with the main chat stream in background
    appendMessageToStream('user', userSpeechText, false);
    appendMessageToStream('model', data.reply, false);
    loadConversations();
  } catch (err) {
    voiceAiTranscript.textContent = `Gagal mengirim suara: ${err.message}`;
    setVoiceLifecycle('idle', 'Koneksi bermasalah.');
    isProcessingVoice = false;
  }
}

// Auto Resize Textarea
function autoResizeTextarea() {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 160) + 'px';
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  initTextToSpeech();
  initSpeechRecognition();
  fetchSystemStatus();
  loadConversations();

  // Mobile menu
  mobileMenuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
  sidebarToggleBtn.addEventListener('click', () => sidebar.classList.remove('open'));

  // New Chat
  newChatBtn.addEventListener('click', startNewChat);

  // Chat Form Submit
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSendMessage();
  });

  // Enter to send (Shift+Enter for newline)
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  messageInput.addEventListener('input', autoResizeTextarea);

  // Penyesuaian Keyboard Virtual di HP (Mobile Viewport Alignment)
  messageInput.addEventListener('focus', () => {
    setTimeout(() => {
      messageInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      scrollToBottom();
    }, 280);
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      if (document.activeElement === messageInput) {
        messageInput.scrollIntoView({ block: 'nearest' });
        scrollToBottom();
      }
    });
  }

  // Mic Button
  micBtn.addEventListener('click', () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  });

  // Voice Call Mode Triggers
  startVoiceCallBtn.addEventListener('click', openVoiceCall);
  closeVoiceCallBtn.addEventListener('click', closeVoiceCall);
  callEndBtn.addEventListener('click', closeVoiceCall);

  callMicToggleBtn.addEventListener('click', () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  });

  callInterruptBtn.addEventListener('click', () => {
    stopSpeaking();
    voiceStatusLabel.textContent = 'Suara dihentikan.';
  });

  // Send Now button (Immediate submission without waiting for 2.2s silence)
  const callSendNowBtn = document.getElementById('callSendNowBtn');
  if (callSendNowBtn) {
    callSendNowBtn.addEventListener('click', () => {
      if (currentRecognizedSpeech && currentRecognizedSpeech.trim()) {
        commitSpeechSubmission();
      } else {
        voiceStatusSub.textContent = currentSpeechLang.startsWith('en')
          ? 'Please speak first before sending...'
          : 'Silakan bicara terlebih dahulu...';
      }
    });
  }

  // Interactive Orb Click (Tap orb to send now or interrupt)
  if (voiceOrbWrapper) {
    voiceOrbWrapper.addEventListener('click', () => {
      if (isSpeaking) {
        stopSpeaking();
        startListening();
      } else if (isListening && currentRecognizedSpeech && currentRecognizedSpeech.trim()) {
        commitSpeechSubmission();
      } else if (!isListening && !isSpeaking && !isProcessingVoice) {
        startListening();
      }
    });
  }

  // Voice Call Language Selector (ID / EN)
  document.querySelectorAll('.voice-lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setSpeechLanguage(btn.dataset.lang);
    });
  });
  updateSpeechLangUI();

  // Settings Modal
  openSettingsBtn.addEventListener('click', () => {
    settingsFeedback.className = 'settings-feedback hidden';
    settingsModal.classList.remove('hidden');
  });

  closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
  cancelSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));

  toggleApiKeyVisibility.addEventListener('click', () => {
    const isPwd = apiKeyInput.type === 'password';
    apiKeyInput.type = isPwd ? 'text' : 'password';
    toggleApiKeyVisibility.textContent = isPwd ? 'Tutup' : 'Lihat';
  });

  voiceRate.addEventListener('input', () => {
    voiceRateVal.textContent = `${voiceRate.value}x`;
  });

  const testVoiceBtn = document.getElementById('testVoiceBtn');
  if (testVoiceBtn) {
    testVoiceBtn.addEventListener('click', () => {
      if (isSpeaking) {
        stopSpeaking();
        testVoiceBtn.classList.remove('testing');
        testVoiceBtn.querySelector('span').textContent = 'Tes Suara';
        return;
      }
      testVoiceBtn.classList.add('testing');
      testVoiceBtn.querySelector('span').textContent = 'Memutar...';

      const phrase = "Hello! I am Sona. I'm ready to assist you with intelligence, poise, and elegance.";
      speakText(phrase, () => {
        testVoiceBtn.classList.remove('testing');
        testVoiceBtn.querySelector('span').textContent = 'Tes Suara';
      });
    });
  }

  saveSettingsBtn.addEventListener('click', async () => {
    saveSettingsBtn.disabled = true;
    saveSettingsBtn.textContent = 'Menyimpan...';

    // Persist audio preferences to localStorage immediately
    if (voiceSelect && voiceSelect.value) {
      localStorage.setItem('sona_voice', voiceSelect.value);
    }
    if (voiceRate) {
      localStorage.setItem('sona_voice_rate', voiceRate.value);
    }
    if (autoSpeakCheck) {
      localStorage.setItem('sona_auto_speak', autoSpeakCheck.checked ? 'true' : 'false');
    }

    const payload = {};
    if (apiKeyInput.value.trim()) payload.geminiApiKey = apiKeyInput.value.trim();
    if (databaseUrlInput.value.trim()) payload.databaseUrl = databaseUrlInput.value.trim();

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      settingsFeedback.className = 'settings-feedback success';
      settingsFeedback.textContent = data.message || 'Pengaturan berhasil disimpan!';
      settingsFeedback.classList.remove('hidden');

      fetchSystemStatus();
      setTimeout(() => {
        settingsModal.classList.add('hidden');
        saveSettingsBtn.disabled = false;
        saveSettingsBtn.textContent = 'Simpan Pengaturan';
      }, 1200);
    } catch (err) {
      settingsFeedback.className = 'settings-feedback error';
      settingsFeedback.textContent = 'Gagal menyimpan pengaturan: ' + err.message;
      settingsFeedback.classList.remove('hidden');
      saveSettingsBtn.disabled = false;
      saveSettingsBtn.textContent = 'Simpan Pengaturan';
    }
  });

  // Feature Card Quick Prompts
  cardPromptVoice.addEventListener('click', openVoiceCall);

  cardPromptCloud.addEventListener('click', () => {
    openSettingsBtn.click();
  });

  cardPromptPro.addEventListener('click', () => {
    modelSelect.value = 'gemini-3.1-flash-lite';
    messageInput.value = 'Jelaskan kemampuan penalaran tingkat tinggimu dan apa yang bisa kamu bantu.';
    messageInput.focus();
    autoResizeTextarea();
  });

  // Export Current Chat to Markdown
  async function exportCurrentChat() {
    if (!currentConversationId) {
      alert('Belum ada sesi obrolan yang sedang aktif untuk diekspor.');
      return;
    }

    try {
      const res = await fetch(`/api/conversations/${currentConversationId}/messages`);
      const messages = await res.json();
      if (!messages || messages.length === 0) {
        alert('Obrolan ini belum memiliki pesan untuk diekspor.');
        return;
      }

      const currentTitle = activeConvTitle.textContent || 'Obrolan SonaAI';
      const timestamp = new Date().toLocaleString('id-ID');

      let markdown = `# 💬 SonaAI - ${currentTitle}\n\n`;
      markdown += `> **Waktu Ekspor:** ${timestamp}  \n`;
      markdown += `> **Model:** ${modelSelect.value}  \n`;
      markdown += `> **Database:** Cloud PostgreSQL (Supabase)  \n\n`;
      markdown += `---\n\n`;

      messages.forEach((msg, idx) => {
        const isUser = msg.role === 'user';
        const roleName = isUser ? '👤 Pengguna' : '🤖 SonaAI';
        const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
        
        markdown += `### ${roleName} ${timeStr ? `(${timeStr})` : ''}\n\n`;
        markdown += `${msg.content}\n\n`;
        if (idx < messages.length - 1) {
          markdown += `---\n\n`;
        }
      });

      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = currentTitle.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 32);
      a.download = `SonaAI_${safeTitle}_${Date.now()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Gagal mengekspor obrolan: ' + err.message);
    }
  }

  if (exportChatBtn) {
    exportChatBtn.addEventListener('click', exportCurrentChat);
  }

  // Web Search Grounding Toggle
  if (webSearchBtn) {
    webSearchBtn.addEventListener('click', () => {
      isWebSearchActive = !isWebSearchActive;
      webSearchBtn.classList.toggle('active', isWebSearchActive);
      webSearchBtn.title = isWebSearchActive
        ? 'Pencarian Web Google: AKTIF (Jawaban didukung info internet terkini)'
        : 'Pencarian Web Google: NONAKTIF (Klik untuk mengaktifkan)';
    });
  }

  // Conversation Search Filter in Sidebar
  if (searchConvInput) {
    searchConvInput.addEventListener('input', () => {
      const q = searchConvInput.value.trim();
      if (clearSearchBtn) {
        clearSearchBtn.classList.toggle('hidden', q.length === 0);
      }
      renderConversationsList();
    });

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        searchConvInput.value = '';
        clearSearchBtn.classList.add('hidden');
        renderConversationsList();
        searchConvInput.focus();
      });
    }
  }

  // Code Live Preview Sandbox Modal Listeners
  if (closePreviewBtn) {
    closePreviewBtn.addEventListener('click', closeCodePreview);
  }

  if (previewModal) {
    previewModal.addEventListener('click', (e) => {
      if (e.target === previewModal) {
        closeCodePreview();
      }
    });
  }

  // Interactive Hover & Voice Greeting for Hero Logo
  const heroInteractiveLogo = document.getElementById('heroInteractiveLogo');
  const heroLogoImg = document.getElementById('heroLogoImg');

  if (heroInteractiveLogo) {
    heroInteractiveLogo.addEventListener('click', () => {
      heroInteractiveLogo.classList.add('clicking');
      setTimeout(() => heroInteractiveLogo.classList.remove('clicking'), 400);

      const greetings = [
        "Hai! Aku Sona. Ada yang bisa kubantu hari ini?",
        "Halo! Senang bertemu denganmu. Mau ngobrol atau ada tugas yang ingin kukerjakan?",
        "Hai! Aku siap membantumu, silakan ketik pesan atau klik tombol suara ya!"
      ];
      const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
      speakText(randomGreeting);
    });
  }
});
