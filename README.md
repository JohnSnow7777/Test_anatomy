# CONNECT InBody AI — Anatomy 10-Figure Interactive Engineering Atlas

주식회사 커넥트의 비침습 멀티센서 AI 건강측정기기(**`CONNECT InBody AI`**) 최종 개발 제품을 [`wheresryan22/anatomy`](https://github.com/wheresryan22/anatomy) 스킬의 6대 코어 키트(`kit/iso-kit.mjs`, `kit/lathe.mjs`, `kit/tube.mjs`, `kit/audit.mjs`, `kit/gl.mjs`, `kit/turn.mjs`)를 사용하여 **10가지 작동 기계 도해(Interactive Isometric Figures)**로 구현한 프로젝트입니다.

- **Live Deployment**: [https://anatomy-sage.vercel.app/](https://anatomy-sage.vercel.app/)
- **GitHub Repository**: [https://github.com/JohnSnow7777/Test_anatomy](https://github.com/JohnSnow7777/Test_anatomy)

## 10 Interactive Anatomy Figures

| Figure | 제목 및 설명 대상 | 사용된 Anatomy Kit |
| :---: | :--- | :--- |
| **Fig 1** | **올인원 21.5" 스탠드 키오스크 7단 공중 분해도** (`Vercon` 키오스크 + `Yolanda` 8전극 발판·핸드스틱 + `OV2710` 카메라 + `80mm` 프린터) | `iso-kit`, `lathe`, `tube`, `audit` |
| **Fig 2** | **Phase 1 벤치탑 1호기 (24.4만원 투명 아크릴 센서 허브 & 13가닥 점퍼선 결선 리그)** | `iso-kit`, `lathe`, `tube` |
| **Fig 3** | **스마트 멀티센서 우측 핸드스틱 단면 & `HX711` 80Hz 악력·순발력(RFD) 다이나모미터** | `iso-kit`, `lathe`, `tube`, `coil` |
| **Fig 4** | **`AD5940` 다주파수(5/50/200kHz) 세포막 위상각($\phi$) & 세포외수분비($\text{ECW/TBW}$) 수조 리그** | `iso-kit`, `lathe`, `gl` (WebGL) |
| **Fig 5** | **`MAX86150`(ECG+PPG) + `60fps rPPG` 1ms 동기화 맥파전달시간(PTT/PWV) & 무커프 혈압 크로노그래프** | `iso-kit`, `lathe`, `tube`, `gl` (WebGL) |
| **Fig 6** | **`OV2710` 60fps 노출잠금(AE Lock) 카메라: 안면 혈류(rPPG) 프리즘 분광기 & 홍채 단속운동(Iris Saccade) 인지 계측기** | `iso-kit`, `lathe`, `gl` (WebGL) |
| **Fig 7** | **3D 피지컬 AI: 360° 회전 관절 가동범위(ROM) · 거북목(CVA) · 외발서기 낙상 균형 3D 턴테이블** | `turn` (3D Mode), `turn-build`, `lathe` |
| **Fig 8** | **$500.0\,\Omega$ 기준 저항 10초 영점 보정기(`RCAL SWMatrix`) & `ADuM3160` $2500\text{V}$ 의료급 갈바닉 절연 브릿지** | `iso-kit`, `lathe`, `tube`, `audit` |
| **Fig 9** | **30초 3-Step 원스톱 측정 캠 시퀀서 & 6대 영역 32종 바이오마커 통합 계기판** | `iso-kit`, `lathe`, `tube` |
| **Fig 10** | **약국 맞춤형 건기식 소분 디스펜서 × 스마일스퀘어 마이파크 `Check-to-Play / Play-to-Care` O2O 순환 플랫폼** | `iso-kit`, `lathe`, `tube`, `audit` |
