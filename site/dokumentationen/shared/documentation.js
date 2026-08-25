(() => {
  const themeStorageKey = 'ugur-dokumentation-theme';
  const validTheme = (value) => value === 'light' || value === 'dark';
  const themeButtons = [...document.querySelectorAll('[data-theme-option]')];
  const themeStatus = document.querySelector('[data-theme-status]');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const urlTheme = new URLSearchParams(window.location.search).get('theme');
  let savedTheme = null;

  try {
    const storedTheme = window.localStorage.getItem(themeStorageKey);
    if (validTheme(storedTheme)) savedTheme = storedTheme;
  } catch (_) {}

  let hasExplicitTheme = validTheme(urlTheme) || validTheme(savedTheme);

  const withThemeParameter = (rawHref, theme) => {
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('/') || rawHref.startsWith('\\')) return rawHref;
    if (/^[a-z][a-z\d+.-]*:/i.test(rawHref)) return rawHref;

    const hashIndex = rawHref.indexOf('#');
    const hash = hashIndex >= 0 ? rawHref.slice(hashIndex) : '';
    const withoutHash = hashIndex >= 0 ? rawHref.slice(0, hashIndex) : rawHref;
    const queryIndex = withoutHash.indexOf('?');
    const relativePath = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
    if (!/\.html$/i.test(relativePath)) return rawHref;

    const query = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : '';
    const parameters = new URLSearchParams(query);
    parameters.set('theme', theme);
    return `${relativePath}?${parameters.toString()}${hash}`;
  };

  const propagateThemeToLocalLinks = (theme) => {
    document.querySelectorAll('a[href]').forEach((link) => {
      const rawHref = link.getAttribute('href');
      const themedHref = withThemeParameter(rawHref, theme);
      if (themedHref !== rawHref) link.setAttribute('href', themedHref);
    });
  };

  const applyTheme = (theme, persist = false) => {
    const normalizedTheme = theme === 'dark' ? 'dark' : 'light';

    if (persist) {
      hasExplicitTheme = true;
      try {
        window.localStorage.setItem(themeStorageKey, normalizedTheme);
      } catch (_) {}
    }

    document.documentElement.dataset.theme = normalizedTheme;
    themeButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.themeOption === normalizedTheme));
    });
    if (themeStatus) {
      themeStatus.textContent = `Aktiv: ${normalizedTheme === 'dark' ? 'Dunkel' : 'Hell'}`;
    }
    if (themeColor) {
      themeColor.setAttribute('content', normalizedTheme === 'dark' ? '#0b0f14' : '#12394a');
    }
    if (hasExplicitTheme) propagateThemeToLocalLinks(normalizedTheme);
  };

  themeButtons.forEach((button) => {
    button.addEventListener('click', () => applyTheme(button.dataset.themeOption, true));
  });

  systemThemeQuery.addEventListener('change', (event) => {
    if (!hasExplicitTheme) applyTheme(event.matches ? 'dark' : 'light');
  });

  const initialTheme = validTheme(urlTheme)
    ? urlTheme
    : (validTheme(savedTheme)
      ? savedTheme
      : (document.documentElement.dataset.theme || (systemThemeQuery.matches ? 'dark' : 'light')));
  applyTheme(initialTheme);

  const layout = document.querySelector('[data-doc-layout]');
  const sidebar = document.getElementById('doc-sidebar');
  const toggle = document.querySelector('[data-nav-toggle]');
  const label = toggle?.querySelector('[data-nav-label]');
  const closeControls = document.querySelectorAll('[data-nav-close]');
  const pageLinks = [...document.querySelectorAll('[data-doc-nav]')];
  const sections = [...document.querySelectorAll('.doc-observed-section')];
  const mobileQuery = window.matchMedia('(max-width: 900px)');

  if (!layout || !sidebar || !toggle || !label) return;

  let lastToggle = toggle;
  let mobileNavigationScrollY = null;
  let pendingMobileNavigationLock = null;
  let pendingMobileNavigationLockTimer = null;

  const isOpen = () => layout.dataset.navOpen === 'true';

  const keepSidebarLinkVisible = (link) => {
    if (!link || (mobileQuery.matches && !isOpen())) return;
    if (typeof link.getBoundingClientRect !== 'function' || typeof sidebar.getBoundingClientRect !== 'function') return;

    const linkRect = link.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();
    const edgePadding = 16;
    if (linkRect.top < sidebarRect.top + edgePadding) {
      sidebar.scrollTop += linkRect.top - sidebarRect.top - edgePadding;
    } else if (linkRect.bottom > sidebarRect.bottom - edgePadding) {
      sidebar.scrollTop += linkRect.bottom - sidebarRect.bottom + edgePadding;
    }
  };

  const setMobileNavigationLock = (locked, preserveScroll) => {
    if (locked) {
      const lockSnapshot = pendingMobileNavigationLock;
      pendingMobileNavigationLock = null;
      if (pendingMobileNavigationLockTimer !== null) {
        window.clearTimeout(pendingMobileNavigationLockTimer);
        pendingMobileNavigationLockTimer = null;
      }
      mobileNavigationScrollY = lockSnapshot?.scrollY ?? window.scrollY;
      const lockWidth = lockSnapshot?.bodyWidth ?? document.body.getBoundingClientRect().width;
      document.body.style.setProperty('--doc-nav-lock-width', `${lockWidth}px`);
      document.documentElement.classList.add('doc-nav-lock');
      document.body.classList.add('doc-nav-lock');
      return;
    }

    const restoreY = mobileNavigationScrollY;
    mobileNavigationScrollY = null;
    document.documentElement.classList.remove('doc-nav-lock');
    document.body.classList.remove('doc-nav-lock');
    document.body.style.removeProperty('--doc-nav-lock-width');
    if (preserveScroll && restoreY !== null) {
      const previousInlineBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, restoreY);
      document.documentElement.style.scrollBehavior = previousInlineBehavior;
    }
  };

  const setNavigation = (open, options = {}) => {
    const { focusFirst = false, restoreFocus = false, preserveScroll = true } = options;
    layout.dataset.navOpen = String(open);
    toggle.setAttribute('aria-expanded', String(open));
    label.textContent = open ? 'Navigation einklappen' : 'Navigation öffnen';
    setMobileNavigationLock(mobileQuery.matches && open, preserveScroll);

    if (focusFirst && mobileQuery.matches) {
      window.setTimeout(() => {
        sidebar.querySelector('summary, a, button')?.focus({ preventScroll: true });
      }, 40);
    }

    if (restoreFocus) {
      window.setTimeout(() => lastToggle?.focus({ preventScroll: true }), 40);
    }

    if (open) {
      window.setTimeout(() => {
        keepSidebarLinkVisible(sidebar.querySelector('a[aria-current="location"]'));
      }, 40);
    }
  };

  const applyViewportDefault = () => {
    setNavigation(!mobileQuery.matches);
  };

  toggle.addEventListener('click', () => {
    lastToggle = toggle;
    const nextState = !isOpen();
    setNavigation(nextState, { focusFirst: nextState });
  });

  toggle.addEventListener('pointerdown', () => {
    if (!mobileQuery.matches) return;
    pendingMobileNavigationLock = {
      scrollY: window.scrollY,
      bodyWidth: document.body.getBoundingClientRect().width,
    };
    if (pendingMobileNavigationLockTimer !== null) {
      window.clearTimeout(pendingMobileNavigationLockTimer);
    }
    pendingMobileNavigationLockTimer = window.setTimeout(() => {
      pendingMobileNavigationLock = null;
      pendingMobileNavigationLockTimer = null;
    }, 1000);
  });

  closeControls.forEach((control) => {
    control.addEventListener('click', () => {
      setNavigation(false, { restoreFocus: mobileQuery.matches });
    });
  });

  const blockBackgroundScroll = (event) => {
    if (!mobileQuery.matches || !isOpen() || sidebar.contains(event.target)) return;
    event.preventDefault();
  };

  document.addEventListener('wheel', blockBackgroundScroll, { passive: false });
  document.addEventListener('touchmove', blockBackgroundScroll, { passive: false });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      setNavigation(false, { restoreFocus: mobileQuery.matches });
      return;
    }

    if (
      mobileQuery.matches
      && isOpen()
      && !sidebar.contains(event.target)
      && ['PageUp', 'PageDown', 'Home', 'End', ' ', 'ArrowUp', 'ArrowDown'].includes(event.key)
    ) {
      event.preventDefault();
    }
  });

  const byTarget = new Map();
  pageLinks.forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (!href.startsWith('#')) return;
    const id = href.slice(1);
    if (id && !byTarget.has(id)) byTarget.set(id, link);
  });

  const activate = (id) => {
    const activeLink = byTarget.get(id);
    if (!activeLink) return;

    const changed = activeLink.getAttribute('aria-current') !== 'location';

    pageLinks.forEach((link) => {
      const active = link === activeLink;
      link.classList.toggle('is-current', active);
      if (active) {
        link.setAttribute('aria-current', 'location');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    const group = activeLink.closest('details');
    if (group) group.open = true;
    if (changed) keepSidebarLinkVisible(activeLink);
  };

  pageLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const href = link.getAttribute('href') || '';
      if (href.startsWith('#')) activate(href.slice(1));
      if (mobileQuery.matches) setNavigation(false, { preserveScroll: false });
    });
  });

  mobileQuery.addEventListener('change', applyViewportDefault);
  applyViewportDefault();

  if (!sections.length || !byTarget.size) return;

  const toolbar = document.querySelector('.doc-toolbar');
  const referenceLine = () => {
    const toolbarLine = Math.max(0, toolbar?.getBoundingClientRect().bottom || 0) + 8;
    const scrollMargin = Number.parseFloat(window.getComputedStyle(sections[0]).scrollMarginTop) || 0;
    return Math.max(toolbarLine, scrollMargin + 1);
  };

  const updateActiveSection = () => {
    if (mobileQuery.matches && isOpen()) return;
    let activeSection = sections[0];
    const documentElement = document.documentElement;
    const atPageEnd = window.scrollY + window.innerHeight >= documentElement.scrollHeight - 2;

    if (atPageEnd) {
      activeSection = sections[sections.length - 1];
    } else {
      const line = referenceLine();
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= line) {
          activeSection = section;
        } else {
          break;
        }
      }
    }

    if (activeSection?.id) activate(activeSection.id);
  };

  let animationFramePending = false;
  const requestActiveSectionUpdate = () => {
    if (animationFramePending) return;
    animationFramePending = true;
    window.requestAnimationFrame(() => {
      animationFramePending = false;
      updateActiveSection();
    });
  };

  const locationHashId = () => {
    if (!window.location.hash) return '';
    try {
      return decodeURIComponent(window.location.hash.slice(1));
    } catch (_) {
      return window.location.hash.slice(1);
    }
  };

  const alignHashTarget = () => {
    const hashId = locationHashId();
    if (!byTarget.has(hashId)) return false;
    const target = document.getElementById(hashId);
    if (!target) return false;

    const scrollMargin = Number.parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0;
    const destination = Math.max(0, target.getBoundingClientRect().top + window.scrollY - scrollMargin);
    const previousInlineBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, destination);
    document.documentElement.style.scrollBehavior = previousInlineBehavior;
    activate(hashId);
    return true;
  };

  const requestHashAlignment = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        alignHashTarget();
        requestActiveSectionUpdate();
      });
    });
  };

  window.addEventListener('scroll', requestActiveSectionUpdate, { passive: true });
  window.addEventListener('resize', requestActiveSectionUpdate);
  window.addEventListener('load', requestHashAlignment);
  window.addEventListener('hashchange', () => {
    const hashId = locationHashId();
    if (byTarget.has(hashId)) activate(hashId);
    requestHashAlignment();
  });

  const initialHashId = locationHashId();
  if (byTarget.has(initialHashId)) {
    activate(initialHashId);
  } else {
    updateActiveSection();
    requestActiveSectionUpdate();
  }
})();
