/* =========================================================
   SMART BLOG FRONTEND APPLICATION
   - Minimalist Responsive Blog + View Counter + AdSense
   - Auth System with Instant Signup Allow/Block Toggle
   - Naver SmartEditor ONE Style Rich Block & Text Editor
   - Built-in Canvas Photo Studio (Crop, Rotate, Filters, Adjustments)
   - Easy Drag & Drop File Attachment Manager
   ========================================================= */

const viewerId = (() => {
  let id = localStorage.getItem('blog_viewer_id');
  if (!id) {
    id = 'v_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    localStorage.setItem('blog_viewer_id', id);
  }
  return id;
})();

const app = {
  settings: {},
  categories: [],
  user: null,
  posts: [],
  currentCategory: '전체',
  currentSort: 'latest',
  currentPost: null,

  async init() {
    // Load theme preference
    if (localStorage.getItem('blog_theme') === 'dark') {
      document.body.classList.add('dark-mode');
    }

    // Close user dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const chip = document.querySelector('.user-profile-chip');
      const dropdown = document.getElementById('userDropdown');
      if (chip && dropdown && !chip.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });

    await this.loadInitialState();
    await this.loadPosts();
    editor.initEvents();
  },

  async api(url, options = {}) {
    const headers = {
      'x-viewer-id': viewerId,
      ...(options.headers || {})
    };
    const token = localStorage.getItem('blog_auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || '요청 처리 중 오류가 발생했습니다.');
    }
    return data;
  },

  async loadInitialState() {
    try {
      const data = await this.api('/api/init');
      this.settings = data.settings || {};
      this.categories = data.categories || ['전체'];
      this.user = data.user || null;

      this.renderBrandingAndStats(data.stats);
      this.renderAuthUI();
      this.renderCategories();
      this.renderAdSenseSlots();
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  renderBrandingAndStats(stats = {}) {
    const title = this.settings.blogTitle || 'MINIMAL LOG.';
    const subtitle = this.settings.blogSubtitle || '';
    document.title = `${title} — 스마트 블로그`;
    document.getElementById('headerBlogTitle').textContent = title;
    document.getElementById('sidebarBlogTitle').textContent = title;
    document.getElementById('footerBlogTitle').textContent = title;
    document.getElementById('heroSubtitle').textContent = subtitle;
    document.getElementById('sidebarBlogDesc').textContent = subtitle;

    if (stats.totalPosts !== undefined) {
      document.getElementById('statTotalPosts').textContent = stats.totalPosts.toLocaleString();
    }
    if (stats.totalViews !== undefined) {
      document.getElementById('statTotalViews').textContent = stats.totalViews.toLocaleString();
    }

    // Update Signup Status Indicators everywhere
    const allow = !!this.settings.allowSignup;
    const headerSignupBtn = document.getElementById('headerSignupBtn');
    if (headerSignupBtn) {
      headerSignupBtn.style.display = allow ? 'inline-flex' : 'none';
    }

    const sidebarStatus = document.getElementById('sidebarSignupStatus');
    if (sidebarStatus) {
      sidebarStatus.innerHTML = allow
        ? `<i class="ri-user-add-line" style="color:var(--accent)"></i> 현재 신규 회원가입이 <strong>열려 있습니다</strong>`
        : `<i class="ri-lock-2-line" style="color:var(--danger)"></i> 현재 신규 회원가입이 <strong>비활성화됨</strong>`;
    }

    // Admin Quick Toggle Pill in Header
    const quickDot = document.getElementById('quickSignupDot');
    const quickText = document.getElementById('quickSignupText');
    if (quickDot && quickText) {
      quickDot.className = 'status-indicator ' + (allow ? '' : 'closed');
      quickText.textContent = allow ? '회원가입 허용됨 (ON)' : '회원가입 차단됨 (OFF)';
    }
  },

  renderAuthUI() {
    const guestActions = document.getElementById('guestActions');
    const userActions = document.getElementById('userActions');
    const adminQuickBar = document.getElementById('adminQuickBar');
    const dropdownAdminBtn = document.getElementById('dropdownAdminBtn');

    if (this.user) {
      guestActions.classList.add('hidden');
      userActions.classList.remove('hidden');
      document.getElementById('userNicknameText').textContent = this.user.nickname;
      document.getElementById('userAvatarText').textContent = (this.user.nickname || 'U')[0].toUpperCase();
      document.getElementById('dropdownUserId').textContent = '@' + this.user.username;
      document.getElementById('dropdownUserRole').textContent = this.user.role === 'admin' ? 'ADMIN' : 'MEMBER';

      if (this.user.role === 'admin') {
        adminQuickBar.classList.remove('hidden');
        dropdownAdminBtn.classList.remove('hidden');
      } else {
        adminQuickBar.classList.add('hidden');
        dropdownAdminBtn.classList.add('hidden');
      }
    } else {
      guestActions.classList.remove('hidden');
      userActions.classList.add('hidden');
      adminQuickBar.classList.add('hidden');
    }
  },

  renderCategories() {
    const tabsEl = document.getElementById('categoryTabs');
    tabsEl.innerHTML = this.categories.map(cat => `
      <button class="category-tab ${this.currentCategory === cat ? 'active' : ''}"
              onclick="app.selectCategory('${cat.replace(/'/g, "\\'")}')">
        ${this.escapeHtml(cat)}
      </button>
    `).join('');

    // Populate editor category select (excluding '전체')
    const editorSelect = document.getElementById('editorCategory');
    const writableCats = this.categories.filter(c => c !== '전체');
    editorSelect.innerHTML = (writableCats.length ? writableCats : ['일상/생각']).map(cat => `
      <option value="${this.escapeHtml(cat)}">${this.escapeHtml(cat)}</option>
    `).join('');
  },

  renderAdSenseSlots() {
    const s = this.settings;
    const slots = [
      { id: 'adSlotTopContainer', slotId: s.adSlotTop, label: '상단 반응형 배너 광고 (Google AdSense)', height: '90px' },
      { id: 'adSlotSidebarContainer', slotId: s.adSlotSidebar, label: '사이드바 멀티플렉스 광고 (Google AdSense)', height: '240px' },
      { id: 'adSlotInArticleContainer', slotId: s.adSlotInArticle, label: '본문 내 인아티클 반응형 광고 (Google AdSense)', height: '120px' },
      { id: 'adSlotBottomContainer', slotId: s.adSlotBottom, label: '하단 추천 콘텐츠 광고 (Google AdSense)', height: '110px' }
    ];

    // Dynamically load Google AdSense script if enabled and real client ID provided
    if (s.adsenseEnabled && s.adsenseClientId && !s.adsenseClientId.includes('00000000')) {
      if (!document.getElementById('adsenseScriptTag')) {
        const script = document.createElement('script');
        script.id = 'adsenseScriptTag';
        script.async = true;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(s.adsenseClientId)}`;
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
      }
    }

    slots.forEach(item => {
      const container = document.getElementById(item.id);
      if (!container) return;
      if (!s.adsenseEnabled) {
        container.innerHTML = '';
        container.classList.add('hidden');
        return;
      }
      container.classList.remove('hidden');

      const showPlaceholder = s.showAdPlaceholder !== false && s.showAdPlaceholder !== 'false';
      const clientId = this.escapeHtml(s.adsenseClientId || 'ca-pub-0000000000000000');
      const slotCode = this.escapeHtml(item.slotId || '0000000000');

      if (showPlaceholder) {
        container.innerHTML = `
          <div class="ad-placeholder-box" style="min-height:${item.height}; display:flex; flex-direction:column; justify-content:center; align-items:center;">
            <span class="ad-badge">AD · GOOGLE ADSENSE</span>
            <div class="ad-placeholder-title"><i class="ri-google-fill"></i> ${item.label}</div>
            <div class="ad-placeholder-sub">Client: <code>${clientId}</code> · Slot: <code>${slotCode}</code> (관리 설정에서 실제 광고 모드로 전환 가능)</div>
          </div>
        `;
      } else {
        container.innerHTML = `
          <ins class="adsbygoogle"
               style="display:block"
               data-ad-client="${clientId}"
               data-ad-slot="${slotCode}"
               data-ad-format="auto"
               data-full-width-responsive="true"></ins>
        `;
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {}
      }
    });
  },

  async loadPosts() {
    try {
      const q = document.getElementById('searchInput')?.value || '';
      const params = new URLSearchParams({
        category: this.currentCategory,
        sort: this.currentSort,
        q
      });
      const data = await this.api(`/api/posts?${params.toString()}`);
      this.posts = data.posts || [];
      this.renderPostList();
      this.renderPopularSidebar();

      // Also refresh global view stats
      const initData = await this.api('/api/init');
      this.renderBrandingAndStats(initData.stats);
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  renderPostList() {
    const listEl = document.getElementById('postListContainer');
    if (!this.posts.length) {
      listEl.innerHTML = `
        <div class="sidebar-widget" style="text-align:center; padding:48px 20px;">
          <p style="color:var(--text-muted); margin-bottom:12px;">아직 등록된 게시글이 없습니다.</p>
          ${this.user ? `<button class="btn btn-primary btn-sm" onclick="editor.openNew()"><i class="ri-quill-pen-line"></i> 첫 게시글 작성하기</button>` : ''}
        </div>
      `;
      return;
    }

    listEl.innerHTML = this.posts.map(post => {
      const dateStr = this.formatDate(post.createdAt);
      const thumbHtml = post.thumbnail
        ? `<img class="post-card-thumb" src="${this.escapeHtml(post.thumbnail)}" alt="썸네일" loading="lazy" />`
        : '';
      const attBadge = post.attachments && post.attachments.length
        ? `<span><i class="ri-attachment-2"></i> 첨부 ${post.attachments.length}</span>`
        : '';

      return `
        <article class="post-card" onclick="app.openPost('${post.id}')">
          <div class="post-card-body">
            <span class="post-card-cat">${this.escapeHtml(post.category)}</span>
            <h2 class="post-card-title">${this.escapeHtml(post.title)}</h2>
            <p class="post-card-summary">${this.escapeHtml(post.summary || '')}</p>
            <div class="post-card-meta">
              <span>${this.escapeHtml(post.authorName || '작성자')}</span>
              <span>·</span>
              <span>${dateStr}</span>
              <span>·</span>
              <span><i class="ri-eye-line"></i> 조회 ${(post.views || 0).toLocaleString()}</span>
              <span>·</span>
              <span><i class="ri-heart-3-line"></i> ${(post.likes || 0).toLocaleString()}</span>
              ${attBadge}
            </div>
          </div>
          ${thumbHtml}
        </article>
      `;
    }).join('');
  },

  renderPopularSidebar() {
    const popEl = document.getElementById('popularPostsList');
    const sorted = [...this.posts].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
    if (!sorted.length) {
      popEl.innerHTML = `<li style="font-size:0.82rem; color:var(--text-muted);">게시글이 없습니다.</li>`;
      return;
    }
    popEl.innerHTML = sorted.map((p, idx) => `
      <li class="popular-item" onclick="app.openPost('${p.id}')">
        <span class="popular-rank">${idx + 1}</span>
        <div class="popular-info">
          <div class="popular-title">${this.escapeHtml(p.title)}</div>
          <div class="popular-views">조회 ${(p.views || 0).toLocaleString()}회</div>
        </div>
      </li>
    `).join('');
  },

  selectCategory(cat) {
    this.currentCategory = cat;
    this.renderCategories();
    this.loadPosts();
  },

  setSort(sortType) {
    this.currentSort = sortType;
    document.getElementById('sortLatestBtn').classList.toggle('active', sortType === 'latest');
    document.getElementById('sortViewsBtn').classList.toggle('active', sortType === 'views');
    this.loadPosts();
  },

  toggleSearch() {
    const drawer = document.getElementById('searchDrawer');
    drawer.classList.toggle('hidden');
    if (!drawer.classList.contains('hidden')) {
      document.getElementById('searchInput').focus();
    }
  },

  clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchDrawer').classList.add('hidden');
    this.loadPosts();
  },

  applyFilter() {
    this.showHome();
    this.loadPosts();
  },

  toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('blog_theme', isDark ? 'dark' : 'light');
  },

  toggleUserMenu() {
    document.getElementById('userDropdown').classList.toggle('hidden');
  },

  switchView(viewId) {
    ['homeView', 'postDetailView', 'editorView'].forEach(id => {
      document.getElementById(id).classList.toggle('hidden', id !== viewId);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  showHome() {
    this.switchView('homeView');
    this.loadPosts();
  },

  async openPost(postId) {
    try {
      const data = await this.api(`/api/posts/${postId}`);
      const post = data.post;
      this.currentPost = post;

      document.getElementById('detailCategory').textContent = post.category;
      document.getElementById('detailTitle').textContent = post.title;
      document.getElementById('detailAuthor').textContent = post.authorName || '작성자';
      document.getElementById('detailDate').textContent = this.formatDate(post.createdAt, true);
      document.getElementById('detailViews').textContent = (post.views || 0).toLocaleString();
      document.getElementById('detailLikes').textContent = (post.likes || 0).toLocaleString();

      // Render content & replace any custom in-content ad-break markers
      let renderedContent = post.content || '';
      if (this.settings.adsenseEnabled) {
        const inlineAdHtml = `
          <div class="ad-placeholder-box" style="margin:24px 0;">
            <span class="ad-badge">AD · IN-CONTENT</span>
            <div class="ad-placeholder-title"><i class="ri-google-fill"></i> 본문 중간 구글 애드센스 광고 영역</div>
          </div>
        `;
        renderedContent = renderedContent.replace(/<div class="se-ad-break"[^>]*>[\s\S]*?<\/div>/gi, inlineAdHtml);
      }
      document.getElementById('detailContent').innerHTML = renderedContent;

      // Render Attachments Box
      const attBox = document.getElementById('detailAttachmentsBox');
      const attList = document.getElementById('detailAttachmentsList');
      const atts = post.attachments || [];
      if (atts.length > 0) {
        attBox.classList.remove('hidden');
        document.getElementById('detailAttachmentCount').textContent = atts.length;
        attList.innerHTML = atts.map(att => `
          <li class="attachment-item">
            <span><i class="ri-file-download-line"></i> ${this.escapeHtml(att.originalName)} <small style="color:var(--text-muted)">(${this.formatBytes(att.size)})</small></span>
            <a href="/api/download/${encodeURIComponent(att.filename)}?name=${encodeURIComponent(att.originalName)}" download>
              다운로드 <i class="ri-download-2-line"></i>
            </a>
          </li>
        `).join('');
      } else {
        attBox.classList.add('hidden');
      }

      // Render Tags
      const tagsEl = document.getElementById('detailTags');
      tagsEl.innerHTML = (post.tags || []).map(t => `
        <span class="tag-item">#${this.escapeHtml(t)}</span>
      `).join('');

      // Show Edit/Delete if owner or admin
      const ownerActions = document.getElementById('postOwnerActions');
      if (this.user && (this.user.id === post.authorId || this.user.role === 'admin')) {
        ownerActions.classList.remove('hidden');
      } else {
        ownerActions.classList.add('hidden');
      }

      this.switchView('postDetailView');
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  async likeCurrentPost() {
    if (!this.currentPost) return;
    try {
      const data = await this.api(`/api/posts/${this.currentPost.id}/like`, { method: 'POST' });
      this.currentPost.likes = data.likes;
      document.getElementById('detailLikes').textContent = data.likes.toLocaleString();
      this.toast('게시글에 공감을 보냈습니다!');
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  copyPostUrl() {
    navigator.clipboard?.writeText(window.location.href);
    this.toast('게시글 링크가 클립보드에 복사되었습니다.');
  },

  async deletePost(postId) {
    if (!confirm('정말 이 게시글을 삭제하시겠습니까?')) return;
    try {
      await this.api(`/api/posts/${postId}`, { method: 'DELETE' });
      this.toast('게시글이 삭제되었습니다.');
      this.showHome();
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  // --- AUTHENTICATION & SIGNUP TOGGLE ---
  openAuthModal(mode = 'login') {
    document.getElementById('authModal').classList.remove('hidden');
    this.switchAuthTab(mode);
  },

  closeAuthModal() {
    document.getElementById('authModal').classList.add('hidden');
  },

  switchAuthTab(mode) {
    const isLogin = mode === 'login';
    document.getElementById('authModalTitle').textContent = isLogin ? '로그인' : '회원가입';
    document.getElementById('tabLoginBtn').classList.toggle('active', isLogin);
    document.getElementById('tabSignupBtn').classList.toggle('active', !isLogin);
    document.getElementById('loginForm').classList.toggle('hidden', !isLogin);
    document.getElementById('signupForm').classList.toggle('hidden', isLogin);

    if (!isLogin) {
      const allow = !!this.settings.allowSignup;
      document.getElementById('signupClosedNotice').classList.toggle('hidden', allow);
      document.getElementById('signupFieldsWrap').classList.toggle('hidden', !allow);
    }
  },

  async submitLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    try {
      const data = await this.api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      localStorage.setItem('blog_auth_token', data.token);
      this.user = data.user;
      this.closeAuthModal();
      await this.loadInitialState();
      this.toast(`${this.user.nickname}님, 환영합니다!`);
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  async submitSignup(e) {
    e.preventDefault();
    const username = document.getElementById('signupUsername').value.trim();
    const nickname = document.getElementById('signupNickname').value.trim();
    const password = document.getElementById('signupPassword').value;
    try {
      const data = await this.api('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ username, nickname, password })
      });
      localStorage.setItem('blog_auth_token', data.token);
      this.user = data.user;
      this.closeAuthModal();
      await this.loadInitialState();
      this.toast('회원가입이 완료되었습니다!');
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  async logout() {
    try {
      await this.api('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    localStorage.removeItem('blog_auth_token');
    this.user = null;
    this.renderAuthUI();
    this.showHome();
    this.toast('로그아웃되었습니다.');
  },

  // Instant One-Click Signup Allow/Block Toggle for Admin
  async quickToggleSignup() {
    try {
      const data = await this.api('/api/settings/toggle-signup', { method: 'POST' });
      this.settings.allowSignup = data.allowSignup;
      this.renderBrandingAndStats();
      this.toast(
        data.allowSignup
          ? '✅ 이제 방문자의 신규 회원가입이 허용됩니다.'
          : '🔒 신규 회원가입이 비활성화(차단)되었습니다.'
      );
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  // Admin Settings Modal
  openAdminModal() {
    const s = this.settings;
    document.getElementById('settingAllowSignup').checked = !!s.allowSignup;
    document.getElementById('settingBlogTitle').value = s.blogTitle || '';
    document.getElementById('settingBlogSubtitle').value = s.blogSubtitle || '';
    document.getElementById('settingCategories').value = this.categories.join(', ');
    document.getElementById('settingAdsenseEnabled').checked = !!s.adsenseEnabled;
    document.getElementById('settingAdsenseClientId').value = s.adsenseClientId || '';
    document.getElementById('settingShowAdPlaceholder').value = String(s.showAdPlaceholder !== false);
    document.getElementById('settingAdSlotTop').value = s.adSlotTop || '';
    document.getElementById('settingAdSlotInArticle').value = s.adSlotInArticle || '';
    document.getElementById('settingAdSlotSidebar').value = s.adSlotSidebar || '';
    document.getElementById('settingAdSlotBottom').value = s.adSlotBottom || '';

    document.getElementById('adminModal').classList.remove('hidden');
  },

  closeAdminModal() {
    document.getElementById('adminModal').classList.add('hidden');
  },

  async saveAdminSettings() {
    const catsRaw = document.getElementById('settingCategories').value
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);
    if (!catsRaw.includes('전체')) catsRaw.unshift('전체');

    const payload = {
      allowSignup: document.getElementById('settingAllowSignup').checked,
      blogTitle: document.getElementById('settingBlogTitle').value.trim(),
      blogSubtitle: document.getElementById('settingBlogSubtitle').value.trim(),
      categories: catsRaw,
      adsenseEnabled: document.getElementById('settingAdsenseEnabled').checked,
      adsenseClientId: document.getElementById('settingAdsenseClientId').value.trim(),
      showAdPlaceholder: document.getElementById('settingShowAdPlaceholder').value === 'true',
      adSlotTop: document.getElementById('settingAdSlotTop').value.trim(),
      adSlotInArticle: document.getElementById('settingAdSlotInArticle').value.trim(),
      adSlotSidebar: document.getElementById('settingAdSlotSidebar').value.trim(),
      adSlotBottom: document.getElementById('settingAdSlotBottom').value.trim()
    };

    try {
      const data = await this.api('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      this.settings = data.settings;
      this.categories = data.categories;
      this.renderBrandingAndStats();
      this.renderCategories();
      this.renderAdSenseSlots();
      this.closeAdminModal();
      this.toast('블로그 및 광고/회원가입 설정이 저장되었습니다.');
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  // Utilities
  toast(msg, isError = false) {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = 'toast-msg';
    if (isError) el.style.background = '#dc2626';
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  },

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  formatDate(iso, detailed = false) {
    if (!iso) return '';
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    if (!detailed) return `${yyyy}. ${mm}. ${dd}.`;
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}. ${mm}. ${dd}. ${hh}:${min}`;
  },

  formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
};

/* =========================================================
   NAVER SMART EDITOR ONE STYLE RICH EDITOR
   ========================================================= */
const editor = {
  editingPostId: null,
  attachments: [],
  selectedFigure: null,
  customThumbnail: '',

  initEvents() {
    const canvas = document.getElementById('editorCanvas');
    const dropZone = document.getElementById('seDropZone');

    // Click inside editor canvas: check if user clicked a photo figure
    canvas.addEventListener('click', (e) => {
      const fig = e.target.closest('figure.se-image');
      if (fig) {
        this.selectFigure(fig);
      } else {
        this.deselectFigure();
      }
    });

    // Drag & drop images or files directly into the editor
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--accent)';
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.style.borderColor = 'var(--border-color)';
    });
    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--border-color)';
      const files = e.dataTransfer?.files;
      if (!files || !files.length) return;

      const imageFiles = [];
      const otherFiles = [];
      Array.from(files).forEach(f => {
        if (f.type.startsWith('image/')) imageFiles.push(f);
        else otherFiles.push(f);
      });

      if (imageFiles.length) await this.handlePhotoFiles(imageFiles);
      if (otherFiles.length) await this.handleAttachmentFiles(otherFiles);
    });
  },

  openNew() {
    if (!app.user) {
      app.openAuthModal('login');
      return;
    }
    this.editingPostId = null;
    this.attachments = [];
    this.customThumbnail = '';
    this.deselectFigure();

    document.getElementById('editorTitleInput').value = '';
    document.getElementById('editorCanvas').innerHTML = '<p class="se-text"><br></p>';
    document.getElementById('editorTagsInput').value = '';

    // Restore local draft if available
    const savedDraft = localStorage.getItem('smartblog_draft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft.title || draft.content) {
          document.getElementById('editorSaveStatus').textContent = '임시저장된 글이 있습니다';
        }
      } catch (e) {}
    } else {
      document.getElementById('editorSaveStatus').textContent = '스마트 에디터 ONE';
    }

    this.renderEditorAttachments();
    app.switchView('editorView');
  },

  async openEdit(postId) {
    try {
      const data = await app.api(`/api/posts/${postId}?noView=1`);
      const post = data.post;
      this.editingPostId = post.id;
      this.attachments = Array.isArray(post.attachments) ? [...post.attachments] : [];
      this.customThumbnail = post.thumbnail || '';
      this.deselectFigure();

      document.getElementById('editorCategory').value = post.category;
      document.getElementById('editorTitleInput').value = post.title;
      document.getElementById('editorCanvas').innerHTML = post.content || '<p><br></p>';
      document.getElementById('editorTagsInput').value = (post.tags || []).join(', ');
      document.getElementById('editorSaveStatus').textContent = '게시글 수정 모드';

      this.renderEditorAttachments();
      app.switchView('editorView');
    } catch (err) {
      app.toast(err.message, true);
    }
  },

  cancel() {
    this.deselectFigure();
    if (this.editingPostId) {
      app.openPost(this.editingPostId);
    } else {
      app.showHome();
    }
  },

  saveDraftLocal() {
    const draft = {
      title: document.getElementById('editorTitleInput').value,
      content: document.getElementById('editorCanvas').innerHTML,
      tags: document.getElementById('editorTagsInput').value
    };
    localStorage.setItem('smartblog_draft', JSON.stringify(draft));
    document.getElementById('editorSaveStatus').textContent = '임시저장 완료 (' + new Date().toLocaleTimeString() + ')';
    app.toast('브라우저에 임시저장되었습니다.');
  },

  exec(command, value = null) {
    document.getElementById('editorCanvas').focus();
    document.execCommand(command, false, value);
  },

  execHeading(tag) {
    document.getElementById('editorCanvas').focus();
    document.execCommand('formatBlock', false, tag);
  },

  execFontFamily(font) {
    document.getElementById('editorCanvas').focus();
    document.execCommand('fontName', false, font);
  },

  insertHtmlBlock(html) {
    const canvas = document.getElementById('editorCanvas');
    canvas.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && canvas.contains(sel.anchorNode)) {
      document.execCommand('insertHTML', false, html);
    } else {
      canvas.insertAdjacentHTML('beforeend', html);
    }
  },

  insertQuote() {
    const html = `
      <blockquote class="se-quote se-quote-line">
        <p>"여기에 인상적인 인용구나 핵심 문장을 입력해 보세요."</p>
        <cite>— 출처 또는 작성자</cite>
      </blockquote>
      <p><br></p>
    `;
    this.insertHtmlBlock(html);
  },

  insertDivider() {
    const html = `<hr class="se-hr" /><p><br></p>`;
    this.insertHtmlBlock(html);
  },

  insertLinkBox() {
    const url = prompt('삽입할 링크 주소(URL)를 입력하세요:', 'https://');
    if (!url || url === 'https://') return;
    const title = prompt('링크 카드 제목을 입력하세요:', url) || url;
    const html = `
      <a class="se-link-card" href="${app.escapeHtml(url)}" target="_blank" rel="noopener noreferrer" contenteditable="false">
        <div>
          <strong style="display:block; font-size:0.95rem;">🔗 ${app.escapeHtml(title)}</strong>
          <span style="font-size:0.8rem; color:var(--text-muted);">${app.escapeHtml(url)}</span>
        </div>
        <i class="ri-external-link-line"></i>
      </a>
      <p><br></p>
    `;
    this.insertHtmlBlock(html);
  },

  insertAdBreak() {
    const html = `
      <div class="se-ad-break" contenteditable="false" style="padding:12px; margin:18px 0; border:1px dashed var(--accent); border-radius:8px; text-align:center; font-size:0.82rem; color:var(--accent); background:var(--accent-soft);">
        <i class="ri-advertisement-line"></i> [구글 애드센스 본문 중간 광고 삽입 위치]
      </div>
      <p><br></p>
    `;
    this.insertHtmlBlock(html);
  },

  // --- PHOTO UPLOAD & INLINE PHOTO CONTEXT CONTROLS ---
  triggerPhotoUpload() {
    const input = document.getElementById('hiddenPhotoInput');
    input.value = '';
    input.click();
  },

  async handlePhotoFiles(fileList) {
    for (const file of Array.from(fileList)) {
      try {
        document.getElementById('editorSaveStatus').textContent = '사진 업로드 중...';
        const formData = new FormData();
        formData.append('file', file);
        const uploaded = await app.api('/api/upload', {
          method: 'POST',
          body: formData
        });
        const figHtml = `
          <figure class="se-image se-align-center" style="width: 100%;">
            <img src="${uploaded.url}" alt="${app.escapeHtml(uploaded.originalName)}" />
            <figcaption>사진 설명을 입력하세요</figcaption>
          </figure>
          <p><br></p>
        `;
        this.insertHtmlBlock(figHtml);
        document.getElementById('editorSaveStatus').textContent = '사진 추가 완료';
      } catch (err) {
        app.toast(err.message, true);
      }
    }
  },

  selectFigure(fig) {
    this.deselectFigure();
    this.selectedFigure = fig;
    fig.classList.add('selected-figure');
    document.getElementById('sePhotoContextBar').classList.remove('hidden');
  },

  deselectFigure() {
    if (this.selectedFigure) {
      this.selectedFigure.classList.remove('selected-figure');
      this.selectedFigure = null;
    }
    document.getElementById('sePhotoContextBar')?.classList.add('hidden');
  },

  resizeSelectedImage(widthPct) {
    if (!this.selectedFigure) return;
    this.selectedFigure.style.width = widthPct;
  },

  alignSelectedImage(align) {
    if (!this.selectedFigure) return;
    this.selectedFigure.classList.remove('se-align-left', 'se-align-center', 'se-align-right');
    this.selectedFigure.classList.add(`se-align-${align}`);
  },

  toggleSelectedImageStyle(styleName) {
    if (!this.selectedFigure) return;
    this.selectedFigure.classList.toggle(`img-${styleName}`);
  },

  setAsThumbnail() {
    if (!this.selectedFigure) return;
    const img = this.selectedFigure.querySelector('img');
    if (img) {
      this.customThumbnail = img.getAttribute('src');
      app.toast('⭐ 이 사진이 게시글 대표 썸네일로 지정되었습니다.');
    }
  },

  removeSelectedImage() {
    if (!this.selectedFigure) return;
    this.selectedFigure.remove();
    this.deselectFigure();
  },

  // --- FILE ATTACHMENTS ---
  triggerFileUpload() {
    const input = document.getElementById('hiddenFileInput');
    input.value = '';
    input.click();
  },

  async handleAttachmentFiles(fileList) {
    for (const file of Array.from(fileList)) {
      try {
        document.getElementById('editorSaveStatus').textContent = '첨부파일 업로드 중...';
        const formData = new FormData();
        formData.append('file', file);
        const uploaded = await app.api('/api/upload', {
          method: 'POST',
          body: formData
        });
        this.attachments.push(uploaded);
        this.renderEditorAttachments();
        document.getElementById('editorSaveStatus').textContent = '파일 첨부 완료';
        app.toast(`첨부파일 추가됨: ${uploaded.originalName}`);
      } catch (err) {
        app.toast(err.message, true);
      }
    }
  },

  removeAttachment(index) {
    this.attachments.splice(index, 1);
    this.renderEditorAttachments();
  },

  renderEditorAttachments() {
    const countEl = document.getElementById('editorAttCount');
    const listEl = document.getElementById('editorAttachmentsList');
    countEl.textContent = this.attachments.length;

    if (!this.attachments.length) {
      listEl.innerHTML = `<p class="empty-hint">첨부된 파일이 없습니다. 상단 [파일첨부] 버튼을 누르거나 파일을 드래그해 넣어주세요.</p>`;
      return;
    }

    listEl.innerHTML = this.attachments.map((att, idx) => `
      <div class="attachment-item">
        <span><i class="ri-attachment-2"></i> ${app.escapeHtml(att.originalName)} <small style="color:var(--text-muted)">(${app.formatBytes(att.size)})</small></span>
        <button type="button" class="btn btn-ghost btn-xs text-danger" onclick="editor.removeAttachment(${idx})">
          <i class="ri-close-circle-line"></i> 삭제
        </button>
      </div>
    `).join('');
  },

  // --- PUBLISH POST ---
  async publish() {
    this.deselectFigure();
    const title = document.getElementById('editorTitleInput').value.trim();
    const category = document.getElementById('editorCategory').value;
    const content = document.getElementById('editorCanvas').innerHTML;
    const tagsRaw = document.getElementById('editorTagsInput').value;
    const tags = tagsRaw.split(',').map(t => t.replace(/^#/, '').trim()).filter(Boolean);

    if (!title) {
      app.toast('제목을 입력해 주세요.', true);
      document.getElementById('editorTitleInput').focus();
      return;
    }

    const payload = {
      title,
      category,
      content,
      tags,
      thumbnail: this.customThumbnail,
      attachments: this.attachments
    };

    try {
      let saved;
      if (this.editingPostId) {
        saved = await app.api(`/api/posts/${this.editingPostId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        app.toast('게시글이 수정되었습니다.');
      } else {
        saved = await app.api('/api/posts', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        localStorage.removeItem('smartblog_draft');
        app.toast('새 게시글이 발행되었습니다!');
      }
      await app.openPost(saved.post.id);
    } catch (err) {
      app.toast(err.message, true);
    }
  }
};

/* =========================================================
   SMART PHOTO STUDIO (IN-BROWSER CANVAS IMAGE EDITOR)
   - Rotate, Flip, Aspect Ratio Crop, Brightness/Contrast/Saturation, Presets
   ========================================================= */
const photoStudio = {
  sourceImage: null,
  rotation: 0,
  flipHorizontal: false,
  aspectRatio: 'free',
  preset: 'none',
  brightness: 100,
  contrast: 100,
  saturate: 100,

  openForSelected() {
    if (!editor.selectedFigure) {
      app.toast('먼저 본문에서 편집할 사진을 클릭해 주세요.');
      return;
    }
    const imgEl = editor.selectedFigure.querySelector('img');
    if (!imgEl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.sourceImage = img;
      this.reset();
      document.getElementById('photoStudioModal').classList.remove('hidden');
    };
    img.onerror = () => {
      app.toast('외부 보안 정책(CORS)이 적용된 샘플 이미지는 직접 업로드한 사진으로 테스트해 주세요.', true);
    };
    img.src = imgEl.src;
  },

  close() {
    document.getElementById('photoStudioModal').classList.add('hidden');
  },

  reset() {
    this.rotation = 0;
    this.flipHorizontal = false;
    this.aspectRatio = 'free';
    this.preset = 'none';
    this.brightness = 100;
    this.contrast = 100;
    this.saturate = 100;

    document.getElementById('sliderBrightness').value = 100;
    document.getElementById('sliderContrast').value = 100;
    document.getElementById('sliderSaturate').value = 100;
    document.querySelectorAll('.preset-chip').forEach((b, i) => b.classList.toggle('active', i === 0));

    this.renderCanvas();
  },

  rotate(deg) {
    this.rotation = (this.rotation + deg + 360) % 360;
    this.renderCanvas();
  },

  flipH() {
    this.flipHorizontal = !this.flipHorizontal;
    this.renderCanvas();
  },

  setAspect(ratio) {
    this.aspectRatio = ratio;
    this.renderCanvas();
  },

  applyPreset(presetName, btnEl) {
    this.preset = presetName;
    document.querySelectorAll('.preset-chip').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    this.renderCanvas();
  },

  updateSliders() {
    this.brightness = Number(document.getElementById('sliderBrightness').value);
    this.contrast = Number(document.getElementById('sliderContrast').value);
    this.saturate = Number(document.getElementById('sliderSaturate').value);
    this.renderCanvas();
  },

  getFilterString() {
    let f = `brightness(${this.brightness}%) contrast(${this.contrast}%) saturate(${this.saturate}%)`;
    if (this.preset === 'vivid') f += ' contrast(115%) saturate(135%)';
    else if (this.preset === 'warm') f += ' sepia(28%) brightness(104%) saturate(120%)';
    else if (this.preset === 'cool') f += ' hue-rotate(12deg) contrast(105%) saturate(90%)';
    else if (this.preset === 'bw') f += ' grayscale(100%) contrast(115%)';
    else if (this.preset === 'sepia') f += ' sepia(85%) contrast(105%)';
    return f;
  },

  renderCanvas() {
    if (!this.sourceImage) return;
    const canvas = document.getElementById('studioCanvas');
    const ctx = canvas.getContext('2d');

    const imgW = this.sourceImage.naturalWidth || this.sourceImage.width;
    const imgH = this.sourceImage.naturalHeight || this.sourceImage.height;

    // Determine crop box from source image center
    let sx = 0, sy = 0, sw = imgW, sh = imgH;
    if (this.aspectRatio !== 'free') {
      const targetRatio = Number(this.aspectRatio);
      const currentRatio = imgW / imgH;
      if (currentRatio > targetRatio) {
        sw = imgH * targetRatio;
        sx = (imgW - sw) / 2;
      } else {
        sh = imgW / targetRatio;
        sy = (imgH - sh) / 2;
      }
    }

    const isRotated90 = this.rotation === 90 || this.rotation === 270;
    const outW = isRotated90 ? sh : sw;
    const outH = isRotated90 ? sw : sh;

    // Cap max dimension to 1400px for crisp & fast upload
    const scale = Math.min(1, 1400 / Math.max(outW, outH));
    canvas.width = Math.round(outW * scale);
    canvas.height = Math.round(outH * scale);

    ctx.save();
    ctx.filter = this.getFilterString();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((this.rotation * Math.PI) / 180);
    if (this.flipHorizontal) ctx.scale(-1, 1);

    const drawW = isRotated90 ? canvas.height : canvas.width;
    const drawH = isRotated90 ? canvas.width : canvas.height;
    ctx.drawImage(this.sourceImage, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  },

  async saveAndApply() {
    const canvas = document.getElementById('studioCanvas');
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const formData = new FormData();
        formData.append('file', blob, 'edited-photo.jpg');
        const uploaded = await app.api('/api/upload', {
          method: 'POST',
          body: formData
        });
        if (editor.selectedFigure) {
          const img = editor.selectedFigure.querySelector('img');
          if (img) img.src = uploaded.url;
        }
        this.close();
        app.toast('✨ 편집된 사진이 본문에 즉시 반영되었습니다!');
      } catch (err) {
        app.toast(err.message, true);
      }
    }, 'image/jpeg', 0.92);
  }
};

window.addEventListener('DOMContentLoaded', () => app.init());
