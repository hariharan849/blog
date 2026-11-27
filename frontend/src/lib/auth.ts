import "server-only";
import { getServerSession, type NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";

/**
 * Sign-in is GitHub OAuth, restricted to the logins in ADMIN_GITHUB_LOGINS
 * (comma-separated). Anyone else is refused at sign-in.
 */
const admins = (process.env.ADMIN_GITHUB_LOGINS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID ?? "",
      clientSecret: process.env.GITHUB_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/admin", error: "/admin" },
  callbacks: {
    signIn({ profile }) {
      const login = String((profile as { login?: string } | undefined)?.login ?? "").toLowerCase();
      return admins.length > 0 && admins.includes(login);
    },
    jwt({ token, profile }) {
      if (profile) token.login = String((profile as { login?: string }).login ?? "").toLowerCase();
      return token;
    },
    session({ session, token }) {
      if (session.user) (session.user as { login?: string }).login = token.login as string | undefined;
      return session;
    },
  },
};

export async function getAdmin() {
  const session = await getServerSession(authOptions);
  const login = (session?.user as { login?: string } | undefined)?.login?.toLowerCase();
  return login && admins.includes(login) ? { login, name: session?.user?.name ?? login } : null;
}

export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) throw new Error("Unauthorized");
  return admin;
}
