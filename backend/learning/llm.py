"""One place for structured Claude calls: model settings, refusal fallbacks and error classification."""
import os

import anthropic

# Models that accept server-side refusal fallbacks (`fallbacks="default"`).
FALLBACK_MODELS = {"claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"}
FALLBACK_BETA = "server-side-fallback-2026-07-01"


class LLMError(RuntimeError):
    """The call failed for this input (refusal, bad request, no structured output)."""


class TransientLLMError(LLMError):
    """Rate limits, overload, 5xx and network errors: worth retrying later."""


def get_client():
    """An Anthropic client when credentials are configured, else ``None`` (callers fall back)."""
    if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
        return None
    return anthropic.Anthropic()


def parse_structured(client, *, model, effort, system, user_content, output_format, max_tokens=16000):
    """Call Claude with structured output; returns ``(parsed_output, served_model)``.

    ``system`` is sent as a cacheable block, so keep it stable across calls.
    AuthenticationError is re-raised untouched: every call would fail, so callers should stop.
    """
    extra = {"betas": [FALLBACK_BETA], "fallbacks": "default"} if model in FALLBACK_MODELS else {}
    try:
        response = client.beta.messages.parse(
            model=model,
            max_tokens=max_tokens,
            output_config={"effort": effort},
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user_content}],
            output_format=output_format,
            **extra,
        )
    except anthropic.AuthenticationError:
        raise
    except anthropic.RateLimitError as exc:  # Already retried by the SDK.
        raise TransientLLMError(f"Rate limited: {exc.message}") from exc
    except anthropic.APIStatusError as exc:
        error = TransientLLMError if exc.status_code >= 500 or exc.status_code == 429 else LLMError
        raise error(f"API error {exc.status_code}: {exc.message}") from exc
    except anthropic.APIConnectionError as exc:
        raise TransientLLMError(f"Connection error: {exc}") from exc

    if response.stop_reason == "refusal":
        category = getattr(response.stop_details, "category", None) if response.stop_details else None
        raise LLMError(f"Model declined (category: {category or 'unspecified'})")
    if response.parsed_output is None:
        raise LLMError(f"No structured output (stop_reason: {response.stop_reason})")
    return response.parsed_output, response.model
