# Personal Blog

This is a personal blog project built with Django. It allows users to create, edit, and delete blog posts. Users can also comment on posts and view posts by category.

## Features

- User authentication (signup, login, logout)
- Create, edit, and delete blog posts
- Comment on posts
- View posts by category
- Responsive design
- AI-ready search: keyword, semantic and hybrid search over chunked, embedded posts
- JSON API, `sitemap.xml`, `robots.txt`, `llms.txt` and schema.org markup for search engines and AI agents

## Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/yourusername/personal_blog.git
    ```
2. Navigate to the project directory:
    ```bash
    cd personal_blog
    ```
3. Create a virtual environment:
    ```bash
    python -m venv venv
    ```
4. Activate the virtual environment:
    - On Windows:
        ```bash
        venv\Scripts\activate
        ```
    - On macOS/Linux:
        ```bash
        source venv/bin/activate
        ```
5. Install the required packages:
    ```bash
    pip install -r requirements.txt
    ```
6. Apply migrations:
    ```bash
    python manage.py migrate
    ```
7. Create a superuser:
    ```bash
    python manage.py createsuperuser
    ```
8. Run the development server:
    ```bash
    python manage.py runserver
    ```

## Configuration

Settings come from environment variables (a local `.env` file is loaded automatically). See
[`.env.example`](.env.example) for the full list. The important ones:

| Variable | Purpose |
| --- | --- |
| `DEBUG` | `True` for local development |
| `DJANGO_SECRET_KEY` | Required when `DEBUG` is off |
| `DJANGO_ALLOWED_HOST` | Comma-separated host names |
| `DATABASE_URL` | e.g. `postgres://user:pass@host/db`; SQLite is used when unset |
| `AI_SEARCH_EMBEDDER` | Embedding provider (see below) |

## AI search

Every saved post is converted to plain text, split into overlapping, heading-aware chunks
(~200 words) and embedded. Searches can then run in three modes:

- **keyword**: PostgreSQL full-text ranking (title, tags, category, excerpt, body), with a portable fallback on SQLite
- **semantic**: nearest chunks by embedding similarity; matching passages are returned, ready to ground an LLM answer (RAG)
- **hybrid** (default): both, merged with reciprocal rank fusion; falls back to keyword if the embedding provider is down

Embedding providers are set with `AI_SEARCH_EMBEDDER`:

| Provider | Value | Notes |
| --- | --- | --- |
| Hashing (default) | `blog.search.embeddings.HashingEmbedder` | Offline, no key; word-overlap only |
| Voyage AI | `blog.search.embeddings.VoyageEmbedder` | Set `AI_SEARCH_EMBEDDING_API_KEY` |
| OpenAI-compatible | `blog.search.embeddings.OpenAICompatibleEmbedder` | OpenAI, Ollama, vLLM, ... via `AI_SEARCH_EMBEDDING_API_BASE` |

After changing provider or model, rebuild the index:

```bash
python manage.py reindex_posts --force
```

Unchanged posts are skipped automatically, so `build.sh` runs `reindex_posts` on every deploy.
Vectors live in the `PostChunk` table. For a large corpus, implement `save()`/`query()` on top of
pgvector (or Qdrant, etc.) and point `AI_SEARCH_VECTOR_STORE` at it; nothing else changes.

### Endpoints for search engines and AI agents

| URL | Description |
| --- | --- |
| `/api/v1/search/?q=...&mode=hybrid&limit=10` | Search; optional `blog`, `category`, `tag` filters |
| `/api/v1/posts/` | Paginated list of published posts |
| `/api/v1/posts/<slug>/` | One post with HTML and plain-text content |
| `/sitemap.xml`, `/robots.txt` | Crawling |
| `/llms.txt` | Markdown site map for LLMs ([llmstxt.org](https://llmstxt.org)) |

Post pages also include `BlogPosting` JSON-LD structured data.

## Testing

```bash
python manage.py test blog
```

## Usage

- Access the blog at `http://127.0.0.1:8000/`
- Log in with your superuser account to create, edit, or delete posts
- Register a new account to comment on posts

## Contributing

Contributions are welcome! Please fork the repository and create a pull request with your changes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

For any questions or suggestions, please contact [your email address].

## Screenshot

![Blog Screenshot](blog.png)