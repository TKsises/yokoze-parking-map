// フィルタ状態の管理と適用
window.ParkingFilters = (function () {
  function getDefaultState() {
    return {
      effectiveOnly: false, // 実効キャパのみ（=available区分のみ）
      freeOnly: false, // 無料のみ（fee=no）
      needsCheckOnly: false, // 要現地確認のみ
      minArea: 0 // 面積○㎡以上
    };
  }

  function apply(features, state) {
    return features.filter((f) => {
      const p = f.properties;
      if (state.effectiveOnly && p._category !== 'available') return false;
      if (state.freeOnly && p.fee !== 'no') return false;
      if (state.needsCheckOnly && !p._needsFieldCheck) return false;
      if (state.minArea > 0) {
        if (p._areaSqm === null || p._areaSqm < state.minArea) return false;
      }
      return true;
    });
  }

  return { getDefaultState, apply };
})();
