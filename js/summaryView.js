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

    // 積み上げバーの比率（台数ベース。総台数0件のときはゼロ割りを避ける）
    const denom = t.count > 0 ? t.count : 1;
    const pct = (n) => (n / denom) * 100;

    containerEl.innerHTML = `
      <div class="kpi-hero">
        <div class="kpi-hero-label">実効キャパシティ（利用可のみ）</div>
        <div class="kpi-hero-value"><span class="mono-num">${fmtNum(a.count)}</span><span class="kpi-hero-unit">台</span></div>
        <div class="kpi-hero-sub">総容量 <span class="mono-num">${fmtNum(t.count)}</span>台（<span class="mono-num">${fmtNum(t.num)}</span>件）</div>
      </div>
      <div class="capacity-bar">
        <div class="capacity-bar-track">
          <div class="capacity-bar-seg seg-available" style="width:${pct(a.count)}%"></div>
          <div class="capacity-bar-seg seg-conditional" style="width:${pct(c.count)}%"></div>
          <div class="capacity-bar-seg seg-excluded" style="width:${pct(e.count)}%"></div>
        </div>
      </div>
      <ul class="capacity-legend">
        <li><span class="dot dot-available"></span>利用可<b class="mono-num">${fmtNum(a.count)}台</b></li>
        <li><span class="dot dot-conditional"></span>条件付き<b class="mono-num">${fmtNum(c.count)}台</b></li>
        <li><span class="dot dot-excluded"></span>除外<b class="mono-num">${fmtNum(e.count)}台</b></li>
      </ul>
      <div class="fieldcheck-tag">要現地確認 <span class="mono-num">${fmtNum(aggregates.needsFieldCheckNum)}</span>件</div>
    `;

    // 地図オーバーレイのKPI表示も同じ集計値で更新する（表示先が違うだけの同一データ）
    const mapKpiEl = document.getElementById('map-kpi-effective');
    if (mapKpiEl) mapKpiEl.textContent = fmtNum(a.count);
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
      li.innerHTML = `<span class="badge-dot"><span class="dot dot-${p._category}"></span></span>
        <span class="ranking-name">${escapeHtml(p._name)}</span>
        <span class="ranking-area mono-num">${fmtNum(p._areaSqm, 0)} ㎡</span>`;
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
