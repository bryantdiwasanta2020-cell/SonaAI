// SonaAI Frontend Logic - Anonymous Device Session Engine (Opsi A)
function getOrCreateUserId() {
  let uid = localStorage.getItem('sona_user_id');
  if (!uid) {
    uid = 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('sona_user_id', uid);
  }
  return uid;
}
const currentUserId = getOrCreateUserId();

let currentConversationId = null;
let conversations = [];
let isVoiceCallActive = false;
let isSpeaking = false;
let isListening = false;
let speechRecognition = null;
let voices = [];
let currentUtterance = null;

// === Siri Crystal Orb Reactive Animation Engine ===
let speakingVisualizerRAF = null;
let userSpeakingTimeout = null;

function setOrbUserSpeaking(active) {
  const wrapper = document.getElementById('voiceOrbWrapper');
  const soundwave = document.getElementById('voiceSoundwaveBars');
  if (!wrapper) return;

  if (active) {
    wrapper.classList.add('user-speaking');
    if (soundwave) soundwave.classList.add('active');
    if (userSpeakingTimeout) clearTimeout(userSpeakingTimeout);
    userSpeakingTimeout = setTimeout(() => {
      setOrbUserSpeaking(false);
    }, 850);
  } else {
    wrapper.classList.remove('user-speaking');
    if (soundwave && !isListening) soundwave.classList.remove('active');
  }
}

function startSpeakingOrbPulse() {
  if (speakingVisualizerRAF) cancelAnimationFrame(speakingVisualizerRAF);
  const voiceOrb = document.getElementById('voiceOrb');
  const orbAura = document.getElementById('orbAuraGlow');
  let t = 0;

  function pulse() {
    if (!isSpeaking) {
      resetOrbAmplitude();
      return;
    }
    t += 0.05;
    const amp = 0.5 + 0.5 * Math.sin(t);
    const scale = 1 + amp * 0.08;
    if (voiceOrb) voiceOrb.style.transform = `scale(${scale.toFixed(3)})`;
    if (orbAura) {
      const blur = 46 + amp * 20;
      orbAura.style.filter = `blur(${blur.toFixed(1)}px) brightness(${(1.15 + amp * 0.45).toFixed(2)})`;
      orbAura.style.opacity = (0.85 + amp * 0.15).toFixed(2);
    }
    speakingVisualizerRAF = requestAnimationFrame(pulse);
  }
  pulse();
}

function resetOrbAmplitude() {
  const voiceOrb = document.getElementById('voiceOrb');
  const orbAura = document.getElementById('orbAuraGlow');
  const wrapper = document.getElementById('voiceOrbWrapper');
  if (voiceOrb) voiceOrb.style.transform = '';
  if (orbAura) {
    orbAura.style.filter = '';
    orbAura.style.opacity = '';
  }
  if (wrapper) wrapper.classList.remove('user-speaking');
}

function stopOrbVisualizer() {
  if (speakingVisualizerRAF) {
    cancelAnimationFrame(speakingVisualizerRAF);
    speakingVisualizerRAF = null;
  }
  if (userSpeakingTimeout) {
    clearTimeout(userSpeakingTimeout);
    userSpeakingTimeout = null;
  }
  resetOrbAmplitude();
}

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
const scrollBottomBtn = document.getElementById('scrollBottomBtn');
let userHasScrolledUp = false;

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
const groqApiKeyInput = document.getElementById('groqApiKeyInput');
const toggleGroqKeyVisibility = document.getElementById('toggleGroqKeyVisibility');
const openrouterApiKeyInput = document.getElementById('openrouterApiKeyInput');
const toggleOpenRouterKeyVisibility = document.getElementById('toggleOpenRouterKeyVisibility');
const databaseUrlInput = document.getElementById('databaseUrlInput');
const voiceSelect = document.getElementById('voiceSelect');
const voiceRate = document.getElementById('voiceRate');
const voiceRateVal = document.getElementById('voiceRateVal');
const autoSpeakCheck = document.getElementById('autoSpeakCheck');
const settingsFeedback = document.getElementById('settingsFeedback');
const voiceModelPill = document.getElementById('voiceModelPill');
const voiceModelName = document.getElementById('voiceModelName');

// Persistent auto-speak setting (default: false for silent chat mode)
if (autoSpeakCheck) {
  const savedAutoSpeak = localStorage.getItem('sona_auto_speak');
  autoSpeakCheck.checked = savedAutoSpeak === 'true'; // false by default
  autoSpeakCheck.addEventListener('change', () => {
    localStorage.setItem('sona_auto_speak', autoSpeakCheck.checked ? 'true' : 'false');
  });
}

// Auth & Guest Trial DOM Elements
const guestCounterPill = document.getElementById('guestCounterPill');
const guestCountText = document.getElementById('guestCountText');
const openAuthBtn = document.getElementById('openAuthBtn');
const userProfilePill = document.getElementById('userProfilePill');
const userAvatar = document.getElementById('userAvatar');
const userNameDisplay = document.getElementById('userNameDisplay');
const logoutBtn = document.getElementById('logoutBtn');
const guestLimitBanner = document.getElementById('guestLimitBanner');
const guestBannerLoginBtn = document.getElementById('guestBannerLoginBtn');

const authModal = document.getElementById('authModal');
const closeAuthBtn = document.getElementById('closeAuthBtn');
const tabLoginBtn = document.getElementById('tabLoginBtn');
const tabRegisterBtn = document.getElementById('tabRegisterBtn');
const googleAuthBtn = document.getElementById('googleAuthBtn');
const googleAuthBtnText = document.getElementById('googleAuthBtnText');
const authForm = document.getElementById('authForm');
const authEmailInput = document.getElementById('authEmailInput');
const authPasswordInput = document.getElementById('authPasswordInput');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authSubmitText = document.getElementById('authSubmitText');
const authFeedback = document.getElementById('authFeedback');
const authModalTitle = document.getElementById('authModalTitle');
const authModalSubtitle = document.getElementById('authModalSubtitle');

// Auth & Guest State
let supabaseClient = null;
let currentUser = null;
const MAX_GUEST_CHATS = 2;
let guestChatCount = parseInt(localStorage.getItem('sona_guest_chats') || '0', 10);
let isRegisterMode = false;

try {
  const savedUserJson = localStorage.getItem('sona_user');
  if (savedUserJson) currentUser = JSON.parse(savedUserJson);
} catch (_) {}

function getActiveUserId() {
  if (currentUser && currentUser.id) return currentUser.id;
  return currentUserId;
}

function updateGuestUI() {
  if (currentUser) {
    if (guestCounterPill) guestCounterPill.classList.add('hidden');
    if (openAuthBtn) openAuthBtn.classList.add('hidden');
    if (userProfilePill) {
      userProfilePill.classList.remove('hidden');
      if (userNameDisplay) userNameDisplay.textContent = currentUser.name || (currentUser.email ? currentUser.email.split('@')[0] : 'Akun Saya');
      if (userAvatar) {
        if (currentUser.avatar) {
          userAvatar.innerHTML = `<img src="${currentUser.avatar}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">`;
        } else {
          userAvatar.textContent = (currentUser.name || currentUser.email || 'U')[0].toUpperCase();
        }
      }
    }
    if (guestLimitBanner) guestLimitBanner.classList.add('hidden');
    if (sendBtn) sendBtn.disabled = false;
    if (messageInput) messageInput.placeholder = 'Ketik pesan untuk Sona...';
  } else {
    if (userProfilePill) userProfilePill.classList.add('hidden');
    if (openAuthBtn) openAuthBtn.classList.remove('hidden');
    if (guestCounterPill) {
      guestCounterPill.classList.remove('hidden');
      const remaining = Math.max(0, MAX_GUEST_CHATS - guestChatCount);
      if (remaining > 0) {
        guestCounterPill.classList.remove('limit-reached');
        if (guestCountText) guestCountText.textContent = `${remaining} Kuota Tamu`;
        if (guestLimitBanner) guestLimitBanner.classList.add('hidden');
        if (messageInput) messageInput.placeholder = 'Ketik pesan untuk Sona...';
      } else {
        guestCounterPill.classList.add('limit-reached');
        if (guestCountText) guestCountText.textContent = 'Batas Tamu';
        if (guestLimitBanner) guestLimitBanner.classList.remove('hidden');
        if (messageInput) messageInput.placeholder = 'Batas kuota tamu tercapai. Masuk untuk melanjutkan...';
      }
    }
  }
}

function openAuthModal(customSubtitle = null) {
  if (!authModal) return;
  authModal.classList.remove('hidden');
  if (authFeedback) {
    authFeedback.classList.add('hidden');
    authFeedback.textContent = '';
  }
  if (customSubtitle && authModalSubtitle) {
    authModalSubtitle.textContent = customSubtitle;
  } else if (authModalSubtitle) {
    authModalSubtitle.textContent = isRegisterMode 
      ? 'Daftar sekarang untuk chat tanpa batas & simpan riwayat di Cloud.'
      : 'Masuk untuk obrolan tanpa batas & simpan riwayat di Cloud.';
  }
  if (authEmailInput) authEmailInput.focus();
}

function closeAuthModal() {
  if (!authModal) return;
  authModal.classList.add('hidden');
  if (authFeedback) authFeedback.classList.add('hidden');
}

function setAuthMode(register) {
  isRegisterMode = register;
  if (tabLoginBtn) tabLoginBtn.classList.toggle('active', !isRegisterMode);
  if (tabRegisterBtn) tabRegisterBtn.classList.toggle('active', isRegisterMode);
  if (authModalTitle) authModalTitle.textContent = isRegisterMode ? 'Buat Akun SonaAI' : 'Lanjutkan Bersama SonaAI';
  if (authModalSubtitle) authModalSubtitle.textContent = isRegisterMode 
    ? 'Daftar sekarang untuk chat tanpa batas & simpan riwayat di Cloud.'
    : 'Masuk untuk obrolan tanpa batas & simpan riwayat di Cloud.';
  if (authSubmitText) authSubmitText.textContent = isRegisterMode ? 'Daftar Akun Baru' : 'Masuk ke SonaAI';
  if (authFeedback) authFeedback.classList.add('hidden');
}

function handleUserLoggedIn(user) {
  currentUser = user;
  localStorage.setItem('sona_user', JSON.stringify(user));
  updateGuestUI();
  closeAuthModal();
  loadConversations();
}

function checkHashForAuth() {
  try {
    if (window.location.hash && window.location.hash.includes('access_token=')) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      if (accessToken) {
        const payloadBase64 = accessToken.split('.')[1];
        const decoded = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        const user = {
          id: decoded.sub,
          email: decoded.email,
          name: decoded.user_metadata?.full_name || decoded.user_metadata?.name || (decoded.email ? decoded.email.split('@')[0] : 'Pengguna Google'),
          avatar: decoded.user_metadata?.avatar_url || decoded.user_metadata?.picture || null
        };
        handleUserLoggedIn(user);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        return true;
      }
    }
  } catch (err) {
    console.error('Failed to parse access token from hash:', err);
  }
  return false;
}

// Immediate hash parse check on script load
checkHashForAuth();

function handleUserLoggedOut() {
  currentUser = null;
  localStorage.removeItem('sona_user');
  if (supabaseClient) {
    try { supabaseClient.auth.signOut(); } catch (_) {}
  }
  updateGuestUI();
  loadConversations();
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

// Helper to score Indonesian voice fidelity (prefer Neural / Online / Google / Enhanced voices over raspy compact voices)
function getIndoVoiceScore(v) {
  if (!v) return -1;
  const name = (v.name || '').toLowerCase();
  const lang = (v.lang || '').toLowerCase();
  const isIndo = lang.includes('id') || name.includes('indonesia') || name.includes('damayanti');
  if (!isIndo) return -1;

  let score = 20;
  if (name.includes('natural') || name.includes('online')) score += 100; // Edge Natural (Gadis / Ardi)
  if (name.includes('google')) score += 80;                              // Chrome Google Bahasa Indonesia (Neural Online)
  if (name.includes('enhanced') || name.includes('premium')) score += 60; // Apple Damayanti (Enhanced / Premium)
  if (name.includes('siri')) score += 50;
  if (name.includes('compact')) score -= 15;                             // Old formant synthesizer with mechanical tremor
  return score;
}

// Split long text into natural sentence chunks to prevent audio buffer jitter & Chrome 15s freeze
function splitTextIntoSentences(text) {
  if (!text) return [];
  const normalized = text.trim();
  const rawParts = normalized.split(/(?<=[.!?;\n])\s+/);
  const chunks = [];
  let buffer = '';

  for (const part of rawParts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (buffer && (buffer.length + trimmed.length < 130)) {
      buffer += ' ' + trimmed;
    } else {
      if (buffer) chunks.push(buffer);
      buffer = trimmed;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks.length > 0 ? chunks : [normalized];
}

// Global speech queue tracking
let isSpeechQueueActive = false;

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
    // 1. Indonesian voices (Highest fidelity first: Google/Natural -> Enhanced -> Compact)
    // 2. Recommended US Female Career voices (Samantha, Ava, Allison, Victoria, Google US English)
    // 3. Other English voices
    // 4. Other languages
    const getRank = (v) => {
      const indoScore = getIndoVoiceScore(v);
      if (indoScore > 0) return 1 - (indoScore / 200); // 0.4 to 0.9 (highest priority for Indonesian users)
      const nameLower = v.name.toLowerCase();
      const isCareerUsFemale = CAREER_US_FEMALE_VOICES.some(n => nameLower.includes(n)) && v.lang.startsWith('en');
      if (isCareerUsFemale) return 2;
      if (v.lang.startsWith('en')) return 3;
      return 4;
    };

    const sorted = [...voices].sort((a, b) => getRank(a) - getRank(b));

    sorted.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v.name;
      const indoScore = getIndoVoiceScore(v);
      const nameLower = v.name.toLowerCase();
      const isCareerUsFemale = CAREER_US_FEMALE_VOICES.some(n => nameLower.includes(n)) && v.lang.startsWith('en');

      if (indoScore >= 70) {
        opt.textContent = `${v.name} (Bahasa Indonesia - Jernih)`;
      } else if (indoScore > 0) {
        if (nameLower.includes('compact')) {
          opt.textContent = `${v.name} (Bahasa Indonesia - Standar)`;
        } else {
          opt.textContent = `${v.name} (${v.lang})`;
        }
      } else if (isCareerUsFemale) {
        opt.textContent = `${v.name} (English US - Natural)`;
      } else {
        opt.textContent = `${v.name} (${v.lang})`;
      }
      voiceSelect.appendChild(opt);
    });

    // Auto-select preferred voice: saved preference -> or highest fidelity Indo voice -> or US Career female
    if (savedVoiceName && voices.some(v => v.name === savedVoiceName)) {
      voiceSelect.value = savedVoiceName;
    } else {
      const bestIndo = sorted.find(v => getIndoVoiceScore(v) >= 70);
      const fallbackIndo = sorted.find(v => getIndoVoiceScore(v) > 0);
      const bestFemaleUs = sorted.find(v => {
        const nameLower = v.name.toLowerCase();
        return CAREER_US_FEMALE_VOICES.some(n => nameLower.includes(n)) && v.lang.startsWith('en');
      });

      if (bestIndo) {
        voiceSelect.value = bestIndo.name;
      } else if (bestFemaleUs) {
        voiceSelect.value = bestFemaleUs.name;
      } else if (fallbackIndo) {
        voiceSelect.value = fallbackIndo.name;
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

// Speak text using SpeechSynthesis with smart sentence chunking & smooth voice selection
function speakText(text, onComplete = null) {
  if (!('speechSynthesis' in window)) {
    if (onComplete) onComplete();
    return;
  }

  stopSpeaking(); // stop any current audio & clear queue

  // Clean emojis, markdown syntax, and URLs from text so TTS speaks only pure natural words
  const cleanAudioText = text
    .replace(/\p{Extended_Pictographic}/gu, '')  // Strip all emojis
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')       // Strip supplemental symbols
    .replace(/[\u{2600}-\u{27EF}]/gu, '')        // Strip misc symbols
    .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '')      // Strip skin tone modifiers
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')      // Strip country flag indicators
    .replace(/\uFE0F|\uFE0E/g, '')               // Strip variation selectors
    .replace(/\u200D/g, '')                      // Strip zero-width joiner
    .replace(/```[\s\S]*?```/g, ' cuplikan kode ')
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

  // Split into natural sentence chunks to eliminate audio buffer jitter & stutter
  const chunks = splitTextIntoSentences(cleanAudioText);
  if (!chunks.length) {
    if (onComplete) onComplete();
    return;
  }

  const detectedLang = detectTextLanguage(cleanAudioText);
  const selectedVoiceName = voiceSelect.value || localStorage.getItem('sona_voice');
  let chosenVoice = null;

  if (detectedLang === 'en') {
    // English text: Prioritize authentic US Career Female Voice (Samantha, Ava, Victoria, etc.)
    if (selectedVoiceName) {
      chosenVoice = voices.find(v => v.name === selectedVoiceName && v.lang.startsWith('en'));
    }
    if (!chosenVoice) {
      chosenVoice = voices.find(v => {
        const nameLower = v.name.toLowerCase();
        return CAREER_US_FEMALE_VOICES.some(n => nameLower.includes(n)) && v.lang.startsWith('en');
      }) || voices.find(v => v.lang.startsWith('en'));
    }
  } else {
    // Indonesian text: Prioritize natural neural/enhanced voices over raspy compact ones
    if (selectedVoiceName) {
      const match = voices.find(v => v.name === selectedVoiceName);
      if (match && getIndoVoiceScore(match) > 0) {
        chosenVoice = match;
      }
    }
    if (!chosenVoice) {
      const indoVoices = voices.filter(v => getIndoVoiceScore(v) > 0);
      indoVoices.sort((a, b) => getIndoVoiceScore(b) - getIndoVoiceScore(a));
      chosenVoice = indoVoices[0] || voices.find(v => v.lang.includes('id')) || null;
    }
  }

  isSpeaking = true;
  isSpeechQueueActive = true;
  updateSpeakingStateUI(true);

  let chunkIndex = 0;

  function speakNextChunk() {
    if (!isSpeechQueueActive) return;

    if (chunkIndex >= chunks.length) {
      isSpeaking = false;
      isSpeechQueueActive = false;
      updateSpeakingStateUI(false);
      if (onComplete) onComplete();
      return;
    }

    const currentChunkText = chunks[chunkIndex];
    chunkIndex++;

    const utter = new SpeechSynthesisUtterance(currentChunkText);
    currentUtterance = utter;

    // Rate & Pitch stabilization:
    // Fixed pitch of 1.0 prevents the annoying robotic tremor/vibrato
    utter.rate = parseFloat(voiceRate.value) || 1.0;
    utter.pitch = 1.0;

    if (chosenVoice) {
      utter.voice = chosenVoice;
      utter.lang = chosenVoice.lang || (detectedLang === 'en' ? 'en-US' : 'id-ID');
    }

    utter.onend = () => {
      if (isSpeechQueueActive) {
        speakNextChunk();
      }
    };

    utter.onerror = (e) => {
      console.warn('SpeechSynthesis chunk error:', e);
      if (isSpeechQueueActive) {
        speakNextChunk();
      }
    };

    window.speechSynthesis.speak(utter);
  }

  speakNextChunk();
}

function stopSpeaking() {
  isSpeechQueueActive = false;
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
    // Start dynamic speaking pulse on the orb
    if (isVoiceCallActive) startSpeakingOrbPulse();
  } else {
    // Stop speaking pulse
    if (speakingVisualizerRAF) {
      cancelAnimationFrame(speakingVisualizerRAF);
      speakingVisualizerRAF = null;
    }
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

  speechRecognition.onsoundstart = () => {
    if (isVoiceCallActive && isListening && !isSpeaking) {
      setOrbUserSpeaking(true);
    }
  };

  speechRecognition.onspeechstart = () => {
    if (isVoiceCallActive && isListening && !isSpeaking) {
      setOrbUserSpeaking(true);
    }
  };

  speechRecognition.onspeechend = () => {
    if (isVoiceCallActive) {
      setOrbUserSpeaking(false);
    }
  };

  speechRecognition.onsoundend = () => {
    if (isVoiceCallActive) {
      setOrbUserSpeaking(false);
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
      setOrbUserSpeaking(true);
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
        setOrbUserSpeaking(false);
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
    setOrbUserSpeaking(false);

    if (event.error === 'no-speech') {
      // Just normal pause in conversation, do not stop listening
      return;
    }

    if (event.error === 'aborted') {
      // Temporary interruption, restart smoothly if voice call is active
      if (isVoiceCallActive && !isSpeaking && !isProcessingVoice) {
        setTimeout(() => {
          if (isVoiceCallActive && !isSpeaking && !isProcessingVoice) {
            startListening();
          }
        }, 200);
      }
      return;
    }

    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      const msg = 'Izin mikrofon belum diberikan atau diblokir. Harap izinkan akses mikrofon di ikon browser Anda.';
      if (isVoiceCallActive) {
        setVoiceLifecycle('idle', msg);
        if (voiceAiTranscript) voiceAiTranscript.textContent = `⚠️ ${msg}`;
      } else {
        speechPreviewText.textContent = `⚠️ ${msg}`;
      }
      stopListening();
      return;
    }

    if (event.error === 'network' || event.error === 'service-not-allowed') {
      console.warn('SpeechRecognition network/service issue, switching to Media Voice Recording...');
      if (isVoiceCallActive && !isSpeaking && !isProcessingVoice) {
        stopListening();
        startMediaVoiceRecording();
        return;
      }
      const msg = 'Koneksi jaringan terputus untuk Speech Recognition.';
      if (isVoiceCallActive) {
        setVoiceLifecycle('idle', msg);
      }
      stopListening();
      return;
    }

    if (event.error === 'audio-capture') {
      const msg = 'Mikrofon tidak terdeteksi atau sedang dipakai aplikasi lain.';
      if (isVoiceCallActive) {
        setVoiceLifecycle('idle', msg);
      }
      stopListening();
      return;
    }

    if (isVoiceCallActive && !isSpeaking && !isProcessingVoice) {
      stopListening();
      startMediaVoiceRecording();
      return;
    }

    stopListening();
  };

  speechRecognition.onend = () => {
    isListening = false;
    micBtn.classList.remove('active');
    callMicToggleBtn.classList.remove('active');
    setOrbUserSpeaking(false);
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

    // Initialize Supabase Client if credentials are provided
    if (window.supabase && data.supabase && data.supabase.url && data.supabase.anonKey) {
      if (!supabaseClient) {
        supabaseClient = window.supabase.createClient(data.supabase.url, data.supabase.anonKey);
        
        supabaseClient.auth.onAuthStateChange((event, session) => {
          if (session?.user) {
            handleUserLoggedIn({
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
              avatar: session.user.user_metadata?.avatar_url || null
            });
          } else if (event === 'SIGNED_OUT') {
            handleUserLoggedOut();
          }
        });

        // Check active session
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            handleUserLoggedIn({
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
              avatar: session.user.user_metadata?.avatar_url || null
            });
          }
        }).catch(() => {});
      }
    }

    // Check if user redirected back with OAuth error
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const oauthError = urlParams.get('error_description') || urlParams.get('error') || hashParams.get('error_description');
    if (oauthError) {
      console.warn('OAuth Return Error:', oauthError);
      setTimeout(() => {
        openAuthModal();
        if (authFeedback) {
          authFeedback.className = 'auth-feedback error';
          authFeedback.textContent = decodeURIComponent(oauthError.replace(/\+/g, ' '));
          authFeedback.classList.remove('hidden');
        }
      }, 400);
    }

    // Update UI for Guest / Logged in
    updateGuestUI();

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
    const res = await fetch('/api/conversations', {
      headers: { 'x-user-id': getActiveUserId() }
    });
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
  if (!confirm('Apakah Anda yakin ingin menghapus sesi obrolan ini?')) return;
  try {
    await fetch(`/api/conversations/${id}`, {
      method: 'DELETE',
      headers: { 'x-user-id': getActiveUserId() }
    });
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
  userHasScrolledUp = false;
  updateScrollPillVisibility();

  if (!messages || messages.length === 0) {
    welcomeHero.classList.remove('hidden');
    return;
  }

  welcomeHero.classList.add('hidden');
  messages.forEach(msg => {
    appendMessageToStream(msg.role, msg.content, false);
  });
  scrollToBottom(true);
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

function isScrolledNearBottom(threshold = 20) {
  if (!chatContainer) return true;
  const distanceFromBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight;
  return distanceFromBottom <= threshold;
}

function updateScrollPillVisibility() {
  if (!scrollBottomBtn) return;
  if (userHasScrolledUp) {
    scrollBottomBtn.classList.remove('hidden');
  } else {
    scrollBottomBtn.classList.add('hidden');
  }
}

function scrollToBottom(force = false) {
  if (!chatContainer) return;
  // If user has intentionally scrolled up to read and force is false, NEVER force scroll
  if (!force && userHasScrolledUp) {
    return;
  }
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 1. Listen for explicit user scroll input (Wheel on mouse / Trackpad)
if (chatContainer) {
  chatContainer.addEventListener('wheel', (e) => {
    if (e.deltaY < -1) {
      // User is scrolling UP to read earlier text
      userHasScrolledUp = true;
      updateScrollPillVisibility();
    } else if (e.deltaY > 1 && isScrolledNearBottom(25)) {
      // User scrolled all the way back down to the bottom
      userHasScrolledUp = false;
      updateScrollPillVisibility();
    }
  }, { passive: true });

  // 2. Touch support for mobile / touch devices
  let touchStartY = 0;
  chatContainer.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches[0]) {
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  chatContainer.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) {
      const deltaY = e.touches[0].clientY - touchStartY;
      if (deltaY > 10) {
        // Dragging down = scrolling up
        userHasScrolledUp = true;
        updateScrollPillVisibility();
      } else if (deltaY < -10 && isScrolledNearBottom(25)) {
        userHasScrolledUp = false;
        updateScrollPillVisibility();
      }
    }
  }, { passive: true });

  // 3. Scrollbar dragging / generic scroll
  chatContainer.addEventListener('scroll', () => {
    if (isScrolledNearBottom(20)) {
      userHasScrolledUp = false;
      updateScrollPillVisibility();
    } else {
      const dist = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight;
      if (dist > 35) {
        userHasScrolledUp = true;
        updateScrollPillVisibility();
      }
    }
  }, { passive: true });
}

if (scrollBottomBtn) {
  scrollBottomBtn.addEventListener('click', () => {
    userHasScrolledUp = false;
    updateScrollPillVisibility();
    if (chatContainer) {
      chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: 'smooth'
      });
    }
  });
}

// 4. Send Message Handler
let isSendingMessage = false;

async function handleSendMessage(text) {
  if (isSendingMessage) return; // Anti-spam: cegah pengiriman ganda bersamaan
  const message = text || messageInput.value.trim();
  if (!message) return;

  // Guest Gate: Batasi 2 obrolan gratis untuk pengguna tanpa akun
  if (!currentUser && guestChatCount >= MAX_GUEST_CHATS) {
    openAuthModal('Batas 2 chat gratis Anda telah tercapai. Masuk atau buat akun gratis untuk melanjutkan tanpa batas!');
    return;
  }

  isSendingMessage = true;

  // Reset scroll state on user input so view jumps to the new message
  userHasScrolledUp = false;
  updateScrollPillVisibility();

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
  scrollToBottom(true);

  sendBtn.disabled = true;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': getActiveUserId()
      },
      body: JSON.stringify({
        conversationId: currentConversationId,
        userId: getActiveUserId(),
        message,
        model: modelSelect.value,
        apiKey: localStorage.getItem('sona_gemini_key') || undefined,
        groqApiKey: localStorage.getItem('sona_groq_key') || undefined,
        openrouterApiKey: localStorage.getItem('sona_openrouter_key') || undefined,
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

    // Guest Trial Tracking
    if (!currentUser) {
      guestChatCount++;
      localStorage.setItem('sona_guest_chats', guestChatCount);
      updateGuestUI();
      if (guestChatCount >= MAX_GUEST_CHATS) {
        setTimeout(() => {
          openAuthModal('Kamu telah menggunakan 2 chat gratis sebagai tamu! Masuk atau daftar akun gratis sekarang untuk obrolan tanpa batas & simpan riwayat di Cloud.');
        }, 1200);
      }
    }
  } catch (err) {
    loadingRow.remove();
    appendMessageToStream('model', `⚠️ Gagal terhubung ke server SonaAI: ${err.message}`, false);
  } finally {
    isSendingMessage = false;
    sendBtn.disabled = false;
  }
}

// === Universal MediaRecorder Multimodal Voice Engine (Firefox, Safari, & Fallback) ===
let mediaRecorder = null;
let mediaRecorderStream = null;
let recordedAudioChunks = [];
let mediaRecorderMimeType = 'audio/webm';
let vadAudioContext = null;
let vadSource = null;
let vadAnalyser = null;
let vadRAF = null;
let vadSilenceTimer = null;
let hasSpokenInRecording = false;
let isRecordingMedia = false;

function hasNativeSTT() {
  // Safari's webkitSpeechRecognition is brittle with continuous speech,
  // requires macOS Dictation to be enabled in System Settings, and halts on auto-restart.
  // Safari and Firefox both provide first-class native MediaRecorder with Gemini Multimodal Voice!
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  if (isSafari) return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function ensureAudioContextRunning() {
  try {
    if (!vadAudioContext) {
      vadAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (vadAudioContext.state === 'suspended') {
      vadAudioContext.resume();
    }
  } catch (e) {
    console.warn('AudioContext init error:', e);
  }
}

let vadHighpass = null;
let vadLowpass = null;

function startVADAudioVisualizer(stream) {
  try {
    ensureAudioContextRunning();

    if (vadSource) {
      try { vadSource.disconnect(); } catch (_) {}
      vadSource = null;
    }
    if (vadHighpass) {
      try { vadHighpass.disconnect(); } catch (_) {}
      vadHighpass = null;
    }
    if (vadLowpass) {
      try { vadLowpass.disconnect(); } catch (_) {}
      vadLowpass = null;
    }

    vadSource = vadAudioContext.createMediaStreamSource(stream);

    // 1. Highpass filter @ 160Hz: completely cuts off laptop chassis vibration & low fan motor hum (<160Hz)
    vadHighpass = vadAudioContext.createBiquadFilter();
    vadHighpass.type = 'highpass';
    vadHighpass.frequency.value = 160;

    // 2. Lowpass filter @ 3500Hz: cuts off high-frequency air hiss and typing clicks (>3500Hz)
    vadLowpass = vadAudioContext.createBiquadFilter();
    vadLowpass.type = 'lowpass';
    vadLowpass.frequency.value = 3500;

    vadAnalyser = vadAudioContext.createAnalyser();
    vadAnalyser.fftSize = 256;
    vadAnalyser.smoothingTimeConstant = 0.45;

    // Connect source -> highpass -> lowpass -> analyser
    vadSource.connect(vadHighpass);
    vadHighpass.connect(vadLowpass);
    vadLowpass.connect(vadAnalyser);

    const freqData = new Uint8Array(vadAnalyser.frequencyBinCount);
    const timeData = new Uint8Array(vadAnalyser.fftSize);
    const voiceOrb = document.getElementById('voiceOrb');
    const orbAura = document.getElementById('orbAuraGlow');

    if (vadRAF) {
      cancelAnimationFrame(vadRAF);
      vadRAF = null;
    }

    let consecutiveSpeechFrames = 0;
    let hasSpokenInThisTurn = false;
    let lastSpokenTime = 0;
    let isSubmittingThisTurn = false;
    // Dynamic noise floor tracking: adapts to laptop fan noise in real time
    let dynamicNoiseFloor = 0.014;

    function checkAudio() {
      if (!isRecordingMedia || !isVoiceCallActive || isSubmittingThisTurn) {
        resetOrbAmplitude();
        return;
      }

      vadAnalyser.getByteFrequencyData(freqData);
      vadAnalyser.getByteTimeDomainData(timeData);

      // Measure isolated vocal formants (bins 2 to 22 correspond to ~180Hz - 3800Hz)
      let voiceSum = 0;
      let voicePeak = 0;
      const binStart = 2;
      const binEnd = Math.min(22, freqData.length);
      for (let i = binStart; i <= binEnd; i++) {
        const val = freqData[i];
        voiceSum += val;
        if (val > voicePeak) voicePeak = val;
      }
      const voiceAvg = voiceSum / (binEnd - binStart + 1);

      // Measure RMS volume
      let rmsSum = 0;
      for (let i = 0; i < timeData.length; i++) {
        const val = (timeData[i] - 128) / 128;
        rmsSum += val * val;
      }
      const rms = Math.sqrt(rmsSum / timeData.length); // 0..1

      // Adaptively track laptop fan noise floor when quiet
      if (rms < dynamicNoiseFloor * 1.8) {
        dynamicNoiseFloor = dynamicNoiseFloor * 0.95 + rms * 0.05;
      }

      // Voice is detected ONLY when volume distinctly exceeds the fan noise floor!
      const speechRmsThreshold = Math.max(0.024, dynamicNoiseFloor * 2.3);
      const isVoiceActive = rms > speechRmsThreshold && (voicePeak > 20 || voiceAvg > 7);

      const voiceNorm = Math.min(Math.max((rms - dynamicNoiseFloor) * 4.5, voiceAvg / 75), 1);
      const isEn = currentSpeechLang.startsWith('en');

      if (isVoiceActive) {
        consecutiveSpeechFrames++;
        if (consecutiveSpeechFrames >= 2) {
          hasSpokenInThisTurn = true;
          hasSpokenInRecording = true;
          lastSpokenTime = Date.now();

          setOrbUserSpeaking(true);
          const soundwave = document.getElementById('voiceSoundwaveBars');
          if (soundwave) soundwave.classList.add('active');

          // Dynamic crystal sphere pulse reacting to user's real voice
          const scale = 1 + Math.min(voiceNorm * 0.18, 0.22);
          if (voiceOrb) voiceOrb.style.transform = `scale(${scale.toFixed(3)})`;
          if (orbAura) {
            const blur = 44 + voiceNorm * 30;
            orbAura.style.filter = `blur(${blur.toFixed(1)}px) brightness(${(1.2 + voiceNorm * 0.6).toFixed(2)})`;
            orbAura.style.opacity = (0.82 + voiceNorm * 0.18).toFixed(2);
          }

          if (voiceUserTranscript && (!voiceUserTranscript.textContent || voiceUserTranscript.textContent.includes('...'))) {
            voiceUserTranscript.textContent = isEn ? '🎙️ Listening to your words...' : '🎙️ Mendengarkan ucapan Anda...';
          }
          voiceStatusSub.textContent = isEn 
            ? 'Speaking... (pause to auto-answer)' 
            : 'Sedang berbicara... (berhenti bicara untuk otomatis dijawab)';
        }
      } else {
        // Quiet frame (laptop fan noise ignored)
        consecutiveSpeechFrames = 0;
        setOrbUserSpeaking(false);
        const soundwave = document.getElementById('voiceSoundwaveBars');
        if (soundwave) soundwave.classList.remove('active');

        // Check for silence after user has spoken
        if (hasSpokenInThisTurn && lastSpokenTime > 0) {
          const silenceDuration = Date.now() - lastSpokenTime;

          if (silenceDuration >= 350) {
            voiceStatusSub.textContent = isEn 
              ? 'Silence detected... formulating response' 
              : 'Jeda hening terdeteksi... bersiap menjawab';
          }

          // AUTOMATIC SWITCH TO THINKING AFTER 1.2 SECONDS OF SILENCE!
          if (silenceDuration >= 1200 && !isSubmittingThisTurn) {
            isSubmittingThisTurn = true;
            stopMediaVoiceRecordingAndSubmit();
            return;
          }
        }
      }

      vadRAF = requestAnimationFrame(checkAudio);
    }

    checkAudio();
  } catch (err) {
    console.warn('VAD Audio Error:', err);
  }
}

async function startMediaVoiceRecording() {
  if (isSpeaking || isProcessingVoice) return;
  stopSpeaking();
  recordedAudioChunks = [];
  hasSpokenInRecording = false;

  try {
    ensureAudioContextRunning();

    if (!mediaRecorderStream || !mediaRecorderStream.active) {
      // Hardware DSP filters: actively suppress laptop fan noise, acoustic echo, and automatic gain
      mediaRecorderStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });
    }

    let mimeType = 'audio/webm';
    if (!MediaRecorder.isTypeSupported('audio/webm')) {
      if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
      else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) mimeType = 'audio/ogg;codecs=opus';
      else mimeType = '';
    }
    mediaRecorderMimeType = mimeType || 'audio/webm';

    mediaRecorder = new MediaRecorder(mediaRecorderStream, mimeType ? { mimeType } : undefined);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedAudioChunks.push(e.data);
      }
    };

    mediaRecorder.start(200);
    isRecordingMedia = true;
    isListening = true;
    callMicToggleBtn.classList.add('active');

    const isEn = currentSpeechLang.startsWith('en');
    setVoiceLifecycle('listening', isEn 
      ? 'Listening... (Speak naturally, silence will auto-send)' 
      : 'Mendengarkan... (Silakan bicara santai, jeda hening akan otomatis dijawab)');

    startVADAudioVisualizer(mediaRecorderStream);
  } catch (err) {
    console.error('Mic Access Error:', err);
    setVoiceLifecycle('idle', 'Gagal mengakses mikrofon.');
    if (voiceAiTranscript) {
      voiceAiTranscript.textContent = '⚠️ Akses mikrofon ditolak atau tidak tersedia. Harap izinkan akses mikrofon di ikon gembok browser Anda.';
    }
  }
}

function stopMediaVoiceRecordingAndSubmit() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

  if (vadSilenceTimer) {
    clearTimeout(vadSilenceTimer);
    vadSilenceTimer = null;
  }
  if (vadRAF) {
    cancelAnimationFrame(vadRAF);
    vadRAF = null;
  }

  isRecordingMedia = false;
  isListening = false;
  callMicToggleBtn.classList.remove('active');
  setOrbUserSpeaking(false);
  resetOrbAmplitude();

  const isEn = currentSpeechLang.startsWith('en');
  setVoiceLifecycle('thinking', isEn ? 'Sona is listening & analyzing...' : 'Sedang mendengarkan & merangkai jawaban...');

  voiceAiTranscript.innerHTML = `
    <div class="thinking-status-row">
      <span class="thinking-label">${isEn ? 'Sona is analyzing your voice' : 'Sona sedang memproses suara Anda'}</span>
      <span class="dot-typing"><span>.</span><span>.</span><span>.</span></span>
    </div>
  `;

  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(recordedAudioChunks, { type: mediaRecorderMimeType });
    recordedAudioChunks = [];

    if (audioBlob.size < 600) {
      // Too short / empty click
      if (isVoiceCallActive) {
        setVoiceLifecycle('listening', isEn ? 'Speak again anytime...' : 'Suara terlalu singkat, silakan bicara lagi...');
        setTimeout(() => {
          if (isVoiceCallActive && !isSpeaking && !isProcessingVoice) {
            startMediaVoiceRecording();
          }
        }, 400);
      }
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result.split(',')[1];
      await handleMediaVoiceSubmit(base64Data, audioBlob.type || mediaRecorderMimeType);
    };
    reader.readAsDataURL(audioBlob);
  };

  try {
    mediaRecorder.stop();
  } catch (_) {}
}

async function handleMediaVoiceSubmit(audioBase64, mimeType) {
  if (!currentUser && guestChatCount >= MAX_GUEST_CHATS) {
    closeVoiceCall();
    openAuthModal('Batas 2 chat gratis Anda telah tercapai. Masuk atau buat akun gratis untuk melanjutkan tanpa batas!');
    isProcessingVoice = false;
    return;
  }

  isProcessingVoice = true;
  const isEn = currentSpeechLang.startsWith('en');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': getActiveUserId()
      },
      body: JSON.stringify({
        conversationId: currentConversationId,
        userId: getActiveUserId(),
        audioBase64,
        audioMimeType: mimeType,
        model: modelSelect.value,
        apiKey: localStorage.getItem('sona_gemini_key') || undefined,
        groqApiKey: localStorage.getItem('sona_groq_key') || undefined,
        openrouterApiKey: localStorage.getItem('sona_openrouter_key') || undefined,
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

    // Display user's exact words on the Voice Call screen
    if (data.userTranscription && data.userTranscription.trim()) {
      voiceUserTranscript.textContent = `"${data.userTranscription.trim()}"`;
    }

    if (window.marked) {
      voiceAiTranscript.innerHTML = marked.parse(data.reply);
    } else {
      voiceAiTranscript.textContent = data.reply;
    }
    voiceAiTranscript.scrollTop = 0;

    // Track guest trial
    if (!currentUser) {
      guestChatCount++;
      localStorage.setItem('sona_guest_chats', guestChatCount);
      updateGuestUI();
    }

    // Stage 3: SPEAKING
    setVoiceLifecycle('speaking', isEn ? 'Sona is speaking...' : 'Sona Menjawab...');

    speakText(data.reply, () => {
      isProcessingVoice = false;
      if (isVoiceCallActive) {
        if (!currentUser && guestChatCount >= MAX_GUEST_CHATS) {
          closeVoiceCall();
          openAuthModal('Batas 2 obrolan gratis telah selesai. Masuk untuk melanjutkan panggilan suara tanpa batas!');
          return;
        }
        setVoiceLifecycle('listening', isEn ? 'Listening... speak anytime' : 'Silakan bicara lagi, Sona siap mendengar...');
        if (voiceUserTranscript) voiceUserTranscript.textContent = '';
        setTimeout(() => {
          if (isVoiceCallActive && !isSpeaking && !isProcessingVoice) {
            startMediaVoiceRecording();
          }
        }, 300);
      } else {
        setVoiceLifecycle('idle');
      }
    });

    // Also sync with the main chat stream with transcribed text
    const userBubbleText = (data.userTranscription && data.userTranscription.trim())
      ? `🎙️ "${data.userTranscription.trim()}"`
      : '🎙️ [Pesan Suara]';
    appendMessageToStream('user', userBubbleText, false);
    appendMessageToStream('model', data.reply, false);
    loadConversations();
  } catch (err) {
    voiceAiTranscript.textContent = `Gagal mengirim suara: ${err.message}`;
    setVoiceLifecycle('idle', 'Koneksi bermasalah.');
    isProcessingVoice = false;
  }
}

function stopMediaRecording() {
  if (vadSilenceTimer) {
    clearTimeout(vadSilenceTimer);
    vadSilenceTimer = null;
  }
  if (vadRAF) {
    cancelAnimationFrame(vadRAF);
    vadRAF = null;
  }
  if (vadSource) {
    try { vadSource.disconnect(); } catch (_) {}
    vadSource = null;
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop(); } catch (_) {}
  }
  if (mediaRecorderStream) {
    try {
      mediaRecorderStream.getTracks().forEach(t => t.stop());
    } catch (_) {}
    mediaRecorderStream = null;
  }
  isRecordingMedia = false;
  recordedAudioChunks = [];
}

async function handleSendAudioMessage(audioBase64, mimeType) {
  if (!currentUser && guestChatCount >= MAX_GUEST_CHATS) {
    openAuthModal('Batas 2 chat gratis Anda telah tercapai. Masuk atau buat akun gratis untuk melanjutkan tanpa batas!');
    return;
  }

  sendBtn.disabled = true;
  appendMessageToStream('user', '🎙️ [Pesan Suara]', false);
  const loadingRow = appendLoadingIndicator();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': getActiveUserId()
      },
      body: JSON.stringify({
        conversationId: currentConversationId,
        userId: getActiveUserId(),
        audioBase64,
        audioMimeType: mimeType,
        model: modelSelect.value,
        apiKey: localStorage.getItem('sona_gemini_key') || undefined,
        groqApiKey: localStorage.getItem('sona_groq_key') || undefined,
        openrouterApiKey: localStorage.getItem('sona_openrouter_key') || undefined,
        language: currentSpeechLang
      })
    });
    const data = await res.json();
    loadingRow.remove();

    if (data.error) {
      appendMessageToStream('model', `⚠️ Error: ${data.error}`, false);
      return;
    }
    currentConversationId = data.conversationId;
    const shouldSpeak = autoSpeakCheck && autoSpeakCheck.checked;
    appendMessageToStream('model', data.reply, shouldSpeak, data.sources, true);

    if (!currentUser) {
      guestChatCount++;
      localStorage.setItem('sona_guest_chats', guestChatCount);
      updateGuestUI();
    }
    await loadConversations();
  } catch (err) {
    loadingRow.remove();
    appendMessageToStream('model', `⚠️ Gagal terhubung ke server: ${err.message}`, false);
  } finally {
    sendBtn.disabled = false;
  }
}

// 5. Voice Call Mode Handler
function openVoiceCall() {
  if (!currentUser && guestChatCount >= MAX_GUEST_CHATS) {
    openAuthModal('Mode Panggilan Suara 3D interaktif eksklusif untuk pengguna terdaftar. Masuk atau buat akun gratis sekarang!');
    return;
  }

  isVoiceCallActive = true;
  isProcessingVoice = false;
  currentRecognizedSpeech = '';
  accumulatedSpeech = '';
  voiceCallOverlay.classList.remove('hidden');
  updateSpeechLangUI();
  const isEn = currentSpeechLang.startsWith('en');

  voiceAiTranscript.textContent = isEn 
    ? '"Hello! I am SonaAI, how can I help you today?"' 
    : '"Halo! Saya SonaAI, mari mengobrol..."';
  voiceUserTranscript.textContent = '';

  if (hasNativeSTT()) {
    setVoiceLifecycle('listening', isEn 
      ? 'Listening... pause speaking to process answer' 
      : 'Silakan bicara, jeda hening akan otomatis memproses');
    startListening();
  } else {
    // Safari, Firefox, & Modern Multimodal MediaRecorder Voice Mode
    setVoiceLifecycle('listening', isEn
      ? 'Listening... (Speak naturally, silence will auto-send)'
      : 'Mendengarkan... (Silakan bicara santai, jeda hening / ketuk bola kristal untuk kirim)');
    startMediaVoiceRecording();
  }
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
  stopMediaRecording();
  stopSpeaking();
  stopOrbVisualizer();
  setVoiceLifecycle('idle');
}

async function handleVoiceCallSubmit(userSpeechText) {
  if (!userSpeechText || !userSpeechText.trim()) {
    isProcessingVoice = false;
    return;
  }

  if (!currentUser && guestChatCount >= MAX_GUEST_CHATS) {
    closeVoiceCall();
    openAuthModal('Batas 2 chat gratis Anda telah tercapai. Masuk atau buat akun gratis untuk melanjutkan tanpa batas!');
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
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': getActiveUserId()
      },
      body: JSON.stringify({
        conversationId: currentConversationId,
        userId: getActiveUserId(),
        message: userSpeechText,
        model: modelSelect.value,
        apiKey: localStorage.getItem('sona_gemini_key') || undefined,
        groqApiKey: localStorage.getItem('sona_groq_key') || undefined,
        openrouterApiKey: localStorage.getItem('sona_openrouter_key') || undefined,
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

    // Track guest trial
    if (!currentUser) {
      guestChatCount++;
      localStorage.setItem('sona_guest_chats', guestChatCount);
      updateGuestUI();
    }

    // Stage 3: SPEAKING
    setVoiceLifecycle('speaking', isEn ? 'Sona is speaking...' : 'Sona Menjawab...');

    speakText(data.reply, () => {
      isProcessingVoice = false;
      if (isVoiceCallActive) {
        if (!currentUser && guestChatCount >= MAX_GUEST_CHATS) {
          closeVoiceCall();
          openAuthModal('Batas 2 obrolan gratis telah selesai. Masuk untuk melanjutkan panggilan suara tanpa batas!');
          return;
        }
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

  // Mic Button (Chat Bar Input)
  let chatMediaRecorder = null;
  let chatAudioChunks = [];
  let isChatRecording = false;

  micBtn.addEventListener('click', async () => {
    if (!currentUser && guestChatCount >= MAX_GUEST_CHATS) {
      openAuthModal('Batas 2 chat gratis Anda telah tercapai. Masuk atau buat akun gratis untuk melanjutkan tanpa batas!');
      return;
    }

    if (hasNativeSTT()) {
      if (isListening) {
        stopListening();
      } else {
        startListening();
      }
      return;
    }

    // Firefox & Fallback Audio Recording Mode
    if (!isChatRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1
          }
        });
        chatAudioChunks = [];
        let mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported('audio/webm')) {
          if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) mimeType = 'audio/ogg;codecs=opus';
          else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
          else mimeType = '';
        }
        chatMediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        chatMediaRecorder.ondataavailable = e => {
          if (e.data && e.data.size > 0) chatAudioChunks.push(e.data);
        };
        chatMediaRecorder.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(chatAudioChunks, { type: chatMediaRecorder.mimeType || mimeType || 'audio/webm' });
          if (blob.size > 1200) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64Data = reader.result.split(',')[1];
              handleSendAudioMessage(base64Data, blob.type || 'audio/webm');
            };
            reader.readAsDataURL(blob);
          }
        };
        chatMediaRecorder.start();
        isChatRecording = true;
        micBtn.classList.add('active');
        speechPreviewBar.classList.remove('hidden');
        speechPreviewText.textContent = '🔴 Merekam suara... Klik lagi tombol mic untuk mengirim pesan suara ke Sona';
      } catch (err) {
        alert('Gagal mengakses mikrofon di Firefox. Harap izinkan akses mikrofon di ikon gembok Firefox.');
      }
    } else {
      isChatRecording = false;
      micBtn.classList.remove('active');
      speechPreviewBar.classList.add('hidden');
      if (chatMediaRecorder && chatMediaRecorder.state !== 'inactive') {
        chatMediaRecorder.stop();
      }
    }
  });

  // Voice Call Mode Triggers
  startVoiceCallBtn.addEventListener('click', () => {
    ensureAudioContextRunning();
    openVoiceCall();
  });
  closeVoiceCallBtn.addEventListener('click', closeVoiceCall);
  callEndBtn.addEventListener('click', closeVoiceCall);

  callMicToggleBtn.addEventListener('click', () => {
    ensureAudioContextRunning();
    if (hasNativeSTT()) {
      if (isListening) {
        stopListening();
      } else {
        startListening();
      }
    } else {
      // Safari / Firefox / MediaRecorder
      if (isRecordingMedia) {
        stopMediaRecording();
        setVoiceLifecycle('idle', 'Mikrofon dijeda. Tekan mic untuk mulai bicara lagi.');
        callMicToggleBtn.classList.remove('active');
      } else if (!isProcessingVoice && !isSpeaking) {
        startMediaVoiceRecording();
      }
    }
  });

  callInterruptBtn.addEventListener('click', () => {
    stopSpeaking();
    voiceStatusLabel.textContent = 'Suara dihentikan.';
  });

  // Send Now button (Immediate submission without waiting for silence)
  const callSendNowBtn = document.getElementById('callSendNowBtn');
  if (callSendNowBtn) {
    callSendNowBtn.addEventListener('click', () => {
      if (!hasNativeSTT()) {
        if (isRecordingMedia) {
          stopMediaVoiceRecordingAndSubmit();
        }
        return;
      }
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
      ensureAudioContextRunning();
      if (isSpeaking) {
        stopSpeaking();
        if (hasNativeSTT()) {
          startListening();
        } else {
          startMediaVoiceRecording();
        }
      } else if (!hasNativeSTT()) {
        if (isRecordingMedia) {
          stopMediaVoiceRecordingAndSubmit();
        } else if (!isProcessingVoice) {
          startMediaVoiceRecording();
        }
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
    if (apiKeyInput && !apiKeyInput.value) {
      apiKeyInput.value = localStorage.getItem('sona_gemini_key') || '';
    }
    if (groqApiKeyInput && !groqApiKeyInput.value) {
      groqApiKeyInput.value = localStorage.getItem('sona_groq_key') || '';
    }
    if (openrouterApiKeyInput && !openrouterApiKeyInput.value) {
      openrouterApiKeyInput.value = localStorage.getItem('sona_openrouter_key') || '';
    }
    settingsModal.classList.remove('hidden');
  });

  closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
  cancelSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));

  toggleApiKeyVisibility.addEventListener('click', () => {
    const isPwd = apiKeyInput.type === 'password';
    apiKeyInput.type = isPwd ? 'text' : 'password';
    toggleApiKeyVisibility.textContent = isPwd ? 'Tutup' : 'Lihat';
  });

  if (toggleGroqKeyVisibility && groqApiKeyInput) {
    toggleGroqKeyVisibility.addEventListener('click', () => {
      const isPwd = groqApiKeyInput.type === 'password';
      groqApiKeyInput.type = isPwd ? 'text' : 'password';
      toggleGroqKeyVisibility.textContent = isPwd ? 'Tutup' : 'Lihat';
    });
  }

  if (toggleOpenRouterKeyVisibility && openrouterApiKeyInput) {
    toggleOpenRouterKeyVisibility.addEventListener('click', () => {
      const isPwd = openrouterApiKeyInput.type === 'password';
      openrouterApiKeyInput.type = isPwd ? 'text' : 'password';
      toggleOpenRouterKeyVisibility.textContent = isPwd ? 'Tutup' : 'Lihat';
    });
  }

  // Voice Call Model Pill Sync
  function updateVoiceModelPill() {
    if (!voiceModelName || !modelSelect) return;
    const selectedOpt = modelSelect.options[modelSelect.selectedIndex];
    if (selectedOpt) {
      voiceModelName.textContent = selectedOpt.text.split('(')[0].trim();
    }
  }
  if (modelSelect) {
    modelSelect.addEventListener('change', updateVoiceModelPill);
  }
  updateVoiceModelPill();

  // === CUSTOM MODEL PICKER (DROPS DOWNWARDS CLEANLY INSIDE VIEWPORT) ===
  const customModelPicker = document.getElementById('customModelPicker');
  const customModelTrigger = document.getElementById('customModelTrigger');
  const customModelLabel = document.getElementById('customModelLabel');
  const customModelMenu = document.getElementById('customModelMenu');

  function renderCustomModelMenu() {
    if (!customModelMenu || !modelSelect) return;
    customModelMenu.innerHTML = '';

    const optgroups = modelSelect.querySelectorAll('optgroup');
    optgroups.forEach(group => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'custom-select-group';

      const title = document.createElement('div');
      title.className = 'custom-select-group-title';
      title.textContent = group.label;
      groupDiv.appendChild(title);

      const options = group.querySelectorAll('option');
      options.forEach(opt => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'custom-select-option' + (opt.value === modelSelect.value ? ' selected' : '');
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', opt.value === modelSelect.value ? 'true' : 'false');
        btn.dataset.value = opt.value;
        btn.dataset.label = opt.textContent.trim();

        btn.innerHTML = `
          <span>${opt.textContent.trim()}</span>
          <svg class="option-check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        `;

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          modelSelect.value = opt.value;
          updateCustomModelTrigger();
          closeCustomModelMenu();
          modelSelect.dispatchEvent(new Event('change'));
        });

        groupDiv.appendChild(btn);
      });

      customModelMenu.appendChild(groupDiv);
    });
  }

  function updateCustomModelTrigger() {
    if (!customModelLabel || !modelSelect) return;
    const selectedOpt = modelSelect.options[modelSelect.selectedIndex];
    if (selectedOpt) {
      customModelLabel.textContent = selectedOpt.textContent.trim();
    }
    if (customModelMenu) {
      const allBtns = customModelMenu.querySelectorAll('.custom-select-option');
      allBtns.forEach(b => {
        const isSel = b.dataset.value === modelSelect.value;
        b.classList.toggle('selected', isSel);
        b.setAttribute('aria-selected', isSel ? 'true' : 'false');
      });
    }
  }

  function openCustomModelMenu() {
    if (!customModelMenu || !customModelTrigger) return;
    customModelMenu.classList.add('open');
    customModelTrigger.classList.add('active');
    customModelTrigger.setAttribute('aria-expanded', 'true');
  }

  function closeCustomModelMenu() {
    if (!customModelMenu || !customModelTrigger) return;
    customModelMenu.classList.remove('open');
    customModelTrigger.classList.remove('active');
    customModelTrigger.setAttribute('aria-expanded', 'false');
  }

  if (customModelTrigger && customModelMenu) {
    renderCustomModelMenu();
    updateCustomModelTrigger();

    customModelTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = customModelMenu.classList.contains('open');
      if (isOpen) {
        closeCustomModelMenu();
      } else {
        openCustomModelMenu();
      }
    });

    document.addEventListener('click', (e) => {
      if (!customModelPicker || !customModelPicker.contains(e.target)) {
        closeCustomModelMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && customModelMenu.classList.contains('open')) {
        closeCustomModelMenu();
      }
    });

    modelSelect.addEventListener('change', () => {
      updateCustomModelTrigger();
    });
  }

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
    if (apiKeyInput && apiKeyInput.value.trim()) {
      payload.geminiApiKey = apiKeyInput.value.trim();
      localStorage.setItem('sona_gemini_key', apiKeyInput.value.trim());
    }
    if (groqApiKeyInput && groqApiKeyInput.value.trim()) {
      payload.groqApiKey = groqApiKeyInput.value.trim();
      localStorage.setItem('sona_groq_key', groqApiKeyInput.value.trim());
    }
    if (openrouterApiKeyInput && openrouterApiKeyInput.value.trim()) {
      payload.openrouterApiKey = openrouterApiKeyInput.value.trim();
      localStorage.setItem('sona_openrouter_key', openrouterApiKeyInput.value.trim());
    }
    if (databaseUrlInput && databaseUrlInput.value.trim()) {
      payload.databaseUrl = databaseUrlInput.value.trim();
    }

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

  // ==========================================
  // Auth Modal & User Session Event Listeners
  // ==========================================
  if (openAuthBtn) {
    openAuthBtn.addEventListener('click', () => openAuthModal());
  }

  if (guestBannerLoginBtn) {
    guestBannerLoginBtn.addEventListener('click', () => openAuthModal());
  }

  if (closeAuthBtn) {
    closeAuthBtn.addEventListener('click', closeAuthModal);
  }

  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) closeAuthModal();
    });
  }

  if (tabLoginBtn) {
    tabLoginBtn.addEventListener('click', () => setAuthMode(false));
  }

  if (tabRegisterBtn) {
    tabRegisterBtn.addEventListener('click', () => setAuthMode(true));
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Apakah Anda yakin ingin keluar dari akun?')) {
        handleUserLoggedOut();
      }
    });
  }

  // Google OAuth Login Link
  if (googleAuthBtn) {
    googleAuthBtn.href = '/auth/google';
    googleAuthBtn.addEventListener('click', () => {
      if (googleAuthBtnText) googleAuthBtnText.textContent = 'Membuka Google...';
    });
  }

  // Email & Password Form Submit (Login & Register)
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = authEmailInput ? authEmailInput.value.trim() : '';
      const password = authPasswordInput ? authPasswordInput.value.trim() : '';

      if (!email || !password) return;

      if (authSubmitBtn) authSubmitBtn.disabled = true;
      if (authSubmitText) authSubmitText.textContent = 'Memproses...';
      if (authFeedback) authFeedback.classList.add('hidden');

      try {
        if (supabaseClient) {
          if (isRegisterMode) {
            const { data, error } = await supabaseClient.auth.signUp({
              email,
              password,
              options: { data: { full_name: email.split('@')[0] } }
            });
            if (error) throw error;
            if (data?.user) {
              if (data.session) {
                handleUserLoggedIn({
                  id: data.user.id,
                  email: data.user.email,
                  name: data.user.user_metadata?.full_name || email.split('@')[0]
                });
              } else {
                authFeedback.className = 'auth-feedback success';
                authFeedback.textContent = 'Pendaftaran berhasil! Silakan periksa email Anda untuk verifikasi atau coba login.';
                authFeedback.classList.remove('hidden');
                setTimeout(() => setAuthMode(false), 2000);
              }
            }
          } else {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            if (data?.user) {
              handleUserLoggedIn({
                id: data.user.id,
                email: data.user.email,
                name: data.user.user_metadata?.full_name || email.split('@')[0]
              });
            }
          }
        } else {
          // Graceful local account fallback
          const localUser = {
            id: 'usr_' + btoa(email).replace(/=/g, '').substring(0, 16),
            email,
            name: email.split('@')[0]
          };
          handleUserLoggedIn(localUser);
        }
      } catch (err) {
        if (authFeedback) {
          authFeedback.className = 'auth-feedback error';
          authFeedback.textContent = err.message || 'Terjadi kesalahan saat memproses akun.';
          authFeedback.classList.remove('hidden');
        }
      } finally {
        if (authSubmitBtn) authSubmitBtn.disabled = false;
        if (authSubmitText) authSubmitText.textContent = isRegisterMode ? 'Daftar Akun Baru' : 'Masuk ke SonaAI';
      }
    });
  }
});
