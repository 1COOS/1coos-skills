---
name: 1coos-quickie
description: Quickly save web content as formatted Markdown. TRIGGER when user pastes a URL and wants to save/clip it, read-later, or extract content from YouTube, Twitter/X, WeChat, Bilibili, Telegram, RSS, or any web page.
version: 1.0.0
metadata: {"openclaw":{"requires":{"bins":["bun","uvx"]},"install":[{"kind":"uv","package":"x-reader[all] @ git+https://github.com/runesleo/x-reader.git","bins":["x-reader"]}],"emoji":"📎"}}
---

# Quickie — URL to Markdown

Grab any URL and save it as beautifully formatted Obsidian-style Markdown. Powered by [x-reader](https://github.com/runesleo/x-reader) for content extraction.

## Usage

```
/1coos-quickie <text-containing-url> [--output-dir path] [--raw]
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `<text>` | Yes | Any text containing a URL to fetch |
| `--output-dir` | No | Output directory (default: from config.json) |
| `--raw` | No | Skip formatting, output raw x-reader result |
| `--config` | No | Path to config.json |

## Supported Platforms

- **Video**: YouTube, Bilibili
- **Social**: Twitter/X, WeChat, Xiaohongshu (Little Red Book), Telegram
- **Feeds**: RSS/Atom
- **General**: Any HTTP/HTTPS URL

## Configuration

Core parameters are configurable via `config.json` in the skill directory:

```json
{
  "outputDir": "~/Documents/quickie",
  "formatting": {
    "maxWidth": 80,
    "listMarker": "-"
  },
  "reader": {
    "timeout": 120000
  }
}
```

CLI arguments always override config.json values.

## Execution Instructions

When the user invokes this skill:

1. **Check prerequisites**: Verify `uvx` is available. If not, instruct the user to install uv: `curl -LsSf https://astral.sh/uv/install.sh | sh`
2. **Run extraction**: Execute the script:
   ```bash
   bun run ${CLAUDE_SKILL_DIR}/scripts/main.ts $ARGUMENTS
   ```
3. **Report results**: Show the output file path, the extracted title, and a brief content summary.
4. **Handle errors**:
   - Exit code 2: argument error (no URL found, invalid options)
   - Exit code 3: missing dependency (uvx not installed)
   - Exit code 4: x-reader fetch failure
   - Exit code 5: output write failure

## Examples

```bash
# Grab a YouTube video transcript
/1coos-quickie https://www.youtube.com/watch?v=dQw4w9WgXcQ

# Save a tweet thread
/1coos-quickie 看看这条推特 https://x.com/user/status/123456 很有意思

# Clip an article with custom output
/1coos-quickie https://example.com/article --output-dir ~/notes/inbox

# Raw output without formatting
/1coos-quickie https://example.com/page --raw
```

## Notes

- First run caches x-reader dependencies; subsequent runs are faster
- Output filename is derived from the content title or URL domain + date
- Obsidian-style formatting includes: wikilinks, callout normalization, highlight syntax, table alignment, frontmatter formatting
- Uses `x-reader[all]` for full platform support
