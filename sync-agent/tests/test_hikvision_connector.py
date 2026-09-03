import unittest
from datetime import datetime

from hikvision_connector import (
    MAX_RESULTS,
    _build_acs_search_xml,
    _map_event_to_status,
    _parse_acs_event_response,
    _parse_hikvision_time,
)


class HikvisionConnectorParsingTests(unittest.TestCase):
    def test_parse_acs_event_response_with_namespace(self):
        xml = """<?xml version="1.0" encoding="UTF-8"?>
<AcsEventSearchResult xmlns="http://www.hikvision.com/ver20/XMLSchema">
  <AcsEventInfoList>
    <AcsEvent>
      <cardNo>101</cardNo>
      <employeeNo>E-101</employeeNo>
      <time>2026-05-12T14:30:00+03:00</time>
      <minor>75</minor>
    </AcsEvent>
  </AcsEventInfoList>
</AcsEventSearchResult>
"""
        records = _parse_acs_event_response(xml)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["card_no"], "101")
        self.assertEqual(records[0]["employee_no"], "E-101")
        self.assertIsInstance(records[0]["timestamp"], datetime)
        self.assertEqual(records[0]["event_type"], "75")

    def test_parse_hikvision_time_handles_z_and_offsets(self):
        dt_z = _parse_hikvision_time("2026-05-12T14:30:00Z")
        dt_pos = _parse_hikvision_time("2026-05-12T14:30:00+03:00")
        dt_neg = _parse_hikvision_time("2026-05-12T14:30:00-05:00")

        self.assertIsInstance(dt_z, datetime)
        self.assertIsInstance(dt_pos, datetime)
        self.assertIsInstance(dt_neg, datetime)
        self.assertIsNone(getattr(dt_z, "tzinfo", None))
        self.assertIsNone(getattr(dt_pos, "tzinfo", None))
        self.assertIsNone(getattr(dt_neg, "tzinfo", None))

    def test_parse_hikvision_time_invalid_returns_none(self):
        self.assertIsNone(_parse_hikvision_time(""))
        self.assertIsNone(_parse_hikvision_time("not-a-date"))

    def test_map_event_to_status_checkout_codes(self):
        self.assertEqual(_map_event_to_status("checkout"), "1")
        self.assertEqual(_map_event_to_status("1"), "1")
        self.assertEqual(_map_event_to_status("out"), "1")
        self.assertEqual(_map_event_to_status("75"), "0")

    def test_acs_event_request_uses_safe_page_size(self):
        self.assertEqual(MAX_RESULTS, 30)

        xml = _build_acs_search_xml(
            search_id="KWADER",
            start_time="2026-06-09T13:00:00",
            end_time="2026-06-09T14:00:00",
            position=0,
            max_results=MAX_RESULTS,
            major=5,
            minor=0,
        )

        self.assertIn("<maxResults>30</maxResults>", xml)
        self.assertIn("<major>5</major>", xml)
        self.assertIn("<minor>0</minor>", xml)

    def test_parse_acs_event_response_json(self):
        json_data = """{
          "AcsEvent": {
            "searchID": "1",
            "totalMatches": 1,
            "responseStatusStrg": "OK",
            "numOfMatches": 1,
            "InfoList": [
              {
                "major": 5,
                "minor": 75,
                "time": "2026-05-12T14:30:00+03:00",
                "employeeNoString": "E-101",
                "cardNo": "101",
                "name": "User Name",
                "attendanceStatus": "checkIn"
              }
            ]
          }
        }"""
        from hikvision_connector import _parse_acs_event_json_response
        records = _parse_acs_event_json_response(json_data)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["card_no"], "101")
        self.assertEqual(records[0]["employee_no"], "E-101")
        self.assertIsInstance(records[0]["timestamp"], datetime)
        self.assertEqual(records[0]["event_type"], "75")

    def test_parse_acs_event_response_json_fallback_keys(self):
        json_data = """{
          "AcsEvent": {
            "searchID": "1",
            "totalMatches": 1,
            "responseStatusStrg": "OK",
            "numOfMatches": 1,
            "InfoList": [
              {
                "major": 5,
                "minor": 76,
                "dateTime": "2026-05-12T14:30:00Z",
                "employeeNo": "E-102",
                "name": "User Name 2"
              }
            ]
          }
        }"""
        from hikvision_connector import _parse_acs_event_json_response
        records = _parse_acs_event_json_response(json_data)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["card_no"], "E-102")
        self.assertEqual(records[0]["employee_no"], "E-102")
        self.assertIsInstance(records[0]["timestamp"], datetime)
        self.assertEqual(records[0]["event_type"], "76")


if __name__ == "__main__":
    unittest.main()
