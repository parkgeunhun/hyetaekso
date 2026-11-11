CREATE TABLE IF NOT EXISTS page_views_daily (
 day VARCHAR(10) PRIMARY KEY, views BIGINT NOT NULL
);
CREATE INDEX leads_created_at ON leads(created_at);
