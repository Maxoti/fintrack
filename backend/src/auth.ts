import { Router, type NextFunction, type Request, type Response } from "express";
import { compare, hash } from "bcryptjs";
import { sign, verify, type JwtPayload } from "jsonwebtoken";
import { query } from "./db";
import { conflict, unauthorized } from "./errors";
import { asText, bodyOf, handle, invalid, isPgError } from "./http";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Valid bcrypt hash used to keep login timing similar when the email is unknown.
const DUMMY_HASH = "$2b$10$ZpVit1ieAG3kv25TwBlrSOMJ1Qw.xxFem5IzNUh58oOih0eRQsYgy";

function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error("JWT_SECRET must be set (at least 16 characters)");
  return s;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone: string | null;
}

const publicUser = (u: UserRow) => ({
  id: u.id,
  email: u.email,
  name: u.full_name,
  phone: u.phone,
});

const signToken = (u: UserRow): string =>
  sign({ email: u.email }, jwtSecret(), { subject: u.id, expiresIn: TOKEN_TTL_SECONDS });

/** Returns the signed-in user's id. Only call after requireAuth. */
export function userId(req: Request): string {
  if (!req.user) throw unauthorized();
  return req.user.id;
}

// ---------- Middleware ----------

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const [scheme, token] = (req.headers.authorization ?? "").split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    next(unauthorized("Missing or malformed Authorization header"));
    return;
  }

  const secret = jwtSecret();
  let payload: JwtPayload;
  try {
    payload = verify(token, secret, { algorithms: ["HS256"] }) as JwtPayload;
    if (!payload.sub) throw new Error("token has no subject");
  } catch {
    next(unauthorized("Invalid or expired token"));
    return;
  }

  req.user = { id: payload.sub as string, email: String(payload.email ?? "") };
  next();
}

// ---------- Validation ----------

function asEmail(v: unknown): string {
  const email = asText(v, "email", 254).toLowerCase(); // DB requires lowercase
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalid("email", "email is not valid");
  return email;
}

/** At least 8 characters with a letter and a number (bcrypt only uses 72 bytes). */
function asNewPassword(v: unknown): string {
  if (
    typeof v !== "string" ||
    v.length < 8 ||
    Buffer.byteLength(v) > 72 ||
    !/[A-Za-z]/.test(v) ||
    !/[0-9]/.test(v)
  ) {
    throw invalid("password", "password must be 8 to 72 characters with a letter and a number");
  }
  return v;
}

/** Optional phone. Accepts 07XXXXXXXX, 2547XXXXXXXX or +E.164; stores E.164. */
function asPhone(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string") throw invalid("phone", "phone must be a string");
  const raw = v.replace(/[\s-]/g, "");
  let phone: string;
  if (/^0[17]\d{8}$/.test(raw)) phone = `+254${raw.slice(1)}`;
  else if (/^254[17]\d{8}$/.test(raw)) phone = `+${raw}`;
  else phone = raw;
  if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) {
    throw invalid("phone", "phone must be a valid number, e.g. 0712345678");
  }
  return phone;
}

// ---------- Routes ----------

export const authRouter = Router();

// POST /auth/register -> 201 { user }  (log in afterwards to get a token)
authRouter.post(
  "/register",
  handle(async (req, res) => {
    const body = bodyOf(req);
    const name = asText(body.name, "name", 120);
    const email = asEmail(body.email);
    const password = asNewPassword(body.password);
    const phone = asPhone(body.phone);
    const passwordHash = await hash(password, 10);

    try {
      const { rows } = await query<UserRow>(
        `INSERT INTO users (email, password_hash, full_name, phone)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, password_hash, full_name, phone`,
        [email, passwordHash, name, phone],
      );
      res.status(201).json({ user: publicUser(rows[0]!) });
    } catch (err) {
      if (isPgError(err, "23505")) throw conflict("An account with this email already exists");
      throw err;
    }
  }),
);

// POST /auth/login -> 200 { token, user }
authRouter.post(
  "/login",
  handle(async (req, res) => {
    const body = bodyOf(req);
    const email = asEmail(body.email);
    if (typeof body.password !== "string" || body.password.length === 0) {
      throw invalid("password", "password is required");
    }

    const { rows } = await query<UserRow>(
      `SELECT id, email, password_hash, full_name, phone FROM users WHERE email = $1`,
      [email],
    );
    const user = rows[0];
    const ok = await compare(body.password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !ok) throw unauthorized("Invalid email or password");

    res.json({ token: signToken(user), user: publicUser(user) });
  }),
);