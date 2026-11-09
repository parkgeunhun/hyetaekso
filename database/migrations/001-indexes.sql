CREATE INDEX products_public ON products(status,sort_order);
CREATE INDEX leads_queue ON leads(status,created_at);
CREATE INDEX content_public ON content(kind,status,created_at);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE INDEX sync_recent ON sync_runs(created_at);
