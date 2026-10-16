-- DEV0245: additive triggers only. Existing entry points and lock order remain.
-- Source writes already hold scheduling rows, so acquire the mail pair guard
-- without waiting: contention returns a retryable conflict, never a lock inversion.
create function app.mail_source_lock(run uuid,a uuid,b uuid) returns void language plpgsql set search_path='' as $$ begin
 if not pg_try_advisory_xact_lock(hashtextextended('mail:'||run::text||':'||least(a,b)::text||':'||greatest(a,b)::text,0)) then raise exception 'message pair changed; retry operation' using errcode='40001'; end if;
end $$;
create function app.mail_trigger_enter() returns jsonb language plpgsql set search_path='' as $$
declare flags jsonb:='{}'; flag text; begin
 foreach flag in array array['app.coach_connection_management','app.coach_profile_management','app.coach_application_management','app.coach_booking_management','app.coach_availability_management','app.coach_booking_request_management','app.profile_media_management','app.message_management'] loop
  flags:=flags||jsonb_build_object(flag,coalesce(current_setting(flag,true),''));
 end loop;
 perform app.mail_flags(true); return flags;
end $$;
create function app.mail_trigger_leave(flags jsonb) returns void language plpgsql set search_path='' as $$
declare flag record; begin for flag in select * from jsonb_each_text(flags) loop perform set_config(flag.key,flag.value,true); end loop; end $$;
create function app.mail_source_event(run uuid,coach uuid,athlete uuid,kind text,source uuid,event text,label text,sender uuid,at_time timestamptz,entry_kind text) returns void language plpgsql set search_path='' as $$
declare c app.message_conversations; ctx uuid; begin
 c:=app.mail_ensure_conversation(run,coach,athlete);ctx:=app.mail_ensure_context(c,kind,source);
 if sender not in(coach,athlete) then sender:=null; end if;
 perform app.mail_append(c,ctx,sender,entry_kind,null,null,event,label,at_time);
end $$;
create function app.mail_request_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare flags jsonb; begin
 perform app.mail_source_lock(new.run_id,new.coach_profile_id,new.client_profile_id);flags:=app.mail_trigger_enter();
 if (tg_op='INSERT' or (new.status='accepted' and old.status is distinct from new.status)) and app.mail_blocked(new.run_id,new.coach_profile_id,new.client_profile_id) then raise exception 'message unavailable: blocked session request' using errcode='P0001'; end if;
 perform app.mail_trigger_leave(flags);return new;
end $$;
create trigger mail_request_guard before insert or update on app.coach_booking_requests for each row execute function app.mail_request_guard();
create function app.mail_request_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare flags jsonb; sender uuid:=nullif(current_setting('app.current_profile_id',true),'')::uuid; begin
 flags:=app.mail_trigger_enter();
 if tg_op='INSERT' then
  perform app.mail_source_event(new.run_id,new.coach_profile_id,new.client_profile_id,'request',new.id,'request:'||new.id::text||':created',new.status,new.client_profile_id,new.created_at,'request');
 elsif old.status is distinct from new.status then
  perform app.mail_source_event(new.run_id,new.coach_profile_id,new.client_profile_id,'request',new.id,'request:'||new.id::text||':'||new.status,new.status,sender,statement_timestamp(),'status');
 end if;
 perform app.mail_trigger_leave(flags);return new;
end $$;
create trigger mail_request_activity after insert or update on app.coach_booking_requests for each row execute function app.mail_request_activity();
create function app.mail_booking_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare flags jsonb; begin
 if new.credit_projection_id is not null then return new; end if;
 perform app.mail_source_lock(new.run_id,new.coach_profile_id,new.client_profile_id);flags:=app.mail_trigger_enter();
 if tg_op='INSERT' and app.mail_blocked(new.run_id,new.coach_profile_id,new.client_profile_id) then raise exception 'message unavailable: blocked session acceptance' using errcode='P0001'; end if;
 perform app.mail_trigger_leave(flags);return new;
end $$;
create trigger mail_booking_guard before insert or update on app.coach_private_bookings for each row execute function app.mail_booking_guard();
create function app.mail_booking_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare flags jsonb; request_id uuid; sender uuid:=nullif(current_setting('app.current_profile_id',true),'')::uuid; begin
 if new.credit_projection_id is not null or old.status is not distinct from new.status then return new; end if;
 flags:=app.mail_trigger_enter();select r.id into request_id from app.coach_booking_requests r where r.accepted_booking_id=new.id;
 perform app.mail_source_event(new.run_id,new.coach_profile_id,new.client_profile_id,case when request_id is null then 'booking' else 'request' end,coalesce(request_id,new.id),'booking:'||new.id::text||':'||new.status,new.status,sender,statement_timestamp(),'status');
 perform app.mail_trigger_leave(flags);return new;
end $$;
create trigger mail_booking_activity after update on app.coach_private_bookings for each row execute function app.mail_booking_activity();
create function app.mail_connection_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare flags jsonb; pair app.coach_athlete_connection_pairs; begin
 flags:=app.mail_trigger_enter();select * into strict pair from app.coach_athlete_connection_pairs where id=new.pair_id;
 perform app.mail_source_lock(pair.run_id,pair.coach_profile_id,pair.athlete_profile_id);
 if new.status in ('pending','accepted') and app.mail_blocked(pair.run_id,pair.coach_profile_id,pair.athlete_profile_id) then raise exception 'message unavailable: blocked connection' using errcode='P0001'; end if;
 if tg_op='UPDATE' and old.status='accepted' and new.status='removed' then
  update app.message_consents a set status='revoked',decided_at=statement_timestamp() from app.message_conversations c where c.id=a.conversation_id and c.run_id=pair.run_id and c.coach_profile_id=pair.coach_profile_id and c.athlete_profile_id=pair.athlete_profile_id and a.status in ('accepted','pending');
 end if;
 perform app.mail_trigger_leave(flags);return new;
end $$;
create trigger mail_connection_guard before insert or update on app.coach_athlete_connection_attempts for each row execute function app.mail_connection_guard();
create function app.mail_change_block(c app.message_conversations,actor uuid,blocking boolean) returns jsonb language plpgsql set search_path='' as $$
declare saved_block_id uuid; begin
 if not blocking then
  update app.message_blocks set ended_at=statement_timestamp() where run_id=c.run_id and low_profile_id=least(c.coach_profile_id,c.athlete_profile_id) and high_profile_id=greatest(c.coach_profile_id,c.athlete_profile_id) and blocked_by_profile_id=actor and ended_at is null;return '{}'::jsonb;
 end if;
 select b.id into saved_block_id from app.message_blocks b where b.run_id=c.run_id and b.low_profile_id=least(c.coach_profile_id,c.athlete_profile_id) and b.high_profile_id=greatest(c.coach_profile_id,c.athlete_profile_id) and b.blocked_by_profile_id=actor and b.ended_at is null;
 if saved_block_id is not null then return '{}'::jsonb; end if;
 insert into app.message_blocks(run_id,low_profile_id,high_profile_id,blocked_by_profile_id) values(c.run_id,least(c.coach_profile_id,c.athlete_profile_id),greatest(c.coach_profile_id,c.athlete_profile_id),actor) returning message_blocks.id into saved_block_id;
 insert into app.message_block_bookings(block_id,booking_id,until_at) select saved_block_id,b.id,b.scheduled_end_at+interval '336 hours' from app.coach_private_bookings b where b.run_id=c.run_id and b.credit_projection_id is null and b.status='confirmed' and b.scheduled_end_at>statement_timestamp() and least(b.coach_profile_id,b.client_profile_id)=least(c.coach_profile_id,c.athlete_profile_id) and greatest(b.coach_profile_id,b.client_profile_id)=greatest(c.coach_profile_id,c.athlete_profile_id);
 update app.coach_athlete_connection_attempts a set status='removed',removed_at=statement_timestamp(),removed_by_profile_id=actor from app.coach_athlete_connection_pairs p where p.id=a.pair_id and p.run_id=c.run_id and least(p.coach_profile_id,p.athlete_profile_id)=least(c.coach_profile_id,c.athlete_profile_id) and greatest(p.coach_profile_id,p.athlete_profile_id)=greatest(c.coach_profile_id,c.athlete_profile_id) and a.status='accepted';
 update app.coach_athlete_connection_attempts a set status=case when a.sender_profile_id=actor then 'withdrawn' else 'declined' end,decided_at=statement_timestamp(),decided_by_profile_id=actor from app.coach_athlete_connection_pairs p where p.id=a.pair_id and p.run_id=c.run_id and least(p.coach_profile_id,p.athlete_profile_id)=least(c.coach_profile_id,c.athlete_profile_id) and greatest(p.coach_profile_id,p.athlete_profile_id)=greatest(c.coach_profile_id,c.athlete_profile_id) and a.status='pending';
 update app.message_consents a set status='revoked',decided_at=statement_timestamp() from app.message_conversations v where v.id=a.conversation_id and v.run_id=c.run_id and least(v.coach_profile_id,v.athlete_profile_id)=least(c.coach_profile_id,c.athlete_profile_id) and greatest(v.coach_profile_id,v.athlete_profile_id)=greatest(c.coach_profile_id,c.athlete_profile_id) and a.status in ('accepted','pending');
 return '{}'::jsonb;
end $$;
-- No fabricated text: bootstrap original cards and mark historical entries read.
do $$ declare r record; begin
 perform app.mail_flags(true);
 for r in select * from app.coach_booking_requests order by created_at,id loop
  perform app.mail_source_event(r.run_id,r.coach_profile_id,r.client_profile_id,'request',r.id,'request:'||r.id::text||':created',r.status,r.client_profile_id,r.created_at,'request');
 end loop;
 for r in select b.* from app.coach_private_bookings b where b.credit_projection_id is null and not exists(select 1 from app.coach_booking_requests request where request.accepted_booking_id=b.id) order by b.created_at,b.id loop
  perform app.mail_source_event(r.run_id,r.coach_profile_id,r.client_profile_id,'booking',r.id,'booking:'||r.id::text||':created',r.status,r.client_profile_id,r.created_at,'request');
 end loop;
 update app.message_conversations c set created_at=e.first_at,activity_at=e.last_at from (select conversation_id,min(created_at) first_at,max(created_at) last_at from app.message_entries group by conversation_id) e where e.conversation_id=c.id;
 update app.message_reads positions set last_seq=c.last_seq from app.message_conversations c where c.id=positions.conversation_id;
 perform app.mail_flags(false);
end $$;
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app' and p.proname like 'mail_%' loop
  execute format('alter function %s owner to app_owner',f.signature);
  execute format('revoke all on function %s from public,anon,authenticated,service_role,app_runtime',f.signature);
 end loop;
end $$;
