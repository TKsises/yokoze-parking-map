# YOKOZE Atlas 2026 駐車場マップ

## プロジェクト方針
- GitHub Pages で静的ホスティング（html/css/js のみ、ビルド不要）
- 地図ライブラリ: MapLibre GL JS
- ベースマップ: OpenFreeMap
- ベクタデータは GeoJSON 形式（YOKOZE Atlas データ整備ルール v0.5.1 準拠）
- OSM由来データのため ODbL 出典表示を画面に常時表示する

## ファイル命名規則
YOKOZEatlas2026_{分類}_{テーマ}_v{版番号}_{作成者イニシャル}.{拡張子}
例: YOKOZEatlas2026_ysdi_parking_v0.1.0_TK.geojson
分類: temp / ysdi / morigawa / dronebird
作成者イニシャル: TK

## このツールの目的
駐車場検索アプリではなく、駐車場を「町の空間資源の在庫表」として可視化する。
中核指標は総容量ではなく「実効キャパシティ」（access=yes または未設定 のみを算入）。
月極・私有地・店舗専用区画は実効キャパから除外する。

## データ取得
- Overpass API、対象は横瀬町全域
- 面積計算のため out geom; でポリゴン形状を取得する（out center; は使わない）
