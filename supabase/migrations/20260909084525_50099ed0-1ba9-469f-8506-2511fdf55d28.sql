create unique index if not exists contributions_paystack_reference_idx on public.contributions(paystack_reference) where paystack_reference is not null;
create index if not exists contributions_member_id_idx on public.contributions(member_id);
create index if not exists contributions_payment_status_idx on public.contributions(payment_status);
create index if not exists expenses_date_idx on public.expenses(date);
create index if not exists stock_logs_date_idx on public.stock_logs(date);
create index if not exists harvest_payouts_member_id_idx on public.harvest_payouts(member_id);