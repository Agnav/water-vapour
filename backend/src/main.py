"""Wind generation forecast accuracy API."""

from contextlib import asynccontextmanager
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse


from .routes.dashboard import router as dashboard_router
from .routes.forecasts import router as forecasts_router
from .routes.health import router as health_router
from .services.dashboard_service import load_dashboard_data

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.dashboard_data = load_dashboard_data()
    yield


app = FastAPI(title="Windforecast API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(dashboard_router)
app.include_router(forecasts_router)

# The Docker image copies the Vite build here. This is deliberately optional:
# Vercel serves the static build itself and imports this app only for API calls.
static_directory = Path(os.getenv("STATIC_DIR", "/__no_static_files__"))
if static_directory.is_dir():
    index_file = static_directory / "index.html"

    @app.get("/{requested_path:path}", include_in_schema=False)
    async def serve_frontend(requested_path: str):
        """Serve Vite assets and fall back to the SPA for client-side routes."""
        candidate = (static_directory / requested_path).resolve()
        if candidate.is_relative_to(static_directory.resolve()) and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(index_file)

