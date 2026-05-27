(function () {
  window.GAPPS.theme = {};

  const COLOR_RE = /^(#[0-9a-f]{3}([0-9a-f]{3}([0-9a-f]{2})?)?|[a-z]{3,32})$/i;
  const lockedVars = new Set();
  const explicitVars = new Set();

  function setColorVar(name, raw, lock) {
    // Locked vars resist passive defaults but yield to explicit parent overrides.
    // `lock=true` (query-string init) skips already-locked names; `lock=false`
    // (postMessage from parent) is always honored — the parent gets the final say.
    if (lock && lockedVars.has(name)) return false;
    let color = (raw || '').trim();
    if (!color) return false;
    // Add # if missing (from query string params)
    if (color.match(/^[0-9a-f]{3}([0-9a-f]{3}([0-9a-f]{2})?)?$/i)) {
      color = '#' + color;
    }
    if (!COLOR_RE.test(color)) return false;
    document.documentElement.style.setProperty(name, color);
    explicitVars.add(name);
    if (lock) lockedVars.add(name);
    if (name === '--tile-bg' || name === '--label-color') deriveHover();
    return true;
  }

  function relativeLuminance(color) {
    if (!color) return null;
    const el = document.createElement('div');
    el.style.color = color;
    document.body.appendChild(el);
    const computed = getComputedStyle(el).color;
    el.remove();

    const match = computed.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return null;

    const [r, g, b] = [match[1], match[2], match[3]].map(x => {
      const c = parseInt(x) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function deriveHover() {
    if (explicitVars.has('--hover-bg')) return;
    const source = explicitVars.has('--tile-bg') ? '--tile-bg' : '--label-color';
    const lum = relativeLuminance(getComputedStyle(document.documentElement)
                                    .getPropertyValue(source).trim());
    if (lum === null) return;
    const [shiftToward, weight] = source === '--tile-bg'
      ? [lum < 0.5 ? '#fff' : '#000', 92]
      : [lum < 0.5 ? '#fff' : '#000', 8];
    document.documentElement.style.setProperty('--hover-bg',
      `color-mix(in srgb, var(${source}) ${weight}%, ${shiftToward})`);
  }

  window.GAPPS.theme.applyQueryColors = function () {
    const params = new URLSearchParams(window.location.search);
    setColorVar('--hover-bg',          params.get('hover'),     true);
    setColorVar('--label-color',       params.get('text'),      true);
    setColorVar('--label-color-hover', params.get('texthover'), true);
    setColorVar('--tile-bg',           params.get('tile'),      true);
    deriveHover();
  };

  window.GAPPS.theme.applyDomainRewrites = function (selector) {
    const params = new URLSearchParams(window.location.search);
    const rawDomain = (params.get('domain') || '').trim().toLowerCase();
    const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
    if (!DOMAIN_RE.test(rawDomain)) return;

    const domain = rawDomain;
    const custom = new Set(
      (params.get('custom') || '').split(',')
        .map(s => s.trim().toLowerCase()).filter(s => /^[a-z0-9-]+$/.test(s))
    );
    const accountChooser = 'https://accounts.google.com/AccountChooser?hd='
                           + encodeURIComponent(domain) + '&continue=';

    document.querySelectorAll(selector).forEach(a => {
      const key = a.dataset.key;
      if (custom.has(key)) {
        const host = a.dataset.shortcutHost || key;
        a.href = 'https://' + host + '.' + domain + '/';
      } else {
        a.href = accountChooser + encodeURIComponent(a.dataset.continue);
      }
    });
  };

  window.GAPPS.theme.startPostMessageListeners = function () {
    if (window.parent === window) return;

    let last = 0;
    function report() {
      const h = document.documentElement.scrollHeight;
      if (h === last) return;
      last = h;
      window.parent.postMessage({ type: 'gapps-embed-height', height: h }, '*');
    }
    if (document.readyState === 'complete') report();
    else window.addEventListener('load', report);
    if ('ResizeObserver' in window)
      new ResizeObserver(report).observe(document.documentElement);
    else window.addEventListener('resize', report);

    window.addEventListener('message', e => {
      const d = e.data;
      if (!d || d.type !== 'gapps-embed-theme') return;
      setColorVar('--tile-bg',     d.tileBg,    false);
      setColorVar('--hover-bg',    d.hoverBg,   false);
      setColorVar('--label-color', d.textColor, false);
      // If parent omits textColorHover, mirror textColor so the label stays
      // the same on hover (default Material-style behavior).
      setColorVar('--label-color-hover',
                  d.textColorHover || d.textColor, false);
    });
  };
})();
