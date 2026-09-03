# hikvision_connector.py
# ─── Hikvision ISAPI Attendance Connector ──────────────────────────────────────
# يتصل بأجهزة Hikvision عبر بروتوكول ISAPI (HTTP REST + Digest Auth)
# لا يحتاج أي SDK — يستخدم مكتبة requests الموجودة فقط
# ─────────────────────────────────────────────────────────────────────────────

import xml.etree.ElementTree as ET
import uuid
from datetime import datetime, timedelta

try:
    import requests
    from requests.auth import HTTPDigestAuth
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False


# ─── ثوابت ISAPI ──────────────────────────────────────────────────────────────
ISAPI_ACS_EVENT   = '/ISAPI/AccessControl/AcsEvent'
ISAPI_DEVICE_INFO = '/ISAPI/System/deviceInfo'
DEFAULT_PORT      = 80
DEFAULT_HTTPS_PORT = 443
REQUEST_TIMEOUT   = 15   # ثانية
# Some Hikvision terminals reject large AcsEvent pages with HTTP 400.
# The ISAPI examples commonly use 30, which is the safest cross-model value.
MAX_RESULTS       = 30   # الحد الأقصى للسجلات في كل صفحة

# نوع الأحداث:
#   major=5 → أحداث التحكم بالدخول (Access Control)
#   minor يحدد نوع الحدث الفرعي (دخول / خروج)
#   minor=75 → card verified (الدخول بالبطاقة)
#   يمكن تركها بدون فلتر لجلب كل الأحداث
HIKVISION_MAJOR_ACS = 5


class HikvisionConnector:
    """
    متصل ISAPI لأجهزة Hikvision (DS-K1T، DS-K2210 وما شابهها).
    يدعم HTTP و HTTPS مع Digest Authentication.
    """

    def __init__(self, ip: str, port: int = DEFAULT_PORT,
                 username: str = 'admin', password: str = '',
                 use_https: bool = False):
        self.ip       = ip.strip()
        self.port     = int(port) if port else DEFAULT_PORT
        self.username = username
        self.password = password
        self.use_https = use_https
        self.scheme   = 'https' if use_https else 'http'
        self.base_url = f'{self.scheme}://{self.ip}:{self.port}'
        self.auth     = HTTPDigestAuth(self.username, self.password)
        self.session  = None
        self.prefer_json = False

    # ─── إنشاء Session ────────────────────────────────────────────────────────
    def _get_session(self):
        if self.session is None:
            self.session = requests.Session()
            self.session.auth = self.auth
            self.session.verify = False  # تجاهل شهادة SSL للشبكات الداخلية
        return self.session

    # ─── GET Helper ───────────────────────────────────────────────────────────
    def _get(self, path: str) -> requests.Response:
        if not REQUESTS_AVAILABLE:
            raise RuntimeError('مكتبة requests غير مثبتة. شغّل: pip install requests')
        url = self.base_url + path
        resp = self._get_session().get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp

    # ─── POST Helper ──────────────────────────────────────────────────────────
    def _post(self, path: str, xml_body: str) -> requests.Response:
        if not REQUESTS_AVAILABLE:
            raise RuntimeError('مكتبة requests غير مثبتة. شغّل: pip install requests')
        url = self.base_url + path
        headers = {'Content-Type': 'application/xml; charset=utf-8'}
        resp = self._get_session().post(
            url,
            data=xml_body.encode('utf-8'),
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )
        resp.raise_for_status()
        return resp

    # ─── POST JSON Helper ─────────────────────────────────────────────────────
    def _post_json(self, path: str, json_body: dict) -> requests.Response:
        if not REQUESTS_AVAILABLE:
            raise RuntimeError('مكتبة requests غير مثبتة. شغّل: pip install requests')
        import json
        url = self.base_url + path
        if '?' in path:
            url += '&format=json'
        else:
            url += '?format=json'
        headers = {'Content-Type': 'application/json; charset=utf-8'}
        resp = self._get_session().post(
            url,
            data=json.dumps(json_body).encode('utf-8'),
            headers=headers,
            timeout=REQUEST_TIMEOUT
        )
        resp.raise_for_status()
        return resp

    # ─── اختبار الاتصال ───────────────────────────────────────────────────────
    def test_connection(self) -> dict:
        """
        يتصل بالجهاز ويجلب معلوماته الأساسية.
        يُعيد dict فيه: connected, model, serial_number, firmware
        """
        try:
            resp = self._get(ISAPI_DEVICE_INFO)
            root = ET.fromstring(resp.text)
            ns   = _extract_namespace(root)

            def find(tag):
                el = root.find(f'{ns}{tag}')
                return el.text.strip() if el is not None and el.text else ''

            return {
                'connected':     True,
                'model':         find('model'),
                'serial_number': find('serialNumber'),
                'firmware':      find('firmwareVersion'),
            }
        except requests.exceptions.ConnectionError:
            raise ConnectionError(f'تعذر الاتصال بالجهاز على {self.base_url} — تحقق من IP والشبكة')
        except requests.exceptions.Timeout:
            raise TimeoutError(f'انتهت مهلة الاتصال بـ {self.base_url} ({REQUEST_TIMEOUT}s)')
        except requests.exceptions.HTTPError as e:
            code = e.response.status_code if e.response is not None else '?'
            if code == 401:
                raise PermissionError('خطأ في اسم المستخدم أو كلمة المرور (401)')
            raise RuntimeError(f'خطأ HTTP {code}: {e}')

    # ─── جلب سجلات الحضور ────────────────────────────────────────────────────
    def get_attendance_logs(self, since: datetime) -> list[dict]:
        """
        يجلب سجلات أحداث التحكم بالدخول منذ التاريخ المحدد.
        يُعيد قائمة من dict فيها: pin, time, status
        - status: '0' = دخول / '1' = خروج (نحوّلها من حقل الجهاز)
        """
        all_logs = []
        position = 0

        # نبدأ من ما قبل اللحظة المحددة بدقيقة (هامش أمان)
        start_dt = since - timedelta(minutes=1)
        end_dt   = datetime.now() + timedelta(hours=1)

        start_str = start_dt.astimezone().isoformat(timespec='seconds')
        end_str   = end_dt.astimezone().isoformat(timespec='seconds')

        while True:
            search_id_str = str(uuid.uuid4())
            try:
                resp = self._post_acs_event_search(
                    search_id=search_id_str,
                    start_time=start_str,
                    end_time=end_str,
                    position=position,
                    max_results=MAX_RESULTS,
                )
            except requests.exceptions.HTTPError as e:
                code = e.response.status_code if e.response is not None else '?'
                body = e.response.text[:500] if e.response is not None else str(e)
                raise RuntimeError(f'خطأ ISAPI AcsEvent ({code}): {body}')

            if self.prefer_json:
                records = _parse_acs_event_json_response(resp.text)
            else:
                records = _parse_acs_event_response(resp.text)

            if not records:
                break  # لا مزيد من السجلات

            for rec in records:
                ts = rec.get('timestamp')
                if ts and ts > since:
                    all_logs.append({
                        'pin':    str(rec.get('card_no') or rec.get('employee_no') or ''),
                        'time':   ts.isoformat(),
                        'status': _map_event_to_status(rec.get('event_type', '')),
                    })

            # تصفح الصفحات إذا كان الجهاز يُعيد MAX_RESULTS بالضبط
            if len(records) < MAX_RESULTS:
                break
            position += MAX_RESULTS

        # تصفية الـ pin الفارغ وترتيب زمني
        all_logs = [l for l in all_logs if l['pin']]
        all_logs.sort(key=lambda l: l['time'])
        return all_logs

    # ─── إغلاق الجلسة ─────────────────────────────────────────────────────────
    def disconnect(self):
        if self.session:
            try:
                self.session.close()
            except Exception:
                pass
            self.session = None

    def _post_acs_event_search(self, search_id: str, start_time: str, end_time: str,
                               position: int, max_results: int) -> requests.Response:
        """
        يرسل طلب البحث في سجلات Hikvision.
        بعض الموديلات ترفض فلتر major أو minor، لذلك نبدأ بالأضيق ثم نجرب العام.
        """
        variants = [
            {'major': HIKVISION_MAJOR_ACS, 'minor': 0},
            {'major': HIKVISION_MAJOR_ACS, 'minor': None},
            {'major': None, 'minor': None},
        ]
        last_error = None

        if self.prefer_json:
            for variant in variants:
                json_body = {
                    "AcsEventCond": {
                        "searchID": search_id,
                        "searchResultPosition": position,
                        "maxResults": max_results,
                        "startTime": start_time,
                        "endTime": end_time
                    }
                }
                if variant['major'] is not None:
                    json_body["AcsEventCond"]["major"] = variant['major']
                if variant['minor'] is not None:
                    json_body["AcsEventCond"]["minor"] = variant['minor']
                try:
                    return self._post_json(ISAPI_ACS_EVENT, json_body)
                except requests.exceptions.HTTPError as exc:
                    last_error = exc
                    status = exc.response.status_code if exc.response is not None else None
                    if status != 400:
                        raise
            if last_error is not None:
                raise last_error
            raise RuntimeError("Unknown error in _post_json")

        for variant in variants:
            xml_body = _build_acs_search_xml(
                search_id=search_id,
                start_time=start_time,
                end_time=end_time,
                position=position,
                max_results=max_results,
                major=variant['major'],
                minor=variant['minor'],
            )
            try:
                return self._post(ISAPI_ACS_EVENT, xml_body)
            except requests.exceptions.HTTPError as exc:
                last_error = exc
                status = exc.response.status_code if exc.response is not None else None
                body = exc.response.text if exc.response is not None else ''
                if status == 400 and 'badJsonFormat' in body:
                    self.prefer_json = True
                    break
                if status != 400:
                    raise

        if self.prefer_json:
            return self._post_acs_event_search(search_id, start_time, end_time, position, max_results)

        if last_error is not None:
            raise last_error
        raise RuntimeError("Unknown error in _post")


# ─── دوال مساعدة (خارج الكلاس) ───────────────────────────────────────────────

def _extract_namespace(root: ET.Element) -> str:
    """يستخلص namespace من tag العنصر الجذري إن وُجد."""
    tag = root.tag
    if tag.startswith('{'):
        return tag[:tag.index('}') + 1]
    return ''


def _build_acs_search_xml(search_id: str, start_time: str, end_time: str,
                           position: int, max_results: int,
                           major: int | None = None,
                           minor: int | None = None) -> str:
    """يبني XML body لاستعلام AcsEvent."""
    filters = []
    if major is not None:
        filters.append(f'    <major>{major}</major>')
    if minor is not None:
        filters.append(f'    <minor>{minor}</minor>')
    filter_xml = '\n'.join(filters)
    if filter_xml:
        filter_xml = '\n' + filter_xml

    return f'''<?xml version="1.0" encoding="UTF-8"?>
<AcsEventCond>
    <searchID>{search_id}</searchID>
    <searchResultPosition>{position}</searchResultPosition>
    <maxResults>{max_results}</maxResults>
    <startTime>{start_time}</startTime>
    <endTime>{end_time}</endTime>{filter_xml}
</AcsEventCond>'''


def _parse_acs_event_response(xml_text: str) -> list[dict]:
    """
    يُحلّل استجابة XML لـ AcsEvent ويستخلص حقول كل سجل.
    يدعم namespace ويتعامل مع XML المعطوب بمرونة.
    """
    records = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return records

    ns = _extract_namespace(root)

    # ابحث عن عناصر AcsEvent أو InfoList > AcsEvent
    event_elements = (
        root.findall(f'.//{ns}AcsEvent') or
        root.findall('.//AcsEvent')
    )

    for ev in event_elements:
        def gtext(tag):
            # ElementTree elements can evaluate to False when they have no children.
            # We must check for None explicitly to avoid dropping valid leaf nodes.
            el = ev.find(f'{ns}{tag}')
            if el is None:
                el = ev.find(tag)
            return el.text.strip() if el is not None and el.text else ''

        # وقت الحدث
        time_raw = gtext('time') or gtext('dateTime') or gtext('eventTime')
        if not time_raw:
            continue
        ts = _parse_hikvision_time(time_raw)
        if ts is None:
            continue

        # رقم البطاقة / رقم الموظف
        card_no  = gtext('cardNo')
        emp_no   = gtext('employeeNo') or gtext('userID')

        # نوع الحدث (major/minor)
        event_type = gtext('eventType') or gtext('minor') or ''

        records.append({
            'timestamp':  ts,
            'card_no':    card_no or emp_no,
            'employee_no': emp_no,
            'event_type': event_type,
        })

    return records


def _parse_hikvision_time(raw: str) -> datetime | None:
    """
    يُحوّل سلاسل الوقت المختلفة من Hikvision إلى datetime.
    يدعم:
      - 2026-05-12T14:30:00+03:00
      - 2026-05-12T14:30:00Z
      - 2026-05-12T14:30:00
    """
    if not raw:
        return None
    cleaned = raw.strip()
    try:
        # fromisoformat does not accept trailing Z in all forms, normalize it first.
        parsed = datetime.fromisoformat(cleaned.replace('Z', '+00:00'))
        # Unify to naive local datetime so comparisons remain consistent with app.py.
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone().replace(tzinfo=None)
        return parsed
    except Exception:
        return None


def _map_event_to_status(event_type: str) -> str:
    """
    يُحوّل نوع حدث Hikvision إلى status متوافق مع نظام ZKTeco:
    '0' = check-in / '1' = check-out
    
    Hikvision minor codes (تقريبية):
      75 = card verified (default = check-in)
      76 = face verified
      القيم الأخرى نتعامل معها كـ check-in
    """
    # يمكن التوسع لاحقاً بناءً على الكودات الفعلية للجهاز
    checkout_codes = {'checkout', '1', 'exit', 'out'}
    if str(event_type).lower() in checkout_codes:
        return '1'
    return '0'


def _parse_acs_event_json_response(json_text: str) -> list[dict]:
    """
    يُحلّل استجابة JSON لـ AcsEvent ويستخلص حقول كل سجل.
    تعامل مرن مع القيم الخالية وبنية البيانات.
    """
    records = []
    try:
        import json
        data = json.loads(json_text)
    except Exception:
        return records

    acs_event = data.get('AcsEvent', {})
    info_list = acs_event.get('InfoList', [])
    if not isinstance(info_list, list):
        info_list = data.get('InfoList', [])
        if not isinstance(info_list, list):
            return records

    for ev in info_list:
        if not isinstance(ev, dict):
            continue

        def gval(keys):
            for k in keys:
                if k in ev and ev[k] is not None:
                    return str(ev[k]).strip()
            return ''

        time_raw = gval(['time', 'dateTime', 'eventTime'])
        if not time_raw:
            continue

        ts = _parse_hikvision_time(time_raw)
        if ts is None:
            continue

        card_no = gval(['cardNo'])
        emp_no = gval(['employeeNoString', 'employeeNo', 'userID'])
        event_type = gval(['eventType', 'minor', 'major'])

        records.append({
            'timestamp':  ts,
            'card_no':    card_no or emp_no,
            'employee_no': emp_no,
            'event_type': event_type,
        })

    return records
