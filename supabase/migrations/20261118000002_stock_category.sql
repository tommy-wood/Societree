-- Split stock into materials (used up) and tools & equipment (kept and reused).
alter table public.stock_items
  add column category text not null default 'material'
  check (category in ('material', 'tool'));

comment on column public.stock_items.category is '''material'' = consumables used on sites; ''tool'' = tools and equipment that are kept.';

-- Classify the items imported from the old app (matched by name, case-insensitive).
update public.stock_items
   set category = 'tool'
 where lower(name) in (
   'fork', 'hardhat', 'broom', 'saw', 'electric tiller', 'postwacker', 'mattock',
   'hoses', 'wheelbarrows', 'spades', 'loppers', 'hammers', 'water butts', 'work gloves'
 );
