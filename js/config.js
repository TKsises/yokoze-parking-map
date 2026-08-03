// アプリ全体の設定値
window.APP_CONFIG = {
  // Overpass API（主 → 予備1 → 予備2 の順に自動フォールバック）
  overpassEndpoints: [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
  ],
  overpassTimeoutMs: 40000, // 1リクエストあたり約40秒でタイムアウトし次のミラーへ
  areaName: '横瀬町',
  adminLevel: '8', // 横瀬町の行政界は admin_level=8

  // 厳密 → 緩い の順に試す複数クエリ。0件だった場合のみ次を試す。
  buildOverpassQueries(areaName, adminLevel) {
    const withLevel = `[out:json][timeout:35];
area["name"="${areaName}"]["admin_level"="${adminLevel}"]->.searchArea;
(
  nwr["amenity"="parking"](area.searchArea);
);
out geom;`;

    const nameOnly = `[out:json][timeout:35];
area["name"="${areaName}"]->.searchArea;
(
  nwr["amenity"="parking"](area.searchArea);
);
out geom;`;

    return [
      { label: `admin_level=${adminLevel}指定`, query: withLevel },
      { label: '名称のみ指定（admin_level不問）', query: nameOnly }
    ];
  },

  // 面積から台数を推計する際の1台あたり面積(㎡)
  sqmPerCar: 25,

  // ベースマップ定義
  basemaps: {
    openfreemap: {
      label: 'OpenFreeMap',
      style: 'https://tiles.openfreemap.org/styles/liberty'
    },
    gsi: {
      label: '地理院タイル（標準地図）',
      style: {
        version: 8,
        sources: {
          gsi: {
            type: 'raster',
            tiles: ['https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 18,
            attribution: '地理院タイル（国土地理院）'
          }
        },
        layers: [
          { id: 'gsi', type: 'raster', source: 'gsi' }
        ]
      }
    }
  },
  defaultBasemap: 'openfreemap',

  // 区分ごとの色・ラベル
  categoryColors: {
    available: '#1E7A4D',
    conditional: '#C2600A',
    excluded: '#8A938E'
  },
  categoryLabels: {
    available: '利用可（実効キャパ）',
    conditional: '条件付き（利用者専用等）',
    excluded: '除外（私有・月極等）'
  },

  // ダウンロードファイル名の既定値（YOKOZE Atlas 命名規則）
  fileNaming: {
    project: 'YOKOZEatlas2026',
    classifications: ['temp', 'ysdi', 'morigawa', 'dronebird'],
    defaultClassification: 'ysdi',
    theme: 'parking',
    defaultVersion: '0.1.0',
    defaultInitials: 'TK'
  },

  map: {
    center: [139.1225, 35.9767], // 横瀬町付近
    zoom: 13
  }
};
