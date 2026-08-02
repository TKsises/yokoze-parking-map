// GeoJSON / CSV / 要現地確認CSV の書き出し
window.ParkingDownload = (function () {
  const UTF8_BOM = '﻿';

  function buildFilename({ classification, theme, version, initials, ext }) {
    const cfg = window.APP_CONFIG.fileNaming;
    return `${cfg.project}_${classification}_${theme}_v${version}_${initials}.${ext}`;
  }

  function triggerDownload(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function downloadGeoJSON(features, nameOpts) {
    const fc = {
      type: 'FeatureCollection',
      features: features.map((f) => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          name: f.properties._name,
          category: f.properties._category,
          categoryLabel: f.properties._categoryLabel,
          areaSqm: f.properties._areaSqm,
          count: f.properties._count,
          isEstimated: f.properties._isEstimated,
          needsFieldCheck: f.properties._needsFieldCheck,
          access: f.properties._accessRaw,
          fee: f.properties.fee || null,
          opening_hours: f.properties.opening_hours || null,
          maxheight: f.properties.maxheight || null,
          operator: f.properties.operator || null,
          surface: f.properties.surface || null,
          parking: f.properties.parking || null,
          capacity_disabled: f.properties['capacity:disabled'] || null
        }
      }))
    };
    const filename = buildFilename({ ...nameOpts, ext: 'geojson' });
    triggerDownload(JSON.stringify(fc, null, 2), filename, 'application/geo+json');
  }

  function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const s = String(value);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCSV(headers, rows) {
    const lines = [headers.map(csvEscape).join(',')];
    rows.forEach((row) => lines.push(row.map(csvEscape).join(',')));
    return UTF8_BOM + lines.join('\r\n');
  }

  function downloadListCSV(features, nameOpts) {
    const headers = ['No.', '名称', '区分', '面積(㎡)', '台数', '推定フラグ', '料金', '利用条件(access)', '要現地確認'];
    const rows = features.map((f) => {
      const p = f.properties;
      return [
        p._no,
        p._name,
        p._categoryLabel,
        p._areaSqm !== null ? p._areaSqm.toFixed(1) : '',
        p._count !== null ? p._count : '',
        p._isEstimated ? '推定' : '実測',
        p.fee || '',
        p._accessRaw,
        p._needsFieldCheck ? '要確認' : ''
      ];
    });
    const filename = buildFilename({ ...nameOpts, ext: 'csv' });
    triggerDownload(toCSV(headers, rows), filename, 'text/csv;charset=utf-8');
  }

  function downloadFieldCheckCSV(features, nameOpts) {
    const targets = features.filter((f) => f.properties._needsFieldCheck);
    const headers = [
      'No.', '名称', '区分', 'access(現況)', 'capacity(現況)', '面積(㎡)', '推定台数',
      '料金', '営業時間', '高さ制限', '調査日', '調査員', '現地メモ'
    ];
    const rows = targets.map((f) => {
      const p = f.properties;
      return [
        p._no,
        p._name,
        p._categoryLabel,
        p._accessRaw,
        p.capacity !== undefined ? p.capacity : '(未設定)',
        p._areaSqm !== null ? p._areaSqm.toFixed(1) : '',
        p._count !== null ? p._count : '',
        p.fee || '',
        p.opening_hours || '',
        p.maxheight || '',
        '', '', '' // 調査日・調査員・現地メモは現地記入欄
      ];
    });
    const filename = buildFilename({ ...nameOpts, theme: nameOpts.theme + '_fieldcheck', ext: 'csv' });
    triggerDownload(toCSV(headers, rows), filename, 'text/csv;charset=utf-8');
  }

  return { downloadGeoJSON, downloadListCSV, downloadFieldCheckCSV, buildFilename };
})();
