# Hệ thống làm bài kiểm tra trực tuyến (Thực chiến công chức)

Ứng dụng web làm bài kiểm tra xây dựng bằng **Next.js 15 (App Router)**, **PostgreSQL** (Prisma ORM) và **Ant Design 5**.

Hệ thống gồm 3 site tách biệt theo vai trò:

| Site | Đường dẫn | Vai trò |
|------|-----------|---------|
| Quản trị | `/admin` | `ADMIN` — quản lý tài khoản, role, private key |
| Quản lý | `/manager` | `MANAGER` / `ADMIN` — cây thư mục, câu hỏi, đề thi |
| Thí sinh | `/client` | `GUEST` / `MANAGER` / `ADMIN` — làm bài, xem lại kết quả |

---

## 1. Công nghệ

- **Next.js 15** App Router + TypeScript (Server/Client Components)
- **Ant Design 5** kèm `@ant-design/nextjs-registry`, locale `vi_VN`
- **PostgreSQL 14+** qua **Prisma ORM 6**
- **JWT** (`jose`) lưu trong cookie httpOnly `tccc_session`, bảo vệ route bằng Next.js **Middleware**
- **Excel** import/export qua `xlsx` (SheetJS)
- **bcryptjs** để băm mật khẩu, **zod** để validate

---

## 2. Yêu cầu môi trường

- Node.js 18.18+ (khuyến nghị 20 LTS)
- PostgreSQL client tools (`initdb`, `pg_ctl`) nếu dùng cluster nội bộ dự án
- Dịch vụ PostgreSQL chạy sẵn cũng được (chỉ cần sửa `DATABASE_URL`)

---

## 3. Cài đặt & chạy

```bash
# 1. Cài dependency
npm install

# 2. Tạo file .env từ mẫu
cp .env.example .env      # Windows PowerShell: copy .env.example .env
# (tuỳ chọn) sửa AUTH_SECRET thành chuỗi ngẫu nhiên >= 32 ký tự

# 3. Khởi động PostgreSQL (xem mục Database bên dưới)
npm run pg:start

# 4. Đồng bộ schema + nạp dữ liệu mẫu
npm run db:push
npm run db:seed

# 5. Chạy dev server (http://localhost:3100)
npm run dev
```

Production:

```bash
npm run build
npm start
```

---

## 4. Database

Dự án kèm sẵn một cluster PostgreSQL nội bộ nằm ở thư mục `.pgdata/` (port **5433**) để không ảnh hưởng tới instance PostgreSQL đang chạy trên máy.

```bash
npm run pg:start    # pg_ctl -D .pgdata -o "-p 5433" start
npm run pg:stop     # pg_ctl -D .pgdata stop
```

`DATABASE_URL` mặc định:

```
postgresql://postgres:postgres@127.0.0.1:5433/thuc_chien_cong_chuc?schema=public
```

Nếu dùng PostgreSQL có sẵn, chỉ cần đổi `DATABASE_URL` trong `.env`.

Các lệnh DB khác:

```bash
npm run db:push     # áp dụng schema (không mất dữ liệu)
npm run db:reset    # xoá & tạo lại schema rồi seed lại
npm run db:seed     # nạp dữ liệu mẫu
npm run db:studio   # mở Prisma Studio để xem/sửa dữ liệu
```

> `.pgdata/` đã nằm trong `.gitignore` nên không bị commit.

---

## 5. Tài khoản mẫu

| Role | Email | Mật khẩu |
|------|-------|----------|
| ADMIN | `seoao24@gmail.com` | `Abcd@1234` |
| MANAGER | `manager@tccc.local` | `Abcd@1234` |
| GUEST | `guest@tccc.local` | `Abcd@1234` |

Ngoài ra `npm run db:seed` tạo 5 **private key** mẫu (in ra mã ở console khi seed) để đăng ký tài khoản mới.

### Luồng đăng ký bằng Private Key

1. Admin vào `/admin/private-keys` → **Sinh private key**, chọn thời hạn hết hạn → copy mã (dạng `TCCC-XXXXXXXXXXXX`).
2. Thí sinh vào `/login` → tab **Đăng ký** → nhập email, mật khẩu, họ tên và private key.
3. Tài khoản mới mặc định có role `GUEST`.

---

## 6. Tính năng theo từng site

### 6.1 Site Quản trị (`/admin`)

- **Quản lý tài khoản** (`/admin/users`)
  - Xem danh sách, tìm kiếm, phân trang.
  - **Khóa / mở khóa** tài khoản (tài khoản bị khóa không đăng nhập được).
  - **Gia hạn private key**: cấp/gia hạn một private key mới cho tài khoản (kéo dài gói sử dụng).
  - **Set role**: `GUEST` / `MANAGER` / `ADMIN`.
- **Quản lý private key** (`/admin/private-keys`)
  - Sinh private key kèm **thời gian hết hạn** và ghi chú.
  - Theo dõi trạng thái: `ACTIVE` / `USED` / `REVOKED` / `EXPIRED`.
  - Thu hồi (revoke) key.

### 6.2 Site Quản lý (`/manager`)

- **Danh mục vai trò (Category Role)** (`/manager/category-roles`)
  - Tạo/sửa/xoá category role kèm mô tả và màu sắc.
- **Cây thư mục** (`/manager/folders`) — dùng **Tree View** (AntD `Tree`)
  - Tạo thư mục cha/con, đổi tên, xoá.
  - Gắn **một hoặc nhiều** category role cho mỗi thư mục.
  - **Kế thừa**: thư mục con mặc định kế thừa category role của thư mục cha; nếu được gán riêng thì hiển thị badge "riêng" bên cạnh badge "kế thừa".
- **Ngân hàng câu hỏi** (`/manager/questions`)
  - Lọc theo thư mục / loại / từ khoá.
  - Nhập trực tiếp qua 3 form tương ứng 3 loại câu hỏi:
    1. **Trắc nghiệm 4 đáp án** — chọn đúng 1 đáp án.
    2. **Đúng/Sai** — 2 ý, mỗi ý gắn nhãn đúng hoặc sai.
    3. **Điền nội dung còn thiếu** — các ô trống kèm đáp án chuẩn.
  - Mỗi câu hỏi có **description** (trích dẫn / giải thích đáp án đúng) — **luôn ẩn khi làm bài**, chỉ hiện ở màn hình review.
  - **Import từ file**: nút **"Tải file mẫu"** tải template Excel **riêng biệt cho từng loại câu hỏi**, điền theo format rồi upload lại hệ thống.
- **Đề thi sẵn** (`/manager/exams`)
  - Chế độ **cố định**: chỉ định từng câu hỏi cụ thể.
  - Chế độ **ngẫu nhiên**: chỉ định số lượng câu theo từng loại (ví dụ 40 trắc nghiệm, 20 đúng/sai, 20 điền nội dung còn thiếu) và/hoặc theo từng mục — hệ thống **random** lấy đúng số lượng yêu cầu.
  - Chọn thư mục nguồn, đặt **thời gian làm bài (phút)**, publish/unpublish.

### 6.3 Site Thí sinh (`/client`)

- **Đăng ký** bằng private key (nếu chưa có tài khoản), **đăng nhập** bằng email + mật khẩu.
- **Trang chủ**: thống kê số bài đã làm, điểm trung bình, bài gần đây.
- **Danh sách câu hỏi** (`/client/questions`): xem danh mục câu hỏi, lọc theo thư mục / loại.
- **Bài thi có sẵn** (`/client/exams`): chọn đề đã publish để làm.
- **Tự tạo bài thi** (`/client/create`): nhập số lượng câu hỏi **mỗi loại**, chọn **danh sách thư mục** chứa câu hỏi, nhập thời gian → hệ thống random lấy câu và tạo lần thi.
- **Làm bài** (`/client/attempt/[id]`):
  - Đồng hồ đếm ngược sticky, hiển thị tiến độ **số câu chưa trả lời**.
  - Bấm **Nộp bài** khi chưa hết giờ mà còn câu chưa trả lời → hiện **modal cảnh báo số câu chưa trả lời** (vẫn nộp được sau khi xác nhận).
  - Hết giờ → tự động nộp và chấm điểm.
- **Review bài thi** (`/client/review/[id]`):
  - Chi tiết từng câu: đáp án của mình, đáp án đúng, **trích dẫn/giải thích** (chỉ hiện cho câu sai).
  - **Phân tích theo thư mục**: tổng số câu sai của từng thư mục, **sắp xếp giảm dần theo số câu sai** (sai nhiều xếp trước).
- **Lịch sử** (`/client/history`): danh sách các lần thi đã làm.

---

## 7. Cấu trúc thư mục

```
├── prisma/
│   ├── schema.prisma          # Data model: User, PrivateKey, Folder, CategoryRole,
│   │                          #   Question, QuestionOption, QuestionBlank, ExamTemplate,
│   │                          #   ExamTemplateRule, ExamItem, ExamAttempt, Answer
│   └── seed.ts                # Dữ liệu mẫu + tài khoản admin/manager/guest
├── scripts/
│   ├── e2e-test.js            # Bộ test E2E (40 case) cho cả 3 site
│   ├── cleanup-test-data.js   # Dọn dữ liệu test
│   ├── check-attempt.js       # Kiểm tra dữ liệu một lần thi
│   └── test-import.js         # Test luồng import Excel
└── src/
    ├── app/
    │   ├── layout.tsx          # Root layout + AntD registry (vi_VN)
    │   ├── page.tsx            # Redirect theo role
    │   ├── login/ register/    # Đăng nhập & đăng ký bằng private key
    │   ├── admin/              # Site quản trị
    │   │   ├── users/          #   Quản lý tài khoản, role, khóa, gia hạn key
    │   │   └── private-keys/   #   Sinh / thu hồi private key
    │   ├── manager/            # Site quản lý
    │   │   ├── category-roles/ #   Category role
    │   │   ├── folders/        #   Cây thư mục + gắn category role
    │   │   ├── questions/      #   Ngân hàng câu hỏi + import/template
    │   │   └── exams/          #   Đề thi sẵn
    │   ├── client/             # Site thí sinh
    │   │   ├── questions/      #   Danh mục câu hỏi
    │   │   ├── exams/          #   Bài thi có sẵn
    │   │   ├── create/         #   Tạo bài thi tùy chỉnh
    │   │   ├── attempt/[id]/   #   Làm bài
    │   │   ├── review/[id]/    #   Review + phân tích sai theo thư mục
    │   │   └── history/        #   Lịch sử làm bài
    │   └── api/                # REST API (route handlers)
    │       ├── auth/           #   login / register / logout
    │       ├── admin/          #   users / private-keys
    │       ├── manager/        #   folders / category-roles / questions
    │       │                    #   questions/import / questions/template / exams
    │       └── client/         #   catalog / questions / attempts / submit / review / history
    ├── components/
    │   ├── AppShell.tsx        # Layout chung: sidebar, header, menu theo role
    │   ├── Providers.tsx       # AntD ConfigProvider (locale vi_VN)
    │   └── client/             # Component client-only cho site thí sinh
    ├── lib/
    │   ├── auth.ts             # JWT sign/verify, requireUser / requireRole
    │   ├── prisma.ts           # Prisma client singleton
    │   ├── private-key.ts      # Sinh & kiểm tra mã private key
    │   └── errors.ts           # Helper trả lỗi chuẩn
    ├── services/
    │   ├── folder.service.ts   # Cây thư mục + resolve inheritance category role
    │   ├── question.service.ts # Validate + CRUD 3 loại câu hỏi
    │   ├── import.service.ts   # Đọc sheet, parse câu hỏi, sinh template Excel
    │   └── exam.service.ts     # Random câu hỏi, snapshot attempt, chấm điểm, thống kê sai theo thư mục
    ├── styles/globals.css
    ├── types/auth.ts
    └── middleware.ts           # Chặn /admin, /manager, /client theo role
```

---

## 8. Luồng nghiệp vụ chính

### 8.1 Kế thừa Category Role

```
Folder
 ├── inheritCategoryRoles (bool)
 ├── FolderCategoryRole[]   ← gán trực tiếp
 └── children[]

resolveEffectiveCategoryRoleIds(folder):
  - gán trực tiếp của folder  ∪  (nếu inheritCategoryRoles && có cha)
      → resolveEffectiveCategoryRoleIds(cha)
```

Kết quả dùng cho bộ lọc câu hỏi của client và cho phân tích sai theo thư mục.

### 8.2 Sinh bài thi ngẫu nhiên

```
ExamTemplate.mode = FIXED  → lấy đúng danh sách câu hỏi đã chỉ định
ExamTemplate.mode = RANDOM → theo ExamTemplateRule { folderId, type, quantity }
                            pickRandom(pool, quantity)
```

Khi thí sinh bấm "Làm bài", hệ thống **snapshot** câu hỏi + đáp án đúng vào `ExamItem` của `ExamAttempt`, nhờ vậy việc sửa/xoá câu hỏi sau đó **không làm thay đổi** bài đang làm.

### 8.3 Chấm điểm & thống kê

- `gradeAndSave()` so đáp án của thí sinh với đáp án đúng trong snapshot, lưu `Answer` và tính điểm.
- Câu bị bỏ trống được tính là sai.
- Thống kê sai theo thư mục: nhóm `Answer` sai theo `folderId`, đếm số câu, **sort giảm dần** → hiển thị trên trang review.

---

## 9. Bảo mật

- Mật khẩu băm bằng **bcrypt** (10 rounds), không bao giờ trả về `passwordHash` ra API.
- Phiên đăng nhập là **JWT** ký bằng `AUTH_SECRET`, lưu cookie httpOnly `tccc_session`, hết hạn theo `AUTH_TOKEN_TTL_HOURS` (mặc định 12h).
- `src/middleware.ts` chặn truy cập:
  - `/admin/*` → chỉ `ADMIN`
  - `/manager/*` → `MANAGER` hoặc `ADMIN`
  - `/client/*` → mọi user đã đăng nhập
  - `/login`, `/register` → chuyển hướng nếu đã đăng nhập
- Mọi API route đều gọi `requireUser` / `requireRole` để kiểm tra lại phía server (middleware chỉ là lớp bảo vệ đầu tiên).
- Private key: mã ngẫu nhiên 12 ký tự, lưu trạng thái, kiểm tra hạn dùng và chỉ dùng được 1 lần khi đăng ký.

---

## 10. Kiểm thử

```bash
# Cần dev server đang chạy ở http://localhost:3100
node scripts/e2e-test.js
```

Bộ test bao phủ 40 case: đăng nhập/đăng xuất, quản lý user & role, khóa tài khoản, sinh/dùng/thu hồi/hết hạn private key, cây thư mục & kế thừa category role, validate & tạo cả 3 loại câu hỏi, tải template & import Excel, tạo đề thi cố định và ngẫu nhiên, làm bài, cảnh báo câu chưa trả lời, hết giờ tự nộp, chấm điểm và thống kê sai theo thư mục.

```bash
node scripts/cleanup-test-data.js   # dọn dữ liệu test
node scripts/check-attempt.js       # xem chi tiết một lần thi
```

---

## 11. Câu hỏi thường gặp

**Đổi port chạy dev server?**
Sửa `dev`/`start` trong `package.json` (mặc định `3100` vì `3000` thường bị chiếm).

**Mất dữ liệu sau khi `db:push`?**
`db:push` không mất dữ liệu. Dùng `npm run db:reset` để tạo lại từ đầu.

**Quên mật khẩu admin?**
Chạy lại `npm run db:seed` — seed sẽ reset mật khẩu admin về `Abcd@1234`.

**Tạo bài thi ngẫu nhiên bị thiếu câu?**
Hệ thống chỉ lấy được số câu thực sự tồn tại trong thư mục/loại đã chọn. Hãy kiểm tra số lượng câu hỏi trong từng thư mục trước khi tạo đề.
