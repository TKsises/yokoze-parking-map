// 駐車場フィーチャの区分判定・面積計算・台数推計
window.ParkingClassifier = (function () {
  // access タグに基づく3区分判定
  function classifyAccess(access) {
    if (access === 'private' || access === 'no') return 'excluded';
    if (access === 'customers') return 'conditional';
    if (access === 'yes' || access === undefined || access === null || access === '') return 'available';
    // permit / destination / permissive など未定義値は条件付き扱いとし、要確認対象とする
    return 'conditional';
  }

  // 座標が [number, number] の形になっているか（null/undefined混入対策）
  function isValidPosition(pos) {
    return Array.isArray(pos) && pos.length >= 2 && Number.isFinite(pos[0]) && Number.isFinite(pos[1]);
  }

  // ジオメトリ全体の座標がすべて有効な数値かを再帰的に検証する。
  // OSMデータ・osmtogeojson変換の過程で座標がnull/undefinedになるケース
  // （メンバー未解決の relation 等）を、turf.area/MapLibreに渡す前に弾く。
  function isValidGeometry(geometry) {
    if (!geometry || !geometry.coordinates) return false;
    const { type, coordinates } = geometry;
    switch (type) {
      case 'Point':
        return isValidPosition(coordinates);
      case 'MultiPoint':
      case 'LineString':
        return Array.isArray(coordinates) && coordinates.length > 0 && coordinates.every(isValidPosition);
      case 'Polygon':
      case 'MultiLineString':
        return (
          Array.isArray(coordinates) &&
          coordinates.length > 0 &&
          coordinates.every((ring) => Array.isArray(ring) && ring.length > 0 && ring.every(isValidPosition))
        );
      case 'MultiPolygon':
        return (
          Array.isArray(coordinates) &&
          coordinates.length > 0 &&
          coordinates.every(
            (poly) =>
              Array.isArray(poly) &&
              poly.length > 0 &&
              poly.every((ring) => Array.isArray(ring) && ring.length > 0 && ring.every(isValidPosition))
          )
        );
      default:
        return false;
    }
  }

  function computeArea(feature) {
    const type = feature.geometry && feature.geometry.type;
    if (type !== 'Polygon' && type !== 'MultiPolygon') return null;
    try {
      const area = turf.area(feature);
      return Number.isFinite(area) ? area : null;
    } catch (e) {
      return null;
    }
  }

  function parseCapacity(raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  // 1件のフィーチャを分類・計算済みプロパティ付きで返す
  function classifyFeature(feature, index) {
    const tags = feature.properties || {};
    const access = tags.access;
    const category = classifyAccess(access);

    const areaSqm = computeArea(feature);
    const capacityActual = parseCapacity(tags.capacity);
    const sqmPerCar = window.APP_CONFIG.sqmPerCar;
    const capacityEstimated =
      capacityActual === null && areaSqm !== null ? Math.floor(areaSqm / sqmPerCar) : null;

    const count = capacityActual !== null ? capacityActual : capacityEstimated;
    const isEstimated = capacityActual === null && capacityEstimated !== null;

    const accessUnset = access === undefined || access === null || access === '';
    const capacityUnset = tags.capacity === undefined || tags.capacity === null || tags.capacity === '';
    const needsFieldCheck = accessUnset || capacityUnset;

    return {
      type: 'Feature',
      geometry: feature.geometry,
      properties: {
        ...tags,
        _no: index + 1,
        _name: tags.name || '(名称未設定)',
        _category: category,
        _categoryLabel: window.APP_CONFIG.categoryLabels[category],
        _areaSqm: areaSqm,
        _count: count,
        _isEstimated: isEstimated,
        _needsFieldCheck: needsFieldCheck,
        _accessRaw: access || '(未設定)',
        _feeRaw: tags.fee !== undefined ? tags.fee : '(未設定)'
      }
    };
  }

  // FeatureCollection 全体を分類する。
  // 座標が不正なフィーチャ（null混入等）は落として件数のみ _meta で報告する。
  function classifyCollection(rawGeojson) {
    const rawFeatures = rawGeojson.features || [];
    const validRaw = rawFeatures.filter((f) => isValidGeometry(f.geometry));
    const droppedCount = rawFeatures.length - validRaw.length;
    const features = validRaw.map((f, i) => classifyFeature(f, i));
    return {
      type: 'FeatureCollection',
      features,
      _meta: { rawCount: rawFeatures.length, droppedCount }
    };
  }

  // 集計値の算出（総計 / 実効キャパ / 条件付き / 除外 / 要現地確認）
  function computeAggregates(features) {
    const zero = () => ({ num: 0, areaSqm: 0, count: 0, unresolvedCount: 0 });
    const agg = {
      total: zero(),
      available: zero(),
      conditional: zero(),
      excluded: zero(),
      needsFieldCheckNum: 0
    };

    for (const f of features) {
      const p = f.properties;
      const bucket = agg[p._category];
      agg.total.num += 1;
      bucket.num += 1;

      if (p._areaSqm !== null) {
        agg.total.areaSqm += p._areaSqm;
        bucket.areaSqm += p._areaSqm;
      }

      if (p._count !== null) {
        agg.total.count += p._count;
        bucket.count += p._count;
      } else {
        agg.total.unresolvedCount += 1;
        bucket.unresolvedCount += 1;
      }

      if (p._needsFieldCheck) agg.needsFieldCheckNum += 1;
    }

    return agg;
  }

  return { classifyCollection, computeAggregates };
})();
