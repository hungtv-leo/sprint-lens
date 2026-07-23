from __future__ import annotations

from typing import Any

import httpx

from app.core.config import Settings


class JiraClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._base_url = settings.jira_base_url.rstrip("/")
        self._headers = self._build_headers()
        self._auth = self._build_auth()

    def _build_headers(self) -> dict[str, str]:
        if self.settings.has_personal_access_token:
            return {"Authorization": f"Bearer {self.settings.jira_personal_access_token}"}
        return {}

    def _build_auth(self) -> tuple[str, str] | None:
        if self.settings.has_personal_access_token:
            return None
        if self.settings.jira_email and self.settings.jira_api_token:
            return (self.settings.jira_email, self.settings.jira_api_token)
        return None

    async def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        async with httpx.AsyncClient(
            auth=self._auth,
            headers=self._headers,
            timeout=30.0,
        ) as client:
            response = await client.get(f"{self._base_url}{path}", params=params)
            response.raise_for_status()
            return response.json()

    async def post(self, path: str, json: dict[str, Any]) -> Any:
        async with httpx.AsyncClient(
            auth=self._auth,
            headers=self._headers,
            timeout=30.0,
        ) as client:
            response = await client.post(f"{self._base_url}{path}", json=json)
            response.raise_for_status()
            return response.json()
