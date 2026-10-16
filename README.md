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

---

## ★ 핵심 영업 방식 벤치마킹 (Sales Funnel SSOT — `Fig 10` & `SSOT C`)

> **"손님이 기기를 30초 측정하면 부족한 영양소(오메가3, 마그네슘, 단백질·류신, MSM 등)가 80mm 감열 영수증과 카카오톡 알림톡에 객관적 수치 근거와 함께 찍혀 나와, 약사님이 주관적 권유 부담 없이 건기식 소분 팩을 추천·판매하기 쉬워진다!"**

1. **카르나(온유) AI 헬스뷰어 약국 영업 성공요인 완벽 계승**:
   - 2025년 1월부터 본격 시행된 식약처 **「맞춤형 건강기능식품 소분·조합 판매 제도」**에 맞춰, 약사가 고객에게 말로만 권유할 때 발생하는 거부감을 **'80mm 측정 결과지 즉시 출력 + 카카오톡 알림톡 전송'**이라는 객관적 데이터 근거(Sales Hook)로 돌파한 영업 퍼널을 그대로 흡수했습니다.
2. **가짜 양자공명(QRMA) 제거 → 100% 실제 바이오센서 데이터로 대체**:
   - 카르나는 $15짜리 가짜 저항봉(QRMA)으로 250개 더미 영양 수치를 찍어내어 약사·의료계에서 유사과학 공격을 받지만, **`CONNECT InBody AI`는 `AD5940` 50kHz 세포막 위상각($\phi$) · `MAX86150` 1ms 맥파전달시간(PTT) · `HX711` 80Hz 악력 · `OV2710` 3D 관절 ROM**이라는 100% 실제 계측 물리량으로 영양 가이드를 도출하여 약사에게 당당한 상담 무기를 제공합니다.
   - *(※ `Fig 10` 도면 좌측의 6연장 호퍼는 실제 기기에서 알약이 물리적으로 나오는 것이 아니라, 소프트웨어 결정론적 룰 엔진이 80mm 영수증에 맞춤 소분 조합 가이드를 찍어주는 과정을 Anatomy 물리 장치로 시각화한 은유입니다.)*
3. **스마일스퀘어 마이파크 (`Check-to-Play / Play-to-Care`) 양방향 O2O 연동**:
   - **Check-to-Play (약국 → 마이파크)**: 약국 측정 결과지 하단에 반경 1km 제휴 마이파크 매장(기본 게임비 1인 18홀 7,000원)의 맞춤 스윙 아크(`3/4 스윙`) 및 클럽 그립(`+2mm 오버사이즈 그립`) 처방을 함께 인쇄합니다.
   - **Play-to-Care (마이파크 → 약국)**: 마이파크 제1회 챔피언쉽 마스터즈 대회(2026.10.17~12.19, 앱 회원 참가비 무료·매장 이용료 별도) 및 일반 18홀 라운딩 완주 회원의 전완근·하체 피로도 데이터를 기반으로 제휴 약국 맞춤 건기식 소분 상담 쿠폰을 역발행합니다.
