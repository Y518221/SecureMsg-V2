-- 1. Create Users table (Public profile)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  secure_id TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Groups table
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Group Members table
CREATE TABLE public.group_members (
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

-- 4. Create Messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  content_encrypted TEXT NOT NULL,
  iv TEXT NOT NULL,
  salt TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Files table
CREATE TABLE public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT,
  mime_type TEXT,
  data_encrypted BYTEA,
  iv TEXT,
  salt TEXT,
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON public.messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_group_id ON public.messages(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);

-- Enable Realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Reset policies (safe for re-runs)
DROP POLICY IF EXISTS users_self_read ON public.users;
DROP POLICY IF EXISTS groups_member_or_owner_read ON public.groups;
DROP POLICY IF EXISTS groups_owner_insert ON public.groups;
DROP POLICY IF EXISTS groups_owner_delete ON public.groups;
DROP POLICY IF EXISTS group_members_member_or_owner_read ON public.group_members;
DROP POLICY IF EXISTS group_members_self_join ON public.group_members;
DROP POLICY IF EXISTS group_members_self_leave ON public.group_members;
DROP POLICY IF EXISTS messages_participant_read ON public.messages;
DROP POLICY IF EXISTS messages_sender_insert ON public.messages;
DROP POLICY IF EXISTS messages_sender_delete ON public.messages;

-- USERS
CREATE POLICY users_self_read ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- GROUPS
CREATE POLICY groups_member_or_owner_read ON public.groups
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = groups.id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY groups_owner_insert ON public.groups
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY groups_owner_delete ON public.groups
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- GROUP MEMBERS
CREATE POLICY group_members_member_or_owner_read ON public.group_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_members.group_id AND g.owner_id = auth.uid()
    )
  );

CREATE POLICY group_members_self_join ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY group_members_self_leave ON public.group_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- MESSAGES
CREATE POLICY messages_participant_read ON public.messages
  FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR receiver_id = auth.uid()
    OR (
      group_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = messages.group_id AND g.owner_id = auth.uid()
      )
    )
    OR (
      group_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = messages.group_id AND gm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY messages_sender_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      (group_id IS NULL AND receiver_id IS NOT NULL)
      OR (
        group_id IS NOT NULL
        AND (
          EXISTS (
            SELECT 1 FROM public.groups g
            WHERE g.id = messages.group_id AND g.owner_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = messages.group_id AND gm.user_id = auth.uid()
          )
        )
      )
    )
  );

CREATE POLICY messages_sender_delete ON public.messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- Backend uses service_role and bypasses these policies for trusted server operations.
