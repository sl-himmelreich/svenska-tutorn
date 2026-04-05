#!/usr/bin/env python3
"""AI Chat backend for Svenska Tutorn — Groq API (free tier)."""

import json
import os
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

SYSTEM_PROMPT_SV = """Du är en vänlig och tålmodig svensklärare som heter Astrid. Du pratar med ett barn (10–12 år) som lär sig svenska.

Regler:
- Svara ALLTID på svenska.
- Använd enkla ord och korta meningar.
- Om eleven gör ett grammatikfel, rätta det vänligt och förklara kort.
- Uppmuntra eleven! Ge beröm när det går bra.
- Föreslå ibland nya ord eller fraser att öva på.
- Om eleven skriver på ryska, svara ändå på svenska men med en kort rysk översättning i parentes.
- Håll svaren korta (1–3 meningar).
- Använd emoji sparsamt (max 1 per meddelande).

Börja med att hälsa och fråga hur eleven mår, på enkel svenska."""

SYSTEM_PROMPT_RU = """Ты — дружелюбный учитель шведского языка по имени Астрид. Ты разговариваешь с ребёнком (10–12 лет), который учит шведский.

Правила:
- Отвечай НА РУССКОМ, но обязательно вставляй шведские слова и фразы.
- Используй простые слова и короткие предложения.
- Если ученик написал что-то по-шведски — похвали и объясни, что он сказал.
- Обучай новым шведским словам и фразам в каждом сообщении.
- Давай шведское слово + транскрипцию + перевод.
- Будь весёлой и ободряющей!
- Держи ответы короткими (2–4 предложения).
- Используй эмодзи умеренно (максимум 1 на сообщение).

Начни с приветствия и спроси, как дела у ученика, вставив пару шведских слов."""


class ChatRequest(BaseModel):
    messages: list[dict]
    language: str = "sv"  # "sv" or "ru"


@asynccontextmanager
async def lifespan(app):
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/chat")
async def chat(req: ChatRequest):
    system = SYSTEM_PROMPT_SV if req.language == "sv" else SYSTEM_PROMPT_RU

    # Build messages
    messages = [{"role": "system", "content": system}]
    for m in req.messages:
        role = m.get("role", "user")
        content = m.get("content", "").strip()
        if not content:
            continue
        if role not in ("user", "assistant"):
            role = "user"
        messages.append({"role": role, "content": content})

    if len(messages) == 1:  # only system prompt
        messages.append({"role": "user", "content": "Привет!"})

    body = {
        "model": GROQ_MODEL,
        "messages": messages,
        "max_tokens": 512,
        "temperature": 0.8,
        "stream": True,
    }

    async def generate():
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream(
                    "POST",
                    GROQ_URL,
                    json=body,
                    headers={
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "Content-Type": "application/json",
                    },
                ) as resp:
                    if resp.status_code != 200:
                        error_body = await resp.aread()
                        yield f"data: {json.dumps({'text': f'Ошибка API: {resp.status_code}'})}\n\n"
                        yield "data: [DONE]\n\n"
                        return

                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            choices = data.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                text = delta.get("content", "")
                                if text:
                                    yield f"data: {json.dumps({'text': text})}\n\n"
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            yield f"data: {json.dumps({'text': f'Ошибка: {str(e)}'})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.get("/api/health")
async def health():
    return {"status": "ok", "model": GROQ_MODEL}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
