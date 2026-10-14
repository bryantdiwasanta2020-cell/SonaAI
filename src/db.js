import pg from 'pg';
const { Pool } = pg;

let pool = null;
let dbConnected = false;
let dbStatusMessage = 'Belum terhubung ke Cloud SQL (Mode memori sementara aktif, 0 byte disimpan di disk lokal).';

// In-memory fallback (Ephemeral / 100% RAM, zero disk write)
const memoryStore = {
  conversations: [],
  messages: []
};

export async function initDB(connectionString = process.env.DATABASE_URL) {
  if (pool) {
    try {
      await pool.end();
    } catch (_) {}
    pool = null;
    dbConnected = false;
  }

  if (!connectionString || !connectionString.trim()) {
    dbConnected = false;
    dbStatusMessage = 'Belum terhubung ke Cloud SQL (Mode memori sementara aktif, 0 byte disimpan di disk lokal).';
    console.log('ℹ️  [DB] ' + dbStatusMessage);
    return false;
  }

  try {
    const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
    pool = new Pool({
      connectionString: connectionString.trim(),
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000
    });

    // Test connection
    const client = await pool.connect();
    try {
      // Auto-migrate tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS conversations (
          id VARCHAR(64) PRIMARY KEY,
          title TEXT NOT NULL,
          model VARCHAR(64) DEFAULT 'gemini-3.8-flash',
          user_id VARCHAR(64),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Safe column migration for existing database
        ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);
        CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);

        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          conversation_id VARCHAR(64) REFERENCES conversations(id) ON DELETE CASCADE,
          role VARCHAR(20) NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      `);

      dbConnected = true;
      dbStatusMessage = 'Terhubung ke Cloud PostgreSQL (Supabase/Cloud SQL).';
      console.log('✅ [DB] ' + dbStatusMessage);
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    dbConnected = false;
    dbStatusMessage = `Gagal terhubung ke Cloud SQL: ${error.message}`;
    console.error('❌ [DB Error]', error.message);
    return false;
  }
}

export function getDBStatus() {
  return {
    connected: dbConnected,
    type: dbConnected ? 'PostgreSQL (Cloud / Supabase)' : 'Ephemeral In-Memory (No Local Disk)',
    message: dbStatusMessage
  };
}

export async function getConversations(userId = null) {
  if (dbConnected && pool) {
    if (userId) {
      const res = await pool.query(
        'SELECT id, title, model, user_id, created_at, updated_at FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC',
        [userId]
      );
      return res.rows;
    }
    const res = await pool.query(
      'SELECT id, title, model, user_id, created_at, updated_at FROM conversations ORDER BY updated_at DESC'
    );
    return res.rows;
  }
  const list = userId 
    ? memoryStore.conversations.filter(c => c.user_id === userId)
    : memoryStore.conversations;
  return [...list].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

export async function createConversation(id, title = 'Obrolan Baru', model = 'gemini-3.8-flash', userId = null) {
  const now = new Date();
  if (dbConnected && pool) {
    const res = await pool.query(
      'INSERT INTO conversations (id, title, model, user_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $5) RETURNING *',
      [id, title, model, userId, now]
    );
    return res.rows[0];
  }

  const conv = { id, title, model, user_id: userId, created_at: now, updated_at: now };
  memoryStore.conversations.unshift(conv);
  return conv;
}

export async function updateConversationTitle(id, title) {
  if (dbConnected && pool) {
    await pool.query(
      'UPDATE conversations SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [title, id]
    );
    return;
  }

  const conv = memoryStore.conversations.find(c => c.id === id);
  if (conv) {
    conv.title = title;
    conv.updated_at = new Date();
  }
}

export async function deleteConversation(id, userId = null) {
  if (dbConnected && pool) {
    if (userId) {
      await pool.query('DELETE FROM conversations WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)', [id, userId]);
    } else {
      await pool.query('DELETE FROM conversations WHERE id = $1', [id]);
    }
    return true;
  }

  memoryStore.conversations = memoryStore.conversations.filter(c => c.id !== id);
  memoryStore.messages = memoryStore.messages.filter(m => m.conversation_id !== id);
  return true;
}

export async function getMessages(conversationId) {
  if (dbConnected && pool) {
    const res = await pool.query(
      'SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY id ASC',
      [conversationId]
    );
    return res.rows;
  }

  return memoryStore.messages.filter(m => m.conversation_id === conversationId);
}

export async function addMessage(conversationId, role, content) {
  const now = new Date();
  if (dbConnected && pool) {
    const res = await pool.query(
      'INSERT INTO messages (conversation_id, role, content, created_at) VALUES ($1, $2, $3, $4) RETURNING *',
      [conversationId, role, content, now]
    );
    await pool.query(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [conversationId]
    );
    return res.rows[0];
  }

  const msg = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    conversation_id: conversationId,
    role,
    content,
    created_at: now
  };
  memoryStore.messages.push(msg);

  const conv = memoryStore.conversations.find(c => c.id === conversationId);
  if (conv) conv.updated_at = now;

  return msg;
}
