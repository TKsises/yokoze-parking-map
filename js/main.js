// アプリ全体の初期化・イベント配線・状態管理
(function () {
  const state = {
    allFeatures: [], // 分類済み全フィーチャ
    aggregates: null,
    filters: window.ParkingFilters.getDefaultState()
  };

  const el = {
    statusBar: document.getElementById('status-bar'),
    refreshBtn: document.getElementById('btn-refresh'),
    basemapSelect: document.getElementById('select-basemap'),
    filterEffective: document.getElementById('filter-effective'),
    filterFree: document.getElementById('filter-free'),
    filterNeedsCheck: document.getElementById('filter-needscheck'),
    filterMinArea: document.getElementById('filter-minarea'),
    summaryPanel: document.getElementById('summary-panel'),
    rankingPanel: document.getElementById('ranking-panel'),
    table: document.getElementById('parking-table'),
    aerialToggle: document.getElementById('aerial-toggle'),
    aerialUrl: document.getElementById('aerial-url'),
    aerialOpacity: document.getElementById('aerial-opacity'),
    customFileInput: document.getElementById('custom-geojson-input'),
    customToggle: document.getElementById('custom-toggle'),
    downloadClassification: document.getElementById('download-classification'),
    downloadVersion: document.getElementById('download-version'),
    downloadInitials: document.getElementById('download-initials'),
    btnDownloadGeojson: document.getElementById('btn-download-geojson'),
    btnDownloadCsv: document.getElementById('btn-download-csv'),
    btnDownloadFieldcheck: document.getElementById('btn-download-fieldcheck'),
    resultCount: document.getElementById('result-count')
  };

  function setStatus(message, type = 'info') {
    el.statusBar.textContent = message;
    el.statusBar.className = 'status-bar status-' + type;
  }

  function getFilteredFeatures() {
    return window.ParkingFilters.apply(state.allFeatures, state.filters);
  }

  function refreshViews() {
    const filtered = getFilteredFeatures();
    const visibleNoSet = new Set(filtered.map((f) => f.properties._no));

    window.ParkingMapView.applyVisibleIds(visibleNoSet);
    window.ParkingTableView.render(filtered);
    window.ParkingSummaryView.render(el.summaryPanel, window.ParkingClassifier.computeAggregates(filtered));
    window.ParkingSummaryView.renderRanking(el.rankingPanel, filtered, 10, (no) => {
      window.ParkingMapView.focusOnFeature(no);
    });
    el.resultCount.textContent = `${filtered.length} / ${state.allFeatures.length} 件を表示中`;
  }

  function readFilterUI() {
    state.filters = {
      effectiveOnly: el.filterEffective.checked,
      freeOnly: el.filterFree.checked,
      needsCheckOnly: el.filterNeedsCheck.checked,
      minArea: Number(el.filterMinArea.value) || 0
    };
    refreshViews();
  }

  async function loadData() {
    el.refreshBtn.disabled = true;
    setStatus('データ取得中...', 'loading');
    try {
      const rawGeojson = await window.OverpassClient.fetchParkingGeoJSON((msg) => setStatus(msg, 'loading'));
      const classified = window.ParkingClassifier.classifyCollection(rawGeojson);
      state.allFeatures = classified.features;
      window.ParkingMapView.setData(classified);
      refreshViews();
      const droppedNote =
        classified._meta.droppedCount > 0 ? `／座標不正のため${classified._meta.droppedCount}件を除外` : '';
      setStatus(
        `取得完了: ${state.allFeatures.length} 件（${new Date().toLocaleString('ja-JP')} 時点）${droppedNote}`,
        'success'
      );
    } catch (err) {
      console.error(err);
      setStatus(`データ取得に失敗しました: ${err.message}`, 'error');
    } finally {
      el.refreshBtn.disabled = false;
    }
  }

  function getNameOpts() {
    return {
      classification: el.downloadClassification.value,
      theme: window.APP_CONFIG.fileNaming.theme,
      version: el.downloadVersion.value || window.APP_CONFIG.fileNaming.defaultVersion,
      initials: el.downloadInitials.value || window.APP_CONFIG.fileNaming.defaultInitials
    };
  }

  function wireEvents() {
    el.refreshBtn.addEventListener('click', loadData);

    [el.filterEffective, el.filterFree, el.filterNeedsCheck].forEach((elm) =>
      elm.addEventListener('change', readFilterUI)
    );
    el.filterMinArea.addEventListener('input', readFilterUI);

    el.basemapSelect.addEventListener('change', (e) => {
      window.ParkingMapView.switchBasemap(e.target.value);
    });

    el.aerialToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        window.ParkingMapView.setAerialOverlay(el.aerialUrl.value.trim(), Number(el.aerialOpacity.value));
      } else {
        window.ParkingMapView.removeAerialOverlay();
      }
    });
    el.aerialUrl.addEventListener('change', () => {
      if (el.aerialToggle.checked) {
        window.ParkingMapView.setAerialOverlay(el.aerialUrl.value.trim(), Number(el.aerialOpacity.value));
      }
    });
    el.aerialOpacity.addEventListener('input', (e) => {
      window.ParkingMapView.setAerialOpacity(Number(e.target.value));
    });

    el.customFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const geojson = JSON.parse(reader.result);
          window.ParkingMapView.setCustomOverlay(geojson);
          el.customToggle.checked = true;
        } catch (err) {
          alert('GeoJSONの読み込みに失敗しました: ' + err.message);
        }
      };
      reader.readAsText(file);
    });
    el.customToggle.addEventListener('change', (e) => {
      if (!e.target.checked) window.ParkingMapView.removeCustomOverlay();
    });

    el.btnDownloadGeojson.addEventListener('click', () => {
      window.ParkingDownload.downloadGeoJSON(getFilteredFeatures(), getNameOpts());
    });
    el.btnDownloadCsv.addEventListener('click', () => {
      window.ParkingDownload.downloadListCSV(getFilteredFeatures(), getNameOpts());
    });
    el.btnDownloadFieldcheck.addEventListener('click', () => {
      window.ParkingDownload.downloadFieldCheckCSV(state.allFeatures, getNameOpts());
    });
  }

  async function bootstrap() {
    // ダウンロード欄の既定値をCLAUDE.mdの命名規則に合わせて設定
    const naming = window.APP_CONFIG.fileNaming;
    naming.classifications.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      if (c === naming.defaultClassification) opt.selected = true;
      el.downloadClassification.appendChild(opt);
    });
    el.downloadVersion.value = naming.defaultVersion;
    el.downloadInitials.value = naming.defaultInitials;

    window.ParkingTableView.init(el.table, {
      onRowSelect: (no) => window.ParkingMapView.focusOnFeature(no)
    });

    Object.entries(window.APP_CONFIG.basemaps).forEach(([key, def]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = def.label;
      if (key === window.APP_CONFIG.defaultBasemap) opt.selected = true;
      el.basemapSelect.appendChild(opt);
    });

    await window.ParkingMapView.init('map', {
      onClickFeature: (no) => {
        // ポップアップは mapView 側で開くため、テーブル側のハイライトのみ行う
        const row = el.table.querySelector(`tbody tr[data-no="${no}"]`);
        if (row) row.scrollIntoView({ block: 'nearest' });
      }
    });

    wireEvents();
    await loadData();
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
})();
