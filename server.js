import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initDB,
  getDBStatus,
  getConversations,
  createConversation,
  updateConversationTitle,
  deleteConversation,
  getMessages,
  addMessage
} from './src/db.js';
import { generateChatResponse, setApiKey, getApiKey } from './src/ai.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize DB with env var if available
await initDB();

// Helper to mask API key for safe UI display
function maskKey(key) {
  if (!key || key.length < 8) return '';
  return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
}

// 1. System Status
app.get('/api/status', (req, res) => {
  const currentKey = getApiKey();
  res.json({
    db: getDBStatus(),
    ai: {
      hasKey: !!(currentKey && currentKey.trim()),
      maskedKey: maskKey(currentKey)
    }
  });
});

// 2. Update Settings (Supabase Connection / Gemini API Key)
app.post('/api/settings', async (req, res) => {
  const { geminiApiKey, databaseUrl } = req.body;

  let dbResult = null;
  if (databaseUrl !== undefined) {
    const success = await initDB(databaseUrl);
    dbResult = {
      success,
      status: getDBStatus()
    };
  }

  if (geminiApiKey !== undefined) {
    setApiKey(geminiApiKey);
  }

  res.json({
    message: 'Pengaturan berhasil diperbarui!',
    db: dbResult || getDBStatus(),
    ai: {
      hasKey: !!getApiKey(),
      maskedKey: maskKey(getApiKey())
    }
  });
});

// Helper to extract userId from request
const getUserId = (req) => req.headers['x-user-id'] || req.query.userId || req.body?.userId || null;

// 3. Conversations List
app.get('/api/conversations', async (req, res) => {
  try {
    const userId = getUserId(req);
    const list = await getConversations(userId);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Create New Conversation
app.post('/api/conversations', async (req, res) => {
  try {
    const { title = 'Obrolan Baru', model = 'gemini-3.8-flash' } = req.body;
    const userId = getUserId(req);
    const id = 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const conv = await createConversation(id, title, model, userId);
    res.json(conv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Delete Conversation
app.delete('/api/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);
    await deleteConversation(id, userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Get Messages for Conversation
app.get('/api/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await getMessages(id);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Chat Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const {
      conversationId: rawId,
      message,
      audioBase64,
      audioMimeType,
      model = 'gemini-3.5-flash-lite',
      webSearch = false,
      language
    } = req.body;

    const hasAudio = !!(audioBase64 && audioBase64.trim());
    const hasText = !!(message && message.trim());

    if (!hasText && !hasAudio) {
      return res.status(400).json({ error: 'Pesan atau rekaman suara tidak boleh kosong.' });
    }

    let conversationId = rawId;
    let isNewConv = false;
    const userId = getUserId(req);

    const summaryText = hasText ? message : '🎙️ Pesan Suara';
    const displayMsg = hasText ? message : '🎙️ [Pesan Suara Dikirimkan]';

    if (!conversationId) {
      conversationId = 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const titleSummary = summaryText.length > 28 ? summaryText.substring(0, 28) + '...' : summaryText;
      await createConversation(conversationId, titleSummary, model, userId);
      isNewConv = true;
    }

    // Save user message to SQL DB
    const userMsg = await addMessage(conversationId, 'user', displayMsg);

    // Get message history for context
    const history = await getMessages(conversationId);

    // Call Gemini AI
    const aiResult = await generateChatResponse({
      prompt: message || '',
      audioBase64,
      audioMimeType,
      history: history.slice(0, -1), // exclude the one we just added to avoid duplicate prompt
      model,
      webSearch: !!webSearch,
      language
    });

    // If audio was transcribed, update user message in DB with actual words
    let effectiveUserContent = displayMsg;
    if (hasAudio && aiResult.userTranscription && aiResult.userTranscription.trim()) {
      effectiveUserContent = `🎙️ "${aiResult.userTranscription.trim()}"`;
      try {
        const pool = (await import('./src/db.js')).pool;
        if (pool) {
          await pool.query('UPDATE messages SET content = $1 WHERE id = $2', [effectiveUserContent, userMsg.id]);
          userMsg.content = effectiveUserContent;
        }
      } catch (_) {}
    }

    // Save AI reply to SQL DB
    const aiMsg = await addMessage(conversationId, 'model', aiResult.text);

    // If first message in an existing conversation with generic title, update title
    const resolvedSummary = (hasAudio && aiResult.userTranscription) ? aiResult.userTranscription : summaryText;
    if (history.length <= 2 || isNewConv) {
      const titleSummary = resolvedSummary.length > 28 ? resolvedSummary.substring(0, 28) + '...' : resolvedSummary;
      await updateConversationTitle(conversationId, titleSummary);
    }

    res.json({
      conversationId,
      userMessage: userMsg,
      userTranscription: aiResult.userTranscription || '',
      reply: aiResult.text,
      modelUsed: aiResult.model || model,
      aiMessage: aiMsg,
      isDemo: aiResult.isDemo,
      sources: aiResult.sources || [],
      queries: aiResult.queries || []
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({ error: error.message || 'Terjadi kesalahan pada server.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 SonaAI Web Server berjalan di: http://localhost:${PORT}`);
});

export default app;
