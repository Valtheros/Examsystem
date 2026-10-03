"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient, usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  // Use this page's origin so the session cookie stays on the hostname being visited.
  plugins: [usernameClient(), adminClient()],
});
