# 프로젝트 표준 작업 규칙 (세션마다 재사용)

이 문서는 이 저장소에서 작업할 때 매 세션 동일하게 적용하는 표준 규칙이다.

## 구현 워크플로우
- [plan.md](plan.md)에 정의된 작업/단계를 구현한다.
- 작업이나 단계를 완료하면 즉시 `plan.md`의 해당 체크박스를 `[x]`로 표시한다.
- 모든 작업과 단계가 완료될 때까지 중간에 멈추지 않는다. 막히면 원인을 해결하고 계속 진행한다.

## 타입 규칙
- `any` 타입을 쓰지 않는다.
- `unknown` 타입을 쓰지 않는다. (JSON.parse 등 라이브러리가 반환하는 `any`는 즉시 구체 타입으로
  캐스팅하고, catch 절 변수는 `instanceof Error`로 즉시 좁혀서 사용한다.)
- 모든 TypeScript 설정은 `strict: true`, `noImplicitAny: true`를 유지한다.

## 검증
- 코드를 수정할 때마다 `npm run typecheck`를 실행해 새로운 타입 오류를 만들지 않았는지 확인한다.
- 커밋/작업 완료 전에 관련 `tsc --noEmit` 스크립트가 전부 통과해야 한다.

## 프로젝트 구조
- `web/` — 정적 랜딩 페이지 (TypeScript → `dist/web`로 컴파일)
- `apps-script/` — Google Apps Script 백엔드 (TypeScript → `apps-script/dist/Code.gs`로 컴파일 후
  Apps Script 편집기에 수동 복사)
- `tools/` — 명함용 QR 코드 생성 스크립트
