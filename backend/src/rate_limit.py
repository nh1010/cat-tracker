import time

from fastapi import HTTPException, Request


class FixedWindowRateLimiter:
    def __init__(self, window_seconds: int):
        self.window_seconds = window_seconds
        self._buckets: dict[tuple[str, str], tuple[float, int]] = {}

    def check(self, request: Request, bucket: str, limit: int, trust_proxy_headers: bool = False) -> None:
        now = time.monotonic()
        key = (bucket, client_ip(request, trust_proxy_headers=trust_proxy_headers))
        window_start, count = self._buckets.get(key, (now, 0))

        if now - window_start >= self.window_seconds:
            self._buckets[key] = (now, 1)
            return

        if count >= limit:
            raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")

        self._buckets[key] = (window_start, count + 1)


def client_ip(request: Request, trust_proxy_headers: bool = False) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if trust_proxy_headers and forwarded_for:
        return forwarded_for.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"
