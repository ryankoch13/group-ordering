import { supabase } from "@/lib/supabase";

export type ActiveGroupOrder = {
  id: string;
  name: string;
  hostUserId: string;
  inviteCode: string;
  status: "open" | "checked_out" | "cancelled";
  createdAt: string;
  checkedOutAt: string | null;
  role: "host" | "guest";
};

type GroupOrderRow = {
  id: string;
  name: string;
  host_user_id: string;
  invite_code: string;
  status: "open" | "checked_out" | "cancelled";
  created_at: string;
  checked_out_at: string | null;
};

type GroupMemberWithOrderRow = {
  role: "host" | "guest";
  group_order: GroupOrderRow | GroupOrderRow[] | null;
};

function resolveGroupOrder(
  value: GroupOrderRow | GroupOrderRow[] | null,
): GroupOrderRow | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function mapActiveGroupOrder(
  group: GroupOrderRow,
  role: "host" | "guest",
): ActiveGroupOrder {
  return {
    id: group.id,
    name: group.name,
    hostUserId: group.host_user_id,
    inviteCode: group.invite_code,
    status: group.status,
    createdAt: group.created_at,
    checkedOutAt: group.checked_out_at,
    role,
  };
}

export async function getActiveGroupOrderForCurrentUser(): Promise<{
  group: ActiveGroupOrder | null;
  currentUserId: string | null;
}> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return {
      group: null,
      currentUserId: null,
    };
  }

  const { data, error } = await supabase
    .from("group_members")
    .select(
      `
      role,
      group_order:group_orders (
        id,
        name,
        host_user_id,
        invite_code,
        status,
        created_at,
        checked_out_at
      )
    `,
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = data as GroupMemberWithOrderRow | null;
  const group = resolveGroupOrder(row?.group_order ?? null);

  return {
    group: group ? mapActiveGroupOrder(group, row?.role ?? "guest") : null,
    currentUserId: user.id,
  };
}

export async function createHostedGroupOrder(name: string): Promise<{
  group: ActiveGroupOrder;
  currentUserId: string;
}> {
  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error("Please enter a group order name.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("You must be signed in to create a group order.");
  }

  const { data, error } = await supabase
    .rpc("create_hosted_group_order", {
      p_name: cleanName,
    })
    .single();

  if (error) {
    console.log("CREATE GROUP ORDER ERROR:", error);
    throw error;
  }

  const group = data as {
    id: string;
    name: string;
    host_user_id: string;
    invite_code: string;
    status: "open" | "checked_out" | "cancelled";
    created_at: string;
    checked_out_at: string | null;
    role: "host" | "guest";
  };

  return {
    group: {
      id: group.id,
      name: group.name,
      hostUserId: group.host_user_id,
      inviteCode: group.invite_code,
      status: group.status,
      createdAt: group.created_at,
      checkedOutAt: group.checked_out_at,
      role: group.role,
    },
    currentUserId: user.id,
  };
}
