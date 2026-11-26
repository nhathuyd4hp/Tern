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
- Xác thực: Run npm run generate:script-api --workspace=packages/js -- --check
- 
- > @usebruno/js@0.12.0 generate:script-api
  >
- > node ./scripts/generate-script-api.js --check
  >
- 
- generate-script-api: the generated script-api.d.ts does not compile:
- Error: ../../../../../tmp/script-api-s3Pnov/script-api.d.ts(2,23): error TS2688: Cannot find type definition file for 'chai'.
- Error: ../../../../../tmp/script-api-s3Pnov/script-api.d.ts(59,30): error TS2503: Cannot find namespace 'Chai'.
- Error: ../../../../../tmp/script-api-s3Pnov/script-api.d.ts(71,30): error TS2503: Cannot find namespace 'Chai'.
- 
- npm error Lifecycle script `generate:script-api` failed with error:
- npm error code 1
- npm error path /home/runner/work/Kevin/Kevin/packages/js
- npm error workspace @usebruno/js@0.12.0
- npm error location /home/runner/work/Kevin/Kevin/packages/js
- npm error command failed
- npm error command sh -c node ./scripts/generate-script-api.js --check
- Error: Process completed with exit code 1.nhiều kiểu auth, có thể đặt ở cấp collection hoặc folder và kế thừa (`inherit`) xuống request.
- Environment và biến ở cấp collection, folder, request; biến bí mật không bị ghi ra file.
- Sinh code mẫu (snippet) cho request.

**Script và test**

- Script trước/sau request và test bằng JavaScript, chạy trong sandbox (QuickJS an toàn mặc định, hoặc chế độ developer).
- Đặt ở cấp collection, folder hoặc request.

**Import, export và đồng bộ**

- Tạo Collection từ OpenAPI hoặc file `.proto` (gRPC).
- Đồng bộ Collection với OpenAPI spec theo chu kỳ, xem spec ngay trong app.
- Import Collection từ Bruno, OpenAPI, `.proto`; import và export Environment (Bruno, Postman).
- Chuyển Collection từ định dạng `.bru` sang `.yml`.

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
