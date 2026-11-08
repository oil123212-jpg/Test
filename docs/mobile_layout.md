# 모바일 화면 비율

화면 너비 900px 이하에서는 카드·버튼을 모바일 너비에 맞춥니다. 모든 화면에서 글씨를 기존보다 1–2px 키우고, 흰색 바탕과 진한 글자·초록색 강조 영역을 사용합니다. 색상 토큰은 `web/src/tokens.css`, 공통 대비와 상태 표시는 `web/src/contrast.css`에서 관리합니다.

- 콘텐츠 최대 너비 640px, 좌우 여백 16px, 카드 안쪽 여백 16px, 카드 간격 16–24px.
- 페이지 제목 26px, 카드 제목 17px, 본문 14–15px, 보조 정보 12–14px. 시간/장치 입력은 17px로 작게 표시되는 문제와 iOS 입력 확대 요인을 줄입니다.
- 주요 버튼과 메뉴는 최소 높이 44px. 대화/오디오 버튼은 좁은 화면에서 일정한 열로 배치합니다.
- 소개 그림은 화면 열 너비 안에서 비례 축소하며, 좁은 화면에서도 본문과 겹치지 않게 합니다.
- 생활 시간 카드의 빈 목록 여백과 중복된 위아래 간격을 줄입니다. 동의 팝업과 오디오 설정은 화면 높이 안에서 스크롤할 수 있습니다.

참고한 공개 스타일:

- [Material Web 버튼 스타일](https://github.com/material-components/material-web/blob/main/button/internal/_shared.scss): 아이콘/문자 간격, 줄바꿈을 허용하는 최소 높이 방식.
- [Shopify Polaris 간격 토큰](https://github.com/Shopify/polaris/blob/main/polaris-tokens/src/themes/base/space.ts), [글자 크기 토큰](https://github.com/Shopify/polaris/blob/main/polaris-tokens/src/themes/base/font.ts), [기본 크기](https://github.com/Shopify/polaris/blob/main/polaris-tokens/src/size.ts): 4/8px 간격과 13/14/16/24px 글자 크기 체계.

확인 화면: 320×568, 360×800, 390×844, 430×932, 600×900, 768×1024, 가로 844×390, 데스크톱 1440×1100. 대시보드·라이프 가이드·설정 팝업의 수평 넘침과 화면 경계를 확인합니다. 자동화는 Chromium이며 실제 iOS Safari 확인과 구분합니다.

초기 비율 조정은 8개 크기에서 총 32개 화면을 점검했습니다. 글씨·색상 변경 후에는 320×568, 390×844, 768×1024, 1440×1100에서 대시보드·라이프 가이드·프로필·오디오 설정·동의 팝업 총 20개 화면의 가로 넘침과 팝업 경계를 확인했습니다. 표시된 글자 340건의 계산된 색상 대비가 모두 4.5:1 이상입니다. 비활성 버튼은 흐리게 처리하는 대신 진한 글자와 점선 테두리로 구분하며, 선택 버튼의 배경 색상 전환 중 글자가 흐려지는 현상을 없앴습니다. 제공자와 DB는 기존 테스트 fixture를 사용하며 실제 배포 API 검증과 구분합니다.
