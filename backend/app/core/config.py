from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    jira_base_url: str = Field(alias="JIRA_BASE_URL")
    jira_personal_access_token: str = Field(default="", alias="JIRA_PERSONAL_ACCESS_TOKEN")
    jira_email: str = Field(default="", alias="JIRA_EMAIL")
    jira_api_token: str = Field(default="", alias="JIRA_API_TOKEN")
    jira_default_projects: str = Field(default="", alias="JIRA_DEFAULT_PROJECTS")
    cache_ttl_seconds: int = Field(default=30, alias="CACHE_TTL_SECONDS")
    cursor_api_key: str = Field(default="", alias="CURSOR_API_KEY")
    kpi_prefer_cursor_agent: bool = Field(default=True, alias="KPI_PREFER_CURSOR_AGENT")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def default_projects(self) -> list[str]:
        return [item.strip() for item in self.jira_default_projects.split(",") if item.strip()]

    @property
    def has_personal_access_token(self) -> bool:
        return bool(self.jira_personal_access_token.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
