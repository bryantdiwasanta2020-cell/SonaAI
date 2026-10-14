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
app.use(express.json());
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

// 3. Conversations List
app.get('/api/conversations', async (req, res) => {
  try {
    const list = await getConversations();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Create New Conversation
app.post('/api/conversations', async (req, res) => {
  try {
    const { title = 'Obrolan Baru', model = 'gemini-3.8-flash' } = req.body;
    const id = 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const conv = await createConversation(id, title, model);
    res.json(conv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Delete Conversation
app.delete('/api/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteConversation(id);
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
    const { conversationId: rawId, message, model = 'gemini-3.1-flash-lite', webSearch = false, language } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
    }

    let conversationId = rawId;
    let isNewConv = false;

    if (!conversationId) {
      conversationId = 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const titleSummary = message.length > 28 ? message.substring(0, 28) + '...' : message;
      await createConversation(conversationId, titleSummary, model);
      isNewConv = true;
    }

    // Save user message to SQL DB
    const userMsg = await addMessage(conversationId, 'user', message);

    // Get message history for context
    const history = await getMessages(conversationId);

    // Call Gemini AI
    const aiResult = await generateChatResponse({
      prompt: message,
      history: history.slice(0, -1), // exclude the one we just added to avoid duplicate prompt
      model,
      webSearch: !!webSearch,
      language
    });

    // Save AI reply to SQL DB
    const aiMsg = await addMessage(conversationId, 'model', aiResult.text);

    // If first message in an existing conversation with generic title, update title
    if (!isNewConv && history.length <= 2) {
      const titleSummary = message.length > 28 ? message.substring(0, 28) + '...' : message;
      await updateConversationTitle(conversationId, titleSummary);
    }

    res.json({
      conversationId,
      userMessage: userMsg,
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
