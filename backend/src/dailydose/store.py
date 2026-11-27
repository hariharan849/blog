"""DynamoDB single-table access.

Record layout (PK / SK):
  SOURCE        / SOURCE#<id>    an author or feed to follow
  ITEM#<hash>   / ITEM           an article (GSI1: DAY#<day> / <published>#<hash>)
  DAY           / <YYYY-MM-DD>   one row per day that has items (count)
  SUB           / SUB#<id>       an email subscriber to the daily lesson (pending or active)
  LESSON        / LESSON#<slug>  a lesson that has been emailed to subscribers
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from .config import settings


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Store:
    def __init__(self, table=None):
        self.table = table or boto3.resource("dynamodb").Table(settings().table_name)

    # ------------------------------------------------------------- sources
    def list_sources(self) -> list[dict[str, Any]]:
        items, kwargs = [], {"KeyConditionExpression": Key("PK").eq("SOURCE")}
        while True:
            res = self.table.query(**kwargs)
            items += res["Items"]
            if "LastEvaluatedKey" not in res:
                break
            kwargs["ExclusiveStartKey"] = res["LastEvaluatedKey"]
        return sorted((_public_source(i) for i in items), key=lambda s: s["created_at"])

    def get_source(self, sid: str) -> dict[str, Any] | None:
        item = self.table.get_item(Key={"PK": "SOURCE", "SK": f"SOURCE#{sid}"}).get("Item")
        return _public_source(item) if item else None

    def add_source(self, source: dict[str, Any]) -> bool:
        """Returns False if a source with the same feed URL already exists."""
        try:
            self.table.put_item(
                Item={"PK": "SOURCE", "SK": f"SOURCE#{source['id']}", **source},
                ConditionExpression="attribute_not_exists(PK)",
            )
            return True
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
                return False
            raise

    def update_source(self, sid: str, **fields: Any) -> dict[str, Any] | None:
        if not fields:
            return self.get_source(sid)
        names = {f"#{k}": k for k in fields}
        values = {f":{k}": v for k, v in fields.items()}
        try:
            res = self.table.update_item(
                Key={"PK": "SOURCE", "SK": f"SOURCE#{sid}"},
                UpdateExpression="SET " + ", ".join(f"#{k} = :{k}" for k in fields),
                ConditionExpression="attribute_exists(PK)",
                ExpressionAttributeNames=names,
                ExpressionAttributeValues=values,
                ReturnValues="ALL_NEW",
            )
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
                return None
            raise
        return _public_source(res["Attributes"])

    def delete_source(self, sid: str) -> bool:
        res = self.table.delete_item(
            Key={"PK": "SOURCE", "SK": f"SOURCE#{sid}"}, ReturnValues="ALL_OLD"
        )
        return "Attributes" in res

    # --------------------------------------------------------------- items
    def put_item_if_new(self, item: dict[str, Any]) -> bool:
        try:
            self.table.put_item(
                Item={
                    "PK": f"ITEM#{item['id']}",
                    "SK": "ITEM",
                    "GSI1PK": f"DAY#{item['day']}",
                    "GSI1SK": f"{item['published_at']}#{item['id']}",
                    **item,
                },
                ConditionExpression="attribute_not_exists(PK)",
            )
            return True
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
                return False
            raise

    def items_for_day(self, day: str) -> list[dict[str, Any]]:
        items, kwargs = [], {
            "IndexName": "GSI1",
            "KeyConditionExpression": Key("GSI1PK").eq(f"DAY#{day}"),
            "ScanIndexForward": False,
        }
        while True:
            res = self.table.query(**kwargs)
            items += res["Items"]
            if "LastEvaluatedKey" not in res:
                break
            kwargs["ExclusiveStartKey"] = res["LastEvaluatedKey"]
        return [_public_item(i) for i in items]

    # ---------------------------------------------------------------- days
    def bump_day(self, day: str, added: int) -> None:
        self.table.update_item(
            Key={"PK": "DAY", "SK": day},
            UpdateExpression="ADD #c :n SET updated_at = :t",
            ExpressionAttributeNames={"#c": "count"},
            ExpressionAttributeValues={":n": added, ":t": now_iso()},
        )

    def list_days(self, limit: int = 30, before: str | None = None) -> list[dict[str, Any]]:
        cond = Key("PK").eq("DAY")
        if before:
            cond = cond & Key("SK").lt(before)
        res = self.table.query(KeyConditionExpression=cond, ScanIndexForward=False, Limit=limit)
        return [{"day": i["SK"], "count": int(i.get("count", 0))} for i in res["Items"]]

    def neighbour_days(self, day: str) -> tuple[str | None, str | None]:
        older = self.table.query(
            KeyConditionExpression=Key("PK").eq("DAY") & Key("SK").lt(day),
            ScanIndexForward=False, Limit=1,
        )["Items"]
        newer = self.table.query(
            KeyConditionExpression=Key("PK").eq("DAY") & Key("SK").gt(day),
            ScanIndexForward=True, Limit=1,
        )["Items"]
        return (older[0]["SK"] if older else None, newer[0]["SK"] if newer else None)

    # --------------------------------------------------------- subscribers
    def get_subscriber(self, sid: str) -> dict[str, Any] | None:
        item = self.table.get_item(Key={"PK": "SUB", "SK": f"SUB#{sid}"}).get("Item")
        return _clean(item) if item else None

    def put_subscriber(self, record: dict[str, Any]) -> None:
        self.table.put_item(Item={"PK": "SUB", "SK": f"SUB#{record['id']}", **record})

    def activate_subscriber(self, sid: str, token: str) -> dict[str, Any] | None:
        """Marks a subscriber active if the token matches. None if it doesn't."""
        try:
            res = self.table.update_item(
                Key={"PK": "SUB", "SK": f"SUB#{sid}"},
                UpdateExpression="SET #s = :active, confirmed_at = if_not_exists(confirmed_at, :t)",
                ConditionExpression="attribute_exists(PK) AND #tok = :tok",
                ExpressionAttributeNames={"#s": "status", "#tok": "token"},
                ExpressionAttributeValues={":active": "active", ":t": now_iso(), ":tok": token},
                ReturnValues="ALL_NEW",
            )
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
                return None
            raise
        return _clean(res["Attributes"])

    def delete_subscriber(self, sid: str, token: str) -> bool | None:
        """True if removed, False if there was nothing to remove, None if the token is wrong."""
        try:
            res = self.table.delete_item(
                Key={"PK": "SUB", "SK": f"SUB#{sid}"},
                ConditionExpression="attribute_not_exists(PK) OR #tok = :tok",
                ExpressionAttributeNames={"#tok": "token"},
                ExpressionAttributeValues={":tok": token},
                ReturnValues="ALL_OLD",
            )
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
                return None
            raise
        return "Attributes" in res

    def subscribers(self) -> list[dict[str, Any]]:
        items, kwargs = [], {"KeyConditionExpression": Key("PK").eq("SUB")}
        while True:
            res = self.table.query(**kwargs)
            items += res["Items"]
            if "LastEvaluatedKey" not in res:
                break
            kwargs["ExclusiveStartKey"] = res["LastEvaluatedKey"]
        return [_clean(i) for i in items]

    # ------------------------------------------------------------- lessons
    def claim_lesson(self, slug: str, title: str) -> bool:
        """Records that a lesson is being emailed. False if it already was."""
        try:
            self.table.put_item(
                Item={"PK": "LESSON", "SK": f"LESSON#{slug}", "slug": slug, "title": title, "sent_at": now_iso()},
                ConditionExpression="attribute_not_exists(PK)",
            )
            return True
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
                return False
            raise

    def record_lesson_sent(self, slug: str, recipients: int) -> None:
        self.table.update_item(
            Key={"PK": "LESSON", "SK": f"LESSON#{slug}"},
            UpdateExpression="SET recipients = :n, finished_at = :t",
            ExpressionAttributeValues={":n": recipients, ":t": now_iso()},
        )


_INTERNAL = {"PK", "SK", "GSI1PK", "GSI1SK"}


def _clean(record: dict[str, Any]) -> dict[str, Any]:
    out = {}
    for k, v in record.items():
        if k in _INTERNAL:
            continue
        # DynamoDB returns numbers as Decimal; the API only stores ints.
        out[k] = int(v) if type(v).__name__ == "Decimal" else v
    return out


def _public_source(record: dict[str, Any]) -> dict[str, Any]:
    return _clean(record)


def _public_item(record: dict[str, Any]) -> dict[str, Any]:
    return _clean(record)
