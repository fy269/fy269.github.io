(() => {
  const themeStorageKey = 'ugur-dokumentation-theme';
  const themeButtons = [...document.querySelectorAll('[data-theme-option]')];
  const themeStatus = document.querySelector('[data-theme-status]');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let hasSavedTheme = false;

  try {
    const savedTheme = window.localStorage.getItem(themeStorageKey);
    hasSavedTheme = savedTheme === 'light' || savedTheme === 'dark';
  } catch (_) {}

  const applyTheme = (theme, persist = false) => {
    const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
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

    if (persist) {
      try {
        window.localStorage.setItem(themeStorageKey, normalizedTheme);
        hasSavedTheme = true;
      } catch (_) {}
    }
  };

  themeButtons.forEach((button) => {
    button.addEventListener('click', () => applyTheme(button.dataset.themeOption, true));
  });

  systemThemeQuery.addEventListener('change', (event) => {
    if (!hasSavedTheme) applyTheme(event.matches ? 'dark' : 'light');
  });

  applyTheme(document.documentElement.dataset.theme || (systemThemeQuery.matches ? 'dark' : 'light'));

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

  const isOpen = () => layout.dataset.navOpen === 'true';

  const setNavigation = (open, options = {}) => {
    const { focusFirst = false, restoreFocus = false } = options;
    layout.dataset.navOpen = String(open);
    toggle.setAttribute('aria-expanded', String(open));
    label.textContent = open ? 'Navigation einklappen' : 'Navigation öffnen';
    document.body.classList.toggle('doc-nav-lock', mobileQuery.matches && open);

    if (focusFirst && mobileQuery.matches) {
      window.setTimeout(() => {
        sidebar.querySelector('summary, a, button')?.focus();
      }, 40);
    }

    if (restoreFocus) {
      window.setTimeout(() => lastToggle?.focus(), 40);
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

  closeControls.forEach((control) => {
    control.addEventListener('click', () => {
      setNavigation(false, { restoreFocus: mobileQuery.matches });
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      setNavigation(false, { restoreFocus: mobileQuery.matches });
    }
  });

  pageLinks.forEach((link) => {
    link.addEventListener('click', () => {
      if (mobileQuery.matches) setNavigation(false);
    });
  });

  mobileQuery.addEventListener('change', applyViewportDefault);
  applyViewportDefault();

  if ('IntersectionObserver' in window && sections.length) {
    const byTarget = new Map(
      pageLinks.map((link) => [link.getAttribute('href')?.slice(1), link])
    );

    const activate = (id) => {
      pageLinks.forEach((link) => {
        const active = link === byTarget.get(id);
        if (active) {
          link.setAttribute('aria-current', 'location');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    };

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visible?.target.id) activate(visible.target.id);
    }, {
      rootMargin: '-24% 0px -62% 0px',
      threshold: [0, 0.08, 0.25]
    });

    sections.forEach((section) => observer.observe(section));
  }
})();
