import pg from 'pg';
const { Pool } = pg;

export let pool = null;
let dbConnected = false;
let dbMode = 'memory'; // 'supabase_https' | 'pg_pool' | 'memory'
let dbStatusMessage = 'Belum terhubung ke Cloud SQL (Mode memori sementara aktif).';

let supabaseUrl = (process.env.SUPABASE_URL || '').trim();
let supabaseKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();

// In-memory fallback (Ephemeral / 100% RAM, zero disk write)
const memoryStore = {
  conversations: [],
  messages: []
};

// Supabase REST Helper via standard HTTPS (Port 443 - zero firewall blockage)
async function supabaseFetch(endpoint, options = {}) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL or Key is missing');
  }
  const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1${endpoint}`;
  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Supabase REST [${res.status}]: ${errorText}`);
  }
  if (res.status === 204) return null;
  return await res.json();
}

export async function initDB(connectionString = process.env.DATABASE_URL) {
  // 1. Try Supabase HTTPS REST API first (fastest, reliable, port 443, IPv4/IPv6 immune)
  supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  supabaseKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();

  if (supabaseUrl && supabaseKey) {
    try {
      // Test query
      await supabaseFetch('/conversations?select=id&limit=1');
      dbConnected = true;
      dbMode = 'supabase_https';
      dbStatusMessage = 'Terhubung ke Cloud PostgreSQL (Supabase Cloud via HTTPS/Port 443).';
      console.log('✅ [DB] ' + dbStatusMessage);
      return true;
    } catch (err) {
      console.warn('⚠️  [DB HTTPS Warning]', err.message);
    }
  }

  // 2. Fallback to direct PostgreSQL Pool if connection string provided
  if (pool) {
    try {
      await pool.end();
    } catch (_) {}
    pool = null;
    dbConnected = false;
  }

  if (connectionString && connectionString.trim()) {
    try {
      const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
      pool = new Pool({
        connectionString: connectionString.trim(),
        ssl: isLocalhost ? false : { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
      });

      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS conversations (
            id VARCHAR(64) PRIMARY KEY,
            title TEXT NOT NULL,
            model VARCHAR(64) DEFAULT 'gemini-3.8-flash',
            user_id VARCHAR(64),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

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
        dbMode = 'pg_pool';
        dbStatusMessage = 'Terhubung ke Cloud PostgreSQL via TCP Pooler.';
        console.log('✅ [DB] ' + dbStatusMessage);
        return true;
      } finally {
        client.release();
      }
    } catch (error) {
      dbConnected = false;
      dbMode = 'memory';
      dbStatusMessage = `Koneksi TCP offline (${error.message}). Mode memori RAM aktif.`;
      console.warn(`⚠️  [DB] TCP connection timeout (${error.message}).`);
    }
  }

  // 3. In-memory ephemeral fallback
  dbConnected = false;
  dbMode = 'memory';
  dbStatusMessage = 'Mode memori sementara aktif (0 byte disimpan di disk lokal).';
  console.log('ℹ️  [DB] ' + dbStatusMessage);
  return false;
}

export function getDBStatus() {
  return {
    connected: dbConnected,
    type: dbMode === 'supabase_https'
      ? 'PostgreSQL (Supabase Cloud HTTPS)'
      : dbMode === 'pg_pool'
      ? 'PostgreSQL (Cloud SQL TCP)'
      : 'Ephemeral In-Memory (No Local Disk)',
    message: dbStatusMessage
  };
}

export async function getConversations(userId = null) {
  // ZERO-LEAK PRIVACY: If no userId (guest), NEVER return database conversations
  if (!userId) {
    return [];
  }

  if (dbMode === 'supabase_https') {
    try {
      const endpoint = `/conversations?select=*&user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc`;
      const data = await supabaseFetch(endpoint);
      return data || [];
    } catch (e) {
      console.error('Supabase HTTPS getConversations error:', e.message);
    }
  }

  if (dbConnected && pool) {
    const res = await pool.query(
      'SELECT id, title, model, user_id, created_at, updated_at FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );
    return res.rows;
  }

  const list = memoryStore.conversations.filter(c => c.user_id === userId);
  return [...list].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

export async function migrateGuestConversation(userId, guestMessages = [], model = 'gemini-3.8-flash') {
  if (!userId || !Array.isArray(guestMessages) || guestMessages.length === 0) {
    return null;
  }

  const firstUserMsg = guestMessages.find(m => m.role === 'user');
  const summaryText = firstUserMsg?.content || 'Obrolan Tamu';
  const title = summaryText.length > 28 ? summaryText.substring(0, 28) + '...' : summaryText;
  const conversationId = 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  // 1. Create the conversation belonging to this user
  const conv = await createConversation(conversationId, title, model, userId);

  // 2. Add each message into this conversation
  for (const msg of guestMessages) {
    if (msg.role && msg.content) {
      await addMessage(conversationId, msg.role, msg.content);
    }
  }

  return conv;
}

export async function createConversation(id, title = 'Obrolan Baru', model = 'gemini-3.8-flash', userId = null) {
  const now = new Date();

  if (dbMode === 'supabase_https') {
    try {
      const data = await supabaseFetch('/conversations', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          id,
          title,
          model,
          user_id: userId,
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        })
      });
      return data && data[0] ? data[0] : { id, title, model, user_id: userId };
    } catch (e) {
      console.error('Supabase HTTPS createConversation error:', e.message);
    }
  }

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

export async function updateConversationTitle(id, title, userId = null) {
  const now = new Date().toISOString();

  if (dbMode === 'supabase_https') {
    try {
      let endpoint = `/conversations?id=eq.${encodeURIComponent(id)}`;
      if (userId) {
        endpoint += `&user_id=eq.${encodeURIComponent(userId)}`;
      }
      await supabaseFetch(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({ title, updated_at: now })
      });
      return true;
    } catch (e) {
      console.error('Supabase HTTPS updateConversationTitle error:', e.message);
    }
  }

  if (dbConnected && pool) {
    if (userId) {
      await pool.query(
        'UPDATE conversations SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND (user_id = $3 OR user_id IS NULL)',
        [title, id, userId]
      );
    } else {
      await pool.query(
        'UPDATE conversations SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [title, id]
      );
    }
    return true;
  }

  const conv = memoryStore.conversations.find(c => c.id === id);
  if (conv) {
    conv.title = title;
    conv.updated_at = new Date();
    return true;
  }
  return false;
}

export async function deleteConversation(id, userId = null) {
  if (dbMode === 'supabase_https') {
    try {
      let endpoint = `/conversations?id=eq.${encodeURIComponent(id)}`;
      if (userId) {
        endpoint += `&user_id=eq.${encodeURIComponent(userId)}`;
      }
      await supabaseFetch(endpoint, { method: 'DELETE' });
      return true;
    } catch (e) {
      console.error('Supabase HTTPS deleteConversation error:', e.message);
    }
  }

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

export async function getMessages(conversationId, userId = null) {
  if (dbMode === 'supabase_https') {
    try {
      if (userId) {
        const conv = await supabaseFetch(`/conversations?id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(userId)}`);
        if (!conv || conv.length === 0) return [];
      }
      const data = await supabaseFetch(
        `/messages?conversation_id=eq.${encodeURIComponent(conversationId)}&order=id.asc`
      );
      return data || [];
    } catch (e) {
      console.error('Supabase HTTPS getMessages error:', e.message);
    }
  }

  if (dbConnected && pool) {
    if (userId) {
      const convCheck = await pool.query('SELECT id FROM conversations WHERE id = $1 AND user_id = $2', [conversationId, userId]);
      if (convCheck.rows.length === 0) return [];
    }
    const res = await pool.query(
      'SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY id ASC',
      [conversationId]
    );
    return res.rows;
  }

  if (userId) {
    const conv = memoryStore.conversations.find(c => c.id === conversationId && c.user_id === userId);
    if (!conv) return [];
  }
  return memoryStore.messages.filter(m => m.conversation_id === conversationId);
}

export async function addMessage(conversationId, role, content) {
  const now = new Date();

  if (dbMode === 'supabase_https') {
    try {
      const inserted = await supabaseFetch('/messages', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          conversation_id: conversationId,
          role,
          content,
          created_at: now.toISOString()
        })
      });

      // Update conversation updated_at
      await supabaseFetch(`/conversations?id=eq.${encodeURIComponent(conversationId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ updated_at: now.toISOString() })
      }).catch(() => {});

      if (inserted && inserted[0]) {
        return inserted[0];
      }
    } catch (e) {
      console.error('Supabase HTTPS addMessage error:', e.message);
    }
  }

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

export async function updateMessageContent(id, content) {
  if (dbMode === 'supabase_https') {
    try {
      await supabaseFetch(`/messages?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ content })
      });
      return true;
    } catch (e) {
      console.error('Supabase HTTPS updateMessageContent error:', e.message);
    }
  }

  if (dbConnected && pool) {
    try {
      await pool.query('UPDATE messages SET content = $1 WHERE id = $2', [content, id]);
      return true;
    } catch (_) {}
  }

  const msg = memoryStore.messages.find(m => m.id == id);
  if (msg) {
    msg.content = content;
    return true;
  }
  return false;
}

export async function deleteMessagesAfter(conversationId, messageId) {
  if (dbMode === 'supabase_https') {
    try {
      await supabaseFetch(
        `/messages?conversation_id=eq.${encodeURIComponent(conversationId)}&id=gt.${encodeURIComponent(messageId)}`,
        { method: 'DELETE' }
      );
      return true;
    } catch (e) {
      console.error('Supabase HTTPS deleteMessagesAfter error:', e.message);
    }
  }

  if (dbConnected && pool) {
    try {
      await pool.query(
        'DELETE FROM messages WHERE conversation_id = $1 AND id > $2',
        [conversationId, messageId]
      );
      return true;
    } catch (e) {
      console.error('Postgres deleteMessagesAfter error:', e.message);
    }
  }

  memoryStore.messages = memoryStore.messages.filter(
    m => !(m.conversation_id === conversationId && Number(m.id) > Number(messageId))
  );
  return true;
}

export async function deleteMessage(messageId) {
  if (dbMode === 'supabase_https') {
    try {
      await supabaseFetch(`/messages?id=eq.${encodeURIComponent(messageId)}`, { method: 'DELETE' });
      return true;
    } catch (e) {
      console.error('Supabase HTTPS deleteMessage error:', e.message);
    }
  }

  if (dbConnected && pool) {
    try {
      await pool.query('DELETE FROM messages WHERE id = $1', [messageId]);
      return true;
    } catch (_) {}
  }

  memoryStore.messages = memoryStore.messages.filter(m => m.id != messageId);
  return true;
}
