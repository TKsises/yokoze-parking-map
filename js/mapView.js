// MapLibre GL の初期化・レイヤー管理・ポップアップ・オーバーレイ
window.ParkingMapView = (function () {
  const SOURCE_ID = 'parking-source';
  const FILL_LAYER_PREFIX = 'parking-fill-';
  const LINE_LAYER_PREFIX = 'parking-line-';
  const POINT_LAYER_PREFIX = 'parking-point-';
  const AERIAL_SOURCE_ID = 'aerial-overlay-source';
  const AERIAL_LAYER_ID = 'aerial-overlay-layer';
  const CUSTOM_SOURCE_ID = 'custom-overlay-source';
  const CUSTOM_LAYER_ID = 'custom-overlay-layer';

  let map = null;
  let currentFeatures = { type: 'FeatureCollection', features: [] };
  let onFeatureClick = null;
  let popup = null;

  function init(containerId, { onClickFeature } = {}) {
    onFeatureClick = onClickFeature;
    const cfg = window.APP_CONFIG;

    map = new maplibregl.Map({
      container: containerId,
      style: cfg.basemaps[cfg.defaultBasemap].style,
      center: cfg.map.center,
      zoom: cfg.map.zoom,
      attributionControl: { compact: false }
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '320px' });

    return new Promise((resolve) => {
      map.on('load', () => {
        addParkingLayers();
        resolve(map);
      });
    });
  }

  function addParkingLayers() {
    if (map.getSource(SOURCE_ID)) return;

    map.addSource(SOURCE_ID, { type: 'geojson', data: currentFeatures });

    ['available', 'conditional', 'excluded'].forEach((category) => {
      const color = window.APP_CONFIG.categoryColors[category];

      map.addLayer({
        id: FILL_LAYER_PREFIX + category,
        type: 'fill',
        source: SOURCE_ID,
        filter: ['all', ['==', ['get', '_category'], category], ['==', ['geometry-type'], 'Polygon']],
        paint: { 'fill-color': color, 'fill-opacity': 0.45 }
      });

      map.addLayer({
        id: LINE_LAYER_PREFIX + category,
        type: 'line',
        source: SOURCE_ID,
        filter: ['all', ['==', ['get', '_category'], category], ['==', ['geometry-type'], 'Polygon']],
        paint: { 'line-color': color, 'line-width': 1.5 }
      });

      map.addLayer({
        id: POINT_LAYER_PREFIX + category,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['all', ['==', ['get', '_category'], category], ['==', ['geometry-type'], 'Point']],
        paint: {
          'circle-color': color,
          'circle-radius': 6,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5
        }
      });
    });

    const clickableLayers = ['available', 'conditional', 'excluded'].flatMap((c) => [
      FILL_LAYER_PREFIX + c,
      POINT_LAYER_PREFIX + c
    ]);

    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: clickableLayers });
      if (!features.length) return;
      showPopup(features[0], e.lngLat);
      if (onFeatureClick) onFeatureClick(features[0].properties._no);
    });

    clickableLayers.forEach((id) => {
      map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''));
    });
  }

  function fmtNum(n, digits = 0) {
    return n === null || n === undefined ? '-' : n.toLocaleString('ja-JP', { maximumFractionDigits: digits });
  }

  function showPopup(feature, lngLat) {
    const p = feature.properties;
    const countLabel = p._count === null ? '不明' : `${fmtNum(p._count)}台${p._isEstimated ? '（推定）' : ''}`;
    const html = `
      <div class="popup-content">
        <h3>${escapeHtml(p._name)}</h3>
        <table>
          <tr><th>区分</th><td>${escapeHtml(p._categoryLabel)}</td></tr>
          <tr><th>面積</th><td>${p._areaSqm !== null ? fmtNum(p._areaSqm, 1) + ' ㎡' : '不明（点データ）'}</td></tr>
          <tr><th>台数</th><td>${countLabel}</td></tr>
          <tr><th>料金</th><td>${escapeHtml(p.fee || '不明')}</td></tr>
          <tr><th>利用条件(access)</th><td>${escapeHtml(p._accessRaw)}</td></tr>
          <tr><th>営業時間</th><td>${escapeHtml(p.opening_hours || '不明')}</td></tr>
          <tr><th>高さ制限</th><td>${escapeHtml(p.maxheight || 'なし')}</td></tr>
          <tr><th>車椅子区画</th><td>${escapeHtml(p['capacity:disabled'] || '不明')}</td></tr>
          ${p._needsFieldCheck ? '<tr><td colspan="2" class="popup-flag">⚠ 要現地確認</td></tr>' : ''}
        </table>
      </div>`;
    popup.setLngLat(lngLat).setHTML(html).addTo(map);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // データ更新（全件保持し、表示のみフィルタで絞る）
  function setData(featureCollection) {
    currentFeatures = featureCollection;
    if (map.getSource(SOURCE_ID)) {
      map.getSource(SOURCE_ID).setData(currentFeatures);
    }
  }

  // フィルタ結果に応じて表示件数を絞る（_noの集合でフィルタ）
  function applyVisibleIds(visibleNoSet) {
    const filterExpr = ['in', ['get', '_no'], ['literal', Array.from(visibleNoSet)]];
    ['available', 'conditional', 'excluded'].forEach((category) => {
      [FILL_LAYER_PREFIX, LINE_LAYER_PREFIX, POINT_LAYER_PREFIX].forEach((prefix) => {
        const layerId = prefix + category;
        if (!map.getLayer(layerId)) return;
        const geomType = prefix === POINT_LAYER_PREFIX ? 'Point' : 'Polygon';
        map.setFilter(layerId, [
          'all',
          ['==', ['get', '_category'], category],
          ['==', ['geometry-type'], geomType],
          filterExpr
        ]);
      });
    });
  }

  function focusOnFeature(no) {
    const feature = currentFeatures.features.find((f) => f.properties._no === no);
    if (!feature) return;
    try {
      if (feature.geometry.type === 'Point') {
        map.flyTo({ center: feature.geometry.coordinates, zoom: Math.max(map.getZoom(), 18) });
        showPopup(feature, feature.geometry.coordinates);
      } else {
        const bbox = turf.bbox(feature);
        map.fitBounds(bbox, { padding: 80, maxZoom: 19, duration: 600 });
        const center = turf.center(feature).geometry.coordinates;
        showPopup(feature, center);
      }
    } catch (e) {
      console.error('focusOnFeature error', e);
    }
  }

  function switchBasemap(key) {
    const cfg = window.APP_CONFIG;
    const target = cfg.basemaps[key];
    if (!target) return;
    map.setStyle(target.style);
    map.once('styledata', () => {
      // レイヤーが失われるためスタイル読み込み完了後に再構築
      if (!map.isStyleLoaded()) {
        map.once('idle', rebuildAfterStyleSwitch);
      } else {
        rebuildAfterStyleSwitch();
      }
    });
  }

  function rebuildAfterStyleSwitch() {
    addParkingLayers();
    if (map.getSource(AERIAL_SOURCE_ID) === undefined && lastAerialUrl) {
      setAerialOverlay(lastAerialUrl, lastAerialOpacity);
    }
    if (map.getSource(CUSTOM_SOURCE_ID) === undefined && lastCustomGeojson) {
      setCustomOverlay(lastCustomGeojson);
    }
  }

  let lastAerialUrl = null;
  let lastAerialOpacity = 0.8;

  function setAerialOverlay(tileUrlTemplate, opacity) {
    lastAerialUrl = tileUrlTemplate;
    lastAerialOpacity = opacity;
    removeAerialOverlay();
    if (!tileUrlTemplate) return;
    map.addSource(AERIAL_SOURCE_ID, {
      type: 'raster',
      tiles: [tileUrlTemplate],
      tileSize: 256,
      attribution: 'ドローン空撮タイル（OpenAerialMap等）'
    });
    map.addLayer({
      id: AERIAL_LAYER_ID,
      type: 'raster',
      source: AERIAL_SOURCE_ID,
      paint: { 'raster-opacity': opacity }
    });
  }

  function setAerialOpacity(opacity) {
    lastAerialOpacity = opacity;
    if (map.getLayer(AERIAL_LAYER_ID)) {
      map.setPaintProperty(AERIAL_LAYER_ID, 'raster-opacity', opacity);
    }
  }

  function removeAerialOverlay() {
    if (map.getLayer(AERIAL_LAYER_ID)) map.removeLayer(AERIAL_LAYER_ID);
    if (map.getSource(AERIAL_SOURCE_ID)) map.removeSource(AERIAL_SOURCE_ID);
  }

  let lastCustomGeojson = null;

  function setCustomOverlay(geojson) {
    lastCustomGeojson = geojson;
    if (map.getSource(CUSTOM_SOURCE_ID)) {
      map.getSource(CUSTOM_SOURCE_ID).setData(geojson);
      return;
    }
    map.addSource(CUSTOM_SOURCE_ID, { type: 'geojson', data: geojson });
    map.addLayer({
      id: CUSTOM_LAYER_ID,
      type: 'line',
      source: CUSTOM_SOURCE_ID,
      paint: { 'line-color': '#1976d2', 'line-width': 2, 'line-dasharray': [2, 1] }
    });
  }

  function removeCustomOverlay() {
    lastCustomGeojson = null;
    if (map.getLayer(CUSTOM_LAYER_ID)) map.removeLayer(CUSTOM_LAYER_ID);
    if (map.getSource(CUSTOM_SOURCE_ID)) map.removeSource(CUSTOM_SOURCE_ID);
  }

  return {
    init,
    setData,
    applyVisibleIds,
    focusOnFeature,
    switchBasemap,
    setAerialOverlay,
    setAerialOpacity,
    removeAerialOverlay,
    setCustomOverlay,
    removeCustomOverlay
  };
})();
