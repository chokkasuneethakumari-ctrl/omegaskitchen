import os
import pytest
import requests

BASE_URL = os.environ.get("OMEGA_API_BASE", "https://omega-kitchen-api.onrender.com")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s
