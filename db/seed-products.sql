INSERT INTO products (type, title, slug, description, thumbnail_url, price_in_paise, currency, is_active)
VALUES
  ('video', 'Leadership Intensive', 'leadership-intensive', 'Executive leadership masterclass', NULL, 790000, 'INR', true),
  ('course', 'Product Strategy Sprint', 'product-strategy-sprint', '12-lesson strategy course', NULL, 590000, 'INR', true),
  ('plan', 'Premium Plan', 'premium-plan', 'Full library access for 30 days', NULL, 490000, 'INR', true)
ON CONFLICT (slug) DO NOTHING;
