-- Keep the enum change in its own migration. PostgreSQL requires a newly
-- added enum value to be committed before functions/triggers can use it.
alter type journal_source add value if not exists 'booking_charge';
alter type journal_source add value if not exists 'damage_deposit';
