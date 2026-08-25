# 로고 원본

`logo.png` — 1059×1059, 배경 `#00D88C` (불투명, 전면 채움).
앱 아이콘의 원본이다. 다운로드 폴더 같은 바깥 경로에 두면 지워질 수 있어 여기 둔다.

## 아이콘 다시 뽑기

```sh
sips -Z 512 assets/logo.png --out public/icon-512.png
sips -Z 192 assets/logo.png --out public/icon-192.png
sips -Z 180 assets/logo.png --out public/apple-touch-icon.png
sips -Z 512 assets/logo.png --out public/icon-maskable-512.png
```

마스커블도 **크롭 없이 그대로 줄인다.** 배경이 캔버스를 꽉 채우므로 잘라내도
드러날 흰 여백이 없고, 마크는 중앙 68% 지름 안에 들어가 안드로이드 안전영역
(중앙 80% 지름) 대비 여유가 있다. 예전 로고는 마크가 작아 88% 크롭으로 키웠는데,
지금 로고에 그걸 쓰면 오히려 마크가 안전영역 밖으로 밀려난다.

로고를 바꾸면 함께 맞출 것:

- `src/app/manifest.ts` 의 `background_color` — 로고 배경과 같은 값
- 이 문서의 크기·배경색

`theme_color`(`#059669`)는 로고가 아니라 앱 UI 의 기본색이다. 주소창·상태바에
쓰이므로 화면 안의 초록과 맞추는 편이 자연스러워 로고 색과 별개로 둔다.
