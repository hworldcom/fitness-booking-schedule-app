-- The preceding function definition schema-qualified COALESCE, which is SQL
-- syntax rather than an ordinary pg_catalog function. PostgreSQL accepts the
-- PL/pgSQL body at creation time but rejects that expression when executed.
-- Preserve the already-applied migration and correct the stored definition
-- forward before any application release uses the replacement function.

do $$
declare
  function_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'app.replace_owned_coach_availability_rules(jsonb,jsonb)'::regprocedure
  )
  into function_definition;

  if function_definition is null
    or pg_catalog.strpos(
      function_definition,
      'pg_catalog.coalesce'
    ) = 0
  then
    raise exception 'weekly schedule replacement definition is unavailable';
  end if;

  execute pg_catalog.replace(
    function_definition,
    'pg_catalog.coalesce',
    'coalesce'
  );
end;
$$;
