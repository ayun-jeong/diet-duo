# 로고 원본

`logo.png` — 1059×1059, 배경 `#faf6f5` (불투명).
앱 아이콘의 원본이다. 다운로드 폴더 같은 바깥 경로에 두면 지워질 수 있어 여기 둔다.

## 아이콘 다시 뽑기

```sh
sips -Z 512 assets/logo.png --out public/icon-512.png
sips -Z 192 assets/logo.png --out public/icon-192.png
sips -Z 180 assets/logo.png --out public/apple-touch-icon.png

# 마스커블: 안드로이드가 원형으로 잘라내므로 여백을 덜어내 로고를 키운다.
# 88% 중앙 크롭 후에도 로고는 아이콘 폭의 약 60% 라 안전 영역(80%) 안에 들어간다.
sips -c 932 932 assets/logo.png --out /tmp/mask.png
sips -Z 512 /tmp/mask.png --out public/icon-maskable-512.png
```

스플래시 배경(`src/app/manifest.ts` 의 `background_color`)은 로고 배경과 같은 값으로 맞춘다.
