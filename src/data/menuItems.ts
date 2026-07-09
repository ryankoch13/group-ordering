import { supabase } from "@/lib/supabase";
import type { MenuItem } from "@/types/shop";

type MenuItemRow = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  category: string;
  image_emoji: string;
};

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

export async function getMenuItems(): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, description, price_cents, category, image_emoji")
    .eq("is_available", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapMenuItem);
}
