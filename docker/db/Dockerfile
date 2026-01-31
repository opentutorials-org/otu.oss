# OTU 커스텀 PostgreSQL: Supabase PostgreSQL + pgvector + pgroonga
FROM supabase/postgres:15.6.1.143

# pgroonga 설치
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        postgresql-15-pgdg-pgroonga && \
    rm -rf /var/lib/apt/lists/*
