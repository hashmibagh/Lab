-- =====================================================================
-- ROW LEVEL SECURITY
-- Run after 01_schema.sql and 02_triggers.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------
create or replace function current_role_name()
returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql stable security definer;

create or replace function is_admin()
returns boolean as $$
  select current_role_name() in ('super_admin','owner');
$$ language sql stable security definer;

create or replace function is_manager_up()
returns boolean as $$
  select current_role_name() in ('super_admin','owner','manager');
$$ language sql stable security definer;

-- ---------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','permissions','user_permissions','medicine_categories','manufacturers',
    'suppliers','customers','medicines','stock_transactions','stock_adjustments',
    'inventory_logs','purchases','purchase_items','purchase_returns','sales','sale_items',
    'sales_returns','payments','expense_categories','expenses','employees',
    'employee_attendance','employee_leaves','prescriptions','prescription_items',
    'lab_test_requests','notifications','audit_logs','settings','attachments',
    'barcode_labels','qr_labels']
  loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- PROFILES: everyone authenticated can read; users edit their own row;
-- only admins can change roles / deactivate others
-- ---------------------------------------------------------------------
create policy "profiles_select_all" on profiles for select using (auth.role() = 'authenticated');
create policy "profiles_update_self" on profiles for update using (auth.uid() = id or is_admin());
create policy "profiles_insert_admin" on profiles for insert with check (is_admin());
create policy "profiles_delete_admin" on profiles for delete using (is_admin());

-- ---------------------------------------------------------------------
-- PERMISSIONS / USER_PERMISSIONS: read for all, write for admins only
-- ---------------------------------------------------------------------
create policy "permissions_select_all" on permissions for select using (auth.role() = 'authenticated');
create policy "permissions_write_admin" on permissions for all using (is_admin()) with check (is_admin());

create policy "user_permissions_select_all" on user_permissions for select using (auth.role() = 'authenticated');
create policy "user_permissions_write_admin" on user_permissions for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- CATALOG TABLES: everyone reads, manager+ writes
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['medicine_categories','manufacturers','suppliers','customers','medicines']
  loop
    execute format('create policy "%I_select_all" on %I for select using (auth.role() = ''authenticated'');', t, t);
    execute format('create policy "%I_write_manager" on %I for insert with check (is_manager_up());', t, t);
    execute format('create policy "%I_update_manager" on %I for update using (is_manager_up());', t, t);
    execute format('create policy "%I_delete_admin" on %I for delete using (is_admin());', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- INVENTORY: everyone reads, pharmacist/store_keeper+ writes
-- ---------------------------------------------------------------------
create or replace function is_stock_handler()
returns boolean as $$
  select current_role_name() in ('super_admin','owner','manager','pharmacist','store_keeper');
$$ language sql stable security definer;

do $$
declare t text;
begin
  foreach t in array array['stock_transactions','stock_adjustments','inventory_logs']
  loop
    execute format('create policy "%I_select_all" on %I for select using (auth.role() = ''authenticated'');', t, t);
    execute format('create policy "%I_write_stock" on %I for insert with check (is_stock_handler());', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- PURCHASES: manager+ full access, everyone reads
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['purchases','purchase_items','purchase_returns']
  loop
    execute format('create policy "%I_select_all" on %I for select using (auth.role() = ''authenticated'');', t, t);
    execute format('create policy "%I_write_manager" on %I for insert with check (is_manager_up());', t, t);
    execute format('create policy "%I_update_manager" on %I for update using (is_manager_up());', t, t);
    execute format('create policy "%I_delete_admin" on %I for delete using (is_admin());', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- SALES / POS: cashier+ can create, everyone reads, manager+ edits/deletes
-- ---------------------------------------------------------------------
create or replace function is_sales_handler()
returns boolean as $$
  select current_role_name() in ('super_admin','owner','manager','pharmacist','cashier');
$$ language sql stable security definer;

do $$
declare t text;
begin
  foreach t in array array['sales','sale_items','sales_returns']
  loop
    execute format('create policy "%I_select_all" on %I for select using (auth.role() = ''authenticated'');', t, t);
    execute format('create policy "%I_write_sales" on %I for insert with check (is_sales_handler());', t, t);
    execute format('create policy "%I_update_manager" on %I for update using (is_manager_up());', t, t);
    execute format('create policy "%I_delete_admin" on %I for delete using (is_admin());', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- FINANCE: payments/expenses — manager+ writes, all read
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['payments','expense_categories','expenses']
  loop
    execute format('create policy "%I_select_all" on %I for select using (auth.role() = ''authenticated'');', t, t);
    execute format('create policy "%I_write_manager" on %I for insert with check (is_manager_up());', t, t);
    execute format('create policy "%I_update_manager" on %I for update using (is_manager_up());', t, t);
    execute format('create policy "%I_delete_admin" on %I for delete using (is_admin());', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- EMPLOYEES: admin-only visibility of salary data — restrict to manager+
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['employees','employee_attendance','employee_leaves']
  loop
    execute format('create policy "%I_select_manager" on %I for select using (is_manager_up());', t, t);
    execute format('create policy "%I_write_manager" on %I for all using (is_manager_up()) with check (is_manager_up());', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- PRESCRIPTIONS / LAB
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['prescriptions','prescription_items','lab_test_requests']
  loop
    execute format('create policy "%I_select_all" on %I for select using (auth.role() = ''authenticated'');', t, t);
    execute format('create policy "%I_write_pharmacist" on %I for all using (is_stock_handler()) with check (is_stock_handler());', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- SYSTEM TABLES
-- ---------------------------------------------------------------------
create policy "notifications_select_own" on notifications for select
  using (user_id = auth.uid() or user_id is null);
create policy "notifications_update_own" on notifications for update using (user_id = auth.uid());
create policy "notifications_insert_system" on notifications for insert with check (auth.role() = 'authenticated');

create policy "audit_logs_select_admin" on audit_logs for select using (is_admin());
create policy "audit_logs_insert_all" on audit_logs for insert with check (auth.role() = 'authenticated');

create policy "settings_select_all" on settings for select using (auth.role() = 'authenticated');
create policy "settings_write_admin" on settings for all using (is_admin()) with check (is_admin());

create policy "attachments_select_all" on attachments for select using (auth.role() = 'authenticated');
create policy "attachments_write_all" on attachments for insert with check (auth.role() = 'authenticated');

do $$
declare t text;
begin
  foreach t in array array['barcode_labels','qr_labels']
  loop
    execute format('create policy "%I_select_all" on %I for select using (auth.role() = ''authenticated'');', t, t);
    execute format('create policy "%I_write_manager" on %I for insert with check (is_manager_up());', t, t);
  end loop;
end $$;
