from functools import lru_cache

from app.clients.jira_client import JiraClient
from app.core.cache import TTLCache
from app.core.config import get_settings
from app.services.jira_service import JiraService
from app.services.kpi_agent import build_kpi_agent_runner
from app.services.kpi_service import KpiService
from app.services.ops_case_service import OpsCaseService


@lru_cache
def get_cache() -> TTLCache:
    settings = get_settings()
    return TTLCache(ttl_seconds=settings.cache_ttl_seconds)


def get_jira_service() -> JiraService:
    settings = get_settings()
    client = JiraClient(settings)
    cache = get_cache()
    return JiraService(
        client=client,
        cache=cache,
        base_url=settings.jira_base_url,
        sprint_custom_field=settings.jira_sprint_custom_field,
    )


def get_kpi_service() -> KpiService:
    settings = get_settings()
    agent = build_kpi_agent_runner(
        cursor_api_key=settings.cursor_api_key or None,
        prefer_cursor=settings.kpi_prefer_cursor_agent,
    )
    return KpiService(jira=get_jira_service(), agent=agent)


@lru_cache
def get_ops_case_service() -> OpsCaseService:
    return OpsCaseService()
