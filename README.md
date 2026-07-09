# Group Ordering App

A React Native + Expo group ordering app powered by Supabase. Hosts can create a group order, share an invite code, guests can join and add items, and only the host can checkout the final order.

## Features

- Supabase email/password auth
- Host-created group orders
- Invite-code guest joining
- Menu browsing
- Add-to-cart flow
- Cart grouped by user
- Host-only checkout
- Order history
- Order detail screen
- Host-only complete/cancel actions
- Light mobile UI

## Tech Stack

- React Native
- Expo
- Expo Router
- TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase RPC
- Row Level Security

## Project Structure

```txt
app/
  _layout.tsx
  group-confirmation.tsx
  login.tsx
  signup.tsx

  (tabs)/
    _layout.tsx
    menu.tsx
    cart.tsx
    profile.tsx

    orders/
      _layout.tsx
      index.tsx
      [orderId].tsx

src/
  lib/
    supabase.ts
    activeGroupOrder.ts
    orders.ts
```

## Getting Started

Install dependencies:

```bash
npm install
```

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Start the app:

```bash
npx expo start
```

Clear the Expo cache if needed:

```bash
npx expo start -c
```

## Supabase Schema

The app expects these tables:

```txt
profiles
menu_items
group_orders
group_members
cart_items
orders
order_items
```

Key relationships:

```txt
group_orders.id
  -> group_members.group_order_id
  -> cart_items.group_order_id
  -> orders.group_order_id
```

Important columns:

```txt
group_orders:
  id
  name
  host_user_id
  invite_code
  status
  checked_out_at
  created_at

group_members:
  id
  group_order_id
  user_id
  invited_email
  role
  status
  created_at

menu_items:
  id
  name
  description
  category
  price_cents
  image_emoji
  is_available

cart_items:
  id
  group_order_id
  user_id
  menu_item_id
  quantity
  created_at

orders:
  id
  group_order_id
  host_user_id
  status
  total_cents
  created_at

order_items:
  id
  order_id
  menu_item_id
  name
  quantity
  price_cents
  created_at
```

## Required RPC

The app uses this Supabase RPC for checkout:

```txt
checkout_group_order
```

Expected argument:

```txt
p_group_order_id uuid
```

Client usage:

```ts
await supabase.rpc("checkout_group_order", {
  p_group_order_id: activeGroupOrder.id,
});
```

The RPC should verify the current user is the host, create an order, copy cart items into order items, calculate the total, and mark the group order as checked out.

## Main User Flow

Host:

```txt
Sign up / log in
Create group order
Share invite code
Review group cart
Checkout order
View order history
Complete or cancel order
```

Guest:

```txt
Sign up / log in
Join with invite code
Add menu items
Edit own cart items
Wait for host checkout
View order history
```

## Routes

```txt
/login
/signup
/group-confirmation

/(tabs)/menu
/(tabs)/cart
/(tabs)/orders
/(tabs)/orders/[orderId]
/(tabs)/profile
```

## RLS Notes

Row Level Security should ensure:

```txt
Users can only edit their own cart items.
Only group members can read group cart items.
Only hosts can checkout group orders.
Only hosts can complete or cancel orders.
Users cannot add items after checkout.
```

Recommended order status protection:

```sql
alter table public.orders enable row level security;

drop policy if exists "hosts can update their own orders" on public.orders;

create policy "hosts can update their own orders"
on public.orders
for update
to authenticated
using (
  host_user_id = auth.uid()
  and status = 'placed'
)
with check (
  host_user_id = auth.uid()
  and status in ('completed', 'cancelled')
);

revoke update on public.orders from authenticated;

grant update (status)
on public.orders
to authenticated;
```

## Testing Checklist

Test with two accounts:

```txt
Host can create a group order.
Guest can join with invite code.
Guest can add and edit their own items.
Host can see all cart items.
Guest cannot checkout.
Host can checkout.
Order appears in Orders tab.
Host can complete or cancel the order.
Guest cannot complete or cancel the order.
Cart is locked after checkout.
```

## Future Improvements

- Realtime cart updates
- Email invites
- Push notifications
- Better guest display names
- Host ability to remove guest items
- Admin menu management
- Payment integration

## Known Assumptions

This app assumes:

```txt
The host column is group_orders.host_user_id.
Active group orders have checked_out_at = null.
Cart items use cart_items.group_order_id.
Orders use orders.group_order_id.
The checkout RPC is checkout_group_order.
The RPC argument is p_group_order_id.
```

## License

Personal and portfolio use.
