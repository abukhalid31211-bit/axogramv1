from datetime import datetime

from pydantic import BaseModel, ConfigDict


class GroupCategoryBase(BaseModel):
    name: str
    description: str | None = None


class GroupCategoryCreate(GroupCategoryBase):
    pass


class GroupCategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class GroupCategoryPublic(GroupCategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    groups_count: int = 0
    created_at: datetime


class TargetGroupBase(BaseModel):
    name: str
    group_type: str = "public"
    members_count: int = 0
    category_id: int | None = None
    account_id: int | None = None
    status: str = "active"
    notes: str | None = None


class TargetGroupCreate(TargetGroupBase):
    pass


class TargetGroupUpdate(BaseModel):
    name: str | None = None
    group_type: str | None = None
    members_count: int | None = None
    category_id: int | None = None
    account_id: int | None = None
    status: str | None = None
    notes: str | None = None


class TargetGroupPublic(TargetGroupBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_name: str | None = None
    account_phone: str | None = None
    created_at: datetime
    updated_at: datetime


class GroupBlacklistEntryPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_value: str
    reason: str | None = None
    created_by: int | None = None
    created_at: datetime


class GroupBlacklistCreate(BaseModel):
    group_value: str
    reason: str | None = None


class GroupsJoinPayload(BaseModel):
    links: list[str]
    account_ids: list[int] | None = None


class GroupsLeavePayload(BaseModel):
    group_ids: list[int] | None = None


class GroupStats(BaseModel):
    total_groups: int
    total_members: int
    by_type: dict[str, int]
    by_status: dict[str, int]
    by_category: dict[str, int]
    largest: list[dict]
    joined_today: int
