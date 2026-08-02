// 一覧表の描画・ソート・行クリック連動
window.ParkingTableView = (function () {
  let tbodyEl = null;
  let onRowClick = null;
  let sortState = { key: '_no', dir: 1 };

  const columns = [
    { key: '_no', label: 'No.', numeric: true },
    { key: '_name', label: '名称', numeric: false },
    { key: '_categoryLabel', label: '区分', numeric: false },
    { key: '_areaSqm', label: '面積(㎡)', numeric: true },
    { key: '_count', label: '台数', numeric: true },
    { key: 'fee', label: '料金', numeric: false },
    { key: '_accessRaw', label: '利用条件', numeric: false },
    { key: '_needsFieldCheck', label: '要現地確認', numeric: false }
  ];

  function init(tableEl, { onRowSelect } = {}) {
    onRowClick = onRowSelect;
    tbodyEl = tableEl.querySelector('tbody');
    const theadRow = tableEl.querySelector('thead tr');
    theadRow.innerHTML = '';
    columns.forEach((col) => {
      const th = document.createElement('th');
      th.textContent = col.label;
      th.dataset.key = col.key;
      th.addEventListener('click', () => {
        if (sortState.key === col.key) {
          sortState.dir *= -1;
        } else {
          sortState = { key: col.key, dir: 1 };
        }
        render(lastFeatures);
      });
      theadRow.appendChild(th);
    });
  }

  let lastFeatures = [];

  function fmtNum(n, digits = 0) {
    return n === null || n === undefined ? '-' : n.toLocaleString('ja-JP', { maximumFractionDigits: digits });
  }

  function render(features) {
    lastFeatures = features;
    const sorted = [...features].sort((a, b) => {
      const av = a.properties[sortState.key];
      const bv = b.properties[sortState.key];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (av < bv) return -1 * sortState.dir;
      if (av > bv) return 1 * sortState.dir;
      return 0;
    });

    tbodyEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    sorted.forEach((f) => {
      const p = f.properties;
      const tr = document.createElement('tr');
      tr.dataset.no = p._no;
      if (p._isEstimated) tr.classList.add('row-estimated');
      if (p._needsFieldCheck) tr.classList.add('row-needs-check');

      const countText = p._count === null ? '不明' : `${fmtNum(p._count)}${p._isEstimated ? '(推定)' : ''}`;

      tr.innerHTML = `
        <td>${p._no}</td>
        <td>${escapeHtml(p._name)}</td>
        <td><span class="badge badge-${p._category}">${escapeHtml(p._categoryLabel)}</span></td>
        <td>${p._areaSqm !== null ? fmtNum(p._areaSqm, 1) : '-'}</td>
        <td>${countText}</td>
        <td>${escapeHtml(p.fee || '不明')}</td>
        <td>${escapeHtml(p._accessRaw)}</td>
        <td>${p._needsFieldCheck ? '⚠ 要確認' : ''}</td>
      `;
      tr.addEventListener('click', () => onRowClick && onRowClick(p._no));
      frag.appendChild(tr);
    });
    tbodyEl.appendChild(frag);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  return { init, render };
})();
