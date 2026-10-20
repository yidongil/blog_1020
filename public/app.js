/* =========================================================
   SMART BLOG FRONTEND APPLICATION
   - Minimalist Responsive Blog + View Counter + AdSense
   - Auth System with Instant Signup Allow/Block Toggle
   - Dedicated Full-Page Admin Console (General, AdSense ON/OFF by Main/Post, Posts, Users)
   - Naver SmartEditor ONE Style Rich Block & Text Editor with Locked Sticky Toolbars
   - Built-in Canvas Photo Studio with Interactive Mouse Drag/Resize Crop Box
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
  adminPosts: [],
  adminPostFilter: 'all',
  stats: { totalPosts: 0, totalDrafts: 0, totalViews: 0, totalUsers: 0 },
  currentCategory: '전체',
  currentSort: 'latest',
  currentPost: null,

  async init() {
    if (localStorage.getItem('blog_theme') === 'dark') {
      document.body.classList.add('dark-mode');
    }

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
    photoStudio.initCropEvents();
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
      this.stats = data.stats || { totalPosts: 0, totalViews: 0, totalUsers: 0 };

      this.renderBrandingAndStats(this.stats);
      this.renderAuthUI();
      this.renderCategories();
      this.renderAdSenseSlots();
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  renderBrandingAndStats(stats = this.stats) {
    this.stats = { ...this.stats, ...stats };
    const title = this.settings.blogTitle || 'MINIMAL LOG.';
    const subtitle = this.settings.blogSubtitle || '';
    document.title = `${title} — 스마트 블로그`;
    document.getElementById('headerBlogTitle').textContent = title;
    document.getElementById('sidebarBlogTitle').textContent = title;
    document.getElementById('footerBlogTitle').textContent = title;
    document.getElementById('heroSubtitle').textContent = subtitle;
    document.getElementById('sidebarBlogDesc').textContent = subtitle;

    if (this.stats.totalPosts !== undefined) {
      document.getElementById('statTotalPosts').textContent = this.stats.totalPosts.toLocaleString();
    }
    if (this.stats.totalViews !== undefined) {
      document.getElementById('statTotalViews').textContent = this.stats.totalViews.toLocaleString();
    }

    // Signup status indicators
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

    const quickDot = document.getElementById('quickSignupDot');
    const quickText = document.getElementById('quickSignupText');
    if (quickDot && quickText) {
      quickDot.className = 'status-indicator ' + (allow ? '' : 'closed');
      quickText.textContent = allow ? '회원가입 허용됨 (ON)' : '회원가입 차단됨 (OFF)';
    }

    // Update Admin Dashboard KPIs if present
    const kpiPosts = document.getElementById('adminKpiPosts');
    if (kpiPosts) {
      kpiPosts.textContent = (this.stats.totalPosts || 0).toLocaleString();
      document.getElementById('adminKpiViews').textContent = (this.stats.totalViews || 0).toLocaleString();
      document.getElementById('adminKpiUsers').textContent = (this.stats.totalUsers || 0).toLocaleString();
      document.getElementById('adminKpiSignupBadge').textContent = allow ? '신규 회원가입 허용 중' : '회원가입 차단됨';

      const masterOn = !!this.settings.adsenseEnabled;
      const mainOn = masterOn && this.settings.adMainEnabled !== false;
      const postOn = masterOn && this.settings.adPostEnabled !== false;
      document.getElementById('adminKpiAds').textContent = masterOn ? 'ON' : 'OFF';
      document.getElementById('adminKpiAdsSub').textContent =
        `메인페이지 ${mainOn ? 'ON' : 'OFF'} · 게시글 ${postOn ? 'ON' : 'OFF'}`;
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

    const editorSelect = document.getElementById('editorCategory');
    const writableCats = this.categories.filter(c => c !== '전체');
    editorSelect.innerHTML = (writableCats.length ? writableCats : ['일상/생각']).map(cat => `
      <option value="${this.escapeHtml(cat)}">${this.escapeHtml(cat)}</option>
    `).join('');
  },

  // Render Google AdSense slots respecting Master, Main Page, Post Page, and individual switches
  renderAdSenseSlots() {
    const s = this.settings;
    const masterOn = !!s.adsenseEnabled;
    const mainPageOn = masterOn && s.adMainEnabled !== false;
    const postPageOn = masterOn && s.adPostEnabled !== false;

    const slots = [
      {
        id: 'adSlotTopContainer',
        enabled: mainPageOn && s.adTopEnabled !== false,
        slotId: s.adSlotTop,
        label: '메인페이지 상단 배너 광고 (Google AdSense)',
        height: '90px'
      },
      {
        id: 'adSlotSidebarContainer',
        enabled: mainPageOn && s.adSidebarEnabled !== false,
        slotId: s.adSlotSidebar,
        label: '메인페이지 사이드바 광고 (Google AdSense)',
        height: '240px'
      },
      {
        id: 'adSlotInArticleContainer',
        enabled: postPageOn && s.adInArticleEnabled !== false,
        slotId: s.adSlotInArticle,
        label: '게시글 본문 내 반응형 광고 (Google AdSense)',
        height: '120px'
      },
      {
        id: 'adSlotBottomContainer',
        enabled: postPageOn && s.adBottomEnabled !== false,
        slotId: s.adSlotBottom,
        label: '게시글 하단 추천 콘텐츠 광고 (Google AdSense)',
        height: '110px'
      }
    ];

    if (masterOn && s.adsenseClientId && !s.adsenseClientId.includes('00000000')) {
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
      if (!item.enabled) {
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
            <div class="ad-placeholder-sub">Client: <code>${clientId}</code> · Slot: <code>${slotCode}</code> (관리자 페이지에서 ON/OFF 제어 가능)</div>
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
            <div>
              <span class="post-no-pill">No. ${post.postNumber || 1}</span>
              <span class="post-card-cat">${this.escapeHtml(post.category)}</span>
            </div>
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
    ['homeView', 'postDetailView', 'editorView', 'adminPageView'].forEach(id => {
      document.getElementById(id)?.classList.toggle('hidden', id !== viewId);
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

      document.getElementById('detailPostNumber').textContent = `No. ${post.postNumber || 1}`;
      document.getElementById('detailCategory').textContent = post.category;
      const draftBadge = document.getElementById('detailDraftBadge');
      if (draftBadge) {
        draftBadge.classList.toggle('hidden', post.status !== 'draft');
      }
      document.getElementById('detailTitle').textContent = post.title;
      document.getElementById('detailAuthor').textContent = post.authorName || '작성자';
      document.getElementById('detailDate').textContent = this.formatDate(post.createdAt, true);
      document.getElementById('detailViews').textContent = (post.views || 0).toLocaleString();
      document.getElementById('detailLikes').textContent = (post.likes || 0).toLocaleString();

      // Render content & handle custom in-article ad breaks according to Post Ads ON/OFF settings
      let renderedContent = post.content || '';
      const s = this.settings;
      const inArticleAdOn = !!s.adsenseEnabled && s.adPostEnabled !== false && s.adInArticleEnabled !== false;
      if (inArticleAdOn) {
        const inlineAdHtml = `
          <div class="ad-placeholder-box" style="margin:24px 0;">
            <span class="ad-badge">AD · IN-ARTICLE</span>
            <div class="ad-placeholder-title"><i class="ri-google-fill"></i> 게시글 본문 중간 구글 애드센스 광고</div>
          </div>
        `;
        renderedContent = renderedContent.replace(/<div class="se-ad-break"[^>]*>[\s\S]*?<\/div>/gi, inlineAdHtml);
      } else {
        renderedContent = renderedContent.replace(/<div class="se-ad-break"[^>]*>[\s\S]*?<\/div>/gi, '');
      }
      document.getElementById('detailContent').innerHTML = renderedContent;

      this.renderAdSenseSlots();

      // Attachments Box
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

      // Tags
      const tagsEl = document.getElementById('detailTags');
      tagsEl.innerHTML = (post.tags || []).map(t => `
        <span class="tag-item">#${this.escapeHtml(t)}</span>
      `).join('');

      // Owner actions
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

  async deletePost(postId, stayOnAdmin = false) {
    if (!confirm('정말 이 게시글을 삭제하시겠습니까?')) return;
    try {
      await this.api(`/api/posts/${postId}`, { method: 'DELETE' });
      this.toast('게시글이 삭제되었습니다.');
      if (stayOnAdmin) {
        await this.loadAdminTables();
      } else {
        this.showHome();
      }
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  // --- AUTHENTICATION ---
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

  async quickToggleSignup() {
    try {
      const data = await this.api('/api/settings/toggle-signup', { method: 'POST' });
      this.settings.allowSignup = data.allowSignup;
      const checkbox = document.getElementById('settingAllowSignup');
      if (checkbox) checkbox.checked = !!data.allowSignup;
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

  // --- DEDICATED FULL-PAGE ADMIN DASHBOARD ---
  async openAdminPage(defaultTab = 'general') {
    if (!this.user || this.user.role !== 'admin') {
      this.toast('관리자 권한이 필요합니다.', true);
      return;
    }
    const s = this.settings;
    document.getElementById('settingAllowSignup').checked = !!s.allowSignup;
    document.getElementById('settingBlogTitle').value = s.blogTitle || '';
    document.getElementById('settingBlogSubtitle').value = s.blogSubtitle || '';
    document.getElementById('settingCategories').value = this.categories.join(', ');

    document.getElementById('settingAdsenseEnabled').checked = !!s.adsenseEnabled;
    document.getElementById('settingAdMainEnabled').checked = s.adMainEnabled !== false;
    document.getElementById('settingAdPostEnabled').checked = s.adPostEnabled !== false;
    document.getElementById('settingAdTopEnabled').checked = s.adTopEnabled !== false;
    document.getElementById('settingAdSidebarEnabled').checked = s.adSidebarEnabled !== false;
    document.getElementById('settingAdInArticleEnabled').checked = s.adInArticleEnabled !== false;
    document.getElementById('settingAdBottomEnabled').checked = s.adBottomEnabled !== false;

    document.getElementById('settingAdsenseClientId').value = s.adsenseClientId || '';
    document.getElementById('settingShowAdPlaceholder').value = String(s.showAdPlaceholder !== false);
    document.getElementById('settingAdSlotTop').value = s.adSlotTop || '';
    document.getElementById('settingAdSlotInArticle').value = s.adSlotInArticle || '';
    document.getElementById('settingAdSlotSidebar').value = s.adSlotSidebar || '';
    document.getElementById('settingAdSlotBottom').value = s.adSlotBottom || '';

    document.getElementById('userDropdown')?.classList.add('hidden');
    this.switchView('adminPageView');
    this.switchAdminTab(defaultTab);
    await this.loadAdminTables();
  },

  switchAdminTab(tabName) {
    document.querySelectorAll('.admin-nav-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    const map = {
      general: 'adminTabGeneral',
      ads: 'adminTabAds',
      posts: 'adminTabPosts',
      users: 'adminTabUsers'
    };
    Object.entries(map).forEach(([key, panelId]) => {
      document.getElementById(panelId)?.classList.toggle('hidden', key !== tabName);
    });
  },

  setAdminPostFilter(filterType) {
    this.adminPostFilter = filterType;
    document.querySelectorAll('.admin-status-filter .filter-chip').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filterType);
    });
    this.renderAdminPostsTable();
  },

  renderAdminPostsTable() {
    const postsTbody = document.getElementById('adminPostsTableBody');
    if (!postsTbody) return;

    const allPosts = this.adminPosts || [];
    const pubCount = allPosts.filter(p => p.status !== 'draft').length;
    const draftCount = allPosts.filter(p => p.status === 'draft').length;

    const cAll = document.getElementById('adminCountAll');
    const cPub = document.getElementById('adminCountPublished');
    const cDraft = document.getElementById('adminCountDraft');
    if (cAll) cAll.textContent = allPosts.length;
    if (cPub) cPub.textContent = pubCount;
    if (cDraft) cDraft.textContent = draftCount;

    const filtered = allPosts.filter(p => {
      if (this.adminPostFilter === 'published') return p.status !== 'draft';
      if (this.adminPostFilter === 'draft') return p.status === 'draft';
      return true;
    });

    if (!filtered.length) {
      postsTbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:28px; color:var(--text-muted);">
            해당 조건의 게시글이 없습니다.
          </td>
        </tr>
      `;
      return;
    }

    postsTbody.innerHTML = filtered.map(p => {
      const isDraft = p.status === 'draft';
      const statusBadge = isDraft
        ? `<span class="status-pill-draft">임시저장</span>`
        : `<span class="status-pill-published">발행됨</span>`;

      return `
        <tr>
          <td><span class="post-no-pill">No. ${p.postNumber || 1}</span></td>
          <td>${statusBadge}</td>
          <td><span class="role-badge">${this.escapeHtml(p.category)}</span></td>
          <td>
            <strong style="cursor:pointer;" onclick="${isDraft ? `editor.openEdit('${p.id}')` : `app.openPost('${p.id}')`}">
              ${this.escapeHtml(p.title)}
            </strong>
          </td>
          <td>${this.escapeHtml(p.authorName || '관리자')}</td>
          <td>${this.formatDate(p.updatedAt || p.createdAt, true)}</td>
          <td>
            <div style="display:flex; align-items:center; gap:6px;">
              <input type="number" min="0" class="view-edit-input" id="viewInput_${p.id}" value="${p.views || 0}" />
              <button class="btn btn-outline btn-xs" onclick="app.updatePostViews('${p.id}')">적용</button>
            </div>
          </td>
          <td>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              ${isDraft
                ? `<button class="btn btn-primary btn-xs" onclick="app.publishDraftNow('${p.id}')">발행하기</button>`
                : ''
              }
              <button class="btn btn-outline btn-xs" onclick="editor.openEdit('${p.id}')">
                ${isDraft ? '이어쓰기' : '수정'}
              </button>
              <button class="btn btn-outline btn-xs text-danger" onclick="app.deletePost('${p.id}', true)">삭제</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async publishDraftNow(postId) {
    try {
      await this.api(`/api/posts/${postId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'published' })
      });
      await this.loadAdminTables();
      this.toast('임시저장 글이 정식 발행되었습니다!');
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  async loadAdminTables() {
    try {
      const [initRes, postsRes, usersRes] = await Promise.all([
        this.api('/api/init'),
        this.api('/api/posts?includeDrafts=1'),
        this.api('/api/users')
      ]);
      this.adminPosts = postsRes.posts || [];
      this.renderBrandingAndStats(initRes.stats);
      this.renderAdminPostsTable();

      // Render Users Management Table
      const usersTbody = document.getElementById('adminUsersTableBody');
      if (usersTbody) {
        const users = usersRes.users || [];
        usersTbody.innerHTML = users.map(u => `
          <tr>
            <td><strong>@${this.escapeHtml(u.username)}</strong></td>
            <td>${this.escapeHtml(u.nickname)}</td>
            <td><span class="role-badge">${u.role.toUpperCase()}</span></td>
            <td>${this.formatDate(u.createdAt, true)}</td>
            <td>
              ${u.role === 'admin'
                ? '<span style="font-size:0.78rem; color:var(--text-muted);">기본 관리자</span>'
                : `<button class="btn btn-outline btn-xs text-danger" onclick="app.deleteUser('${u.id}')">회원 삭제</button>`
              }
            </td>
          </tr>
        `).join('');
      }
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  async updatePostViews(postId) {
    const val = document.getElementById(`viewInput_${postId}`)?.value;
    try {
      await this.api(`/api/posts/${postId}/views`, {
        method: 'PUT',
        body: JSON.stringify({ views: Number(val) })
      });
      await this.loadAdminTables();
      this.toast('조회수가 업데이트되었습니다.');
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  async deleteUser(userId) {
    if (!confirm('이 회원을 삭제하시겠습니까?')) return;
    try {
      await this.api(`/api/users/${userId}`, { method: 'DELETE' });
      await this.loadAdminTables();
      this.toast('회원이 삭제되었습니다.');
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  async saveAdminSettings(silentToggle = false) {
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
      adMainEnabled: document.getElementById('settingAdMainEnabled').checked,
      adPostEnabled: document.getElementById('settingAdPostEnabled').checked,
      adTopEnabled: document.getElementById('settingAdTopEnabled').checked,
      adSidebarEnabled: document.getElementById('settingAdSidebarEnabled').checked,
      adInArticleEnabled: document.getElementById('settingAdInArticleEnabled').checked,
      adBottomEnabled: document.getElementById('settingAdBottomEnabled').checked,
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
      this.toast(silentToggle ? '설정이 즉시 반영되었습니다.' : '모든 관리자 설정이 저장되었습니다.');
    } catch (err) {
      this.toast(err.message, true);
    }
  },

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

    canvas.addEventListener('click', (e) => {
      const fig = e.target.closest('figure.se-image');
      if (fig) {
        this.selectFigure(fig);
      } else {
        this.deselectFigure();
      }
    });

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
    document.getElementById('editorSaveStatus').textContent = '스마트 에디터 ONE';
    const noBadge = document.getElementById('editorPostNoBadge');
    if (noBadge) noBadge.textContent = '새 게시글 (발행/임시저장 시 번호 자동 부여)';

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
      document.getElementById('editorSaveStatus').textContent =
        post.status === 'draft' ? `임시저장 글 편집 중 (No. ${post.postNumber || 1})` : `게시글 수정 모드 (No. ${post.postNumber || 1})`;
      const noBadge = document.getElementById('editorPostNoBadge');
      if (noBadge) {
        noBadge.textContent = `No. ${post.postNumber || 1} · ${post.status === 'draft' ? '임시저장 상태' : '발행됨'}`;
      }

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

  // Save directly to server as a draft post so it is managed in Admin -> Posts & View Count Management
  async saveAsServerDraft() {
    this.deselectFigure();
    const rawTitle = document.getElementById('editorTitleInput').value.trim();
    const title = rawTitle || `(임시저장) ${new Date().toLocaleString('ko-KR')}`;
    const category = document.getElementById('editorCategory').value;
    const content = document.getElementById('editorCanvas').innerHTML;
    const tagsRaw = document.getElementById('editorTagsInput').value;
    const tags = tagsRaw.split(',').map(t => t.replace(/^#/, '').trim()).filter(Boolean);

    const payload = {
      title,
      category,
      content,
      tags,
      status: 'draft',
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
      } else {
        saved = await app.api('/api/posts', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        this.editingPostId = saved.post.id;
      }

      const postNo = saved.post.postNumber || 1;
      document.getElementById('editorTitleInput').value = saved.post.title;
      document.getElementById('editorSaveStatus').textContent =
        `임시저장 완료 (No. ${postNo} · ${new Date().toLocaleTimeString()})`;
      const noBadge = document.getElementById('editorPostNoBadge');
      if (noBadge) noBadge.textContent = `No. ${postNo} · 임시저장 상태`;

      app.toast(`📁 No. ${postNo} 게시글이 [게시글 및 조회수 관리]에 임시저장되었습니다.`);
    } catch (err) {
      app.toast(err.message, true);
    }
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
      status: 'published',
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
   SMART PHOTO STUDIO WITH INTERACTIVE MOUSE DRAG CROP BOX
   ========================================================= */
const photoStudio = {
  originalImage: null,
  workingImage: null,
  rotation: 0,
  flipHorizontal: false,
  aspectRatio: 'free',
  preset: 'none',
  brightness: 100,
  contrast: 100,
  saturate: 100,

  // Normalized crop box coordinates (0..1 relative to displayed canvas)
  cropRect: { x: 0, y: 0, w: 1, h: 1 },
  dragState: null,

  initCropEvents() {
    const overlay = document.getElementById('cropOverlayBox');
    const stage = document.getElementById('studioStage');
    if (!overlay || !stage) return;

    const onPointerDown = (e) => {
      if (overlay.classList.contains('hidden')) return;
      e.preventDefault();
      e.stopPropagation();

      const handleEl = e.target.closest('.crop-handle');
      const mode = handleEl ? handleEl.dataset.handle : 'move';
      const canvas = document.getElementById('studioCanvas');
      const rect = canvas.getBoundingClientRect();

      this.dragState = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        canvasW: rect.width,
        canvasH: rect.height,
        startCrop: { ...this.cropRect }
      };
    };

    const onPointerMove = (e) => {
      if (!this.dragState) return;
      e.preventDefault();
      const { mode, startX, startY, canvasW, canvasH, startCrop } = this.dragState;
      if (!canvasW || !canvasH) return;

      const dx = (e.clientX - startX) / canvasW;
      const dy = (e.clientY - startY) / canvasH;
      const minSize = 0.08;
      let { x, y, w, h } = startCrop;

      if (mode === 'move') {
        x = Math.max(0, Math.min(1 - w, x + dx));
        y = Math.max(0, Math.min(1 - h, y + dy));
      } else {
        if (mode.includes('w')) {
          const maxDelta = w - minSize;
          const d = Math.max(-x, Math.min(maxDelta, dx));
          x += d;
          w -= d;
        }
        if (mode.includes('e')) {
          w = Math.max(minSize, Math.min(1 - x, w + dx));
        }
        if (mode.includes('n')) {
          const maxDelta = h - minSize;
          const d = Math.max(-y, Math.min(maxDelta, dy));
          y += d;
          h -= d;
        }
        if (mode.includes('s')) {
          h = Math.max(minSize, Math.min(1 - y, h + dy));
        }

        // Enforce aspect ratio if locked
        if (this.aspectRatio !== 'free') {
          const canvas = document.getElementById('studioCanvas');
          const targetPxRatio = Number(this.aspectRatio);
          const normRatio = targetPxRatio * (canvas.height / canvas.width);
          h = Math.min(1 - y, w / normRatio);
          w = h * normRatio;
        }
      }

      this.cropRect = { x, y, w, h };
      this.updateCropOverlayUI();
    };

    const onPointerUp = () => {
      this.dragState = null;
    };

    overlay.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', () => {
      if (!document.getElementById('photoStudioModal').classList.contains('hidden')) {
        this.updateCropOverlayUI();
      }
    });
  },

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
      this.originalImage = img;
      this.workingImage = img;
      document.getElementById('photoStudioModal').classList.remove('hidden');
      this.reset();
    };
    img.onerror = () => {
      app.toast('이미지를 불러올 수 없습니다.', true);
    };
    img.src = imgEl.src;
  },

  close() {
    document.getElementById('photoStudioModal').classList.add('hidden');
  },

  reset() {
    this.workingImage = this.originalImage;
    this.rotation = 0;
    this.flipHorizontal = false;
    this.aspectRatio = 'free';
    this.preset = 'none';
    this.brightness = 100;
    this.contrast = 100;
    this.saturate = 100;
    this.cropRect = { x: 0, y: 0, w: 1, h: 1 };

    document.getElementById('sliderBrightness').value = 100;
    document.getElementById('sliderContrast').value = 100;
    document.getElementById('sliderSaturate').value = 100;
    document.querySelectorAll('.preset-chip').forEach((b, i) => b.classList.toggle('active', i === 0));

    this.renderCanvas();
  },

  resetCropSelection() {
    this.aspectRatio = 'free';
    this.cropRect = { x: 0, y: 0, w: 1, h: 1 };
    this.updateCropOverlayUI();
  },

  rotate(deg) {
    this.rotation = (this.rotation + deg + 360) % 360;
    this.cropRect = { x: 0, y: 0, w: 1, h: 1 };
    this.renderCanvas();
  },

  flipH() {
    this.flipHorizontal = !this.flipHorizontal;
    this.renderCanvas();
  },

  setAspect(ratio) {
    this.aspectRatio = ratio;
    const canvas = document.getElementById('studioCanvas');
    if (!canvas.width || !canvas.height) return;

    if (ratio === 'free') {
      this.cropRect = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
    } else {
      const targetRatio = Number(ratio);
      const canvasRatio = canvas.width / canvas.height;
      let w = 0.8, h = 0.8;
      if (canvasRatio > targetRatio) {
        h = 0.8;
        w = (h * canvas.height * targetRatio) / canvas.width;
      } else {
        w = 0.8;
        h = (w * canvas.width / targetRatio) / canvas.height;
      }
      this.cropRect = {
        x: (1 - w) / 2,
        y: (1 - h) / 2,
        w,
        h
      };
    }
    this.updateCropOverlayUI();
  },

  // Immediately crop the canvas to the mouse-selected region so user sees the cropped result
  applyInteractiveCrop() {
    const canvas = document.getElementById('studioCanvas');
    const { x, y, w, h } = this.cropRect;
    if (w >= 0.99 && h >= 0.99 && x <= 0.01 && y <= 0.01) {
      app.toast('마우스로 초록색 자르기 박스의 모서리를 드래그해 줄인 뒤 눌러주세요.');
      return;
    }

    const sx = Math.round(x * canvas.width);
    const sy = Math.round(y * canvas.height);
    const sw = Math.max(16, Math.round(w * canvas.width));
    const sh = Math.max(16, Math.round(h * canvas.height));

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sw;
    tempCanvas.height = sh;
    const tCtx = tempCanvas.getContext('2d');
    tCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

    const croppedImg = new Image();
    croppedImg.onload = () => {
      this.workingImage = croppedImg;
      this.rotation = 0;
      this.flipHorizontal = false;
      this.cropRect = { x: 0, y: 0, w: 1, h: 1 };
      this.renderCanvas();
      app.toast('✂️ 선택한 영역으로 사진이 잘렸습니다!');
    };
    croppedImg.src = tempCanvas.toDataURL('image/png');
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
    if (!this.workingImage) return;
    const canvas = document.getElementById('studioCanvas');
    const ctx = canvas.getContext('2d');

    const imgW = this.workingImage.naturalWidth || this.workingImage.width || 800;
    const imgH = this.workingImage.naturalHeight || this.workingImage.height || 500;

    const isRotated90 = this.rotation === 90 || this.rotation === 270;
    const outW = isRotated90 ? imgH : imgW;
    const outH = isRotated90 ? imgW : imgH;

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
    ctx.drawImage(this.workingImage, 0, 0, imgW, imgH, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    requestAnimationFrame(() => this.updateCropOverlayUI());
  },

  updateCropOverlayUI() {
    const canvas = document.getElementById('studioCanvas');
    const overlay = document.getElementById('cropOverlayBox');
    const badge = document.getElementById('cropSizeBadge');
    if (!canvas || !overlay) return;

    overlay.classList.remove('hidden');
    const displayW = canvas.clientWidth || canvas.width;
    const displayH = canvas.clientHeight || canvas.height;

    const { x, y, w, h } = this.cropRect;
    overlay.style.left = `${x * displayW}px`;
    overlay.style.top = `${y * displayH}px`;
    overlay.style.width = `${w * displayW}px`;
    overlay.style.height = `${h * displayH}px`;

    if (badge) {
      const pxW = Math.round(w * canvas.width);
      const pxH = Math.round(h * canvas.height);
      badge.textContent = `${pxW} × ${pxH}px`;
    }
  },

  async saveAndApply() {
    const sourceCanvas = document.getElementById('studioCanvas');
    const { x, y, w, h } = this.cropRect;

    // Export using the current mouse-selected crop box automatically
    const outCanvas = document.createElement('canvas');
    const sx = Math.round(x * sourceCanvas.width);
    const sy = Math.round(y * sourceCanvas.height);
    const sw = Math.max(16, Math.round(w * sourceCanvas.width));
    const sh = Math.max(16, Math.round(h * sourceCanvas.height));
    outCanvas.width = sw;
    outCanvas.height = sh;
    outCanvas.getContext('2d').drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

    outCanvas.toBlob(async (blob) => {
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
        app.toast('✨ 자르기 및 보정이 적용된 사진이 본문에 반영되었습니다!');
      } catch (err) {
        app.toast(err.message, true);
      }
    }, 'image/jpeg', 0.92);
  }
};

window.addEventListener('DOMContentLoaded', () => app.init());
