# SSHS108 프로젝트 이해 문서

이 문서는 이 폴더에서 작업할 때 먼저 읽기 위한 프로젝트 요약입니다. 이후 기능 수정이나 버그 수정을 하기 전에 `app.py`, 관련 템플릿, 이 문서를 함께 확인합니다.

## 한 줄 요약

`sshs108`은 서울과학고 1-8반용으로 보이는 Flask 웹앱입니다. 로그인 기반 게시판, 공지, 자유/익명 게시판, 분실물 게시판, Google Sheets 연동 자습/외출 신청 기능, 간단한 퀴즈 페이지를 제공합니다.

## 기술 스택

- Backend: Flask
- Template: Jinja2 HTML 템플릿
- Styling: `static/style.css`
- File upload: `werkzeug.utils.secure_filename`
- Data storage:
  - JSON 파일: 사용자, 게시글, 댓글, 분실물, 승인 대기 사용자
  - SQLite: 자습/외출 예약
  - Google Sheets API: 실시간 자습/외출 현황 연동

## 주요 파일

- `app.py`: 전체 Flask 앱, 라우트, 데이터 로딩/저장, Google Sheets 연동, SQLite 예약 처리
- `requirements.txt`: Python 의존성
- `README.md`: 현재는 매우 짧고 `python->js` TODO만 있음
- `users.json`: 활성 사용자 계정 정보. 평문 비밀번호가 들어 있으므로 조심해서 다룰 것
- `pending_users.json`: 회원가입 승인 대기 사용자
- `notices.json`: 공지 게시판 데이터
- `free.json`: 자유 게시판 데이터
- `anonymous.json`: 익명 게시판 데이터. 내부적으로 실제 작성자도 저장함
- `lost_found.json`: 분실물 관련 게시글 데이터
- `reservations.db`: 예약 테이블을 가진 SQLite DB
- `templates/`: 화면별 HTML
- `static/style.css`: 공통 스타일
- `static/logo.png`: 파비콘/로고

## 실행/배포 구조

`app.py`는 PythonAnywhere 배포 경로를 기준으로 작성되어 있습니다.

```python
/home/sshs108/mysite/*.json
/home/sshs108/mysite/reservations.db
/home/sshs108/mysite/static/uploads
```

현재 로컬 폴더에는 같은 이름의 JSON/DB 파일이 있지만, `app.py`의 상수는 절대 경로를 사용합니다. 로컬 실행을 하려면 이 경로 처리부터 확인해야 합니다.

## 데이터 모델

### 사용자

`users.json`

```json
{
  "user_id": "plain_text_password"
}
```

주의: 비밀번호가 해시 없이 평문 저장됩니다.

### 승인 대기 사용자

`pending_users.json`

```json
{
  "user_id": {
    "pw": "plain_text_password",
    "student_id": "학번",
    "name": "이름",
    "birth": "생일"
  }
}
```

### 공지 게시글

`notices.json`

```json
{
  "datetime": "YYYY-MM-DDTHH:MM",
  "title": "제목",
  "content": "내용",
  "file": "첨부파일명",
  "views": 0,
  "comments": [
    {
      "writer": "user_id",
      "content": "댓글",
      "time": "MM-DD HH:MM"
    }
  ]
}
```

### 자유 게시판

`free.json`

공지와 유사하지만 `author` 필드가 있습니다.

### 익명 게시판

`anonymous.json`

화면에서는 익명이지만 JSON에는 `real_author`, 댓글에는 `real_writer`가 저장됩니다.

### 분실물 게시판

`lost_found.json`

```json
{
  "type": "owner 또는 item",
  "author": "user_id",
  "datetime": "YYYY-MM-DDTHH:MM",
  "location": "장소",
  "title": "제목",
  "content": "내용",
  "file": "첨부파일명",
  "views": 0,
  "comments": []
}
```

### 예약 DB

`reservations.db`의 테이블은 `app.py` 기준으로 다음과 같습니다.

```sql
CREATE TABLE IF NOT EXISTS reservations (
  date TEXT,
  student_id TEXT,
  name TEXT,
  period TEXT,
  location TEXT
);
```

## 주요 라우트

### 인증/회원

- `GET/POST /`: 로그인
- `GET /logout`: 로그아웃
- `GET/POST /signup`: 회원가입 신청
- `GET /admin_dashboard`: admin 전용 승인 대기 목록
- `GET /approve/<user_id>`: 가입 승인
- `GET /reject/<user_id>`: 가입 거절
- `GET/POST /mypage`: 비밀번호 변경

### 공지 게시판

- `GET/POST /notice`: 공지 목록 및 작성. `admin`, `Teacher`만 작성 가능
- `GET/POST /notice/<index>`: 공지 상세, 조회수 증가, 댓글 작성
- `GET /delete/<index>`: 공지 삭제. `admin`, `Teacher`만 가능
- `GET/POST /edit/<index>`: 공지 수정. `admin`, `Teacher`만 가능

### 자유 게시판

- `GET/POST /free`: 자유 게시글 목록/작성. `Teacher` 접근 제한
- `GET/POST /free/<index>`: 상세/댓글/조회수
- `GET /free/delete/<index>`: 작성자 또는 admin 삭제
- `GET/POST /free/edit/<index>`: 작성자 또는 admin 수정

### 익명 게시판

- `GET/POST /anonymous`: 익명 게시글 목록/작성. `Teacher` 접근 제한
- `GET/POST /anonymous/<index>`: 상세/댓글/조회수
- `GET /anonymous/delete/<index>`: 실제 작성자 또는 admin 삭제

### 분실물 게시판

- `GET/POST /lost/<board_type>`:
  - `owner`: 주인을 찾는 게시판
  - `item`: 물건을 찾는 게시판
- `GET/POST /lost/<board_type>/<index>`: 상세/댓글/조회수
- `GET /lost/<board_type>/delete/<index>`: 작성자 또는 admin 삭제
- `location` 쿼리로 장소 필터링

### 자습/외출 신청

- `GET /google_login`: Google OAuth 시작
- `GET /callback`: OAuth 콜백, 토큰을 세션에 저장
- `GET/POST /outing`: 신청, 현황 조회, 예약 처리
- `POST /delete_reservation`: 예약 삭제
- `GET/POST /continuous_outing`: 연속 신청

동작 요약:

- Google Sheets API로 특정 시트의 학생 신청 정보를 읽고 씁니다.
- 당일 07:15 이후에는 오늘 예약을 Google Sheet에 반영하고 DB에서 삭제합니다.
- 오늘 07:15 이후 19:00 전 신청은 즉시 Google Sheet에 반영합니다.
- 미래 날짜 또는 오늘 07:15 전 신청은 SQLite 예약으로 저장합니다.
- 화면에서는 전체 현황과 1801~1816 학번만 필터링한 1-8반 현황을 보여줍니다.

### 퀴즈

- `GET /quiz`: 주기율표 퀴즈
- `GET /english`: 영어 단어 퀴즈

## 템플릿 역할

- `login.html`: 로그인 화면
- `signup.html`: 회원가입 신청
- `admin.html`: 관리자 승인 화면
- `noti.html`: 공지 목록/작성
- `detail.html`: 공지 상세
- `free.html`, `free_detail.html`: 자유 게시판
- `anonymous.html`, `anonymous_detail.html`: 익명 게시판
- `lost.html`, `lost_detail.html`: 분실물 게시판
- `outing.html`: 자습/외출 신청 및 현황
- `continuous_outing.html`: 연속 자습/외출 신청
- `mypage.html`: 비밀번호 변경
- `periodic_quiz_1.html`: 주기율표 퀴즈
- `eng.html`: 영어 단어 퀴즈
- `edit.html`: 공지/게시글 수정 공용 화면

## 현재 코드에서 특히 주의할 점

- `app.py`와 여러 템플릿의 한글 문자열이 깨져 있습니다. 기능 수정 전 인코딩 상태를 먼저 확인해야 합니다.
- Google OAuth `CLIENT_SECRET`, 사용자 비밀번호 등 민감정보가 코드/JSON에 평문으로 있습니다.
- `app.secret_key`가 고정 문자열입니다.
- `users` 등 일부 데이터는 앱 시작 시 전역 변수로 로드됩니다. 파일이 외부에서 바뀌어도 메모리 값과 불일치할 수 있습니다.
- `free()`는 `if session['user'] == 'Teacher'`처럼 로그인 여부 확인 전에 세션 키를 바로 참조하는 곳이 있어 비로그인 접근 시 오류 가능성이 있습니다.
- 게시글 상세/수정/삭제는 화면에 보이는 역순 리스트의 `index`를 사용합니다. 필터링/역순 처리 때문에 원본 리스트와 인덱스 매핑을 조심해야 합니다.
- 파일 업로드는 확장자/크기 제한이 없습니다.
- SQLite 예약 테이블에는 중복 방지 제약이 없습니다.
- 로컬 개발 환경에서는 `python` 명령이 없을 수 있습니다. 필요하면 설치된 Python 런타임 경로를 먼저 확인합니다.

## 작업 전 체크리스트

1. 이 문서와 `app.py`의 관련 라우트를 먼저 읽습니다.
2. 수정 대상 화면의 템플릿을 확인합니다.
3. JSON 데이터 구조를 깨지 않도록 기존 필드명을 유지합니다.
4. 민감정보 값을 답변이나 새 문서에 노출하지 않습니다.
5. 로컬 실행이 필요하면 PythonAnywhere 절대 경로 문제를 먼저 해결하거나 임시 환경 설정 방식을 정합니다.
6. 한글 문구를 고칠 때는 파일 인코딩과 기존 깨진 문자열의 원래 의미를 확인합니다.
