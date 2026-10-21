from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.platform import router as platform_router
from app.api.v1.companies import router as companies_router
from app.api.v1.memberships import router as memberships_router
from app.api.v1.invitations import router as invitations_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.orders import router as orders_router
from app.api.v1.customers import router as customers_router

api_v1_router = APIRouter()
api_v1_router.include_router(auth_router)
api_v1_router.include_router(platform_router)
api_v1_router.include_router(companies_router)
api_v1_router.include_router(memberships_router)
api_v1_router.include_router(invitations_router)
api_v1_router.include_router(notifications_router)
api_v1_router.include_router(customers_router)
api_v1_router.include_router(orders_router)
