import test from 'node:test';
import assert from 'node:assert/strict';

test('pending requests emit nothing; published, rescheduled and cancelled events create durable notifications', { skip: !process.env.TEST_DATABASE }, async () => {
  const { db } = await import('../server/db.js');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const college = (await client.query("INSERT INTO colleges(name,code) VALUES ('CRMS transaction test',$1) RETURNING id", [`T${Date.now()}`])).rows[0].id;
    const user = (await client.query("INSERT INTO users(name,email,password_hash,role,college_id) VALUES ('Test',$1,'unused','student',$2) RETURNING id", [`test-${Date.now()}@example.invalid`,college])).rows[0].id;
    await client.query("INSERT INTO booking_requests(college_id,title,request_scope,requested_start,requested_end,resource_type,requester_id) VALUES ($1,'Pending test','club',NOW()+interval '1 day',NOW()+interval '2 days','hall',$2)",[college,user]);
    assert.equal((await client.query('SELECT * FROM notification_outbox WHERE college_id=$1',[college])).rowCount,0);
    const event = (await client.query("INSERT INTO events(college_id,title,event_type,start_at,end_at) VALUES ($1,'Approved test','club',NOW()+interval '1 day',NOW()+interval '2 days') RETURNING id",[college])).rows[0].id;
    await client.query("UPDATE events SET start_at=start_at+interval '1 hour',status='rescheduled',updated_at=NOW() WHERE id=$1",[event]);
    await client.query("UPDATE events SET status='cancelled',updated_at=NOW() WHERE id=$1",[event]);
    const messages=(await client.query('SELECT payload FROM notification_outbox WHERE college_id=$1 ORDER BY id',[college])).rows;
    assert.equal(messages.length,3);
    assert.equal(messages[0].payload.isNew,true);
    assert.equal(messages[1].payload.status,'rescheduled');
    assert.equal(messages[2].payload.status,'cancelled');
  } finally { await client.query('ROLLBACK'); client.release(); await db.end(); }
});
