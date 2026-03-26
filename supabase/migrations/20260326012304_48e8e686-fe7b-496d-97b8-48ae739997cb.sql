
ALTER TABLE public.calendar_events
  ADD COLUMN recorrencia text DEFAULT null,
  ADD COLUMN recorrencia_fim date DEFAULT null;
