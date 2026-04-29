"""
LLM Factory - Create chat model from config

Supports: ollama, gemini
Add new providers here.
"""

import os
from typing import Any

from langchain_core.language_models import BaseChatModel

from config.setting import get_settings


def get_llm() -> BaseChatModel:
    """
    Return the configured chat model (Ollama, Gemini, etc.)

    Set llm.provider in config.yaml: "ollama" | "gemini"
    """
    settings = get_settings()
    cfg = settings.llm
    provider = (cfg.provider or "ollama").lower()

    if provider == "ollama":
        return _create_ollama(cfg)
    if provider == "gemini":
        return _create_gemini(cfg)
    raise ValueError(
        f"Unknown LLM provider: {provider}. Supported: ollama, gemini"
    )


def _create_ollama(cfg: Any) -> BaseChatModel:
    from langchain_ollama import ChatOllama

    return ChatOllama(
        model=cfg.model,
        base_url=cfg.ollama.base_url,
        temperature=cfg.temperature,
        num_predict=cfg.max_tokens,
        top_p=cfg.top_p,
        top_k=cfg.top_k,
        repeat_penalty=cfg.repeat_penalty,
        timeout=cfg.ollama.timeout,
        keep_alive=-1, # Disable connection pooling to avoid "Connection reset by peer" errors with Ollama
    )


def _create_gemini(cfg: Any) -> BaseChatModel:
    from langchain_google_genai import ChatGoogleGenerativeAI

    api_key = None
    if cfg.gemini and cfg.gemini.api_key:
        api_key = cfg.gemini.api_key
    if not api_key:
        api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError(
            "Gemini requires GOOGLE_API_KEY in .env or llm.gemini.api_key in config"
        )

    max_tokens = cfg.max_tokens
    if cfg.gemini and cfg.gemini.max_output_tokens is not None:
        max_tokens = cfg.gemini.max_output_tokens

    return ChatGoogleGenerativeAI(
        model=cfg.model,
        google_api_key=api_key,
        temperature=cfg.temperature,
        max_output_tokens=max_tokens,
    )
