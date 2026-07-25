# 欠交功課 ArUco 掃描系統

PWA：用手機影相一次過認出功課簿右上角的 ArUco 標籤（OpenCV `DICT_4X4_50`），即時列出欠交名單。

## 技術

- Vite + React + TypeScript + Tailwind CSS v4
- `js-aruco2`（`ARUCO_4X4_1000` 字典前 50 碼 = DICT_4X4_50）+ Web Worker 切塊偵測
- 本機資料：`localStorage`（開箱即用）
- 雲端：Supabase（見 `supabase/schema.sql` + `.env.example`）
- PWA：`vite-plugin-pwa`

## 本機開發

```bash
npm install
npm run dev
```

用手機測試鏡頭時，請以同一區網 HTTPS 或 Vite 的區網位址開啟（`npm run dev -- --host` 已預設 `host: true`）。部分瀏覽器在非 HTTPS 會拒絕相機；可用 `npm run build && npm run preview -- --host` 或部署到 Vercel / Cloudflare Pages。

## Phase 0 驗證

1. 開啟 `/spike`
2. 列印 1 / 1.2 / 1.5 cm 標籤，貼真簿
3. 5 疊 × 10 本並排，只露右上角
4. 影最高解析度相，看辨識率與平均 marker 像素

## 建議流程

1. 班別 → 匯入學生（學號,姓名）
2. 列印標籤貼紙
3. 建立功課 → 一次過掃描（可補影累積）
4. 結果頁人手修正 → 儲存 / 匯出 CSV
5. 統計頁看累計欠交

## Supabase（可選）

1. 建立專案，在 SQL Editor 執行 [`supabase/schema.sql`](supabase/schema.sql)
2. 複製 `.env.example` 為 `.env`，填入 URL 與 anon key
3. Authentication → Email Magic Link
4. 首次登入後需自行建立 `schools` / `profiles` 對應列（或加 signup trigger）

未設定 env 時，App 以本機模式運作，不影響掃描功能。

## 部署

- **Vercel**：匯入 repo，Framework=Vite，即可
- **Cloudflare Pages**：build command `npm run build`，output `dist`

鏡頭與 PWA 需要 HTTPS。

## 擺簿提醒

- 勿一大疊 50 本（景深會失焦）→ 分 5 疊並排
- 啞面貼紙、深色枱面、側面光源
- Marker 四周留白、勿遮黑邊
