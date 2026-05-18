-- Migration 53 added a trigger that inserts journal_entries with
-- source='revenue_point', but never extended the journal_source enum.
-- Any revenue-point-sale write therefore aborts with:
--   invalid input value for enum journal_source: "revenue_point"
alter type journal_source add value if not exists 'revenue_point';
