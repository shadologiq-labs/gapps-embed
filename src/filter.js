(function () {
  window.GAPPS.filter = function (search, apps = GAPPS.APPS) {
    const params = new URLSearchParams(search);

    // 1. Get order and filter presets
    const orderKey = (params.get('order') || 'category').trim().toLowerCase();
    const filterKey = (params.get('filter') || params.get('list') || '').trim().toLowerCase();
    const wantedKeys = (params.get('apps') || '')
      .split(',').map(s => s.trim().toLowerCase()).filter(s => /^[a-z0-9-]+$/.test(s));

    // 2. Build the app set (which apps to include)
    let appSet;
    let groupBy = 'category';

    if (wantedKeys.length) {
      // Explicit ?apps= takes precedence
      const byKey = new Map(apps.map(a => [a.key, a]));
      appSet = wantedKeys.map(k => byKey.get(k)).filter(Boolean);
      groupBy = null;
    } else if (filterKey && GAPPS.LISTS[filterKey]) {
      // Filter by tier preset (gmail, ws-legacy, etc.)
      const byKey = new Map(apps.map(a => [a.key, a]));
      appSet = GAPPS.LISTS[filterKey].map(k => byKey.get(k)).filter(Boolean);
      groupBy = null;
    } else if (filterKey && GAPPS.CATEGORIES.some(c => c.slug === filterKey)) {
      // Filter by category
      const set = new Set([filterKey]);
      appSet = apps.filter(a => a.categories.some(c => set.has(c)));
      groupBy = 'category';
    } else {
      // Default: all apps
      appSet = apps.slice();
      groupBy = 'category';
    }

    // 3. Apply ordering
    let out;
    if (wantedKeys.length) {
      // Explicit ?apps= already has the right order, don't reorder
      out = appSet;
    } else if (orderKey && GAPPS.ORDERS[orderKey] !== undefined) {
      // Apply order preset (works for both list and category filters)
      const orderArr = GAPPS.ORDERS[orderKey];
      if (orderArr === null) {
        // category order: use APPS array order
        out = appSet;
      } else {
        // Use specified order
        const byKey = new Map(appSet.map(a => [a.key, a]));
        out = orderArr.map(k => byKey.get(k)).filter(Boolean);
        groupBy = null;
      }
    } else {
      // Default: use appSet as-is
      out = appSet;
    }

    return { apps: out, groupBy, params };
  };
})();
