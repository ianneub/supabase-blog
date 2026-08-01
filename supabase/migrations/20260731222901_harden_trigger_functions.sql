-- These are trigger functions, not RPC endpoints. Keep them off the REST API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- set_updated_at only touches NEW, so it does not need definer rights.
alter function public.set_updated_at() security invoker;