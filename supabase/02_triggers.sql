-- =====================================================================
-- TRIGGERS: timestamps, stock movement, low-stock notifications
-- Run after 01_schema.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- Generic updated_at trigger
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['profiles','suppliers','customers','medicines','purchases','sales']
  loop
    execute format('create trigger trg_%I_updated_at before update on %I
      for each row execute function set_updated_at();', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Create a profile row automatically when a new auth user signs up
-- ---------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'cashier');
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
-- Stock decrement on sale_items insert, increment on delete
-- ---------------------------------------------------------------------
create or replace function apply_sale_stock()
returns trigger as $$
begin
  update medicines set current_stock = current_stock - new.quantity where id = new.medicine_id;
  insert into stock_transactions (medicine_id, type, quantity, reference_table, reference_id, notes)
  values (new.medicine_id, 'out', new.quantity, 'sales', new.sale_id, 'Sale');
  return new;
end;
$$ language plpgsql;

create trigger trg_sale_items_stock
  after insert on sale_items
  for each row execute function apply_sale_stock();

create or replace function revert_sale_stock()
returns trigger as $$
begin
  update medicines set current_stock = current_stock + old.quantity where id = old.medicine_id;
  return old;
end;
$$ language plpgsql;

create trigger trg_sale_items_stock_revert
  after delete on sale_items
  for each row execute function revert_sale_stock();

-- ---------------------------------------------------------------------
-- Stock increment on purchase_items insert, decrement on delete
-- ---------------------------------------------------------------------
create or replace function apply_purchase_stock()
returns trigger as $$
begin
  update medicines set current_stock = current_stock + new.quantity where id = new.medicine_id;
  insert into stock_transactions (medicine_id, type, quantity, reference_table, reference_id, notes)
  values (new.medicine_id, 'in', new.quantity, 'purchases', new.purchase_id, 'Purchase');
  return new;
end;
$$ language plpgsql;

create trigger trg_purchase_items_stock
  after insert on purchase_items
  for each row execute function apply_purchase_stock();

create or replace function revert_purchase_stock()
returns trigger as $$
begin
  update medicines set current_stock = current_stock - old.quantity where id = old.medicine_id;
  return old;
end;
$$ language plpgsql;

create trigger trg_purchase_items_stock_revert
  after delete on purchase_items
  for each row execute function revert_purchase_stock();

-- ---------------------------------------------------------------------
-- Sales/purchase returns adjust stock too
-- ---------------------------------------------------------------------
create or replace function apply_sales_return_stock()
returns trigger as $$
begin
  update medicines set current_stock = current_stock + new.quantity where id = new.medicine_id;
  insert into stock_transactions (medicine_id, type, quantity, reference_table, reference_id, notes)
  values (new.medicine_id, 'return', new.quantity, 'sales_returns', new.id, 'Sales return');
  return new;
end;
$$ language plpgsql;

create trigger trg_sales_returns_stock
  after insert on sales_returns
  for each row execute function apply_sales_return_stock();

create or replace function apply_purchase_return_stock()
returns trigger as $$
begin
  update medicines set current_stock = current_stock - new.quantity where id = new.medicine_id;
  insert into stock_transactions (medicine_id, type, quantity, reference_table, reference_id, notes)
  values (new.medicine_id, 'return', new.quantity, 'purchase_returns', new.id, 'Purchase return');
  return new;
end;
$$ language plpgsql;

create trigger trg_purchase_returns_stock
  after insert on purchase_returns
  for each row execute function apply_purchase_return_stock();

-- ---------------------------------------------------------------------
-- Low stock / out of stock notification after any stock change
-- ---------------------------------------------------------------------
create or replace function check_stock_notification()
returns trigger as $$
begin
  if new.current_stock <= 0 then
    insert into notifications (type, title, body)
    values ('out_of_stock', new.name || ' is out of stock', 'Current stock: 0');
  elsif new.current_stock <= new.minimum_stock then
    insert into notifications (type, title, body)
    values ('low_stock', new.name || ' is low on stock', 'Current stock: ' || new.current_stock || ' / min ' || new.minimum_stock);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_medicines_stock_notify
  after update of current_stock on medicines
  for each row execute function check_stock_notification();
