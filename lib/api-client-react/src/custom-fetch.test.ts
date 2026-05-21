import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  ResponseParseError,
  customFetch,
  setAuthTokenGetter,
  setBaseUrl,
} from "./custom-fetch";

const originalFetch = globalThis.fetch;

describe("customFetch", () => {
  beforeEach(() => {
    setBaseUrl(null);
    setAuthTokenGetter(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("prepends configured base URL for relative paths", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    globalThis.fetch = fetchMock as typeof fetch;

    setBaseUrl("https://api.example.com/");
    await customFetch("/healthz", { responseType: "json" });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.example.com/healthz");
  });

  it("does not prepend base URL for absolute URLs", async () => {
    const fetchMock = vi.fn(async () => new Response("ok"));
    globalThis.fetch = fetchMock as typeof fetch;

    setBaseUrl("https://api.example.com");
    await customFetch("https://other.example.com/x", { responseType: "text" });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://other.example.com/x");
  });

  it("adds bearer token when auth token getter is configured", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    globalThis.fetch = fetchMock as typeof fetch;
    setAuthTokenGetter(() => "token-123");

    await customFetch("/api", { responseType: "json" });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer token-123");
  });

  it("keeps explicit authorization header instead of overriding it", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    globalThis.fetch = fetchMock as typeof fetch;
    setAuthTokenGetter(() => "token-123");

    await customFetch("/api", {
      responseType: "json",
      headers: { authorization: "Bearer explicit" },
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer explicit");
  });

  it("auto-detects and parses JSON response bodies", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ value: 42 }), {
          headers: { "content-type": "application/json; charset=utf-8" },
        }),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await customFetch<{ value: number }>("/value");
    expect(result).toEqual({ value: 42 });
  });

  it("returns null for no-content responses", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await customFetch("/empty");
    expect(result).toBeNull();
  });

  it("rejects GET requests with a body", async () => {
    await expect(customFetch("/x", { method: "GET", body: "{}" })).rejects.toThrow(
      "customFetch: GET requests cannot have a body.",
    );
  });

  it("sets JSON content-type for stringified JSON body", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    globalThis.fetch = fetchMock as typeof fetch;

    await customFetch("/submit", { method: "POST", body: '{"a":1}' });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("sets default JSON accept header for responseType json", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    globalThis.fetch = fetchMock as typeof fetch;

    await customFetch("/data", { responseType: "json" });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("accept")).toBe("application/json, application/problem+json");
  });

  it("throws ApiError with parsed JSON payload on non-2xx responses", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ detail: "No access" }), {
          status: 403,
          statusText: "Forbidden",
          headers: { "content-type": "application/problem+json" },
        }),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(customFetch("/secure")).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      data: { detail: "No access" },
    } satisfies Partial<ApiError>);
  });

  it("throws ResponseParseError when JSON parsing fails", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('{"broken"', {
          headers: { "content-type": "application/json" },
        }),
    );
    globalThis.fetch = fetchMock as typeof fetch;

    await expect(customFetch("/broken", { responseType: "json" })).rejects.toBeInstanceOf(
      ResponseParseError,
    );
  });
});
