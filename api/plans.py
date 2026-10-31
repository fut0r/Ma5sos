"""Package prices and guest limits — keep in sync with src/data/plans.js."""

MA5SOS_BASIC = {
    "id": "ma5sos",
    "name": "باقة مخصوص",
    "tagline": "للمناسبات الصغيرة",
    "price": 149,
    "max_guests": 50,
}

PLANS = {
    "ma5sos": MA5SOS_BASIC,
    "mazom": MA5SOS_BASIC,  # Backwards compatibility for legacy orders
    "plus": {
        "id": "plus",
        "name": "باقة مخصوص بلس",
        "tagline": "للمناسبات المتوسطة – الباقة الموصى بها",
        "price": 299,
        "max_guests": 100,
    },
    "vip": {
        "id": "vip",
        "name": "باقة مخصوص VIP",
        "tagline": "للمناسبات الكبيرة",
        "price": 599,
        "max_guests": 250,
    },
}

TRIAL = {
    "id": "trial",
    "name": "التجربة المجانية",
    "tagline": "جرّب مخصوص قبل اختيار باقتك.",
    "price": 0,
    "max_guests": 3,
}

ALL_PLANS = {**PLANS, TRIAL["id"]: TRIAL}


def max_guests_for_plan(plan_id: str | None) -> int:
    return int(ALL_PLANS.get(plan_id or "", TRIAL)["max_guests"])
