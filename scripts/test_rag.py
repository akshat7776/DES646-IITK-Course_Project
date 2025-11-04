import argparse
import time
import requests
import json
import sys

DEFAULT_URL = "http://127.0.0.1:8000/query"
HEALTH_URL = "http://127.0.0.1:8000/health"


def parse_args():
    p = argparse.ArgumentParser(description="Test the local RAG server")
    p.add_argument("--query", type=str, default="What things customers are not like?", help="Query text to send")
    p.add_argument("--url", type=str, default=DEFAULT_URL, help="Full query endpoint URL")
    p.add_argument("--count", type=int, default=1, help="Number of repeated requests")
    p.add_argument("--delay", type=float, default=0.0, help="Seconds to wait between requests")
    p.add_argument("--timeout", type=float, default=60.0, help="Request timeout seconds")
    p.add_argument(
        "--sources",
        type=str,
        choices=["auto", "always", "never"],
        default="auto",
        help="When to print sources: 'auto' (only if include_sources=True), 'always', or 'never'",
    )
    p.add_argument(
        "--fields",
        type=str,
        default="Clothing ID,Age,Title,Review Text,Rating,Department Name,Class Name",
        help=(
            "Comma-separated metadata fields to print (e.g. 'Clothing ID,Age,Title,Review Text,Rating,Department Name,Class Name'). "
            "Defaults to a curated set; set to empty string to print all metadata fields."
        ),
    )
    p.add_argument(
        "--max-len",
        type=int,
        default=180,
        help="Maximum characters to show for long text fields (Review Text, text_snippet). Use a larger value to see more.",
    )
    p.add_argument(
        "--top-sources",
        type=int,
        default=5,
        help="Maximum number of sources to print.",
    )
    p.add_argument(
        "--include-snippet",
        action="store_true",
        help="Also print the text_snippet field for each source",
    )
    return p.parse_args()


def pretty_print(obj):
    try:
        print(json.dumps(obj, indent=2, ensure_ascii=False))
    except Exception:
        print(obj)


def main():
    args = parse_args()

    # Health check
    try:
        h = requests.get(HEALTH_URL, timeout=5)
        print("Health:", h.status_code, end=" - ")
        try:
            pretty_print(h.json())
        except Exception:
            print(h.text)
    except Exception as e:
        print("Health check failed:", e)
        print("Make sure the server is running (python src/fastapi_serve.py)")
        sys.exit(1)

    # Run queries
    for i in range(1, args.count + 1):
        # print(f"\n=== Request #{i} ===")
        payload = {"query": args.query}
        t0 = time.perf_counter()
        try:
            r = requests.post(args.url, json=payload, timeout=args.timeout)
            elapsed = time.perf_counter() - t0
            print(f"Status: {r.status_code}  Time: {elapsed:.2f}s")
            try:
                data = r.json()
                # Print answer first
                print("\nAnswer:")
                print(data.get("answer", ""))

                # Decide whether to print sources
                include_sources_flag = bool(data.get("include_sources", False))
                should_print_sources = (
                    args.sources == "always" or (args.sources == "auto" and include_sources_flag)
                )

                if should_print_sources:
                    sources = (data.get("sources", []) or [])[: max(0, args.top_sources)]
                    if sources:
                        print("\nSources:")
                        # Prepare requested fields list (if any)
                        requested_fields = [f.strip() for f in (args.fields or "").split(",") if f.strip()]

                        def clip(val: object) -> str:
                            try:
                                s = "" if val is None else str(val)
                            except Exception:
                                s = ""
                            if args.max_len and isinstance(s, str) and len(s) > args.max_len:
                                return s[: args.max_len].rstrip() + "..."
                            return s

                        # Print each source block cleanly
                        for idx, s in enumerate(sources, start=1):
                            md = s.get("metadata", {}) or {}
                            snippet = s.get("text_snippet", "")
                            print(f"\nSource #{idx}:")

                            if requested_fields:
                                # case-insensitive mapping of metadata keys
                                md_ci = {str(k).lower(): k for k in md.keys()}
                                for rf in requested_fields:
                                    k_actual = md_ci.get(rf.lower(), rf)
                                    print(f"  {k_actual}: {clip(md.get(k_actual, ''))}")
                            else:
                                # print all metadata keys present for this source
                                for k in md.keys():
                                    print(f"  {k}: {clip(md.get(k, ''))}")

                            if args.include_snippet:
                                print(f"  text_snippet: {clip(snippet)}")
                    else:
                        print("(no sources)")
                else:
                    # Skip printing sources
                    pass
            except Exception:
                print(r.text)
        except Exception as e:
            elapsed = time.perf_counter() - t0
            print(f"Request failed after {elapsed:.2f}s: {e}")
        if i < args.count and args.delay > 0:
            time.sleep(args.delay)


if __name__ == "__main__":
    main()
