import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.models.user import User
from app.models.company import Company
from app.models.membership import CompanyMembership
from app.models.subscription import SubscriptionPlan, CompanySubscription
from app.main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture(scope="function")
async def test_engine():
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest_asyncio.fixture(scope="function")
async def db_session(test_engine):
    session_factory = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    async with session_factory() as session:
        yield session

@pytest_asyncio.fixture(scope="function")
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()

@pytest_asyncio.fixture
async def seed_data(db_session: AsyncSession):
    # 1. Super Admin
    superadmin = User(
        email="superadmin@orbx.in",
        full_name="Super Admin",
        hashed_password=get_password_hash("SuperAdminPass123!"),
        is_superadmin=True,
        is_active=True
    )
    db_session.add(superadmin)

    # 2. Starter Plan
    plan = SubscriptionPlan(
        code="starter",
        name="Starter Studio",
        description="Starter tier",
        max_users=5,
        modules_allowed={"orders": True, "team": True},
        is_active=True
    )
    db_session.add(plan)
    await db_session.flush()

    # 3. Company 1 (Active)
    owner1 = User(
        email="owner1@company-a.com",
        full_name="Owner Alpha",
        hashed_password=get_password_hash("OwnerPass123!"),
        is_superadmin=False,
        is_active=True
    )
    db_session.add(owner1)
    await db_session.flush()

    comp1 = Company(
        name="Company Alpha Atelier",
        code="company-alpha",
        status="active",
        owner_id=owner1.id,
        contact_email="contact@company-a.com"
    )
    db_session.add(comp1)
    await db_session.flush()

    mem1 = CompanyMembership(
        user_id=owner1.id,
        company_id=comp1.id,
        role="owner",
        status="active"
    )
    db_session.add(mem1)

    # 4. Company 2 (Active)
    owner2 = User(
        email="owner2@company-b.com",
        full_name="Owner Beta",
        hashed_password=get_password_hash("OwnerPass123!"),
        is_superadmin=False,
        is_active=True
    )
    db_session.add(owner2)
    await db_session.flush()

    comp2 = Company(
        name="Company Beta Boutique",
        code="company-beta",
        status="active",
        owner_id=owner2.id,
        contact_email="contact@company-b.com"
    )
    db_session.add(comp2)
    await db_session.flush()

    mem2 = CompanyMembership(
        user_id=owner2.id,
        company_id=comp2.id,
        role="owner",
        status="active"
    )
    db_session.add(mem2)

    # 5. Suspended Company
    comp_susp = Company(
        name="Company Suspended",
        code="company-suspended",
        status="suspended",
        owner_id=owner1.id,
        contact_email="suspended@example.com"
    )
    db_session.add(comp_susp)
    await db_session.flush()

    mem_susp = CompanyMembership(
        user_id=owner1.id,
        company_id=comp_susp.id,
        role="owner",
        status="active"
    )
    db_session.add(mem_susp)

    # 6. Multi-Company User (belongs to both Alpha and Beta)
    multi_user = User(
        email="consultant@fashion.com",
        full_name="Multi Consultant",
        hashed_password=get_password_hash("ConsultantPass123!"),
        is_superadmin=False,
        is_active=True
    )
    db_session.add(multi_user)
    await db_session.flush()

    mem_m1 = CompanyMembership(
        user_id=multi_user.id,
        company_id=comp1.id,
        role="manager",
        status="active"
    )
    mem_m2 = CompanyMembership(
        user_id=multi_user.id,
        company_id=comp2.id,
        role="staff",
        status="active"
    )
    db_session.add_all([mem_m1, mem_m2])

    await db_session.commit()

    return {
        "superadmin": superadmin,
        "owner1": owner1,
        "owner2": owner2,
        "multi_user": multi_user,
        "comp1": comp1,
        "comp2": comp2,
        "comp_susp": comp_susp,
        "plan": plan
    }
