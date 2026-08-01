from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AccountPerformance(BaseModel):
    account_id: int
    phone: str
    gather: int
    add: int
    dm: int
    success_rate: int
    flood_waits: int


class LeaderboardRow(BaseModel):
    rank: int
    account_id: int
    phone: str
    value: int
    metric: str


class AdvancedAnalytics(BaseModel):
    overall_success_rate: int
    best_hours: str
    avg_gather_speed: int
    avg_add_speed: int
    avg_dm_speed: int


class LogManagementSummary(BaseModel):
    total_logs: int
    log_size_mb: int
