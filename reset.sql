-- Töm alla spelare inför tee off.
-- Tar bort spelare, poäng och PIN-koder. Spelet och barerna ligger kvar.
-- Kör i Supabase → SQL Editor.

truncate table players cascade;
