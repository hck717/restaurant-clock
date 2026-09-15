# Cloudflare Worker 設定步驟（5 分鐘）

## 一、整 GitHub token（PAT）

1. 去 https://github.com/settings/tokens → 撳 **Generate new token (classic)**
2. In 個 **Note**，例如 `restaurant-clock-worker`
3. **Expiration** 揀 **No expiration**（或你鍾意）
4. 揀權限：✓ **repo**（Full control of private repositories）
5. 撳 **Generate token**，即刻抄低（**只會顯示一次**）

> 呢個 token 淨係存在 Cloudflare，唔會入去任何 repo。

## 二、開 Cloudflare 帳戶 + 整 Worker

1. 去 https://dashboard.cloudflare.com 免費註冊
2. 左邊選單 → **Workers & Pages** → **Create** → **Worker**
3. 改個名，例如 `restaurant-clock-api`
4. **Deploy**
5. Deploy 完撳 **Edit code**，刪走所有 code，貼上 `worker.js` 嘅內容
6. 撳 **Deploy** 右上角

## 三、加 GITHUB_TOKEN secret

1. 返到 Worker 主頁 → **Settings** → **Variables and Secrets**
2. **Add** → **Secret** → 名：`GITHUB_TOKEN`，值：你喺步驟一抄低嘅 token
3. **Save**

## 四、攞返 Workers URL

- Worker 主頁會顯示一條 **`https://restaurant-clock-api.<你嘅subdomain>.workers.dev`** 網址
- 呢條就係你要貼入 App「連接數據庫」嗰度嘅 URL

## 測試

用瀏覽器開：
- `GET`：個 URL → 應該回傳 `data.json` 內容或 `{}`
- 撳 App 加入員工 → 去返 GitHub repo 應該見到 `data.json` 有新內容

## 注意

- 每次寫入係成個檔案更新，若兩部機同時打卡，後寫入嗰部會覆蓋（對一般餐廳單一部機無問題）
- GitHub API 限額：用 token 係每小時 5000 次，一個餐廳用綽綽有餘