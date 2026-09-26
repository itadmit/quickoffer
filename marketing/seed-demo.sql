-- The quote the demo reel shows, seeded so capture-screens.mjs can photograph
-- the real /q page instead of a mockup.
--
-- ⚠️ LOCAL DATABASE ONLY. DATABASE_URL in .env.local points at production Neon
--    (see CLAUDE.md), so this must be run with an explicit local target:
--
--      psql -d quickoffer_dev -f marketing/seed-demo.sql
--
-- The numbers are not chosen - they are what calc.ts produces from the saved
-- voice note ("שלוש נקודות חשמל, מאה שמונים ליחידה. ביקור מאתיים. לפני מע״מ"):
--   3 x 180 = 540, 1 x 200 = 200, net 740, vat 18% = 133.20, total 873.20
begin;

delete from quotes where public_id = 'A3f9Qd';
delete from users where phone = '972501112233';

-- logo_url must be ABSOLUTE: the opengraph-image route renders with Satori and
-- throws "Image source must be an absolute URL" on a relative path.
-- Put marketing/logo-yossi.png at public/tmp-logo-yossi.png before capturing.
insert into users (id, phone, channel, display_name, business_name, logo_url,
                   business_phone, vat_status, default_valid_days,
                   next_quote_number, plan, onboarding_state)
values ('11111111-1111-1111-1111-111111111111', '972501112233', 'whatsapp',
        'יוסי', 'יוסי חשמל ותאורה', 'http://localhost:3100/tmp-logo-yossi.png',
        '050-111-2233', 'registered', 14, 2, 'pro', 'done');

-- status 'sent' with sent_at set: /q refuses to register a view on a draft
-- that never left the chat, and would 404 the customer on an unsent quote.
insert into quotes (id, public_id, user_id, number, status, customer_name,
                    customer_phone, vat_included, vat_rate, discount_amount,
                    payment_terms, valid_until, subtotal, vat_amount, total,
                    transcript, sent_at)
values ('22222222-2222-2222-2222-222222222222', 'A3f9Qd',
        '11111111-1111-1111-1111-111111111111', 1, 'sent', 'דני כהן',
        '0501234567', false, 0.18, 0,
        'שוטף 30', now() + interval '14 days', 740, 133.20, 873.20,
        'עופר, תכין הצעה לדני כהן. שלוש נקודות חשמל, 180 ליחידה. ביקור 200. לפני מע״מ.',
        now());

insert into quote_items (quote_id, position, description, quantity, unit,
                         unit_price, line_total, needs_review)
values
  ('22222222-2222-2222-2222-222222222222', 0, 'נקודת חשמל', 3, 'נקודה', 180, 540, false),
  ('22222222-2222-2222-2222-222222222222', 1, 'ביקור', 1, 'יח׳', 200, 200, false);

commit;
