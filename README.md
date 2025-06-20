## 啟動方式

# 繪本電商平台 Little Chapter

親子繪本電商交易平台是一個專為兒童繪本設計的線上電商平台，提供多樣的繪本商品，並根據年齡分類，幫助家長為孩子選擇適合的讀物。

## 技術棧

- 後端：Node.js、Express、TypeORM
- 資料庫：PostgreSQL
- 部署：Docker

## 開發環境首次設定指南

為了讓團隊成員能夠快速設定本地開發環境，請遵循以下步驟：

1. **取得程式碼：** 從版本控制系統 (如 Git) 拉取最新的程式碼。
2. **安裝依賴：** 在專案根目錄執行 `npm install`。
3. **設定環境變數：** 確保專案根目錄有 `.env` 檔案，並包含必要的資料庫連接環境變數 (例如 `DB_HOST=db`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `DB_PORT`)。這些值應與 `docker-compose.yml` 中 PostgreSQL 服務的設定一致。
4. **啟動 Docker 環境：** 執行 `npm run start`。這會使用 `docker-compose` 在背景啟動 PostgreSQL 資料庫容器。首次執行可能需要一些時間下載映像檔。
5. **首次資料庫同步 (重要！)：**
   - 確認 Docker 中的 PostgreSQL 資料庫是空的（如果是第一次執行 `npm run start` 應該是空的）。
   - 確認 `.env` 檔案中 `DB_SYNCHRONIZE=true` 已設定。
   - **啟動 Node.js 應用程式：** 執行 `npm run dev`。應用程式啟動時，TypeORM 會連接到 Docker 中的資料庫，並根據定義的 EntitySchema 自動建立所有表格。你可以在終端機看到 SQL 執行的紀錄，或使用資料庫工具檢查表格是否已建立。
   - **恢復設定 (非常重要！)：** 確認表格建立成功後，**立即**開啟 `.env` 檔案，將 `DB_SYNCHRONIZE=true` **改為 `DB_SYNCHRONIZE=false`**。
   - **重新啟動應用：** 執行 `npm run dev`。
6. **開始開發：** 現在你的本地資料庫結構已經和程式碼定義一致，並且 Node.js 應用程式正在運行。你可以開始開發功能了！

**警告：** `synchronize: true` 非常方便於首次建立資料庫結構，但**絕對不能**在生產環境或任何包含重要資料的開發/測試環境中保持啟用狀態，否則可能導致資料遺失。後續的資料庫結構變更應一律使用 TypeORM Migrations 來管理。

## 開發指令

- `npm run start` - 使用 Docker 啟動 PostgreSQL 資料庫
- `npm run restart` - 重建並重啟 Docker 容器
- `npm run stop` - 停止 Docker 容器
- `npm run clean` - 停止並移除 Docker 容器和資料卷
- `npm run dev` - 使用 nodemon 啟動開發環境的應用程式

## 資料庫結構

專案使用 TypeORM 實體定義來管理資料庫結構。所有實體定義都位於 `db/entities/` 目錄下。

### 主要資料表

#### 使用者系統

- **users** - 使用者資料表

#### 商品系統

- **products** - 商品資料表
- **categories** - 商品分類表
- **ageRanges** - 年齡範圍表
- **productImages** - 商品圖片表
- **productReviews** - 商品評價表

#### 購物車與願望清單

- **cartItems** - 購物車項目表
- **wishlists** - 願望清單表

#### 訂單系統

- **orders** - 訂單主表
- **orderItems** - 訂單項目表
- **pendingOrders** - 待處理訂單表
- **pendingOrderItems** - 待處理訂單項目表

#### 金流與優惠系統

- **paymentTransactions** - 付款交易記錄表
- **invoices** - 發票資料表
- **discountCodes** - 優惠券主表
- **discountCodeUsages** - 優惠券使用記錄表

#### 推薦與通知系統

- **recommendationSections** - 推薦專區表
- **recommendationProducts** - 專區商品關聯表
- **notifications** - 通知表
- **notificationTemplates** - 通知模板表
- **templateTargetUsers** - 模板目標使用者關聯表

#### 系統管理

- **tasks** - 系統任務表

## API 路由

### 使用者相關 (`/api/users`)

- `POST /api/users/sign-up` - 使用者註冊
- `POST /api/users/log-in` - 使用者登入
- `GET /api/users/verify-email` - 電子郵件驗證
- `POST /api/users/resend-verification` - 重新發送驗證郵件
- `GET /api/users/profile` - 取得個人資料（需登入）
- `PUT /api/users/profile` - 更新個人資料（需登入）
- `POST /api/users/forgot-password` - 忘記密碼
- `POST /api/users/verify-code` - 重設密碼驗證代碼
- `POST /api/users/reset-password` - 重設密碼
- `PUT /api/users/password` - 修改密碼（需登入）
- `POST /api/users/email-change` - 申請變更電子郵件（需登入）
- `POST /api/users/email-change/verify` - 驗證新電子郵件（需登入）
- `POST /api/users/google-sign-in` - Google 登入

### 商品相關 (`/api/products`)

- `GET /api/products` - 取得商品列表
- `GET /api/products/reviews` - 取得商品評價
- `GET /api/products/:productId` - 取得指定商品詳細資料

### 購物車相關 (`/api/cart`)

- `GET /api/cart` - 取得購物車內容（需登入）
- `POST /api/cart` - 新增商品至購物車（需登入）
- `PUT /api/cart/:productId` - 修改購物車內商品數量（需登入）
- `DELETE /api/cart/:productId` - 移除購物車內指定商品（需登入）
- `DELETE /api/cart` - 清空購物車（需登入）

### 訂單相關 (`/api/orders`)

- `GET /api/orders` - 取得使用者訂單列表（需登入）
- `GET /api/orders/:orderNumber` - 取得指定訂單詳細資料（需登入）
- `POST /api/orders/action` - 訂單操作（取消訂單、退貨申請）（需登入）
- `POST /api/orders/:orderNumber/products/:productId/reviews` - 新增商品評價（需登入）

### 結帳相關 (`/api/checkout`)

- `POST /api/checkout` - 處理結帳（需登入）

### 金流相關 (`/api/payment`)

- `POST /api/payment/return` - 付款回傳處理
- `POST /api/payment/notify` - 付款通知處理

### 願望清單相關 (`/api/wishlist`)

- `GET /api/wishlist` - 取得願望清單（需登入）
- `POST /api/wishlist` - 新增商品至願望清單（需登入）
- `DELETE /api/wishlist/:productId` - 從願望清單移除商品（需登入）

### 通知相關 (`/api/notifications`)

- `GET /api/notifications` - 取得通知列表（需登入）
- `PUT /api/notifications/read` - 標記通知為已讀（需登入）

### 優惠券相關 (`/api/discountCodes`)

- `GET /api/discountCodes` - 取得可用優惠券（需登入）
- `POST /api/discountCodes/:code` - 使用優惠券（需登入）

### 搜尋相關 (`/api/search`)

- `GET /api/search` - 搜尋商品

### 首頁相關 (`/api/homepage`)

- `GET /api/homepage` - 取得首頁內容

### AI 客服相關 (`/api/chat`)

- `POST /api/chat` - AI 客服對話（限制請求頻率）

### 檔案上傳相關

- `POST /api/upload/avatar` - 上傳使用者頭像（需登入）

### 管理者功能 (`/api/admin`)

**需要管理員權限的 API**

#### 管理者認證

- `POST /api/admin/log-in` - 管理者登入
- `GET /api/admin/profile` - 取得管理者個人資料

#### 儀表板與統計

- `GET /api/admin/dashboard` - 管理者儀表板
- `GET /api/admin/task` - 取得待辦事項數量

#### 使用者管理

- `GET /api/admin/users` - 取得使用者列表
- `GET /api/admin/users/:userId` - 取得特定使用者詳細資訊
- `PUT /api/admin/users/:userId` - 更新特定使用者資訊

#### 商品管理

- `GET /api/admin/products` - 管理者取得商品列表
- `GET /api/admin/products/:productId` - 管理者取得指定商品詳細資料
- `POST /api/admin/products` - 新增商品
- `PUT /api/admin/products/:productId` - 更新商品
- `DELETE /api/admin/products/:productId` - 刪除商品
- `POST /api/admin/products/:product_id/images` - 上傳商品圖片

#### 商品分類管理

- `GET /api/admin/categories` - 取得分類列表
- `GET /api/admin/categories/:categoryId` - 取得類別詳細資訊
- `POST /api/admin/categories` - 新增商品分類
- `PUT /api/admin/categories/:categoryId` - 編輯商品分類
- `DELETE /api/admin/categories/:categoryId` - 刪除商品分類

#### 訂單管理

- `GET /api/admin/orders` - 取得訂單列表
- `GET /api/admin/orders/:orderNumber` - 取得指定訂單詳細資料
- `POST /api/admin/orders/action` - 管理者訂單操作（出貨確認、退貨審核）

#### 推薦專區管理

- `GET /api/admin/recommendations/:sectionId/candidateProducts` - 取得專區候選商品
- `GET /api/admin/recommendations/:sectionId/products` - 取得專區商品列表
- `POST /api/admin/recommendations/:sectionId/products` - 新增專區商品
- `PUT /api/admin/recommendations/:sectionId/products/:productId` - 更新專區商品
- `DELETE /api/admin/recommendations/:sectionId/products/:productId` - 刪除專區商品

#### 通知管理

- `GET /api/admin/notifications` - 取得通知模板列表
- `POST /api/admin/notifications` - 發送通知

## GitHub 協作流程

為了確保專案程式碼的穩定與開發流程的順暢，建議遵循以下版本控制規則：

### 分支管理

- **主要分支：** `main` 分支為專案的正式發布版本，請勿直接在此分支進行任何開發工作。
- **開發分支：** `dev` 分支為主要的開發分支，所有新功能開發都應基於此分支進行。
- **功能分支：** 每當需要開發新功能時，請從 `dev` 分支建立一個新的功能分支，命名格式建議遵循 conventional commits 原則，例如：
  - **fix**：修復某個 bug
  - **feat**：實現某個新功能 (feature 的縮寫)
  - 其他常見前綴：如 **docs** (新增文件)、**refactor** (重構程式碼)、**test** (撰寫測試) 等

### Pull Request (PR)

功能開發完成後，請將您的功能分支發起 Pull Request，目標分支設定為 `dev`。經過程式碼審查並確認無誤後，您的 PR 將會被合併到 `dev` 分支。

### 團隊成員版控情境完整步驟

#### 情境一：本地端完全沒有該專案

1. **Clone 遠端專案到本地**

```bash
git clone <遠端倉庫網址>
cd <專案資料夾>
```

2. **切換並更新 dev 分支**

```bash
git checkout dev
git pull origin dev
```

3. **從 dev 分支建立並切換到 feature 分支**

```bash
git checkout -b feature/你的功能名稱
```

4. **在 feature 分支進行開發，隨時提交**

```bash
git add .
git commit -m "你的 commit 訊息"
```

5. **將 feature 分支推送到遠端**

```bash
git push -u origin feature/你的功能名稱
```

6. **到 GitHub 上發起 Pull Request，目標分支設為 dev**
   - 填寫 PR 描述，清楚說明本次提交的功能或修改內容
   - 等待其他成員進行程式碼審查
   - 根據審查意見進行必要的修改後再次提交
   - PR 通過審查後，將由專案管理者或您自行合併到 dev 分支

#### 情境二：本地端之前已經 clone 過專案

1. **進入專案資料夾**

```bash
cd <專案資料夾>
```

2. **確保本地 dev 分支為最新**

```bash
git checkout dev
git pull origin dev
```

3. **從 dev 分支建立並切換到 feature 分支**

```bash
git checkout -b feature/你的功能名稱
```

4. **在 feature 分支進行開發，隨時提交**

```bash
git add .
git commit -m "你的 commit 訊息"
```

5. **將 feature 分支推送到遠端**

```bash
git push -u origin feature/你的功能名稱
```

6. **到 GitHub 上發起 Pull Request，目標分支設為 dev**
   - 填寫 PR 描述，清楚說明本次提交的功能或修改內容
   - 等待其他成員進行程式碼審查
   - 根據審查意見進行必要的修改後再次提交
   - PR 通過審查後，將由專案管理者或您自行合併到 dev 分支
