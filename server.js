const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'smartblog-secret-key-2026';

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Initialize DB with sample posts and default admin
function initDB() {
  if (!fs.existsSync(DB_FILE)) {
    const adminPasswordHash = bcrypt.hashSync('admin1234', 10);
    const initialData = {
      settings: {
        blogTitle: 'MINIMAL LOG.',
        blogSubtitle: '일상과 기술, 그리고 생각을 기록하는 심플한 공간',
        allowSignup: true,
        adsenseEnabled: true,
        adMainEnabled: true,
        adPostEnabled: true,
        adTopEnabled: true,
        adSidebarEnabled: true,
        adInArticleEnabled: true,
        adBottomEnabled: true,
        adsenseClientId: 'ca-pub-0000000000000000',
        adSlotTop: '1111111111',
        adSlotInArticle: '2222222222',
        adSlotSidebar: '3333333333',
        adSlotBottom: '4444444444',
        showAdPlaceholder: true
      },
      users: [
        {
          id: 'u_admin',
          username: 'admin',
          nickname: '관리자',
          passwordHash: adminPasswordHash,
          role: 'admin',
          createdAt: new Date().toISOString()
        }
      ],
      categories: ['전체', '일상/생각', '테크/개발', '리뷰/노하우', '사진/여행'],
      posts: [
        {
          id: 'post_1',
          title: '스마트 에디터가 탑재된 심플 블로그에 오신 것을 환영합니다',
          summary: '네이버 스마트에디터 ONE 스타일의 편리한 글쓰기, 내장 사진 편집기, 첨부파일 관리, 조회수 통계 및 구글 애드센스 광고 설정까지 모두 갖춘 반응형 블로그입니다.',
          category: '테크/개발',
          tags: ['블로그', '스마트에디터', '반응형웹', '애드센스'],
          thumbnail: '/uploads/sample-desk.svg',
          content: `
            <p class="se-text">안녕하세요! 새롭게 개설된 <strong>MINIMAL LOG.</strong>에 오신 것을 환영합니다. 이 블로그는 복잡한 요소는 덜어내고 오직 <strong>글과 사진, 그리고 독자의 가독성</strong>에 집중할 수 있도록 디자인되었습니다.</p>
            <blockquote class="se-quote se-quote-line">
              <p>"단순함은 궁극의 정교함이다."</p>
              <cite>— 레오나르도 다 빈치</cite>
            </blockquote>
            <h3>✨ 주요 기능 안내</h3>
            <p class="se-text">상단 우측의 <strong>글쓰기</strong> 버튼을 눌러 스마트 에디터를 체험해 보세요. 기본 관리자 계정은 <code>admin</code> / 비밀번호 <code>admin1234</code> 입니다.</p>
            <figure class="se-image se-align-center" style="width: 100%;">
              <img src="/uploads/sample-desk.svg" alt="데스크 셋업" />
              <figcaption>클릭 한 번으로 사진 필터, 회전, 크기 조절, 캡션 편집이 가능합니다.</figcaption>
            </figure>
            <hr class="se-hr hr-stars" />
            <p class="se-text">또한 우측 상단 <strong>관리 설정</strong> 메뉴에서 언제든지 <strong>회원가입 허용/차단 스위치</strong>를 켜고 끌 수 있으며, 구글 애드센스(Google AdSense) 광고 슬롯을 제어할 수 있습니다.</p>
          `,
          attachments: [],
          authorId: 'u_admin',
          authorName: '관리자',
          views: 128,
          likes: 14,
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 2).toISOString()
        },
        {
          id: 'post_2',
          title: '사진 편집과 레이아웃을 내 마음대로 다루는 방법',
          summary: '별도의 포토샵이나 외부 프로그램 없이 에디터 안에서 바로 사진을 자르고, 밝기와 필터를 보정하고, 본문 폭에 맞게 정렬해 보세요.',
          category: '리뷰/노하우',
          tags: ['사진편집', '팁', '디자인'],
          thumbnail: '/uploads/sample-camera.svg',
          content: `
            <p class="se-text">블로그 글을 작성할 때 가장 시간이 많이 걸리는 작업이 바로 사진 크기 조절과 색감 보정입니다. 스마트 에디터에서는 사진을 본문에 넣은 뒤 클릭하면 즉시 <strong>전용 플로팅 툴바</strong>가 나타납니다.</p>
            <figure class="se-image se-align-center" style="width: 100%;">
              <img src="/uploads/sample-camera.svg" alt="카메라 사진" />
              <figcaption>내장 사진 편집 스튜디오에서 밝기, 대비, 채도, 세피아/빈티지 필터 및 크롭을 지원합니다.</figcaption>
            </figure>
            <p class="se-text">모바일, 태블릿, 데스크탑 어디서 접속하더라도 화면 크기에 맞춰 최적의 비율로 자동 리사이징됩니다.</p>
          `,
          attachments: [],
          authorId: 'u_admin',
          authorName: '관리자',
          views: 84,
          likes: 9,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString()
        }
      ],
      viewLogs: {}
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

initDB();

function readDB() {
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const defaultAdFlags = {
    adMainEnabled: true,
    adPostEnabled: true,
    adTopEnabled: true,
    adSidebarEnabled: true,
    adInArticleEnabled: true,
    adBottomEnabled: true
  };
  db.settings = { ...defaultAdFlags, ...db.settings };

  // Ensure every post has a sequential postNumber (oldest = 1) and status ('published' | 'draft')
  let mutated = false;
  const chrono = [...db.posts].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  let maxNo = chrono.reduce((m, p) => Math.max(m, p.postNumber || 0), 0);
  if (maxNo === 0) {
    chrono.forEach((p, idx) => {
      p.postNumber = idx + 1;
      if (!p.status) p.status = 'published';
      mutated = true;
    });
  } else {
    chrono.forEach(p => {
      if (!p.postNumber) {
        maxNo += 1;
        p.postNumber = maxNo;
        mutated = true;
      }
      if (!p.status) {
        p.status = 'published';
        mutated = true;
      }
    });
  }
  if (mutated) writeDB(db);
  return db;
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for file uploads (preserving safe original filenames)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E6);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 } // 30MB limit
});

// Auth Middleware
function getAuthUser(req) {
  const token = req.cookies?.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
  req.user = user;
  next();
}

// --- API ROUTES ---

// 1. Get initial blog state & settings
app.get('/api/init', (req, res) => {
  const db = readDB();
  const user = getAuthUser(req);
  let currentUser = null;
  if (user) {
    const found = db.users.find(u => u.id === user.id);
    if (found) {
      currentUser = { id: found.id, username: found.username, nickname: found.nickname, role: found.role };
    }
  }
  const publishedPosts = db.posts.filter(p => p.status !== 'draft');
  const draftPosts = db.posts.filter(p => p.status === 'draft');
  const totalViews = publishedPosts.reduce((acc, p) => acc + (p.views || 0), 0);
  res.json({
    settings: db.settings,
    categories: db.categories,
    user: currentUser,
    stats: {
      totalPosts: publishedPosts.length,
      totalDrafts: draftPosts.length,
      totalViews,
      totalUsers: db.users.length
    }
  });
});

// 2. Auth: Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력해 주세요.' });
  }
  const db = readDB();
  const user = db.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }
  const payload = { id: user.id, username: user.username, nickname: user.nickname, role: user.role };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000 });
  res.json({ user: payload, token });
});

// 3. Auth: Signup (Respects allowSignup setting!)
app.post('/api/auth/signup', (req, res) => {
  const db = readDB();
  if (!db.settings.allowSignup) {
    return res.status(403).json({ error: '현재 관리자에 의해 신규 회원가입이 비활성화되어 있습니다.' });
  }
  const { username, nickname, password } = req.body;
  if (!username || !nickname || !password) {
    return res.status(400).json({ error: '모든 항목을 입력해 주세요.' });
  }
  if (username.trim().length < 3) {
    return res.status(400).json({ error: '아이디는 3자 이상이어야 합니다.' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: '비밀번호는 4자 이상이어야 합니다.' });
  }
  const exists = db.users.some(u => u.username.toLowerCase() === username.trim().toLowerCase());
  if (exists) {
    return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
  }
  const newUser = {
    id: 'u_' + Date.now(),
    username: username.trim(),
    nickname: nickname.trim(),
    passwordHash: bcrypt.hashSync(password, 10),
    role: db.users.length === 0 ? 'admin' : 'member',
    createdAt: new Date().toISOString()
  };
  db.users.push(newUser);
  writeDB(db);

  const payload = { id: newUser.id, username: newUser.username, nickname: newUser.nickname, role: newUser.role };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000 });
  res.json({ user: payload, token });
});

// 4. Auth: Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// 5. Settings: Toggle Signup or Update Blog/AdSense Settings (Admin only)
app.put('/api/settings', requireAdmin, (req, res) => {
  const db = readDB();
  const allowedFields = [
    'blogTitle', 'blogSubtitle', 'allowSignup',
    'adsenseEnabled', 'adMainEnabled', 'adPostEnabled',
    'adTopEnabled', 'adSidebarEnabled', 'adInArticleEnabled', 'adBottomEnabled',
    'adsenseClientId',
    'adSlotTop', 'adSlotInArticle', 'adSlotSidebar', 'adSlotBottom',
    'showAdPlaceholder'
  ];
  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      db.settings[key] = req.body[key];
    }
  }
  if (Array.isArray(req.body.categories) && req.body.categories.length > 0) {
    db.categories = req.body.categories;
  }
  writeDB(db);
  res.json({ settings: db.settings, categories: db.categories });
});

// Quick Toggle for Allow Signup
app.post('/api/settings/toggle-signup', requireAdmin, (req, res) => {
  const db = readDB();
  db.settings.allowSignup = !db.settings.allowSignup;
  writeDB(db);
  res.json({ allowSignup: db.settings.allowSignup });
});

// 6. Posts: List Posts
app.get('/api/posts', (req, res) => {
  const db = readDB();
  const { category, q, sort, includeDrafts } = req.query;
  const user = getAuthUser(req);
  let posts = [...db.posts];

  // Hide draft posts on public feed unless admin/author explicitly requests includeDrafts=1
  if (!(includeDrafts === '1' && user)) {
    posts = posts.filter(p => p.status !== 'draft');
  }

  if (category && category !== '전체') {
    posts = posts.filter(p => p.category === category);
  }
  if (q && q.trim() !== '') {
    const query = q.trim().toLowerCase();
    posts = posts.filter(p =>
      p.title.toLowerCase().includes(query) ||
      p.summary.toLowerCase().includes(query) ||
      String(p.postNumber || '').includes(query) ||
      (p.tags && p.tags.some(t => t.toLowerCase().includes(query)))
    );
  }
  if (sort === 'views') {
    posts.sort((a, b) => (b.views || 0) - (a.views || 0));
  } else {
    posts.sort((a, b) => (b.postNumber || 0) - (a.postNumber || 0));
  }

  res.json({ posts });
});

// 7. Posts: Get Single Post & Increment View Count
app.get('/api/posts/:id', (req, res) => {
  const db = readDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

  // View count increment with session/IP deduplication window (e.g. 30 mins per client token/IP)
  const viewerKey = (req.headers['x-viewer-id'] || req.ip || 'anon') + '_' + post.id;
  const now = Date.now();
  if (!db.viewLogs) db.viewLogs = {};

  const skipView = req.query.noView === '1';
  if (!skipView) {
    const lastViewed = db.viewLogs[viewerKey] || 0;
    if (now - lastViewed > 1000 * 60 * 15) { // 15 minutes cooldown per viewer
      post.views = (post.views || 0) + 1;
      db.viewLogs[viewerKey] = now;
      writeDB(db);
    }
  }

  res.json({ post });
});

// Explicit view count increment endpoint if needed
app.post('/api/posts/:id/view', (req, res) => {
  const db = readDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
  post.views = (post.views || 0) + 1;
  writeDB(db);
  res.json({ views: post.views });
});

// Like a post
app.post('/api/posts/:id/like', (req, res) => {
  const db = readDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
  post.likes = (post.likes || 0) + 1;
  writeDB(db);
  res.json({ likes: post.likes });
});

// 8. Create Post (Supports status: 'published' | 'draft')
app.post('/api/posts', requireAuth, (req, res) => {
  const { title, content, summary, category, tags, thumbnail, attachments, status } = req.body;
  const postStatus = status === 'draft' ? 'draft' : 'published';
  const safeTitle = (title && title.trim()) ? title.trim() : (postStatus === 'draft' ? '(제목 없는 임시저장 글)' : '');

  if (!safeTitle) {
    return res.status(400).json({ error: '제목을 입력해 주세요.' });
  }
  const db = readDB();
  const plainText = (content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const autoSummary = summary && summary.trim() ? summary.trim() : plainText.slice(0, 160);

  // Extract first image from content if thumbnail is not explicitly set
  let thumb = thumbnail || '';
  if (!thumb && content) {
    const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match) thumb = match[1];
  }

  const maxNo = db.posts.reduce((m, p) => Math.max(m, p.postNumber || 0), 0);

  const newPost = {
    id: 'post_' + Date.now(),
    postNumber: maxNo + 1,
    status: postStatus,
    title: safeTitle,
    summary: autoSummary,
    category: category || '일상/생각',
    tags: Array.isArray(tags) ? tags : [],
    thumbnail: thumb,
    content: content || '',
    attachments: Array.isArray(attachments) ? attachments : [],
    authorId: req.user.id,
    authorName: req.user.nickname,
    views: postStatus === 'draft' ? 0 : 1,
    likes: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.posts.unshift(newPost);
  writeDB(db);
  res.json({ post: newPost });
});

// 9. Update Post (Supports updating status between 'draft' and 'published')
app.put('/api/posts/:id', requireAuth, (req, res) => {
  const db = readDB();
  const postIndex = db.posts.findIndex(p => p.id === req.params.id);
  if (postIndex === -1) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

  const post = db.posts[postIndex];
  if (post.authorId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: '수정 권한이 없습니다.' });
  }

  const { title, content, summary, category, tags, thumbnail, attachments, status } = req.body;
  const plainText = (content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  let thumb = thumbnail !== undefined ? thumbnail : post.thumbnail;
  if (!thumb && content) {
    const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match) thumb = match[1];
  }

  const nextStatus = status === 'draft' ? 'draft' : (status === 'published' ? 'published' : (post.status || 'published'));

  db.posts[postIndex] = {
    ...post,
    status: nextStatus,
    title: title ? title.trim() : post.title,
    content: content !== undefined ? content : post.content,
    summary: summary ? summary.trim() : plainText.slice(0, 160),
    category: category || post.category,
    tags: Array.isArray(tags) ? tags : post.tags,
    thumbnail: thumb,
    attachments: Array.isArray(attachments) ? attachments : post.attachments,
    updatedAt: new Date().toISOString()
  };

  writeDB(db);
  res.json({ post: db.posts[postIndex] });
});

// 10. Delete Post
app.delete('/api/posts/:id', requireAuth, (req, res) => {
  const db = readDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

  if (post.authorId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: '삭제 권한이 없습니다.' });
  }

  db.posts = db.posts.filter(p => p.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

// 11. Upload Image or Attachment File
app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
  }
  // Decode originalname properly for Korean filenames
  const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    url: fileUrl,
    filename: req.file.filename,
    originalName: originalName,
    size: req.file.size,
    mimetype: req.file.mimetype
  });
});

// Download attachment with original Korean filename
app.get('/api/download/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('파일을 찾을 수 없습니다.');
  }
  const downloadName = req.query.name || req.params.filename;
  res.download(filePath, downloadName);
});

// Users list & management for admin
app.get('/api/users', requireAdmin, (req, res) => {
  const db = readDB();
  const users = db.users.map(u => ({
    id: u.id,
    username: u.username,
    nickname: u.nickname,
    role: u.role,
    createdAt: u.createdAt
  }));
  res.json({ users });
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
  const db = readDB();
  const target = db.users.find(u => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: '회원을 찾을 수 없습니다.' });
  if (target.role === 'admin') {
    return res.status(400).json({ error: '관리자 계정은 삭제할 수 없습니다.' });
  }
  db.users = db.users.filter(u => u.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

app.put('/api/posts/:id/views', requireAdmin, (req, res) => {
  const db = readDB();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
  post.views = Math.max(0, parseInt(req.body.views, 10) || 0);
  writeDB(db);
  res.json({ post });
});

app.listen(PORT, () => {
  console.log(`Smart Blog Server running on http://localhost:${PORT}`);
});
