from flask import Flask, render_template, request, redirect, session, url_for
from datetime import datetime, date, timedelta
from werkzeug.utils import secure_filename
import json
import os

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', '')

# PythonAnywhere 배포 경로
DATA_FILE = '/home/sshs108/mysite/notices.json'
FREE_DATA_FILE = '/home/sshs108/mysite/free.json'
ANONYMOUS_DATA_FILE = '/home/sshs108/mysite/anonymous.json'
LOST_DATA_FILE = '/home/sshs108/mysite/lost_found.json'
USER_DATA_FILE = '/home/sshs108/mysite/users.json'
PENDING_DATA_FILE = '/home/sshs108/mysite/pending_users.json'

UPLOAD_FOLDER = '/home/sshs108/mysite/static/uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# JSON 파일 유틸리티
def load_json(filepath, default_data):
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(default_data, f, ensure_ascii=False, indent=4)
    return default_data

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

# JSON 읽기
def load_data(filename):
    if not os.path.exists(filename):
        return {}
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {}

# JSON 저장
def save_data(filename, data):
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

users = load_json(USER_DATA_FILE, {})
notices = load_json(DATA_FILE, [])
free_posts = load_json(FREE_DATA_FILE, [])
anonymous_posts = load_json(ANONYMOUS_DATA_FILE, [])
lost_posts = load_json(LOST_DATA_FILE, [])
LOST_LOCATIONS = ['예지관', '의행관', '우암관', '융합인재관', '창의인재관', '아람관', '운동장', '모름/기타']

# Google Sheets 연동

import os
import google.oauth2.credentials
import google_auth_oauthlib.flow
from googleapiclient.discovery import build

# Google API 설정
CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = os.environ.get('GOOGLE_SPREADSHEET_ID', '')

import sqlite3

def perform_sheet_update(service, student_id, period, location):
    SHEET_NAME = '학생 신청'
    try:
        # 학번 위치 찾기
        result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range=f'{SHEET_NAME}!A:A').execute()
        values = result.get('values', [])

        row_index = -1
        for i, row in enumerate(values):
            if row and str(row[0]) == str(student_id):
                row_index = i + 1
                break

        if row_index != -1:
            target_col = 'C' if '1교시' in period else 'F'
            target_range = f'{SHEET_NAME}!{target_col}{row_index}'
            body = {'values': [[location]]}
            service.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID, range=target_range,
                valueInputOption='RAW', body=body).execute()
            return True
    except Exception as e:
        print(f"시트 업데이트 중 상세 에러: {e}")
    return False


# 예약 DB 초기화
def init_db():
    db_path = '/home/sshs108/mysite/reservations.db'
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    # 날짜, 학번, 이름, 교시, 장소를 저장한다.
    c.execute('''CREATE TABLE IF NOT EXISTS reservations
                 (date TEXT, student_id TEXT, name TEXT, period TEXT, location TEXT)''')
    conn.commit()
    conn.close()

init_db()


# OAuth 설정
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

@app.route('/google_login')
def google_login():
    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        {"web": {"client_id": CLIENT_ID, "client_secret": CLIENT_SECRET, "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token"}},
        scopes=SCOPES
    )
    flow.redirect_uri = url_for('callback', _external=True)

    authorization_url, state = flow.authorization_url(access_type='offline', include_granted_scopes='true')

    session['state'] = state
    session['code_verifier'] = flow.code_verifier

    return redirect(authorization_url)

@app.route('/callback')
def callback():
    state = session.get('state')
    flow = google_auth_oauthlib.flow.Flow.from_client_config(
        {"web": {"client_id": CLIENT_ID, "client_secret": CLIENT_SECRET, "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token"}},
        scopes=SCOPES,
        state=state
    )
    flow.redirect_uri = url_for('callback', _external=True)

    flow.code_verifier = session.get('code_verifier')

    flow.fetch_token(authorization_response=request.url)

    credentials = flow.credentials
    session['google_token'] = {
        'token': credentials.token,
        'refresh_token': credentials.refresh_token,
        'token_uri': credentials.token_uri,
        'client_id': credentials.client_id,
        'client_secret': credentials.client_secret,
        'scopes': credentials.scopes
    }

    session.pop('code_verifier', None)

    return "<script>alert('학교 구글 계정 인증 완료!'); location.href='/outing';</script>"

@app.route('/outing', methods=['GET', 'POST'])
def outing():
    if 'google_token' not in session:
        return "<script>alert('학교 Google 계정으로 로그인이 필요합니다.'); location.href='/google_login';</script>"

    creds = google.oauth2.credentials.Credentials(**session['google_token'])
    service = build('sheets', 'v4', credentials=creds, cache_discovery=False)

    db_path = '/home/sshs108/mysite/reservations.db'

    # 한국 시간 기준
    now_kst = datetime.utcnow() + timedelta(hours=9)
    today_str = now_kst.strftime('%Y-%m-%d')
    current_hour = now_kst.hour
    current_minute = now_kst.minute

    # 오전 7시 15분 이후 오늘 예약을 시트에 반영한다.
    if (current_hour > 7) or (current_hour == 7 and current_minute >= 15):
        try:
            conn = sqlite3.connect(db_path)
            c = conn.cursor()

            c.execute("SELECT student_id, period, location FROM reservations WHERE date=?", (today_str,))
            todays_reservations = c.fetchall()

            if todays_reservations:
                for res in todays_reservations:
                    perform_sheet_update(service, res[0], res[1], res[2])

                c.execute("DELETE FROM reservations WHERE date=?", (today_str,))
                conn.commit()
            conn.close()
            print(f"[{now_kst}] 자동 예약 처리 완료")
        except Exception as e:
            print(f"방문자 트리거 실행 중 오류: {e}")
    else:
        print(f"[{now_kst}] 아직 예약 처리 시간이 아닙니다 (7:15 이후 작동)")

    # 신청 또는 예약 처리
    if request.method == 'POST':
        target_date = request.form.get('target_date', '').strip()
        student_id = request.form.get('student_id', '').strip()
        name = request.form.get('name', '').strip()
        period = request.form.get('period', '').strip()
        location = request.form.get('location', '').strip()

        if target_date == today_str and ((19> current_hour > 7) or (current_hour == 7 and current_minute >= 15)):
            success = perform_sheet_update(service, student_id, period, location)
            if success:
                return f"<script>alert('오늘({today_str}) 이석 신청이 완료되었습니다!'); location.href='/outing';</script>"
            else:
                return f"<script>alert('시트 업데이트 실패. 학번을 확인하세요.'); history.back();</script>"

        elif target_date > today_str or (target_date == today_str and ((7> current_hour ) or (current_hour == 7 and current_minute < 15))):
            try:
                conn = sqlite3.connect(db_path)
                c = conn.cursor()
                c.execute("INSERT INTO reservations VALUES (?, ?, ?, ?, ?)",
                          (target_date, student_id, name, period, location))
                conn.commit()
                conn.close()
                return f"<script>alert('{target_date}일로 예약 완료!'); location.href='/outing';</script>"
            except Exception as e:
                return f"<script>alert('예약 저장 오류: {e}'); history.back();</script>"
        else:
            return "<script>alert('과거 날짜는 선택할 수 없습니다.'); history.back();</script>"

    # 현황판 출력
    try:
        SHEET_NAME = '학생 신청'
        result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range=f'{SHEET_NAME}!A3:H').execute()
        rows = result.get('values', [])
    except:
        rows = []

    # 1-8반 명단만 필터링한다.
    class_1_8_rows = []
    for row in rows:
        if len(row) > 0:
            try:
                s_id = int(str(row[0]).strip())
                if 1801 <= s_id <= 1816:
                    class_1_8_rows.append(row)
            except ValueError:
                pass

    # 현재 사용자의 향후 예약만 가져온다.
    my_reservations = []
    try:
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("SELECT date, period, location FROM reservations WHERE (student_id=? OR name=?) AND date >= ? ORDER BY date ASC",
                  (session['user'], session['user'], today_str))
        my_reservations = c.fetchall()
        conn.close()
    except Exception as e:
        print(f"내 예약 불러오기 오류: {e}")

    return render_template('outing.html', rows=rows, class_1_8_rows=class_1_8_rows, my_reservations=my_reservations, user=session.get('user'))

# 예약 취소
@app.route('/delete_reservation', methods=['POST'])
def delete_reservation():
    if 'google_token' not in session:
        return "<script>alert('학교 Google 계정으로 로그인이 필요합니다.'); location.href='/google_login';</script>"

    res_date = request.form.get('date', '').strip()
    res_period = request.form.get('period', '').strip()
    res_location = request.form.get('location', '').strip()
    user_id = session.get('user')

    db_path = '/home/sshs108/mysite/reservations.db'
    try:
        conn = sqlite3.connect(db_path)
        c = conn.cursor()

        c.execute("""
            DELETE FROM reservations
            WHERE date = ? AND period = ? AND location = ?
              AND (student_id = ? OR name = ?)
        """, (res_date, res_period, res_location, user_id, user_id))

        conn.commit()
        conn.close()

        return "<script>alert('예약이 정상적으로 취소 및 삭제되었습니다.'); location.href='/outing';</script>"
    except Exception as e:
        return f"<script>alert('삭제 처리 중 오류가 발생했습니다: {e}'); history.back();</script>"
# 연속 이석 신청
@app.route('/continuous_outing', methods=['GET', 'POST'])
def continuous_outing():
    if 'google_token' not in session:
        return "<script>alert('학교 Google 계정으로 로그인이 필요합니다.'); location.href='/google_login';</script>"

    if request.method == 'POST':
        start_date_str = request.form.get('start_date', '').strip()
        end_date_str = request.form.get('end_date', '').strip()
        student_id = request.form.get('student_id', '').strip()
        name = request.form.get('name', '').strip()
        period = request.form.get('period', '').strip()
        location = request.form.get('location', '').strip()

        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            return "<script>alert('날짜 형식이 잘못되었습니다.'); history.back();</script>"

        now_kst = datetime.utcnow() + timedelta(hours=9)
        today = now_kst.date()

        if start_date > end_date:
            return "<script>alert('종료일이 시작일보다 빠를 수 없습니다.'); history.back();</script>"
        if end_date < today:
            return "<script>alert('과거 날짜는 예약할 수 없습니다.'); history.back();</script>"

        try:
            s_id_int = int(''.join(filter(str.isdigit, student_id)))
            is_student_odd = (s_id_int % 2 != 0)
        except ValueError:
            s_id_int = -1
            is_student_odd = False

        db_path = '/home/sshs108/mysite/reservations.db'
        conn = sqlite3.connect(db_path)
        c = conn.cursor()

        creds = google.oauth2.credentials.Credentials(**session['google_token'])
        service = build('sheets', 'v4', credentials=creds, cache_discovery=False)

        current_date = start_date
        added_count = 0
        skipped_count = 0

        while current_date <= end_date:
            if current_date.weekday() in [0, 1, 2, 3]:

                skip_date = False

                if location == '(기숙사)' and s_id_int != -1:
                    is_date_odd = (current_date.day % 2 != 0)

                    is_allowed_dormitory_date = not is_date_odd if is_student_odd else is_date_odd
                    skip_date = not is_allowed_dormitory_date

                if skip_date:
                    skipped_count += 1
                else:
                    if current_date < today:
                        pass
                    elif current_date == today:
                        perform_sheet_update(service, student_id, period, location)
                        added_count += 1
                    else:
                        c.execute("INSERT INTO reservations VALUES (?, ?, ?, ?, ?)",
                                  (current_date.strftime('%Y-%m-%d'), student_id, name, period, location))
                        added_count += 1

            current_date += timedelta(days=1)

        conn.commit()
        conn.close()

        msg = f"총 {added_count}일의 월~목 예약이 완료되었습니다."

        return f"<script>alert('{msg}'); location.href='/outing';</script>"

    return render_template('continuous_outing.html', user=session.get('user'))

# 로그인
@app.route('/', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        id = request.form.get('id', '').strip()
        pw = request.form.get('pw', '').strip()

        current_users = load_data(USER_DATA_FILE)

        if id in current_users and current_users[id] == pw:
            session['user'] = id
            return redirect('/notice')
        else:
            return "<script>alert('로그인 실패: 아이디 또는 비밀번호를 확인하세요.'); history.back();</script>"
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect('/')
# 회원가입
@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        user_id = request.form.get('id', '').strip()
        pw = request.form.get('pw', '').strip()
        pw_confirm = request.form.get('pw_confirm', '').strip()
        student_id = request.form.get('student_id', '').strip()
        name = request.form.get('name', '').strip()
        birth = request.form.get('birth', '').strip()

        if not all([user_id, pw, pw_confirm, student_id, name, birth]):
            return "<script>alert('모든 항목을 입력해주세요.'); history.back();</script>"

        if pw != pw_confirm:
            return "<script>alert('비밀번호가 일치하지 않습니다.'); history.back();</script>"

        active_users = load_data(USER_DATA_FILE)
        pending_users = load_data(PENDING_DATA_FILE)

        if user_id in active_users:
            return "<script>alert('이미 가입된 아이디입니다.'); history.back();</script>"

        if user_id in pending_users:
            return "<script>alert('이미 승인 대기 중인 아이디입니다.'); history.back();</script>"

        pending_users[user_id] = {
            "pw": pw,
            "student_id": student_id,
            "name": name,
            "birth": birth
        }
        save_data(PENDING_DATA_FILE, pending_users)

        return "<script>alert('가입 신청이 완료되었습니다! 관리자 승인 후 로그인이 가능합니다.'); window.location.href='/';</script>"

    return render_template('signup.html')

@app.route('/admin_dashboard')
def admin_dashboard():
    if 'user' not in session: return redirect('/')
    if session['user'] != 'admin':
        return "<script>alert('관리자 권한이 필요합니다.'); history.back();</script>"
    pending_users = load_data(PENDING_DATA_FILE)
    return render_template('admin.html', pending_users=pending_users)

@app.route('/approve/<user_id>')
def approve(user_id):
    pending_users = load_data(PENDING_DATA_FILE)
    active_users = load_data(USER_DATA_FILE)

    if user_id in pending_users:
        user_pw = pending_users[user_id]['pw']
        active_users[user_id] = user_pw

        del pending_users[user_id]

        save_data(USER_DATA_FILE, active_users)
        save_data(PENDING_DATA_FILE, pending_users)
        return "<script>alert('승인 완료! 이제 해당 아이디로 로그인이 가능합니다.'); window.location.href='/admin_dashboard';</script>"

    return "해당 유저를 찾을 수 없습니다.", 404

@app.route('/reject/<user_id>')
def reject(user_id):
    pending_users = load_data(PENDING_DATA_FILE)
    if user_id in pending_users:
        del pending_users[user_id]
        save_data(PENDING_DATA_FILE, pending_users)
        return "<script>alert('거절되었습니다.'); window.location.href='/admin_dashboard';</script>"
    return "유저를 찾을 수 없습니다.", 404
# 공지 게시판
@app.route('/notice', methods=['GET', 'POST'])
def notice():
    if 'user' not in session: return redirect('/')
    if request.method == 'POST':
        if session.get('user') not in ['admin', 'Teacher']: return "권한 없음"

        file = request.files.get('file')
        filename = ""
        if file and file.filename != '':
            filename = secure_filename(file.filename)
            file.save(os.path.join(UPLOAD_FOLDER, filename))

        notices.append({
            "datetime": request.form['datetime'],
            "title": request.form['title'],
            "content": request.form['content'],
            "file": filename, "views": 0, "comments": []
        })
        save_json(DATA_FILE, notices)
        return redirect('/notice')

    now = datetime.utcnow() + timedelta(hours=9)
    visible_notices = [n for n in notices if datetime.strptime(n["datetime"], "%Y-%m-%dT%H:%M") <= now]
    visible_notices.reverse()
    return render_template('noti.html', notices=visible_notices, user=session['user'])

@app.route('/notice/<int:index>', methods=['GET', 'POST'])
def detail(index):
    if 'user' not in session: return redirect('/')
    now = datetime.utcnow() + timedelta(hours=9)
    visible_notices = [n for n in notices if datetime.strptime(n["datetime"], "%Y-%m-%dT%H:%M") <= now]
    visible_notices.reverse()

    if 0 <= index < len(visible_notices):
        notice = visible_notices[index]
        if request.method == 'POST':
            comment_text = request.form.get('comment')
            if comment_text:
                notice.setdefault('comments', []).append({"writer": session['user'], "content": comment_text, "time": now.strftime("%m-%d %H:%M")})
                save_json(DATA_FILE, notices)
            return redirect(f'/notice/{index}')

        if request.method == 'GET':
            notice['views'] = notice.get('views', 0) + 1
            save_json(DATA_FILE, notices)
        return render_template('detail.html', notice=notice, user=session['user'])
    return "존재하지 않음"

@app.route('/delete/<int:index>')
def delete(index):
    if session.get('user') not in ['admin', 'Teacher']: return "권한 없음"
    now = datetime.utcnow() + timedelta(hours=9)
    visible_notices = [n for n in notices if datetime.strptime(n["datetime"], "%Y-%m-%dT%H:%M") <= now]
    visible_notices.reverse()
    if 0 <= index < len(visible_notices):
        notices.remove(visible_notices[index])
        save_json(DATA_FILE, notices)
    return redirect('/notice')

@app.route('/edit/<int:index>', methods=['GET', 'POST'])
def edit(index):
    if session.get('user') not in ['admin', 'Teacher']: return "권한 없음"
    now = datetime.utcnow() + timedelta(hours=9)
    visible_notices = [n for n in notices if datetime.strptime(n["datetime"], "%Y-%m-%dT%H:%M") <= now]
    visible_notices.reverse()
    if 0 <= index < len(visible_notices):
        if request.method == 'POST':
            visible_notices[index]['title'] = request.form['title']
            visible_notices[index]['content'] = request.form['content']
            save_json(DATA_FILE, notices)
            return redirect('/notice')
        return render_template('edit.html', notice=visible_notices[index])
    return "존재하지 않음"

# 자유 게시판
@app.route('/free', methods=['GET', 'POST'])
def free():
    if session['user'] == 'Teacher':
        return "<script>alert('선생님은 자유게시판에 접근할 수 없습니다.'); history.back();</script>"

    now = datetime.utcnow() + timedelta(hours=9)

    if request.method == 'POST':
        file = request.files.get('file')
        filename = ""
        if file and file.filename != '':
            filename = secure_filename(file.filename)
            file.save(os.path.join(UPLOAD_FOLDER, filename))

        free_posts.append({
            "author": session['user'],
            "datetime": now.strftime("%Y-%m-%dT%H:%M"),
            "title": request.form['title'],
            "content": request.form['content'],
            "file": filename, "views": 0, "comments": []
        })
        save_json(FREE_DATA_FILE, free_posts)
        return redirect('/free')

    visible_posts = free_posts.copy()
    visible_posts.reverse()
    return render_template('free.html', posts=visible_posts, user=session['user'])

@app.route('/free/<int:index>', methods=['GET', 'POST'])
def free_detail(index):
    if 'user' not in session: return redirect('/')
    if session['user'] == 'Teacher': return "<script>alert('접근 불가'); history.back();</script>"

    now = datetime.utcnow() + timedelta(hours=9)
    visible_posts = free_posts.copy()
    visible_posts.reverse()

    if 0 <= index < len(visible_posts):
        post = visible_posts[index]
        if request.method == 'POST':
            comment_text = request.form.get('comment')
            if comment_text:
                post.setdefault('comments', []).append({"writer": session['user'], "content": comment_text, "time": now.strftime("%m-%d %H:%M")})
                save_json(FREE_DATA_FILE, free_posts)
            return redirect(f'/free/{index}')

        if request.method == 'GET':
            post['views'] = post.get('views', 0) + 1
            save_json(FREE_DATA_FILE, free_posts)
        return render_template('free_detail.html', notice=post, user=session['user'])
    return "존재하지 않음"

@app.route('/free/delete/<int:index>')
def free_delete(index):
    if 'user' not in session: return redirect('/')
    if session['user'] == 'Teacher': return "<script>alert('접근 불가'); history.back();</script>"

    visible_posts = free_posts.copy()
    visible_posts.reverse()

    if 0 <= index < len(visible_posts):
        target = visible_posts[index]
        if target.get('author') == session['user'] or session['user'] == 'admin':
            free_posts.remove(target)
            save_json(FREE_DATA_FILE, free_posts)
        else:
            return "<script>alert('삭제 권한이 없습니다.'); history.back();</script>"
    return redirect('/free')

@app.route('/free/edit/<int:index>', methods=['GET', 'POST'])
def free_edit(index):
    if 'user' not in session: return redirect('/')
    if session['user'] == 'Teacher': return "<script>alert('접근 불가'); history.back();</script>"

    visible_posts = free_posts.copy()
    visible_posts.reverse()

    if 0 <= index < len(visible_posts):
        target = visible_posts[index]
        if target.get('author') != session['user'] and session['user'] != 'admin':
            return "<script>alert('수정 권한이 없습니다.'); history.back();</script>"

        if request.method == 'POST':
            target['title'] = request.form['title']
            target['content'] = request.form['content']
            save_json(FREE_DATA_FILE, free_posts)
            return redirect('/free')
        return render_template('edit.html', notice=target)
    return "존재하지 않음"

# 익명 게시판
@app.route('/anonymous', methods=['GET', 'POST'])
def anonymous():
    if 'user' not in session: return redirect('/')
    if session['user'] == 'Teacher': return "<script>alert('접근 불가'); history.back();</script>"

    now = datetime.utcnow() + timedelta(hours=9)
    if request.method == 'POST':
        file = request.files.get('file')
        filename = ""
        if file and file.filename != '':
            filename = secure_filename(file.filename)
            file.save(os.path.join(UPLOAD_FOLDER, filename))

        anonymous_posts.append({
            "real_author": session['user'],
            "datetime": now.strftime("%Y-%m-%dT%H:%M"),
            "title": request.form['title'],
            "content": request.form['content'],
            "file": filename, "views": 0, "comments": []
        })
        save_json(ANONYMOUS_DATA_FILE, anonymous_posts)
        return redirect('/anonymous')

    visible_posts = anonymous_posts.copy()
    visible_posts.reverse()
    return render_template('anonymous.html', posts=visible_posts, user=session['user'])

@app.route('/anonymous/<int:index>', methods=['GET', 'POST'])
def anonymous_detail(index):
    if 'user' not in session: return redirect('/')
    if session['user'] == 'Teacher': return "<script>alert('접근 불가'); history.back();</script>"

    now = datetime.utcnow() + timedelta(hours=9)
    visible_posts = anonymous_posts.copy()
    visible_posts.reverse()

    if 0 <= index < len(visible_posts):
        post = visible_posts[index]
        if request.method == 'POST':
            comment_text = request.form.get('comment')
            if comment_text:
                post.setdefault('comments', []).append({
                    "real_writer": session['user'],
                    "time": now.strftime("%m-%d %H:%M"),
                    "content": comment_text
                })
                save_json(ANONYMOUS_DATA_FILE, anonymous_posts)
            return redirect(f'/anonymous/{index}')

        if request.method == 'GET':
            post['views'] = post.get('views', 0) + 1
            save_json(ANONYMOUS_DATA_FILE, anonymous_posts)
        return render_template('anonymous_detail.html', notice=post, user=session['user'], post_index=index)
    return "존재하지 않음"

@app.route('/anonymous/delete/<int:index>')
def anonymous_delete(index):
    if 'user' not in session:
        return redirect('/')

    visible_posts = anonymous_posts.copy()
    visible_posts.reverse()

    if 0 <= index < len(visible_posts):
        target = visible_posts[index]
        if target.get('real_author') == session['user'] or session['user'] == 'admin':
            anonymous_posts.remove(target)
            save_json(ANONYMOUS_DATA_FILE, anonymous_posts)
        else:
            return "<script>alert('삭제 권한이 없습니다 (본인 글만 삭제 가능).'); history.back();</script>"
    return redirect('/anonymous')


# 분실물 신고 게시판
def lost_location_label(location):
    return '기타장소' if location == '모름/기타' else location

def lost_board_info(board_type):
    if board_type == 'owner':
        return '주인을 찾습니다', '내가 주운 물건의 주인을 찾는 글을 올려주세요.'
    if board_type == 'item':
        return '물건을 찾습니다', '내가 잃어버린 물건을 찾는 글을 올려주세요.'
    return None, None

@app.route('/lost/<board_type>', methods=['GET', 'POST'])
def lost_board(board_type):
    if 'user' not in session:
        return redirect('/')

    board_title, board_description = lost_board_info(board_type)
    if board_title is None:
        return "존재하지 않는 분실물 게시판입니다.", 404

    now = datetime.utcnow() + timedelta(hours=9)

    if request.method == 'POST':
        file = request.files.get('file')
        filename = ""
        if file and file.filename != '':
            filename = secure_filename(file.filename)
            file.save(os.path.join(UPLOAD_FOLDER, filename))

        location = request.form.get('location', '모름/기타')
        if location not in LOST_LOCATIONS:
            location = '모름/기타'

        lost_posts.append({
            "type": board_type,
            "author": session['user'],
            "datetime": now.strftime("%Y-%m-%dT%H:%M"),
            "location": location,
            "title": request.form['title'],
            "content": request.form['content'],
            "file": filename,
            "views": 0,
            "comments": []
        })
        save_json(LOST_DATA_FILE, lost_posts)
        return redirect(f'/lost/{board_type}')

    selected_location = request.args.get('location', '')
    if selected_location not in LOST_LOCATIONS:
        selected_location = ''

    visible_posts = [p for p in lost_posts if p.get('type') == board_type]
    if selected_location:
        visible_posts = [p for p in visible_posts if p.get('location', '모름/기타') == selected_location]
    visible_posts.reverse()

    location_labels = {loc: lost_location_label(loc) for loc in LOST_LOCATIONS}
    return render_template(
        'lost.html',
        posts=visible_posts,
        board_type=board_type,
        board_title=board_title,
        board_description=board_description,
        locations=LOST_LOCATIONS,
        location_labels=location_labels,
        selected_location=selected_location,
        user=session['user']
    )

@app.route('/lost/<board_type>/<int:index>', methods=['GET', 'POST'])
def lost_detail(board_type, index):
    if 'user' not in session:
        return redirect('/')

    board_title, board_description = lost_board_info(board_type)
    if board_title is None:
        return "존재하지 않는 분실물 게시판입니다.", 404

    now = datetime.utcnow() + timedelta(hours=9)
    selected_location = request.args.get('location', '')
    if selected_location not in LOST_LOCATIONS:
        selected_location = ''

    visible_posts = [p for p in lost_posts if p.get('type') == board_type]
    if selected_location:
        visible_posts = [p for p in visible_posts if p.get('location', '모름/기타') == selected_location]
    visible_posts.reverse()

    if 0 <= index < len(visible_posts):
        post = visible_posts[index]
        if request.method == 'POST':
            comment_text = request.form.get('comment')
            if comment_text:
                post.setdefault('comments', []).append({
                    "writer": session['user'],
                    "content": comment_text,
                    "time": now.strftime("%m-%d %H:%M")
                })
                save_json(LOST_DATA_FILE, lost_posts)
            query = f'?location={selected_location}' if selected_location else ''
            return redirect(f'/lost/{board_type}/{index}{query}')

        if request.method == 'GET':
            post['views'] = post.get('views', 0) + 1
            save_json(LOST_DATA_FILE, lost_posts)

        file_ext = post.get('file', '').rsplit('.', 1)[-1].lower() if post.get('file') else ''
        is_image = file_ext in ['png', 'jpg', 'jpeg', 'gif', 'webp']
        location_label = lost_location_label(post.get('location', '모름/기타'))
        return render_template(
            'lost_detail.html',
            notice=post,
            board_type=board_type,
            board_title=board_title,
            location_label=location_label,
            is_image=is_image,
            user=session['user']
        )
    return "존재하지 않음", 404

@app.route('/lost/<board_type>/delete/<int:index>')
def lost_delete(board_type, index):
    if 'user' not in session:
        return redirect('/')

    board_title, board_description = lost_board_info(board_type)
    if board_title is None:
        return "존재하지 않는 분실물 게시판입니다.", 404

    selected_location = request.args.get('location', '')
    if selected_location not in LOST_LOCATIONS:
        selected_location = ''

    visible_posts = [p for p in lost_posts if p.get('type') == board_type]
    if selected_location:
        visible_posts = [p for p in visible_posts if p.get('location', '모름/기타') == selected_location]
    visible_posts.reverse()

    if 0 <= index < len(visible_posts):
        target = visible_posts[index]
        if target.get('author') == session['user'] or session['user'] == 'admin':
            lost_posts.remove(target)
            save_json(LOST_DATA_FILE, lost_posts)
        else:
            return "<script>alert('삭제 권한이 없습니다.'); history.back();</script>"
    query = f'?location={selected_location}' if selected_location else ''
    return redirect(f'/lost/{board_type}{query}')

# 주기율표 퀴즈
@app.route('/quiz')
def quiz():
    if 'user' not in session:
        return render_template('periodic_quiz_1.html')
    return render_template('periodic_quiz_1.html', user=session['user'])

@app.route('/quiz/aminoacid')
def aminoacid_quiz():
    return render_template('aminoacid_quiz.html', user=session.get('user'))

@app.route('/quiz/hormone')
def hormone_quiz():
    return render_template('hormone_quiz.html', user=session.get('user'))

# 영어 단어 퀴즈
@app.route('/english')
def english_quiz():
    if 'user' not in session:
        return render_template('eng.html')

    return render_template('eng.html', user=session['user'])
# 마이페이지
@app.route('/mypage', methods=['GET', 'POST'])
def mypage():
    if 'user' not in session:
        return redirect('/')
    user_id = session['user']
    if request.method == 'POST':
        current_pw = request.form['current_pw']
        new_pw = request.form['new_pw']
        confirm_pw = request.form['confirm_pw']
        if users[user_id] != current_pw:
            return "<script>alert('현재 비밀번호가 틀렸습니다.'); history.back();</script>"
        if new_pw != confirm_pw:
            return "<script>alert('새 비밀번호가 일치하지 않습니다.'); history.back();</script>"
        users[user_id] = new_pw
        save_json(USER_DATA_FILE, users)
        return "<script>alert('비밀번호가 성공적으로 변경되었습니다.'); location.href='/notice';</script>"
    return render_template('mypage.html', user=user_id)

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)
