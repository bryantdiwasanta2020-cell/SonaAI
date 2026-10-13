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
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

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

export async function getConversations() {
  if (dbConnected && pool) {
    const res = await pool.query(
      'SELECT id, title, model, created_at, updated_at FROM conversations ORDER BY updated_at DESC'
    );
    return res.rows;
  }
  return [...memoryStore.conversations].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

export async function createConversation(id, title = 'Obrolan Baru', model = 'gemini-3.8-flash') {
  const now = new Date();
  if (dbConnected && pool) {
    const res = await pool.query(
      'INSERT INTO conversations (id, title, model, created_at, updated_at) VALUES ($1, $2, $3, $4, $4) RETURNING *',
      [id, title, model, now]
    );
    return res.rows[0];
  }

  const conv = { id, title, model, created_at: now, updated_at: now };
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

export async function deleteConversation(id) {
  if (dbConnected && pool) {
    await pool.query('DELETE FROM conversations WHERE id = $1', [id]);
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
