from pydantic import BaseModel, Field


class SignUpRequest(BaseModel):
    employee_name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    phone_number: str = Field(default="", max_length=40)
    employee_id: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=8, max_length=256)


class LoginRequest(BaseModel):
    employee_name: str = Field(default="", max_length=120)
    employee_id: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class UserProfile(BaseModel):
    id: str
    employee_name: str
    email: str
    phone_number: str
    employee_id: str
    role: str
    created_at: str


class SessionDescriptor(BaseModel):
    id: str
    created_at: str
    last_seen_at: str
    expires_at: str
    user_agent: str = ""
    ip_address: str = ""
    is_current: bool = False


class AuthResponse(BaseModel):
    user: UserProfile
    session: SessionDescriptor


class SessionListResponse(BaseModel):
    sessions: list[SessionDescriptor]
