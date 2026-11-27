import os
import sys
from pathlib import Path

import boto3
import pytest
from moto import mock_aws

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

os.environ.update(
    AWS_DEFAULT_REGION="us-east-1",
    AWS_ACCESS_KEY_ID="testing",
    AWS_SECRET_ACCESS_KEY="testing",
    TABLE_NAME="DailyDoseTest",
    TIMEZONE="UTC",
    LOOKBACK_HOURS="48",
    ADMIN_TOKEN_PARAM="/dailydose/admin-token",
    DIGEST_TO="me@example.com",
    DIGEST_FROM="digest@example.com",
    SITE_URL="https://example.com",
    POWERTOOLS_SERVICE_NAME="test",
)

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def aws():
    from dailydose import config

    config.settings.cache_clear()
    config.secret.cache_clear()
    with mock_aws():
        ddb = boto3.client("dynamodb")
        ddb.create_table(
            TableName="DailyDoseTest",
            BillingMode="PAY_PER_REQUEST",
            AttributeDefinitions=[
                {"AttributeName": n, "AttributeType": "S"} for n in ("PK", "SK", "GSI1PK", "GSI1SK")
            ],
            KeySchema=[{"AttributeName": "PK", "KeyType": "HASH"}, {"AttributeName": "SK", "KeyType": "RANGE"}],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "GSI1",
                    "KeySchema": [
                        {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                        {"AttributeName": "GSI1SK", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                }
            ],
        )
        boto3.client("ssm").put_parameter(
            Name="/dailydose/admin-token", Value="s3cret-token", Type="SecureString"
        )
        ses = boto3.client("ses")
        ses.verify_email_identity(EmailAddress="digest@example.com")
        from dailydose import api

        api._store = None
        yield


@pytest.fixture
def fixture_bytes():
    return lambda name: (FIXTURES / name).read_bytes()
