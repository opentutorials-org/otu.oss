# 보안 정책 (Security Policy)

OTU 프로젝트의 보안을 중요하게 생각합니다. 보안 취약점을 발견하셨다면 아래 절차에 따라 신고해 주세요.

## 지원 버전

현재 보안 업데이트가 지원되는 버전입니다.

| 버전  |        지원 상태        |
| :---: | :---------------------: |
| 0.5.x | :white_check_mark: 지원 |
| < 0.5 |      :x: 지원 종료      |

## 보안 취약점 보고

### 중요: 공개 이슈로 등록하지 마세요

보안 취약점은 **절대 공개 GitHub 이슈로 등록하지 마세요**. 취약점이 패치되기 전에 공개되면 악용될 수 있습니다.

### 보고 방법

다음 방법 중 하나를 선택하여 비공개로 보고해 주세요:

1. **GitHub Security Advisory** (권장)

    - [Security Advisory 페이지](../../security/advisories/new)에서 새 보안 권고 생성
    - 취약점 세부 정보를 비공개로 공유할 수 있습니다

2. **이메일**
    - 보안 관련 문의: [contact@opentutorials.org](mailto:contact@opentutorials.org)
    - 제목에 `[보안]` 또는 `[SECURITY]`를 포함해 주세요

### 보고 시 포함할 정보

- 취약점 유형 (예: XSS, SQL Injection, 인증 우회 등)
- 영향받는 버전 또는 커밋
- 취약점 재현 단계
- 가능하다면, 개념 증명(PoC) 코드 또는 스크린샷

## 대응 절차

1. **확인 (48시간 내)**: 보고 접수 확인 메일 발송
2. **검토 (7일 내)**: 취약점 심각도 평가 및 영향 범위 분석
3. **수정**: 패치 개발 및 테스트
4. **배포**: 보안 패치 릴리스 및 공지
5. **공개**: 패치 배포 후 적절한 시점에 취약점 정보 공개 (보고자 동의 시)

## 보안 업데이트

- 보안 패치는 최신 버전에 우선 적용됩니다
- 심각한 취약점의 경우 긴급 패치를 배포합니다
- 릴리스 노트에 보안 관련 수정 사항을 명시합니다

## 감사의 말

책임감 있는 보안 취약점 보고에 감사드립니다. 보고자의 동의 하에 기여자로 인정해 드립니다.

---

# Security Policy (English)

We take the security of the OTU project seriously. If you discover a security vulnerability, please follow the procedures below to report it.

## Supported Versions

Currently supported versions for security updates:

| Version |        Support Status        |
| :-----: | :--------------------------: |
|  0.5.x  | :white_check_mark: Supported |
|  < 0.5  |       :x: End of Life        |

## Reporting a Vulnerability

### Important: Do NOT open a public issue

**Never report security vulnerabilities through public GitHub issues.** Public disclosure before a patch is available could allow exploitation.

### How to Report

Choose one of the following methods to report privately:

1. **GitHub Security Advisory** (Recommended)

    - Create a new security advisory at [Security Advisory page](../../security/advisories/new)
    - Allows private sharing of vulnerability details

2. **Email**
    - Security inquiries: [contact@opentutorials.org](mailto:contact@opentutorials.org)
    - Please include `[SECURITY]` in the subject line

### Information to Include

- Vulnerability type (e.g., XSS, SQL Injection, Authentication Bypass)
- Affected version or commit
- Steps to reproduce the vulnerability
- If possible, proof-of-concept (PoC) code or screenshots

## Response Process

1. **Acknowledgment (within 48 hours)**: Confirmation email sent upon receipt
2. **Review (within 7 days)**: Severity assessment and impact analysis
3. **Fix**: Patch development and testing
4. **Release**: Security patch deployment and announcement
5. **Disclosure**: Vulnerability details published after patch (with reporter consent)

## Security Updates

- Security patches are prioritized for the latest version
- Critical vulnerabilities receive emergency patches
- Release notes document security-related fixes

## Acknowledgments

Thank you for responsible security vulnerability reporting. With consent, reporters will be credited as contributors.
