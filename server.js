const express = require('express');
const path = require('path');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'fanconnect-secret-2024';
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const db = new sqlite3.Database('./platform.db');

const dbRun = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, function(e) { e ? rej(e) : res(this); }));
const dbGet = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => e ? rej(e) : res(r)));
const dbAll = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => e ? rej(e) : res(r)));

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
}

function optAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) try { req.user = jwt.verify(token, JWT_SECRET); } catch {}
  next();
}

async function initDB() {
  await dbRun(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'fan',
    bio TEXT DEFAULT '',
    avatar_color TEXT DEFAULT '#00AFF0',
    cover_color TEXT DEFAULT '#1a1a2e',
    subscription_price REAL DEFAULT 9.99,
    verified INTEGER DEFAULT 0,
    total_posts INTEGER DEFAULT 0,
    total_subscribers INTEGER DEFAULT 0,
    total_likes INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    media_type TEXT DEFAULT 'text',
    is_premium INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (creator_id) REFERENCES users(id)
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fan_id INTEGER NOT NULL,
    creator_id INTEGER NOT NULL,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(fan_id, creator_id)
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, post_id)
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await dbRun(`CREATE TABLE IF NOT EXISTS tips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    creator_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    message TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  const count = await dbGet('SELECT COUNT(*) as n FROM users');
  if (count.n === 0) await seedData();
}

async function seedData() {
  const hash = await bcrypt.hash('password123', 10);

  const creators = [
    { u: 'alexfit', d: 'Alex Fitness', e: 'alex@demo.com', bio: 'Personal trainer & fitness coach. Daily workouts, nutrition tips, and motivation! 💪 Transform your body with me.', ac: '#FF6B6B', cc: '#2d1b69', p: 9.99, v: 1 },
    { u: 'luna_art', d: 'Luna Creative', e: 'luna@demo.com', bio: 'Digital artist & illustrator. Behind-the-scenes art process, tutorials, and exclusive prints 🎨', ac: '#A855F7', cc: '#0f172a', p: 14.99, v: 1 },
    { u: 'chefmia', d: 'Chef Mia', e: 'mia@demo.com', bio: 'Michelin-trained chef sharing secret recipes and cooking techniques 🍳 Elevate your cooking game!', ac: '#F59E0B', cc: '#1a1a1a', p: 7.99, v: 1 },
    { u: 'mikegames', d: 'Mike Gaming', e: 'mike@demo.com', bio: 'Pro gamer & streamer. Exclusive tutorials, tips, and epic gameplay highlights 🎮', ac: '#10B981', cc: '#0d1117', p: 4.99, v: 0 },
    { u: 'sofia_photo', d: 'Sofia Photography', e: 'sofia@demo.com', bio: 'Award-winning photographer. Travel diaries, tutorials, and print shop 📸', ac: '#EC4899', cc: '#1e293b', p: 12.99, v: 1 },
    { u: 'jaymusic', d: 'Jay Music', e: 'jay@demo.com', bio: 'Indie musician sharing unreleased tracks, studio sessions & acoustic covers 🎵', ac: '#3B82F6', cc: '#1c1917', p: 6.99, v: 1 },
    { u: 'zen_wellness', d: 'Zen Wellness', e: 'zen@demo.com', bio: 'Yoga instructor & wellness coach. Guided meditations, yoga flows, and mindfulness 🧘‍♀️', ac: '#14B8A6', cc: '#042f2e', p: 8.99, v: 0 },
    { u: 'kayla_fashion', d: 'Kayla Fashion', e: 'kayla@demo.com', bio: 'Fashion influencer & stylist. OOTDs, hauls, style tips & exclusive lookbooks 👗', ac: '#F97316', cc: '#27272a', p: 11.99, v: 1 },
  ];

  const ids = [];
  for (const c of creators) {
    const subs = Math.floor(Math.random() * 5000) + 500;
    const r = await dbRun(
      `INSERT INTO users (username,display_name,email,password_hash,role,bio,avatar_color,cover_color,subscription_price,verified,total_subscribers) VALUES (?,?,?,?,'creator',?,?,?,?,?,?)`,
      [c.u, c.d, c.e, hash, c.bio, c.ac, c.cc, c.p, c.v, subs]
    );
    ids.push(r.lastID);
  }

  await dbRun(`INSERT INTO users (username,display_name,email,password_hash,role) VALUES (?,?,?,?,'fan')`,
    ['demo_fan', 'Demo Fan', 'fan@demo.com', hash]);
  const fan = await dbGet(`SELECT id FROM users WHERE username='demo_fan'`);
  const fanId = fan.id;

  const exp = new Date(); exp.setMonth(exp.getMonth() + 1);
  for (let i = 0; i < 3; i++) {
    await dbRun(`INSERT INTO subscriptions (fan_id,creator_id,expires_at) VALUES (?,?,?)`, [fanId, ids[i], exp.toISOString()]);
  }

  const posts = [
    // alexfit
    [ids[0], `🔥 Morning chest workout! My go-to 5-exercise routine:\n\n1. Bench Press — 4×8\n2. Incline Dumbbell — 3×12\n3. Cable Flies — 3×15\n4. Push-ups to failure\n5. Dips — 3×10\n\nSave this and crush it today!`, 'text', 0, 312],
    [ids[0], `EXCLUSIVE: My full 12-week transformation program drops this week for subscribers only! 💪 The exact program I used to gain 15 lbs of muscle — meal plans, workouts, video tutorials all included.`, 'image', 1, 589],
    [ids[0], `Nutrition tip: You don't need to count every calorie. Focus on these 3:\n✅ 30-40g protein per meal\n✅ Vegetables fill half your plate\n✅ Water before every meal\n\nSimple wins every time.`, 'text', 0, 244],
    [ids[0], `Behind the scenes of today's photoshoot 📸 Progress doesn't lie.`, 'image', 1, 401],
    // luna_art
    [ids[1], `New piece drop! 🎨 "Cosmic Dreams" — 40 hours of work. Color palette inspired by the aurora I saw in Iceland last year. Prints available for subscribers!`, 'image', 0, 721],
    [ids[1], `EXCLUSIVE TUTORIAL: How I create depth and atmosphere in digital art. Full 2-hour breakdown — brushes, layer techniques, color theory. Subscribers only 🖌️`, 'image', 1, 534],
    [ids[1], `Sketchbook time-lapse! ✏️ 3 hours condensed into 60 seconds.`, 'text', 0, 389],
    [ids[1], `My complete brush pack + 5 color palettes I use in ALL my work. Download link in subscriber tier!`, 'text', 1, 612],
    // chefmia
    [ids[2], `Today's recipe: Brown Butter Pasta with Crispy Sage 🍝\n\nIngredients:\n• 400g spaghetti\n• 150g butter\n• 20 fresh sage leaves\n• Parmesan to taste\n• Salt & pepper\n\nThe brown butter is everything — don't rush it!`, 'text', 0, 478],
    [ids[2], `EXCLUSIVE: My signature Truffle Risotto — the dish I served at my restaurant for 3 years. Step-by-step video + written recipe for subscribers 🍄`, 'image', 1, 691],
    [ids[2], `5 knife skills every home cook should master:\n1. The pinch grip\n2. Julienne cuts\n3. Brunoise dice\n4. Chiffonade\n5. Rock chop\n\nWhich one do you struggle with?`, 'text', 0, 302],
    // mikegames
    [ids[3], `Hit #1 global on the new ranked mode 🎮 Clip incoming — full breakdown of every decision in my subscriber feed.`, 'text', 0, 445],
    [ids[3], `EXCLUSIVE: My complete setup tour + all settings, keybinds, and hardware specs. Everything you need to play at a pro level!`, 'image', 1, 823],
    // sofia_photo
    [ids[4], `Tokyo street photography dump 📸 Shot entirely on film. There's an energy in these streets impossible to put into words.`, 'image', 0, 934],
    [ids[4], `EXCLUSIVE: My complete Lightroom preset pack (15 presets) + editing tutorial. These took 2 years to perfect.`, 'image', 1, 712],
    [ids[4], `Unpopular opinion: Blue hour > Golden hour. Change my mind 📷`, 'text', 0, 567],
    // jaymusic
    [ids[5], `Wrote this one at 2am last Tuesday 🎵 Sometimes the best songs come from nowhere. Full track available in my exclusive tier.`, 'text', 0, 388],
    [ids[5], `EXCLUSIVE: Unreleased track + studio session footage. 6 months of work. You're the first to hear it 🎶`, 'text', 1, 492],
    // zen_wellness
    [ids[6], `Morning affirmations to start your day:\n\n🌱 I am exactly where I need to be\n🌱 My body is strong and capable\n🌱 I choose peace over perfection\n🌱 Today I will be kind to myself\n\nSave this and read it every morning 🙏`, 'text', 0, 671],
    [ids[6], `EXCLUSIVE: 30-minute guided morning yoga flow. My personal daily practice that took 5 years to refine 🧘‍♀️`, 'image', 1, 445],
    // kayla_fashion
    [ids[7], `OOTD: Quiet luxury era has entered the chat 🤍\n\nCoat: Vintage ($45) · Trousers: Zara · Shoes: Steve Madden · Bag: Thrifted\n\nFull breakdown + dupes in my subscriber feed!`, 'image', 0, 803],
    [ids[7], `EXCLUSIVE: My complete fall capsule wardrobe guide. 15 pieces, 30+ outfits, full sourcing list for every budget.`, 'image', 1, 654],
  ];

  for (const [cid, content, media_type, is_premium, likes] of posts) {
    await dbRun(`INSERT INTO posts (creator_id,content,media_type,is_premium,likes_count) VALUES (?,?,?,?,?)`,
      [cid, content, media_type, is_premium, likes]);
    await dbRun(`UPDATE users SET total_posts=total_posts+1 WHERE id=?`, [cid]);
  }

  await dbRun(`INSERT INTO messages (sender_id,receiver_id,content) VALUES (?,?,?)`,
    [fanId, ids[0], 'Hey! Love your content, really motivating me!']);
  await dbRun(`INSERT INTO messages (sender_id,receiver_id,content) VALUES (?,?,?)`,
    [ids[0], fanId, 'Thank you so much! That means the world to me! 💪 Keep pushing!']);

  console.log('Seeded demo data');
}

// AUTH
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, display_name, role = 'fan' } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const r = await dbRun(`INSERT INTO users (username,display_name,email,password_hash,role) VALUES (?,?,?,?,?)`,
      [username, display_name || username, email, hash, role]);
    const token = jwt.sign({ id: r.lastID, username, role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: r.lastID, username, display_name: display_name || username, role, avatar_color: '#00AFF0' } });
  } catch (err) {
    res.status(400).json({ error: err.message.includes('UNIQUE') ? 'Username or email already taken' : err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await dbGet(`SELECT * FROM users WHERE email=?`, [email]);
  if (!user || !await bcrypt.compare(password, user.password_hash))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role, avatar_color: user.avatar_color } });
});

// USERS
app.get('/api/users/:username', optAuth, async (req, res) => {
  const u = await dbGet(
    `SELECT id,username,display_name,bio,avatar_color,cover_color,subscription_price,verified,total_posts,total_subscribers,total_likes,role,created_at FROM users WHERE username=?`,
    [req.params.username]);
  if (!u) return res.status(404).json({ error: 'Not found' });
  if (req.user) {
    const sub = await dbGet(`SELECT id FROM subscriptions WHERE fan_id=? AND creator_id=?`, [req.user.id, u.id]);
    u.is_subscribed = !!sub;
    u.is_own_profile = req.user.id === u.id;
  }
  res.json(u);
});

app.put('/api/users/profile', auth, async (req, res) => {
  const { display_name, bio, subscription_price } = req.body;
  await dbRun(`UPDATE users SET display_name=?,bio=?,subscription_price=? WHERE id=?`,
    [display_name, bio, subscription_price, req.user.id]);
  res.json({ success: true });
});

// CREATORS
app.get('/api/creators', optAuth, async (req, res) => {
  const { search, limit = 20 } = req.query;
  let sql = `SELECT id,username,display_name,bio,avatar_color,cover_color,subscription_price,verified,total_posts,total_subscribers FROM users WHERE role='creator'`;
  const p = [];
  if (search) { sql += ` AND (username LIKE ? OR display_name LIKE ? OR bio LIKE ?)`; p.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  sql += ` ORDER BY total_subscribers DESC LIMIT ?`;
  p.push(parseInt(limit));
  const creators = await dbAll(sql, p);
  if (req.user) {
    for (const c of creators) {
      const s = await dbGet(`SELECT id FROM subscriptions WHERE fan_id=? AND creator_id=?`, [req.user.id, c.id]);
      c.is_subscribed = !!s;
    }
  }
  res.json(creators);
});

// POSTS
app.get('/api/posts/feed', auth, async (req, res) => {
  const subs = await dbAll(`SELECT creator_id FROM subscriptions WHERE fan_id=?`, [req.user.id]);
  if (!subs.length) return res.json([]);
  const ids = subs.map(s => s.creator_id);
  const ph = ids.map(() => '?').join(',');
  const posts = await dbAll(
    `SELECT p.*,u.username,u.display_name,u.avatar_color,u.verified FROM posts p JOIN users u ON p.creator_id=u.id WHERE p.creator_id IN (${ph}) ORDER BY p.created_at DESC LIMIT 30`,
    ids);
  for (const post of posts) {
    const l = await dbGet(`SELECT id FROM likes WHERE user_id=? AND post_id=?`, [req.user.id, post.id]);
    post.is_liked = !!l;
  }
  res.json(posts);
});

app.get('/api/posts/creator/:username', optAuth, async (req, res) => {
  const u = await dbGet(`SELECT id FROM users WHERE username=?`, [req.params.username]);
  if (!u) return res.status(404).json({ error: 'Not found' });
  let isSub = false, isOwn = false;
  if (req.user) {
    const s = await dbGet(`SELECT id FROM subscriptions WHERE fan_id=? AND creator_id=?`, [req.user.id, u.id]);
    isSub = !!s;
    isOwn = req.user.id === u.id;
  }
  const posts = await dbAll(`SELECT * FROM posts WHERE creator_id=? ORDER BY created_at DESC`, [u.id]);
  for (const post of posts) {
    if (post.is_premium && !isSub && !isOwn) {
      post.content_locked = true;
      post.content = '';
    }
    if (req.user) {
      const l = await dbGet(`SELECT id FROM likes WHERE user_id=? AND post_id=?`, [req.user.id, post.id]);
      post.is_liked = !!l;
    }
  }
  res.json(posts);
});

app.post('/api/posts', auth, async (req, res) => {
  if (req.user.role !== 'creator') return res.status(403).json({ error: 'Creators only' });
  const { content, media_type = 'text', is_premium = 0 } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  const r = await dbRun(`INSERT INTO posts (creator_id,content,media_type,is_premium) VALUES (?,?,?,?)`,
    [req.user.id, content, media_type, is_premium]);
  await dbRun(`UPDATE users SET total_posts=total_posts+1 WHERE id=?`, [req.user.id]);
  res.json({ id: r.lastID, success: true });
});

app.post('/api/posts/:id/like', auth, async (req, res) => {
  try {
    await dbRun(`INSERT INTO likes (user_id,post_id) VALUES (?,?)`, [req.user.id, req.params.id]);
    await dbRun(`UPDATE posts SET likes_count=likes_count+1 WHERE id=?`, [req.params.id]);
    res.json({ liked: true });
  } catch {
    await dbRun(`DELETE FROM likes WHERE user_id=? AND post_id=?`, [req.user.id, req.params.id]);
    await dbRun(`UPDATE posts SET likes_count=MAX(0,likes_count-1) WHERE id=?`, [req.params.id]);
    res.json({ liked: false });
  }
});

// SUBSCRIPTIONS
app.post('/api/subscriptions', auth, async (req, res) => {
  const { creator_id } = req.body;
  const exp = new Date(); exp.setMonth(exp.getMonth() + 1);
  try {
    await dbRun(`INSERT INTO subscriptions (fan_id,creator_id,expires_at) VALUES (?,?,?)`,
      [req.user.id, creator_id, exp.toISOString()]);
    await dbRun(`UPDATE users SET total_subscribers=total_subscribers+1 WHERE id=?`, [creator_id]);
    res.json({ success: true });
  } catch { res.status(400).json({ error: 'Already subscribed' }); }
});

app.delete('/api/subscriptions/:creatorId', auth, async (req, res) => {
  await dbRun(`DELETE FROM subscriptions WHERE fan_id=? AND creator_id=?`, [req.user.id, req.params.creatorId]);
  await dbRun(`UPDATE users SET total_subscribers=MAX(0,total_subscribers-1) WHERE id=?`, [req.params.creatorId]);
  res.json({ success: true });
});

app.get('/api/subscriptions', auth, async (req, res) => {
  const subs = await dbAll(
    `SELECT u.id,u.username,u.display_name,u.avatar_color,u.verified,s.expires_at FROM subscriptions s JOIN users u ON s.creator_id=u.id WHERE s.fan_id=?`,
    [req.user.id]);
  res.json(subs);
});

// MESSAGES
app.get('/api/messages', auth, async (req, res) => {
  const uid = req.user.id;
  const convs = await dbAll(`
    SELECT DISTINCT
      CASE WHEN m.sender_id=? THEN m.receiver_id ELSE m.sender_id END as other_id,
      u.username, u.display_name, u.avatar_color, u.verified,
      (SELECT content FROM messages WHERE (sender_id=? AND receiver_id=CASE WHEN m.sender_id=? THEN m.receiver_id ELSE m.sender_id END) OR (receiver_id=? AND sender_id=CASE WHEN m.sender_id=? THEN m.receiver_id ELSE m.sender_id END) ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages WHERE (sender_id=? AND receiver_id=CASE WHEN m.sender_id=? THEN m.receiver_id ELSE m.sender_id END) OR (receiver_id=? AND sender_id=CASE WHEN m.sender_id=? THEN m.receiver_id ELSE m.sender_id END) ORDER BY created_at DESC LIMIT 1) as last_time,
      (SELECT COUNT(*) FROM messages WHERE sender_id=CASE WHEN m.sender_id=? THEN m.receiver_id ELSE m.sender_id END AND receiver_id=? AND is_read=0) as unread_count
    FROM messages m
    JOIN users u ON u.id=CASE WHEN m.sender_id=? THEN m.receiver_id ELSE m.sender_id END
    WHERE m.sender_id=? OR m.receiver_id=?
    GROUP BY other_id ORDER BY last_time DESC`,
    [uid,uid,uid,uid,uid,uid,uid,uid,uid,uid,uid,uid,uid,uid]);
  res.json(convs);
});

app.get('/api/messages/:userId', auth, async (req, res) => {
  const msgs = await dbAll(
    `SELECT m.*,u.username,u.display_name,u.avatar_color FROM messages m JOIN users u ON m.sender_id=u.id WHERE (m.sender_id=? AND m.receiver_id=?) OR (m.sender_id=? AND m.receiver_id=?) ORDER BY m.created_at ASC LIMIT 100`,
    [req.user.id, req.params.userId, req.params.userId, req.user.id]);
  await dbRun(`UPDATE messages SET is_read=1 WHERE sender_id=? AND receiver_id=?`, [req.params.userId, req.user.id]);
  res.json(msgs);
});

app.post('/api/messages', auth, async (req, res) => {
  const { receiver_id, content } = req.body;
  const r = await dbRun(`INSERT INTO messages (sender_id,receiver_id,content) VALUES (?,?,?)`,
    [req.user.id, receiver_id, content]);
  res.json({ id: r.lastID, success: true });
});

// TIPS
app.post('/api/tips', auth, async (req, res) => {
  const { creator_id, amount, message = '' } = req.body;
  await dbRun(`INSERT INTO tips (sender_id,creator_id,amount,message) VALUES (?,?,?,?)`,
    [req.user.id, creator_id, amount, message]);
  res.json({ success: true });
});

// CREATOR STATS
app.get('/api/stats', auth, async (req, res) => {
  if (req.user.role !== 'creator') return res.status(403).json({ error: 'Creators only' });
  const user = await dbGet(`SELECT * FROM users WHERE id=?`, [req.user.id]);
  const posts = await dbAll(`SELECT * FROM posts WHERE creator_id=? ORDER BY created_at DESC`, [req.user.id]);
  const subs = await dbGet(`SELECT COUNT(*) as count FROM subscriptions WHERE creator_id=?`, [req.user.id]);
  const tips = await dbGet(`SELECT SUM(amount) as total FROM tips WHERE creator_id=?`, [req.user.id]);
  const recent = await dbAll(
    `SELECT u.username,u.display_name,u.avatar_color,s.created_at FROM subscriptions s JOIN users u ON s.fan_id=u.id WHERE s.creator_id=? ORDER BY s.created_at DESC LIMIT 5`,
    [req.user.id]);
  res.json({
    user, posts,
    total_subscribers: subs.count,
    monthly_revenue: (subs.count * user.subscription_price).toFixed(2),
    total_tips: (tips.total || 0).toFixed(2),
    recent_subscribers: recent,
  });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

initDB().then(() => app.listen(PORT, () => console.log(`FanConnect running on port ${PORT}`))).catch(console.error);
