import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const SESSION_RECHECK_MS = 5 * 60 * 1000;

class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // Only revealed after the password checked out, so this can't be used
        // to discover which emails are registered.
        if (!user.emailVerified) throw new EmailNotVerifiedError();

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    // A JWT stays valid until it expires, even if the account is deleted or
    // unverified in the meantime. Re-check the user every few minutes and end
    // the session when it no longer exists (returning null signs the person out).
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.checkedAt = Date.now();
        return token;
      }

      const checkedAt = typeof token.checkedAt === "number" ? token.checkedAt : 0;
      if (token.id && Date.now() - checkedAt > SESSION_RECHECK_MS) {
        const current = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { emailVerified: true },
        });
        if (!current || !current.emailVerified) return null;
        token.checkedAt = Date.now();
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
