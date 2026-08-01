from pydantic import BaseModel


class AccountPerformance(BaseModel):
    account_id: int
    phone: str
    gather: int
    add: int
    dm: int
    success_rate: int
    flood_waits: int
    operations: int = 0


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
    total_operations: int = 0
    flood_waits: int = 0
    active_accounts: int = 0


class LogManagementSummary(BaseModel):
    total_logs: int
    log_size_mb: int
