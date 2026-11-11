"""Run the Daily Dose API locally against an in-memory AWS mock (moto). No AWS account needed.

    pip install -r requirements-dev.txt
    python scripts/local_api.py            # http://127.0.0.1:8787, admin token: dev-token

Then in /frontend set FEED_API_URL=http://127.0.0.1:8787 and FEED_ADMIN_TOKEN=dev-token.
POST /ingest runs the daily job synchronously so you can see results straight away.
Data lives in memory and is lost when the server stops.
"""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qsl, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "local")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "local")
os.environ.setdefault("TABLE_NAME", "DailyDoseLocal")
os.environ.setdefault("ADMIN_TOKEN_PARAM", "/dailydose/admin-token")
os.environ.setdefault("POWERTOOLS_SERVICE_NAME", "local")

import boto3  # noqa: E402
from moto import mock_aws  # noqa: E402

TOKEN = os.environ.get("ADMIN_TOKEN", "dev-token")
PORT = int(os.environ.get("PORT", "8787"))


def bootstrap():
    ddb = boto3.client("dynamodb")
    keys = ("PK", "SK", "GSI1PK", "GSI1SK")
    ddb.create_table(
        TableName=os.environ["TABLE_NAME"],
        BillingMode="PAY_PER_REQUEST",
        AttributeDefinitions=[{"AttributeName": k, "AttributeType": "S"} for k in keys],
        KeySchema=[{"AttributeName": "PK", "KeyType": "HASH"}, {"AttributeName": "SK", "KeyType": "RANGE"}],
        GlobalSecondaryIndexes=[{
            "IndexName": "GSI1",
            "KeySchema": [{"AttributeName": "GSI1PK", "KeyType": "HASH"}, {"AttributeName": "GSI1SK", "KeyType": "RANGE"}],
            "Projection": {"ProjectionType": "ALL"},
        }],
    )
    boto3.client("ssm").put_parameter(Name=os.environ["ADMIN_TOKEN_PARAM"], Value=TOKEN, Type="SecureString")


class Handler(BaseHTTPRequestHandler):
    def _handle(self):
        from dailydose import api, ingest

        url = urlparse(self.path)
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length).decode() if length else None
        method = self.command

        if method == "POST" and url.path == "/ingest":  # run synchronously locally
            if self.headers.get("Authorization") != f"Bearer {TOKEN}":
                return self._send(401, {"message": "Unauthorized"})
            return self._send(202, {"status": "done", **ingest.run()})

        event = {
            "version": "2.0",
            "routeKey": "$default",
            "rawPath": url.path,
            "rawQueryString": url.query,
            "queryStringParameters": dict(parse_qsl(url.query)) or None,
            "headers": {k.lower(): v for k, v in self.headers.items()},
            "requestContext": {"http": {"method": method, "path": url.path}, "stage": "$default"},
            "body": body,
            "isBase64Encoded": False,
        }
        res = api.app.resolve(event, None)
        self.send_response(res["statusCode"])
        for k, v in (res.get("headers") or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write((res.get("body") or "").encode())

    def _send(self, status, payload):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode())

    do_GET = do_POST = do_PATCH = do_DELETE = _handle


def main():
    with mock_aws():
        bootstrap()
        server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
        print(f"Daily Dose local API on http://127.0.0.1:{PORT} (admin token: {TOKEN})")
        server.serve_forever()


if __name__ == "__main__":
    main()
