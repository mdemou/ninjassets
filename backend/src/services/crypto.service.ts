import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface IHash {
  hash: string;
  salt: string;
}

const SALT_ROUNDS = 10;

const cryptoService = {
  async hashValue(plaintext: string, salt?: string): Promise<IHash> {
    const generatedSalt = salt || (await bcrypt.genSalt(SALT_ROUNDS));
    const hash = await bcrypt.hash(plaintext, generatedSalt);
    return { hash, salt: generatedSalt };
  },

  async compareWithHashedPassword(raw: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(raw, hashed);
  },

  timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  },

  generateStrongPassword(): string {
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    const all = lower + upper + digits;

    const pick = (str: string) => str[crypto.randomInt(str.length)];

    // Ensure at least one lower, one upper, one digit
    const password = [pick(lower), pick(upper), pick(digits)];

    // Fill remaining (5 chars to make 8) with random allowed chars
    for (let i = 3; i < 8; i++) {
      password.push(pick(all));
    }

    // Shuffle to avoid predictable position of character classes
    for (let i = password.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [password[i], password[j]] = [password[j], password[i]];
    }

    return password.join('');
  },

  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  },

  /** Deterministic SHA-256 hex digest — used to store/look up opaque tokens by hash. */
  sha256Hex(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  },
};

export default cryptoService;
