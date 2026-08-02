// 集計パネル・面積ランキングの描画
window.ParkingSummaryView = (function () {
  function fmtNum(n, digits = 0) {
    return n === null || n === undefined ? '-' : n.toLocaleString('ja-JP', { maximumFractionDigits: digits });
  }

  function render(containerEl, aggregates) {
    const t = aggregates.total;
    const a = aggregates.available;
    const c = aggregates.conditional;
    const e = aggregates.excluded;

    containerEl.innerHTML = `
      <div class="summary-grid">
        <div class="summary-card summary-total">
          <h4>総キャパシティ（全区分）</h4>
          <div class="summary-row"><span>駐車場数</span><b>${fmtNum(t.num)} 件</b></div>
          <div class="summary-row"><span>総面積</span><b>${fmtNum(t.areaSqm, 0)} ㎡</b></div>
          <div class="summary-row"><span>総台数</span><b>${fmtNum(t.count)} 台</b></div>
        </div>
        <div class="summary-card summary-effective">
          <h4>実効キャパシティ（利用可のみ）</h4>
          <div class="summary-row"><span>駐車場数</span><b>${fmtNum(a.num)} 件</b></div>
          <div class="summary-row"><span>面積</span><b>${fmtNum(a.areaSqm, 0)} ㎡</b></div>
          <div class="summary-row"><span>台数</span><b>${fmtNum(a.count)} 台</b></div>
        </div>
        <div class="summary-card summary-sub">
          <h4>条件付き（利用者専用等）</h4>
          <div class="summary-row"><span>件数</span><b>${fmtNum(c.num)}</b></div>
          <div class="summary-row"><span>台数</span><b>${fmtNum(c.count)}</b></div>
        </div>
        <div class="summary-card summary-sub">
          <h4>除外（私有・月極等）</h4>
          <div class="summary-row"><span>件数</span><b>${fmtNum(e.num)}</b></div>
          <div class="summary-row"><span>台数</span><b>${fmtNum(e.count)}</b></div>
        </div>
      </div>
      <div class="summary-flag">要現地確認: ${fmtNum(aggregates.needsFieldCheckNum)} 件</div>
    `;
  }

  function renderRanking(containerEl, features, topN, onSelect) {
    const ranked = features
      .filter((f) => f.properties._areaSqm !== null)
      .sort((a, b) => b.properties._areaSqm - a.properties._areaSqm)
      .slice(0, topN);

    containerEl.innerHTML = '';
    const ol = document.createElement('ol');
    ol.className = 'ranking-list';
    ranked.forEach((f) => {
      const p = f.properties;
      const li = document.createElement('li');
      li.innerHTML = `<span class="badge badge-${p._category}">${escapeHtml(p._categoryLabel)}</span>
        <span class="ranking-name">${escapeHtml(p._name)}</span>
        <span class="ranking-area">${fmtNum(p._areaSqm, 0)} ㎡</span>`;
      li.addEventListener('click', () => onSelect && onSelect(p._no));
      ol.appendChild(li);
    });
    containerEl.appendChild(ol);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  return { render, renderRanking };
})();
