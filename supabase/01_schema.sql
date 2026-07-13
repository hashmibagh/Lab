-- =====================================================================
-- PHARMACY MANAGEMENT SYSTEM — CORE SCHEMA
-- Run this file in the Supabase SQL editor first (before RLS/triggers/seed)
-- =====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type user_role as enum ('super_admin','owner','manager','pharmacist','cashier','store_keeper');
create type payment_method as enum ('cash','card','bank','mobile_wallet','partial');
create type payment_status as enum ('paid','partial','unpaid');
create type stock_txn_type as enum ('in','out','adjustment','transfer','opening','return','damage');
create type notification_type as enum ('low_stock','expiry','out_of_stock','payment_due','supplier_due','customer_due','daily_summary','system');

-- ---------------------------------------------------------------------
-- CORE / IDENTITY
-- ---------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  avatar_url text,
  role user_role not null default 'cashier',
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,          -- e.g. 'medicines.create'
  label text not null,
  module text not null
);

create table user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  allowed boolean not null default true,
  unique(user_id, permission_id)
);

-- ---------------------------------------------------------------------
-- CATALOG
-- ---------------------------------------------------------------------
create table medicine_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table manufacturers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_person text,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  whatsapp text,
  email text,
  address text,
  tax_number text,
  opening_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  whatsapp text,
  address text,
  cnic text,
  medical_notes text,
  credit_limit numeric(14,2) not null default 0,
  reward_points integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table medicines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  generic_name text,
  brand_name text,
  manufacturer_id uuid references manufacturers(id),
  category_id uuid references medicine_categories(id),
  batch_number text,
  barcode text unique,
  qr_code text unique,
  strength text,
  dosage_form text,
  packing text,
  purchase_price numeric(12,2) not null default 0,
  sale_price numeric(12,2) not null default 0,
  wholesale_price numeric(12,2) not null default 0,
  tax_percent numeric(5,2) not null default 0,
  discount_percent numeric(5,2) not null default 0,
  current_stock numeric(12,2) not null default 0,
  minimum_stock numeric(12,2) not null default 10,
  maximum_stock numeric(12,2) not null default 1000,
  expiry_date date,
  manufacturing_date date,
  supplier_id uuid references suppliers(id),
  rack_number text,
  image_url text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_medicines_name on medicines using gin (to_tsvector('simple', name));
create index idx_medicines_barcode on medicines(barcode);
create index idx_medicines_expiry on medicines(expiry_date);
create index idx_medicines_stock on medicines(current_stock);

-- ---------------------------------------------------------------------
-- INVENTORY
-- ---------------------------------------------------------------------
create table stock_transactions (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references medicines(id),
  type stock_txn_type not null,
  quantity numeric(12,2) not null,
  reference_table text,       -- 'purchases' | 'sales' | 'sales_returns' | 'purchase_returns' | null
  reference_id uuid,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_stock_txn_medicine on stock_transactions(medicine_id);

create table stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references medicines(id),
  previous_qty numeric(12,2) not null,
  adjusted_qty numeric(12,2) not null,
  reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table inventory_logs (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid references medicines(id),
  action text not null,
  details jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PURCHASES
-- ---------------------------------------------------------------------
create table purchases (
  id uuid primary key default gen_random_uuid(),
  invoice_no text unique not null,
  supplier_id uuid references suppliers(id),
  purchase_date date not null default current_date,
  subtotal numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  payment_status payment_status not null default 'unpaid',
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  medicine_id uuid not null references medicines(id),
  batch_number text,
  quantity numeric(12,2) not null,
  unit_cost numeric(12,2) not null,
  tax_percent numeric(5,2) not null default 0,
  discount_percent numeric(5,2) not null default 0,
  line_total numeric(14,2) not null,
  expiry_date date
);

create table purchase_returns (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid references purchases(id),
  medicine_id uuid not null references medicines(id),
  quantity numeric(12,2) not null,
  reason text,
  amount numeric(14,2) not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SALES / POS
-- ---------------------------------------------------------------------
create table sales (
  id uuid primary key default gen_random_uuid(),
  invoice_no text unique not null,
  customer_id uuid references customers(id),
  sale_date timestamptz not null default now(),
  subtotal numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  payment_method payment_method not null default 'cash',
  payment_status payment_status not null default 'paid',
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  medicine_id uuid not null references medicines(id),
  quantity numeric(12,2) not null,
  unit_price numeric(12,2) not null,
  tax_percent numeric(5,2) not null default 0,
  discount_percent numeric(5,2) not null default 0,
  line_total numeric(14,2) not null
);

create table sales_returns (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references sales(id),
  medicine_id uuid not null references medicines(id),
  quantity numeric(12,2) not null,
  reason text,
  amount numeric(14,2) not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PAYMENTS / FINANCE
-- ---------------------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  reference_table text not null,   -- 'sales' | 'purchases'
  reference_id uuid not null,
  amount numeric(14,2) not null,
  method payment_method not null default 'cash',
  paid_at timestamptz not null default now(),
  notes text,
  created_by uuid references profiles(id)
);

create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references expense_categories(id),
  title text not null,
  amount numeric(14,2) not null,
  is_recurring boolean not null default false,
  expense_date date not null default current_date,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------
-- EMPLOYEES
-- ---------------------------------------------------------------------
create table employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  full_name text not null,
  phone text,
  designation text,
  salary numeric(12,2) not null default 0,
  commission_percent numeric(5,2) not null default 0,
  hire_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table employee_attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  date date not null,
  status text not null default 'present',  -- present, absent, leave, half_day
  check_in time,
  check_out time,
  unique(employee_id, date)
);

create table employee_leaves (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending'
);

-- ---------------------------------------------------------------------
-- PRESCRIPTIONS / LAB
-- ---------------------------------------------------------------------
create table prescriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  patient_name text not null,
  doctor_name text,
  notes text,
  image_url text,
  pdf_url text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions(id) on delete cascade,
  medicine_id uuid references medicines(id),
  dosage text,
  frequency text,
  duration text
);

create table lab_test_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  test_name text not null,
  status text not null default 'requested',
  report_url text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SYSTEM
-- ---------------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  type notification_type not null,
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  action text not null,
  table_name text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create table settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  reference_table text not null,
  reference_id uuid not null,
  file_url text not null,
  file_type text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table barcode_labels (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references medicines(id),
  label_data text not null,
  created_at timestamptz not null default now()
);

create table qr_labels (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references medicines(id),
  label_data text not null,
  created_at timestamptz not null default now()
);
