<p align="center">
  <img src="docs/icon.png" alt="Kevin" width="96" height="96">
</p>

<h1 align="center">Kevin</h1>

<p align="center">Ứng dụng API client cho máy tính: gửi request, xem response, viết script và test, tất cả lưu thành file thuần trên đĩa.</p>

Kevin được fork từ [Bruno](https://github.com/usebruno/bruno) (giấy phép MIT), dùng cá nhân.
Mọi Application và Collection là thư mục chứa file văn bản (`.bru` hoặc `.yml`), nên có thể đưa vào Git cùng mã nguồn, review và merge như code.

## Chức năng

**Giao thức**

- HTTP/REST, GraphQL, gRPC và WebSocket trong cùng một giao diện.

**Soạn request**

- Params, headers, body (JSON, XML, form, multipart, file, ...), cookie.
- Xác thực: nhiều kiểu auth, có thể đặt ở cấp application hoặc collection và kế thừa (`inherit`) xuống request.
- Environment và biến ở cấp application, collection, request; biến bí mật không bị ghi ra file.
- Sinh code mẫu (snippet) cho request.

**Script và test**

- Script trước/sau request và test bằng JavaScript, chạy trong sandbox (QuickJS an toàn mặc định, hoặc chế độ developer).
- Đặt ở cấp application, collection hoặc request.

**Import, export và đồng bộ**

- Tạo Application gồm nhiều Collection, mỗi Collection lấy từ OpenAPI hoặc file `.proto` (gRPC), bằng URL hoặc file.
- Đồng bộ Collection với OpenAPI spec theo chu kỳ, xem spec ngay trong app.
- Import Application có sẵn từ thư mục; import và export Environment.
- Chuyển Application từ định dạng `.bru` sang `.yml`.

**Giao diện**

- Trang Home dạng card hoặc bảng, sidebar cây thư mục, tab request, nhiều theme sáng/tối.

## Cài đặt và chạy

Cần Node `v24.22.3` (xem `.nvmrc`).

```bash
npm i --legacy-peer-deps
npm run setup      # build các package dùng chung
npm run dev        # chạy Electron + React
```

## Nguồn gốc

Dựa trên mã nguồn Bruno (MIT), dùng riêng cá nhân, không phân phối.
