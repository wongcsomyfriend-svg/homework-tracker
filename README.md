# 欠交功課 ArUco 掃描系統

PWA：用手機影相一次過認出功課簿右上角的 ArUco 標籤（OpenCV `DICT_4X4_50`），即時列出欠交名單。

## 技術

- Vite + React + TypeScript + Tailwind CSS v4
- `js-aruco2`（`ARUCO_4X4_1000` 字典前 50 碼 = DICT_4X4_50）+ Web Worker 切塊偵測
- 資料層：Repository + Adapter（`src/lib/storage/`）
  - 預設本機：`localStorage`（`VITE_STORAGE_DRIVER=local`）
  - 可選雲端：Supabase Auth + RLS（`VITE_STORAGE_DRIVER=supabase`）
- 老師端／學生端：兩個獨立 PWA（同一 repo、同一 Supabase）
  - 老師：`/homework-tracker/`
  - 學生：`/homework-tracker/student/`
- 同校邀請碼共用工作區；學生用認領碼／QR 匿名綁定身份
- 每週 Web Push 提醒（Edge Function + pg_cron）
- 設定頁可匯出／匯入 JSON，方便搬機或本機 → 雲端遷移
- PWA：`vite-plugin-pwa`

## 本機開發

```bash
npm install
npm run dev          # 老師端 http://localhost:5173/homework-tracker/
npm run dev:student  # 學生端（另開終端）APP_TARGET=student
```

正式建置兩個站：

```bash
npm run build:all
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
| `supabase` | Magic Link 登入；建立／加入學校工作區；RLS 按 `school_id` 隔離 |

未設 Supabase env、或 driver 非 `supabase` 時，一律走本機模式。學生端、共用工作區、推送提醒**僅雲端模式**可用。

### 切換到雲端（一次性遷移）

1. 本機模式開啟「設定」→ **匯出 JSON**
2. 在 [supabase.com](https://supabase.com) 建專案
3. SQL Editor 執行 [`supabase/schema.sql`](supabase/schema.sql)
4. 複製 `.env.example` 為 `.env`，填入 URL / anon key，設 `VITE_STORAGE_DRIVER=supabase`
5. Authentication → 啟用 Email；電郵範本 **Magic Link** 請改成寄出 6 位數碼（見下方）
6. 重新部署後到「設定」登入 → 建立或加入學校 → **匯入 JSON**

#### 電郵範本（必改，否則收不到 6 位數碼）

Dashboard → **Authentication → Email Templates → Magic Link**，內文改成例如：

```html
<h2>登入驗證碼</h2>
<p>請在 App 內輸入此 6 位數碼（不用點連結）：</p>
<p style="font-size:24px;letter-spacing:4px"><strong>{{ .Token }}</strong></p>
```

老師在主畫面 App 輸入電郵 → 寄送驗證碼 → 抄電郵裡的數字回來確認登入。

前端只使用 anon key；勿把 service role 放進前端。掃描相片只在手機本機分析，雲端只存結果（欠交狀態、detected IDs）。

### 同校老師共用工作區

1. 第一位老師登入後到 `/onboarding` **建立學校**（成為 admin）
2. 在「設定」複製 **學校邀請碼** 給同事
3. 同事登入後用邀請碼 **加入**，即可看到同一批班別／學生／欠交

### 兩個獨立網站

| 角色 | 網址（GitHub Pages） | 功能 |
|------|----------------------|------|
| 老師 | `https://wongcsomyfriend-svg.github.io/homework-tracker/` | 班別、掃描、統計、邀請碼、堂前提醒 |
| 學生 | `https://wongcsomyfriend-svg.github.io/homework-tracker/student/` | 認領身份、欠交清單、每朝提醒 |

部署前請在 GitHub → Settings → Secrets and variables → Actions 新增：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_VAPID_PUBLIC_KEY`

### 學生端

1. 老師在班別頁開啟「學生認領碼」列印 QR（QR 指向學生站）
2. 學生開學生端網址 → 加入主畫面 → 掃 QR 或輸入 8 位碼
3. 學生端首頁查看自己尚欠交的功課
4. 「提醒」頁可設每週固定時間（例如每朝 08:00）
5. 一部手機可綁多個身份（例如家長幫多個子女）

### 每週推送提醒

1. `npx web-push generate-vapid-keys`
2. 公鑰填入 `.env` 的 `VITE_VAPID_PUBLIC_KEY`
3. 私鑰等設為 Supabase secrets：
   ```bash
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@school.edu.hk
   supabase functions deploy send-reminders
   ```
4. Database → Extensions 啟用 `pg_cron`、`pg_net`，再執行 [`supabase/cron.sql`](supabase/cron.sql)（替換 project ref 與 service role key）
5. App 內「提醒」頁開啟推送並新增每週規則
6. iOS：需先把網站「加入主畫面」才可收到 Web Push

### 還原備份

實作學生端前的版本已標記為 Git tag `backup-before-student-app`：

```bash
git checkout backup-before-student-app
```

## 部署

- **Vercel**：匯入 repo，Framework=Vite，即可
- **Cloudflare Pages**：build command `npm run build`，output `dist`

鏡頭與 PWA 需要 HTTPS。

## 擺簿提醒

- 勿一大疊 50 本（景深會失焦）→ 分 5 疊並排
- 啞面貼紙、深色枱面、側面光源
- Marker 四周留白、勿遮黑邊
