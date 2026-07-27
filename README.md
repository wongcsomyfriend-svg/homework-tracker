# 欠交功課 ArUco 掃描系統

PWA：用手機影相一次過認出功課簿右上角的 ArUco 標籤（OpenCV `DICT_4X4_50`），即時列出欠交名單。

## 技術

- Vite + React + TypeScript + Tailwind CSS v4
- `js-aruco2`（`ARUCO_4X4_1000` 字典前 50 碼 = DICT_4X4_50）+ Web Worker 切塊偵測
- 資料層：Repository + Adapter（`src/lib/storage/`）
  - 預設本機：`localStorage`（`VITE_STORAGE_DRIVER=local`）
  - 可選雲端：Supabase Auth + RLS（`VITE_STORAGE_DRIVER=supabase`）
- 設定頁可匯出／匯入 JSON，方便搬機或本機 → 雲端遷移
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

## 儲存模式

| Driver | 說明 |
|--------|------|
| `local`（預設） | 資料在瀏覽器；無需登入；可於「設定」匯出／匯入 JSON |
| `supabase` | Magic Link 登入；`ensure_my_workspace` 自動建學校／profile；RLS 按 `school_id` 隔離 |

未設 Supabase env、或 driver 非 `supabase` 時，一律走本機模式。

### 切換到雲端（一次性遷移）

1. 本機模式開啟「設定」→ **匯出 JSON**
2. 在 [supabase.com](https://supabase.com) 建專案
3. SQL Editor 執行 [`supabase/schema.sql`](supabase/schema.sql)（含 `ensure_my_workspace`）
4. 複製 `.env.example` 為 `.env`，填入 URL / anon key，設 `VITE_STORAGE_DRIVER=supabase`
5. Authentication → 啟用 Email Magic Link
6. 重新部署後到「設定」登入 → **匯入 JSON**

前端只使用 anon key；勿把 service role 放進前端。掃描相片只在手機本機分析，雲端只存結果（欠交狀態、detected IDs）。

## 部署

- **Vercel**：匯入 repo，Framework=Vite，即可
- **Cloudflare Pages**：build command `npm run build`，output `dist`

鏡頭與 PWA 需要 HTTPS。

## 擺簿提醒

- 勿一大疊 50 本（景深會失焦）→ 分 5 疊並排
- 啞面貼紙、深色枱面、側面光源
- Marker 四周留白、勿遮黑邊
