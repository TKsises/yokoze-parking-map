// Overpass API からの駐車場データ取得と GeoJSON 変換
window.OverpassClient = (function () {
  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  // 横瀬町全域の駐車場データを取得し、GeoJSON FeatureCollection を返す。
  // クエリの厳密度（admin_level指定 → 名称のみ）× エンドポイント（主→予備→予備2）の
  // 総当たりで試し、0件・エラー・タイムアウトのいずれでも次の組み合わせへフォールバックする。
  async function fetchParkingGeoJSON(onStatus) {
    const cfg = window.APP_CONFIG;
    const variants = cfg.buildOverpassQueries(cfg.areaName, cfg.adminLevel);
    let lastError = null;
    // 504/タイムアウト/fetch失敗が一度でも起きたか（0件のみの失敗と区別してUI文言を出し分ける）
    let hadNetworkFailure = false;

    for (const variant of variants) {
      for (const endpoint of cfg.overpassEndpoints) {
        try {
          onStatus && onStatus(`Overpass API に問い合わせ中... [${variant.label}] (${endpoint})`);
          const res = await fetchWithTimeout(
            endpoint,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json'
              },
              body: 'data=' + encodeURIComponent(variant.query)
            },
            cfg.overpassTimeoutMs
          );

          // fetch は 504 等のHTTPエラー応答では例外を投げず正常にresolveしてしまうため、
          // res.ok を明示チェックしないと「失敗」を検知できず次のミラーへフォールバックしない。
          if (!res.ok) {
            hadNetworkFailure = true;
            throw new Error(`HTTPエラー ${res.status} ${res.statusText}`);
          }

          const osmJson = await res.json();

          if (!osmJson.elements || osmJson.elements.length === 0) {
            lastError = new Error(`0件でした（${variant.label} / ${endpoint}）。行政界の解決に失敗している可能性があります`);
            onStatus && onStatus(`0件でした [${variant.label}] (${endpoint})。次を試します...`);
            continue;
          }

          onStatus && onStatus('GeoJSON へ変換中...');
          const geojson = osmtogeojson(osmJson);
          return geojson;
        } catch (err) {
          lastError = err;
          if (err.name === 'AbortError') hadNetworkFailure = true;
          const reason = err.name === 'AbortError' ? `タイムアウト(${Math.round(cfg.overpassTimeoutMs / 1000)}秒)` : err.message;
          onStatus && onStatus(`取得失敗（${reason}） [${variant.label}] (${endpoint})。次のミラーへ切り替えます...`);
        }
      }
    }

    // 全ミラー・全条件を使い切っても取得できなかった場合。
    // 504やタイムアウトが原因だった場合は、技術的なエラー文ではなく分かりやすい文言にする。
    if (hadNetworkFailure) {
      throw new Error('サーバー混雑のため取得できませんでした。時間をおいて再試行してください。');
    }
    throw lastError || new Error('Overpass API からのデータ取得に失敗しました（全条件で0件でした）');
  }

  return { fetchParkingGeoJSON };
})();
