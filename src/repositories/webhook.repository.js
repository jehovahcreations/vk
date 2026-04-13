const pool = require("../config/db");

async function createWebhookEvent({ eventId, eventType, signature, payload }) {
  const result = await pool.query(
    `INSERT INTO webhook_events (event_id, event_type, signature, payload)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [eventId, eventType, signature, payload]
  );
  return result.rows[0];
}

async function findByEventId(eventId) {
  const result = await pool.query(
    "SELECT * FROM webhook_events WHERE event_id = $1 LIMIT 1",
    [eventId]
  );
  return result.rows[0];
}

async function markProcessed(id, error) {
  const result = await pool.query(
    `UPDATE webhook_events
     SET processed = true,
         processed_at = NOW(),
         processing_error = $2
     WHERE id = $1
     RETURNING *`,
    [id, error || null]
  );
  return result.rows[0];
}

async function listWebhooks() {
  const result = await pool.query(
    "SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 200"
  );
  return result.rows;
}

module.exports = {
  createWebhookEvent,
  findByEventId,
  markProcessed,
  listWebhooks
};
