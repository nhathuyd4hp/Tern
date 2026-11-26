# Kevin

Ứng dụng API client cho máy tính, dùng cá nhân, được fork từ [Bruno](https://github.com/usebruno/bruno) (giấy phép MIT).
Collection được lưu dưới dạng file thuần (`.bru` hoặc `.yml`) trên đĩa, nên có thể đưa vào Git cùng với mã nguồn.

## Cài đặt

Cần Node `v24.22.3` (xem `.nvmrc`).

```bash
npm i --legacy-peer-deps
npm run setup      # build các package dùng chung
npm run dev        # chạy Electron + React
```

`npm run dev` không tự build lại các package dùng chung. Sau khi sửa một package trong số đó,
hãy chạy `npm run build:<tên-package>` (ví dụ `npm run build:bruno-common`).

## Lệnh thường dùng

```bash
npm run lint:fix                                   # ESLint
npm test --workspace=packages/bruno-app            # unit test (tương tự: bruno-requests, bruno-filestore, ...)
```

## Cấu trúc

- `packages/bruno-app`: giao diện React
- `packages/bruno-electron`: tiến trình chính của Electron
- `packages/bruno-js`: sandbox chạy script
- `packages/bruno-filestore`, `packages/bruno-lang`: đọc và ghi file `.bru` / `.yml`

Ghi chú dự án cho Claude Code nằm trong `.claude/`.

## Nguồn gốc

Dựa trên mã nguồn Bruno (MIT), dùng riêng cá nhân, không phân phối.
