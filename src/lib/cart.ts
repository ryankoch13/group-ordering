import { supabase } from "@/lib/supabase";
import type { CartItem, MenuItem } from "@/types/shop";

type MenuItemRow = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  category: string;
  image_emoji: string;
};

type CartItemRow = {
  id: string;
  group_order_id: string;
  user_id: string;
  menu_item_id: string;
  quantity: number;
  menu_item: MenuItemRow | MenuItemRow[] | null;
};

function resolveMenuItem(
  value: MenuItemRow | MenuItemRow[] | null,
): MenuItemRow | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function mapMenuItem(row: MenuItemRow): MenuItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    category: row.category,
    imageEmoji: row.image_emoji,
  };
}

function mapCartItem(row: CartItemRow): CartItem {
  const menuItem = resolveMenuItem(row.menu_item);

  if (!menuItem) {
    throw new Error("Cart item is missing menu item data.");
  }

  return {
    menuItem: mapMenuItem(menuItem),
    quantity: row.quantity,
  };
}

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error("You must be signed in to update your cart.");
  }

  return user.id;
}

export async function getCartItemsForCurrentUser(
  groupOrderId: string,
): Promise<CartItem[]> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("cart_items")
    .select(
      `
      id,
      group_order_id,
      user_id,
      menu_item_id,
      quantity,
      menu_item:menu_items (
        id,
        name,
        description,
        price_cents,
        category,
        image_emoji
      )
    `,
    )
    .eq("group_order_id", groupOrderId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as CartItemRow[]).map(mapCartItem);
}

export async function addMenuItemToCart(
  groupOrderId: string,
  menuItemId: string,
): Promise<CartItem[]> {
  const userId = await getCurrentUserId();

  const { data: existingItem, error: existingError } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("group_order_id", groupOrderId)
    .eq("user_id", userId)
    .eq("menu_item_id", menuItemId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingItem) {
    const { error } = await supabase
      .from("cart_items")
      .update({
        quantity: existingItem.quantity + 1,
      })
      .eq("id", existingItem.id);

    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabase.from("cart_items").insert({
      group_order_id: groupOrderId,
      user_id: userId,
      menu_item_id: menuItemId,
      quantity: 1,
    });

    if (error) {
      throw error;
    }
  }

  return getCartItemsForCurrentUser(groupOrderId);
}

export async function setMenuItemCartQuantity(
  groupOrderId: string,
  menuItemId: string,
  quantity: number,
): Promise<CartItem[]> {
  const userId = await getCurrentUserId();

  if (quantity <= 0) {
    return removeMenuItemFromCart(groupOrderId, menuItemId);
  }

  const { error } = await supabase
    .from("cart_items")
    .update({
      quantity,
    })
    .eq("group_order_id", groupOrderId)
    .eq("user_id", userId)
    .eq("menu_item_id", menuItemId);

  if (error) {
    throw error;
  }

  return getCartItemsForCurrentUser(groupOrderId);
}

export async function increaseMenuItemCartQuantity(
  groupOrderId: string,
  menuItemId: string,
): Promise<CartItem[]> {
  const userId = await getCurrentUserId();

  const { data: existingItem, error: existingError } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("group_order_id", groupOrderId)
    .eq("user_id", userId)
    .eq("menu_item_id", menuItemId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existingItem) {
    const { error } = await supabase.from("cart_items").insert({
      group_order_id: groupOrderId,
      user_id: userId,
      menu_item_id: menuItemId,
      quantity: 1,
    });

    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabase
      .from("cart_items")
      .update({
        quantity: existingItem.quantity + 1,
      })
      .eq("id", existingItem.id);

    if (error) {
      throw error;
    }
  }

  return getCartItemsForCurrentUser(groupOrderId);
}

export async function decreaseMenuItemCartQuantity(
  groupOrderId: string,
  menuItemId: string,
): Promise<CartItem[]> {
  const userId = await getCurrentUserId();

  const { data: existingItem, error: existingError } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("group_order_id", groupOrderId)
    .eq("user_id", userId)
    .eq("menu_item_id", menuItemId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existingItem) {
    return getCartItemsForCurrentUser(groupOrderId);
  }

  if (existingItem.quantity <= 1) {
    const { error } = await supabase
      .from("cart_items")
      .delete()
      .eq("id", existingItem.id);

    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabase
      .from("cart_items")
      .update({
        quantity: existingItem.quantity - 1,
      })
      .eq("id", existingItem.id);

    if (error) {
      throw error;
    }
  }

  return getCartItemsForCurrentUser(groupOrderId);
}

export async function removeMenuItemFromCart(
  groupOrderId: string,
  menuItemId: string,
): Promise<CartItem[]> {
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("group_order_id", groupOrderId)
    .eq("user_id", userId)
    .eq("menu_item_id", menuItemId);

  if (error) {
    throw error;
  }

  return getCartItemsForCurrentUser(groupOrderId);
}

export async function clearCartForCurrentUser(
  groupOrderId: string,
): Promise<void> {
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("group_order_id", groupOrderId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}
