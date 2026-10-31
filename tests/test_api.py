import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert res.json()["service"] == "Ma5sos API"


def test_admin_auth():
    res = client.post(
        "/api/auth/login",
        json={"email": "admin@ma5sos.com", "password": "Ma5sos#Admin2026$"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    token = data["access_token"]

    me_res = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    assert me_res.json()["is_admin"] is True


def test_events_crud_and_public_flow():
    login_res = client.post(
        "/api/auth/login",
        json={"email": "admin@ma5sos.com", "password": "Ma5sos#Admin2026$"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_payload = {
        "title": "حفل تخرج الدفعة الثلاثين",
        "occasion_type": "graduation",
        "host_name": "جامعة القصيم",
        "honoree_name": "الخريجين والخريجات",
        "event_date": "2026-11-20T18:00:00",
        "event_time": "6:00 مساءً",
        "venue_name": "مركز المؤتمرات الرئيسي",
        "venue_address": "بريدة",
        "location_url": "https://maps.google.com/?q=26.35,43.98",
        "description": "يسرنا دعوتكم لحضور بهجة تخرج أبنائنا وبناتنا.",
        "notes": "يرجى التواجد قبل نصف ساعة من بدء الحفل",
        "template_id": "formal-graduation",
        "max_guests": 300,
    }
    create_res = client.post("/api/events", json=create_payload, headers=headers)
    assert create_res.status_code == 201
    created_event = create_res.json()
    event_id = created_event["id"]
    share_code = created_event["share_code"]
    assert share_code.startswith("MK-")

    public_res = client.get(f"/api/public/invite/{share_code}")
    assert public_res.status_code == 200
    assert public_res.json()["title"] == create_payload["title"]

    rsvp_payload = {
        "guest_name": "سعد المطيري",
        "phone": "0551122334",
        "status": "confirmed",
        "companions_count": 2,
        "notes": "ألف مبروك التخرج وبالتوفيق",
    }
    rsvp_res = client.post(f"/api/public/invite/{share_code}/rsvp", json=rsvp_payload)
    assert rsvp_res.status_code == 200
    rsvp_data = rsvp_res.json()
    assert rsvp_data["ok"] is True
    qr_code = rsvp_data["rsvp"]["qr_code"]
    rsvp_id = rsvp_data["rsvp"]["id"]
    assert qr_code.startswith(f"QR-{share_code}")

    ticket_res = client.get(f"/api/public/ticket/{qr_code}")
    assert ticket_res.status_code == 200
    assert ticket_res.json()["guest_name"] == "سعد المطيري"
    assert ticket_res.json()["checked_in"] is False

    checkin_res = client.post(
        f"/api/events/{event_id}/rsvps/{rsvp_id}/checkin",
        headers=headers,
    )
    assert checkin_res.status_code == 200
    assert checkin_res.json()["checked_in"] is True

    ticket_after = client.get(f"/api/public/ticket/{qr_code}").json()
    assert ticket_after["checked_in"] is True

    stats_res = client.get("/api/stats", headers=headers)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_events"] >= 1
    assert stats["confirmed_guests"] >= 1

    update_res = client.put(
        f"/api/events/{event_id}",
        json={"title": "حفل التخرج السنوي الموحد"},
        headers=headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["title"] == "حفل التخرج السنوي الموحد"

    delete_res = client.delete(f"/api/events/{event_id}", headers=headers)
    assert delete_res.status_code == 200


def test_private_guest_invitation_flow():
    login_res = client.post(
        "/api/auth/login",
        json={"email": "admin@ma5sos.com", "password": "Ma5sos#Admin2026$"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_res = client.post(
        "/api/events",
        json={
            "title": "حفل اختبار الروابط الخاصة",
            "occasion_type": "wedding",
            "host_name": "أسرة الاختبار",
            "event_date": "2026-12-18T20:00:00",
            "venue_name": "قاعة الاختبار",
            "max_guests": 10,
            "template_id": "andalusian",
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    event = create_res.json()
    event_id = event["id"]
    share_code = event["share_code"]

    guest_res = client.post(
        f"/api/events/{event_id}/guests",
        json={
            "guest_name": "سعد المطيري",
            "phone": "0559988776",
            "companions_count": 2,
            "notes": "صديق العائلة",
        },
        headers=headers,
    )
    assert guest_res.status_code == 201
    guest = guest_res.json()
    assert guest["status"] == "pending"
    assert guest["invite_token"]
    assert guest["qr_code"].startswith(f"QR-{share_code}")

    private_res = client.get(
        f"/api/public/invite/{share_code}/guest/{guest['invite_token']}"
    )
    assert private_res.status_code == 200
    private_data = private_res.json()
    assert private_data["guest"]["status"] == "pending"
    assert private_data["guest"]["qr_code"] is None

    respond_res = client.post(
        f"/api/public/invite/{share_code}/guest/{guest['invite_token']}/respond",
        json={"guest_name": "سعد المطيري", "status": "confirmed"},
    )
    assert respond_res.status_code == 200
    responded = respond_res.json()["rsvp"]
    assert responded["status"] == "confirmed"
    assert responded["qr_code"].startswith(f"QR-{share_code}")
    assert responded["qr_payload"].startswith("MA5SOS:TICKET:")

    private_after = client.get(
        f"/api/public/invite/{share_code}/guest/{guest['invite_token']}"
    )
    assert private_after.status_code == 200
    assert private_after.json()["guest"]["qr_code"] == responded["qr_code"]

    checkin_res = client.post(
        f"/api/events/{event_id}/checkin",
        json={"qr_token": responded["qr_code"]},
        headers=headers,
    )
    assert checkin_res.status_code == 200
    assert checkin_res.json()["guest_name"] == "سعد المطيري"

    foreign_res = client.post(
        f"/api/events/{event_id}/checkin",
        json={"qr_token": "https://example.com/not-a-ma5sos-ticket"},
        headers=headers,
    )
    assert foreign_res.status_code == 400

    other_event_res = client.post(
        "/api/events",
        json={
            "title": "مناسبة أخرى لاختبار رمز QR",
            "occasion_type": "party",
            "host_name": "أسرة أخرى",
            "event_date": "2026-12-19T20:00:00",
            "venue_name": "قاعة أخرى",
            "max_guests": 5,
            "template_id": "andalusian",
        },
        headers=headers,
    )
    assert other_event_res.status_code == 201
    other_event = other_event_res.json()

    other_guest_res = client.post(
        f"/api/events/{other_event['id']}/guests",
        json={
            "guest_name": "ضيف المناسبة الأخرى",
            "phone": "0559988775",
            "companions_count": 0,
        },
        headers=headers,
    )
    assert other_guest_res.status_code == 201
    other_guest = other_guest_res.json()
    assert other_guest["qr_code"] != guest["qr_code"]

    wrong_event_res = client.post(
        f"/api/events/{event_id}/checkin",
        json={"qr_token": other_guest["qr_code"]},
        headers=headers,
    )
    assert wrong_event_res.status_code == 400

    delete_other_res = client.delete(f"/api/events/{other_event['id']}", headers=headers)
    assert delete_other_res.status_code == 200

    delete_res = client.delete(f"/api/events/{event_id}", headers=headers)
    assert delete_res.status_code == 200
